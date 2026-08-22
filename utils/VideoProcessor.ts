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
 * Resolves any URI (ph://, assets-library://, file://) to a local cache path.
 * We ALWAYS copy the file to the app's cache directory first to guarantee
 * that FFmpeg has sandbox read permissions, preventing native crash.
 */
const resolveUri = async (uri: string, name: string): Promise<string> => {
  if (!uri) throw new Error('Empty URI provided');

  const cacheDir = (FileSystem as any).cacheDirectory as string;
  const dest = `${cacheDir}${name}.mp4`;

  // Delete existing
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
  
  await FileSystem.copyAsync({ from: uri, to: dest });

  return dest;
};

/**
 * Main video processing function.
 * Trims, watermarks, adjusts audio, and splits video into 30s chunks.
 */
export const compressAndSplitVideo = async (
  inputUri: string,
  durationMillis: number,
  options: VideoProcessingOptions = {}
): Promise<ProcessResult> => {
  try {
    const { FFmpegKitExtended, FFmpegKit, isSuccessReturnCode } = require('ffmpeg-kit-extended');
    
    // The new TurboModule requires initialization before use
    FFmpegKitExtended.initialize();

    const {
      trimStartMillis = 0,
      trimEndMillis = durationMillis,
      watermarkText = 'ReginaStatus',
      musicUri = null,
      videoVolume = 1.0,
      musicVolume = 1.0,
    } = options;

    // Resolve input URI to a real file path
    const safeInput = await resolveUri(inputUri, 'rs_input_video');
    const inputForFfmpeg = safeInput.replace('file://', '');

    // Set up output directory
    const outputDir = ((FileSystem as any).cacheDirectory as string) + 'reginastatus_exports/';
    const dirInfo = await FileSystem.getInfoAsync(outputDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
    }

    const timestamp = Date.now();
    const outputPattern = `${outputDir.replace('file://', '')}output_${timestamp}_%03d.mp4`;

    const startSec = trimStartMillis / 1000;
    const endSec = trimEndMillis / 1000;
    const durationSec = Math.max(endSec - startSec, 1);

    // Build inputs
    let inputs = `-ss ${startSec} -t ${durationSec} -i "${inputForFfmpeg}"`;

    let musicForFfmpeg: string | null = null;
    if (musicUri) {
      try {
        const safeMusic = await resolveUri(musicUri, 'rs_input_music');
        musicForFfmpeg = safeMusic.replace('file://', '');
        inputs += ` -i "${musicForFfmpeg}"`;
      } catch (_) {
        musicForFfmpeg = null;
      }
    }

    // Ensure font for watermark exists
    const fontPath = ((FileSystem as any).cacheDirectory as string) + 'Roboto.ttf';
    const fontInfo = await FileSystem.getInfoAsync(fontPath);
    if (!fontInfo.exists) {
      const { robotoBase64 } = require('./RobotoBase64');
      await FileSystem.writeAsStringAsync(fontPath, robotoBase64, { encoding: FileSystem.EncodingType.Base64 });
    }
    const fontPathForFfmpeg = fontPath.replace('file://', '');

    let filterComplex = '';
    const customName = watermarkText !== 'ReginaStatus' ? watermarkText.replace('ReginaStatus • ', '') : '';
    
    // Scale to max 1280px on the longest side to preserve aspect ratio (fixes black bars and low quality)
    const scaleFilter = `scale='w=if(gt(iw,ih),min(iw,1280),-2):h=if(gt(iw,ih),-2,min(ih,1280))'`;

    const yBase = customName ? 80 : 50;

    const badgeFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='HD':fontcolor=black:fontsize=16:box=1:boxcolor=white:boxborderw=6:x=w-tw-240:y=h-th-${yBase + 34}`;
    
    const titleFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='ReginaStatus':fontcolor=white:fontsize=32:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-${yBase + 28}`;
    
    const subtitleFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='Upload Status in Full HD':fontcolor=white@0.9:fontsize=20:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-${yBase}`;

    let videoFilter = `${scaleFilter},${badgeFilter},${titleFilter},${subtitleFilter}`;

    if (customName) {
      const sanitizedName = customName.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
      const nameFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='by ${sanitizedName}':fontcolor=#FFD700:fontsize=22:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-30`;
      videoFilter += `,${nameFilter}`;
    }

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

    // PURE STATUS ALGORITHM: max 1280p scaling, libx264, -crf 22, strict bitrate limits, segment 30s
    // Added -r 30, -pix_fmt yuv420p, -profile:v main to strictly bypass WhatsApp's fps/HDR recompression triggers
    // NOTE: Removed -movflags +faststart because it corrupts the -f segment output, resulting in black unplayable videos!
    const ffmpegCommand = `${inputs} -filter_complex "${filterComplex}" ${maps} -c:v libx264 -crf 22 -maxrate 3.0M -bufsize 6.0M -preset ultrafast -r 30 -pix_fmt yuv420p -profile:v main -c:a aac -b:a 128k -ar 44100 -f segment -segment_time 30 -reset_timestamps 1 "${outputPattern}"`;

    console.log('[ReginaStatus] FFmpeg command:', ffmpegCommand);

    const session = await FFmpegKit.executeAsync(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (isSuccessReturnCode(returnCode)) {
      const files = await FileSystem.readDirectoryAsync(outputDir);
      const generatedFiles = files
        .filter(f => f.startsWith(`output_${timestamp}_`))
        .sort()
        .map(f => `file://${outputDir}${f}`);

      if (generatedFiles.length === 0) {
        return { success: false, outputUris: [], error: 'FFmpeg ran but produced no output files.' };
      }

      return { success: true, outputUris: generatedFiles };
    } else {
      const logs = await session.getLogsAsString();
      console.error('[ReginaStatus] FFmpeg failed:', logs);
      return {
        success: false,
        outputUris: [],
        error: 'Video processing failed with FFmpeg error. ' + (logs?.substring(logs.length - 200) ?? ''),
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
    FFmpegKitExtended.initialize();

    const safeInput = await resolveUri(inputUri, `rs_input_photo_${Date.now()}`);
    const inputForFfmpeg = safeInput.replace('file://', '');

    const outputDir = ((FileSystem as any).cacheDirectory as string) + 'reginastatus_exports/';
    const dirInfo = await FileSystem.getInfoAsync(outputDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
    }

    const timestamp = Date.now();
    const outputPath = `${outputDir}output_photo_${timestamp}.jpg`;
    const outputForFfmpeg = outputPath.replace('file://', '');

    const fontPath = ((FileSystem as any).cacheDirectory as string) + 'Roboto.ttf';
    const fontInfo = await FileSystem.getInfoAsync(fontPath);
    if (!fontInfo.exists) {
      const { robotoBase64 } = require('./RobotoBase64');
      await FileSystem.writeAsStringAsync(fontPath, robotoBase64, { encoding: FileSystem.EncodingType.Base64 });
    }
    const fontPathForFfmpeg = fontPath.replace('file://', '');

    const customName = watermarkText !== 'ReginaStatus' ? watermarkText.replace('ReginaStatus • ', '') : '';
    const scaleFilter = `scale='w=if(gt(iw,ih),min(iw,1280),-2):h=if(gt(iw,ih),-2,min(ih,1280))'`;
    const yBase = customName ? 80 : 50;

    const badgeFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='HD':fontcolor=black:fontsize=16:box=1:boxcolor=white:boxborderw=6:x=w-tw-240:y=h-th-${yBase + 34}`;
    const titleFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='ReginaStatus':fontcolor=white:fontsize=32:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-${yBase + 28}`;
    const subtitleFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='Upload Status in Full HD':fontcolor=white@0.9:fontsize=20:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-${yBase}`;

    let videoFilter = `${scaleFilter},${badgeFilter},${titleFilter},${subtitleFilter}`;

    if (customName) {
      const sanitizedName = customName.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
      const nameFilter = `drawtext=fontfile='${fontPathForFfmpeg}':text='by ${sanitizedName}':fontcolor=#FFD700:fontsize=22:shadowcolor=black@0.6:shadowx=2:shadowy=2:x=w-tw-40:y=h-th-30`;
      videoFilter += `,${nameFilter}`;
    }

    const ffmpegCommand = `-i "${inputForFfmpeg}" -vf "${videoFilter}" -q:v 2 -y "${outputForFfmpeg}"`;
    
    console.log('[ReginaStatus] FFmpeg Photo command:', ffmpegCommand);

    const session = await FFmpegKit.executeAsync(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (isSuccessReturnCode(returnCode)) {
      return { success: true, outputUri: `file://${outputForFfmpeg}` };
    } else {
      const logs = await session.getLogsAsString();
      console.error('[ReginaStatus] FFmpeg Photo failed:', logs);
      return {
        success: false,
        error: 'Photo processing failed with FFmpeg error. ' + (logs?.substring(logs.length - 200) ?? ''),
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
