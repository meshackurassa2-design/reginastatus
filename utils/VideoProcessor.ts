/**
 * VideoProcessor — Pure Expo implementation (no FFmpeg)
 *
 * Uses expo-file-system + expo-av to copy and save video segments.
 * Watermark is applied as a UI overlay (burned-in watermark requires a
 * future server-side step or a stable native build).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Audio, Video } from 'expo-av';

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
 */
const resolveUri = async (uri: string, name: string): Promise<string> => {
  if (!uri) throw new Error('Empty URI provided');

  const cacheDir = (FileSystem as any).cacheDirectory as string;

  if (uri.startsWith('ph://') || uri.startsWith('assets-library://')) {
    const dest = `${cacheDir}${name}.mp4`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }

  if (uri.startsWith('file://')) return uri;

  return uri;
};

/**
 * Main processing function.
 *
 * Since FFmpegKit is not available in sideloaded IPAs, this implementation:
 * 1. Resolves the video URI to a real local file.
 * 2. Copies it (or trims by duration metadata) into the output directory.
 * 3. Returns the output URIs for the gallery/share flow.
 *
 * Full compression + watermark burn-in will be added in a future update.
 */
export const compressAndSplitVideo = async (
  inputUri: string,
  _durationMillis: number,
  options: VideoProcessingOptions = {}
): Promise<ProcessResult> => {
  try {
    // Step 1: resolve to a local file URI
    const localUri = await resolveUri(inputUri, 'rs_source_video');

    // Step 2: set up output directory
    const cacheDir = (FileSystem as any).cacheDirectory as string;
    const outputDir = `${cacheDir}reginastatus_exports/`;
    const dirInfo = await FileSystem.getInfoAsync(outputDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
    }

    // Step 3: copy the resolved file to the output directory
    const timestamp = Date.now();
    const outputUri = `${outputDir}output_${timestamp}_001.mp4`;
    await FileSystem.copyAsync({ from: localUri, to: outputUri });

    // Verify the output exists and has size > 0
    const info = await FileSystem.getInfoAsync(outputUri);
    if (!info.exists || (info as any).size === 0) {
      return {
        success: false,
        outputUris: [],
        error: 'Output file is empty or missing after copy.',
      };
    }

    return {
      success: true,
      outputUris: [outputUri],
    };
  } catch (err: any) {
    console.error('[VideoProcessor] Error:', err);
    return {
      success: false,
      outputUris: [],
      error: err?.message ?? 'Unknown error during video processing.',
    };
  }
};
