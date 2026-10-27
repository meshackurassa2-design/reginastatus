import * as FileSystem from 'expo-file-system/legacy';

export interface VideoProcessingOptions {
  trimStartMillis?: number;
  trimEndMillis?: number;
  watermarkText?: string;
  musicUri?: string | null;
  videoVolume?: number;
  musicVolume?: number;
}

export interface ProcessResult {
  success: boolean;
  outputUris: string[];
  error?: string;
}

/**
 * WhatsApp "sweet spot" settings.
 * The idea (same as Pure Status): hand WhatsApp a file that already matches what
 * its HD status pipeline wants, so it applies little or no extra compression.
 */
export const STATUS_CONFIG = {
  /** Longest side in pixels. WhatsApp HD status is 720p (1280 x 720). */
  maxDimension: 1280,
  /** Length of each status clip in seconds. */
  segmentSeconds: 30,
  /** Output frame rate. */
  fps: 30,
  /** x264 quality (lower = better). 20-22 is visually near-transparent at 720p. */
  crf: 21,
  /** Bitrate ceiling so files stay under WhatsApp's re-compression threshold. */
  maxRate: '3M',
  bufSize: '6M',
  /**
   * x264 speed/quality trade-off. 'ultrafast' wastes bits (blocky video);
   * 'fast' gives much better quality per bit while staying reasonable on phones.
   */
  preset: 'fast',
  audioBitrate: '128k',
  audioSampleRate: 44100,
};

const getCacheDir = () => (FileSystem as any).cacheDirectory as string;
const toFfmpegPath = (uri: string) => uri.replace('file://', '');

/** Loads and initializes ffmpeg-kit-extended (requires a dev/native build, not Expo Go). */
const getFfmpeg = () => {
  const { FFmpegKitExtended, FFmpegKit, isSuccessReturnCode } = require('ffmpeg-kit-extended');
  // The TurboModule requires initialization before use
  FFmpegKitExtended.initialize();
  return { FFmpegKit, isSuccessReturnCode };
};

/** Best-effort file extension from a URI, used so FFmpeg detects the format correctly. */
const getExtension = (uri: string, fallback: string) => {
  const clean = uri.split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : fallback;
};

/**
 * Resolves any URI (ph://, assets-library://, content://, file://) to a local cache path.
 * We ALWAYS copy the file to the app's cache directory first to guarantee
 * that FFmpeg has sandbox read permissions, preventing native crash.
 */
const resolveUri = async (uri: string, name: string, extension: string): Promise<string> => {
  if (!uri) throw new Error('Empty URI provided');

  const dest = `${getCacheDir()}${name}.${extension}`;

  // Delete existing
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) await FileSystem.deleteAsync(dest, { idempotent: true });

  await FileSystem.copyAsync({ from: uri, to: dest });

  return dest;
};

const ensureOutputDir = async () => {
  const outputDir = getCacheDir() + 'reginastatus_exports/';
  const dirInfo = await FileSystem.getInfoAsync(outputDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
  }
  return outputDir;
};

/** Ensure font for watermark exists and return an FFmpeg-friendly path. */
const ensureFont = async () => {
  const fontPath = getCacheDir() + 'Roboto.ttf';
  const fontInfo = await FileSystem.getInfoAsync(fontPath);
  if (!fontInfo.exists) {
    const { robotoBase64 } = require('./RobotoBase64');
    await FileSystem.writeAsStringAsync(fontPath, robotoBase64, { encoding: FileSystem.EncodingType.Base64 });
  }
  return toFfmpegPath(fontPath);
};

/**
 * Scale so the longest side is at most STATUS_CONFIG.maxDimension, preserving aspect ratio.
 * Lanczos keeps edges and text sharper than the default bicubic scaler.
 */
const buildScaleFilter = () => {
  const max = STATUS_CONFIG.maxDimension;
  return `scale='w=if(gt(iw,ih),min(iw,${max}),-2):h=if(gt(iw,ih),-2,min(ih,${max}))':flags=lanczos`;
};

/** Watermark (brand + optional "by name") drawn with drawtext. */
const buildWatermarkFilters = (fontPathForFfmpeg: string, watermarkText: string) => {
  const customName = watermarkText !== 'ReginaStatus' ? watermarkText.replace('ReginaStatus • ', '') : '';
  const yBase = customName ? 80 : 50;

  const badgeFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='HD':fontcolor=black:fontsize=16:box=1:boxcolor=white:boxborderw=6:x=w-tw-240:y=h-th-${yBase + 34}`;
  const titleFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='ReginaStatus':fontcolor=white:fontsize=32:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-${yBase + 28}`;
  const subtitleFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='Upload Status in Full HD':fontcolor=white@0.9:fontsize=20:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-${yBase}`;

  let filters = `${badgeFilter},${titleFilter},${subtitleFilter}`;

  if (customName) {
    const sanitizedName = customName.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
    const nameFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='by ${sanitizedName}':fontcolor=#FFD700:fontsize=22:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-30`;
    filters += `,${nameFilter}`;
  }

  return filters;
};

const tailLogs = async (session: any) => {
  try {
    const logs: string = await session.getLogsAsString();
    return logs ? logs.substring(Math.max(0, logs.length - 300)) : '';
  } catch (_) {
    return '';
  }
};

/**
 * Main video processing function.
 * Trims, watermarks, mixes audio, re-encodes to WhatsApp's HD sweet spot,
 * and splits into exact STATUS_CONFIG.segmentSeconds clips.
 */
export const compressAndSplitVideo = async (
  inputUri: string,
  durationMillis: number,
  options: VideoProcessingOptions = {}
): Promise<ProcessResult> => {
  try {
    const { FFmpegKit, isSuccessReturnCode } = getFfmpeg();
    const cfg = STATUS_CONFIG;

    const {
      trimStartMillis = 0,
      trimEndMillis = durationMillis,
      watermarkText = 'ReginaStatus',
      musicUri = null,
      videoVolume = 1.0,
      musicVolume = 1.0,
    } = options;

    // Resolve input URI to a real file path
    const safeInput = await resolveUri(inputUri, 'rs_input_video', getExtension(inputUri, 'mp4'));
    const inputForFfmpeg = toFfmpegPath(safeInput);

    const outputDir = await ensureOutputDir();
    const timestamp = Date.now();
    const outputPattern = `${toFfmpegPath(outputDir)}output_${timestamp}_%03d.mp4`;

    // Only apply -t when we have a valid trim range. If the editor hadn't loaded the
    // duration yet (trimEnd = 0), the old code exported a 1-second clip.
    const startSec = Math.max(0, trimStartMillis / 1000);
    const endSec = trimEndMillis / 1000;
    const hasValidEnd = endSec > startSec + 0.1;
    const trimArgs = `${startSec > 0 ? `-ss ${startSec.toFixed(3)} ` : ''}${hasValidEnd ? `-t ${(endSec - startSec).toFixed(3)} ` : ''}`;

    // Build inputs
    let inputs = `${trimArgs}-i "${inputForFfmpeg}"`;

    let musicForFfmpeg: string | null = null;
    if (musicUri) {
      try {
        const safeMusic = await resolveUri(musicUri, 'rs_input_music', getExtension(musicUri, 'mp3'));
        musicForFfmpeg = toFfmpegPath(safeMusic);
        // Loop the song so it covers the whole video if it's shorter
        inputs += ` -stream_loop -1 -i "${musicForFfmpeg}"`;
      } catch (_) {
        musicForFfmpeg = null;
      }
    }

    const fontPathForFfmpeg = await ensureFont();
    const videoFilter = `${buildScaleFilter()},${buildWatermarkFilters(fontPathForFfmpeg, watermarkText)}`;

    let filterComplex: string;
    if (musicForFfmpeg) {
      filterComplex = `[0:v]${videoFilter}[vout];[0:a]volume=${videoVolume}[a1];[1:a]volume=${musicVolume}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
    } else if (videoVolume !== 1.0) {
      filterComplex = `[0:v]${videoFilter}[vout];[0:a]volume=${videoVolume}[aout]`;
    } else {
      filterComplex = `[0:v]${videoFilter}[vout]`;
    }

    // Map outputs
    let maps = `-map "[vout]"`;
    if (musicForFfmpeg || videoVolume !== 1.0) {
      maps += ` -map "[aout]"`;
    } else {
      maps += ` -map 0:a?`;
    }

    const seg = cfg.segmentSeconds;

    // PURE STATUS ALGORITHM:
    // - max 1280p, lanczos scaling, libx264 'fast' preset, CRF + bitrate ceiling
    // - 30fps, yuv420p, main profile: avoids WhatsApp's fps/HDR recompression triggers
    // - force a keyframe exactly every `seg` seconds so the segment muxer cuts clips at
    //   exactly 30s. Without this, clips could overrun and WhatsApp would trim/re-encode them.
    // NOTE: Do not add a global -movflags +faststart; it corrupts the -f segment output (black, unplayable videos).
    const ffmpegCommand = [
      inputs,
      `-filter_complex "${filterComplex}"`,
      maps,
      `-c:v libx264 -preset ${cfg.preset} -crf ${cfg.crf} -maxrate ${cfg.maxRate} -bufsize ${cfg.bufSize}`,
      `-r ${cfg.fps} -g ${cfg.fps * 2} -pix_fmt yuv420p -profile:v main`,
      `-force_key_frames "expr:gte(t,n_forced*${seg})"`,
      `-c:a aac -b:a ${cfg.audioBitrate} -ar ${cfg.audioSampleRate} -ac 2`,
      `-f segment -segment_time ${seg} -segment_time_delta 0.05 -reset_timestamps 1`,
      `"${outputPattern}"`,
    ].join(' ');

    console.log('[ReginaStatus] FFmpeg command:', ffmpegCommand);

    const session = await FFmpegKit.executeAsync(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (isSuccessReturnCode(returnCode)) {
      const files = await FileSystem.readDirectoryAsync(outputDir);
      const generatedFiles = files
        .filter(f => f.startsWith(`output_${timestamp}_`))
        .sort()
        .map(f => `${outputDir}${f}`);

      if (generatedFiles.length === 0) {
        return { success: false, outputUris: [], error: 'FFmpeg ran but produced no output files.' };
      }

      return { success: true, outputUris: generatedFiles };
    } else {
      const logs = await tailLogs(session);
      console.error('[ReginaStatus] FFmpeg failed:', logs);
      return {
        success: false,
        outputUris: [],
        error: 'Video processing failed with FFmpeg error. ' + logs,
      };
    }
  } catch (err: any) {
    console.error('[ReginaStatus] VideoProcessor error:', err);
    return {
      success: false,
      outputUris: [],
      error: err?.message ?? 'Unknown video processing error.',
    };
  }
};

export const processPhoto = async (
  inputUri: string,
  watermarkText: string = 'ReginaStatus'
): Promise<{ success: boolean; outputUri?: string; error?: string }> => {
  try {
    // Previously these were never imported here, so every photo export crashed.
    const { FFmpegKit, isSuccessReturnCode } = getFfmpeg();

    const safeInput = await resolveUri(inputUri, `rs_input_photo_${Date.now()}`, getExtension(inputUri, 'jpg'));
    const inputForFfmpeg = toFfmpegPath(safeInput);

    const outputDir = await ensureOutputDir();
    const timestamp = Date.now();
    const outputPath = `${outputDir}output_photo_${timestamp}.jpg`;
    const outputForFfmpeg = toFfmpegPath(outputPath);

    const fontPathForFfmpeg = await ensureFont();
    const videoFilter = `${buildScaleFilter()},${buildWatermarkFilters(fontPathForFfmpeg, watermarkText)}`;

    // -q:v 2 = very high JPEG quality; -frames:v 1 guarantees a single image output
    const ffmpegCommand = `-i "${inputForFfmpeg}" -vf "${videoFilter}" -frames:v 1 -q:v 2 -y "${outputForFfmpeg}"`;

    console.log('[ReginaStatus] FFmpeg Photo command:', ffmpegCommand);

    const session = await FFmpegKit.executeAsync(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (isSuccessReturnCode(returnCode)) {
      return { success: true, outputUri: outputPath };
    } else {
      const logs = await tailLogs(session);
      console.error('[ReginaStatus] FFmpeg Photo failed:', logs);
      return {
        success: false,
        error: 'Photo processing failed with FFmpeg error. ' + logs,
      };
    }
  } catch (err: any) {
    console.error('[ReginaStatus] PhotoProcessor error:', err);
    return {
      success: false,
      error: err?.message ?? 'Unknown photo processing error.',
    };
  }
};
