import * as FileSystem from 'expo-file-system';

// FFmpegKit is imported conditionally to prevent native crash
let FFmpegKit: any = null;
let ReturnCode: any = null;

const loadFFmpeg = async () => {
  if (FFmpegKit) return true;
  try {
    const mod = require('@nikhil-cephei/ffmpeg-kit-react-native');
    FFmpegKit = mod.FFmpegKit;
    ReturnCode = mod.ReturnCode;
    return true;
  } catch (e) {
    console.warn('FFmpegKit not available:', e);
    return false;
  }
};

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
 * Resolves a URI to a local file path that FFmpeg can read.
 * Handles ph:// and file:// URIs.
 */
const resolveToLocalPath = async (uri: string, tempName: string): Promise<string> => {
  if (!uri) throw new Error('Empty URI');

  // ph:// is a Photos framework URI — must copy to cache first
  if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
    const cacheDir = (FileSystem as any).cacheDirectory as string;
    const destPath = `${cacheDir}${tempName}.mp4`;
    await FileSystem.copyAsync({ from: uri, to: destPath });
    return destPath.replace('file://', '');
  }

  // file:// URI — strip the prefix for FFmpeg
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }

  return uri;
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
    const loaded = await loadFFmpeg();
    if (!loaded) {
      return {
        success: false,
        outputUris: [],
        error: 'Video processing engine is not available on this device.',
      };
    }

    const {
      trimStartMillis = 0,
      trimEndMillis = durationMillis,
      watermarkText = 'ReginaStatus',
      musicUri = null,
      videoVolume = 1.0,
      musicVolume = 1.0,
    } = options;

    // Resolve input URI to a real file path
    const safeInput = await resolveToLocalPath(inputUri, 'rs_input_video');

    // Set up output directory
    const outputDir = ((FileSystem as any).cacheDirectory as string) + 'reginastatus_exports/';
    const dirInfo = await FileSystem.getInfoAsync(outputDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
    }

    const timestamp = Date.now();
    const outputPattern = `${outputDir}output_${timestamp}_%03d.mp4`;

    const startSec = trimStartMillis / 1000;
    const endSec = trimEndMillis / 1000;
    const durationSec = Math.max(endSec - startSec, 1);

    // Build inputs
    let inputs = `-ss ${startSec} -t ${durationSec} -i "${safeInput}"`;

    let safeMusic: string | null = null;
    if (musicUri) {
      try {
        safeMusic = await resolveToLocalPath(musicUri, 'rs_input_music');
        inputs += ` -i "${safeMusic}"`;
      } catch (_) {
        // Music resolve failed, proceed without music
        safeMusic = null;
      }
    }

    // Build filter_complex
    let filterComplex = '';
    const sanitizedWatermark = watermarkText
      .replace(/\\/g, '\\\\')
      .replace(/:/g, '\\:')
      .replace(/'/g, "\\'")
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]');

    const videoFilter = `scale=-2:720,drawtext=text='${sanitizedWatermark}':fontcolor=white:fontsize=28:x=w-tw-16:y=h-th-16:shadowcolor=black:shadowx=2:shadowy=2`;

    if (safeMusic) {
      filterComplex = `[0:v]${videoFilter}[vout];[0:a]volume=${videoVolume}[a1];[1:a]volume=${musicVolume}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`;
    } else if (videoVolume !== 1.0) {
      filterComplex = `[0:v]${videoFilter}[vout];[0:a]volume=${videoVolume}[aout]`;
    } else {
      filterComplex = `[0:v]${videoFilter}[vout]`;
    }

    // Map outputs
    let maps = `-map "[vout]"`;
    if (safeMusic || videoVolume !== 1.0) {
      maps += ` -map "[aout]"`;
    } else {
      maps += ` -map 0:a?`;
    }

    const ffmpegCommand = `${inputs} -filter_complex "${filterComplex}" ${maps} -c:v libx264 -crf 23 -preset ultrafast -c:a aac -b:a 128k -f segment -segment_time 30 -reset_timestamps 1 "${outputPattern}"`;

    console.log('[ReginaStatus] FFmpeg command:', ffmpegCommand);

    const session = await FFmpegKit.execute(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (ReturnCode.isSuccess(returnCode)) {
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
        error: 'Video processing failed. Please try a shorter video or different format.',
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
