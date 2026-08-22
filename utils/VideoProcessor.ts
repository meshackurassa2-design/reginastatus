/**
 * VideoProcessor — Pure Expo + React Native Compressor implementation
 *
 * Uses react-native-compressor to heavily compress the video for WhatsApp.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Video as RNCompressor } from 'react-native-compressor';

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
    // Delete existing
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
    
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }

  if (uri.startsWith('file://')) return uri;

  return uri;
};

/**
 * Main processing function.
 *
 * Compresses the video using react-native-compressor so it fits perfectly on WhatsApp.
 */
export const compressAndSplitVideo = async (
  inputUri: string,
  _durationMillis: number,
  options: VideoProcessingOptions = {}
): Promise<ProcessResult> => {
  try {
    // Step 1: resolve to a local file URI
    const localUri = await resolveUri(inputUri, 'rs_source_video');

    // Step 2: Compress the video heavily for WhatsApp Status
    const compressedUri = await RNCompressor.compress(
      localUri,
      {
        compressionMethod: 'auto',
        minimumFileSizeForCompress: 0,
      },
      (progress) => {
        console.log('[ReginaStatus] Video Compression Progress: ', progress);
      }
    );

    // Verify the output exists
    const info = await FileSystem.getInfoAsync(compressedUri);
    if (!info.exists) {
      return {
        success: false,
        outputUris: [],
        error: 'Output file is empty or missing after compression.',
      };
    }

    return {
      success: true,
      outputUris: [compressedUri],
    };
  } catch (err: any) {
    console.error('[VideoProcessor] Error:', err);
    return {
      success: false,
      outputUris: [],
      error: err?.message ?? 'Unknown error during video compression.',
    };
  }
};
