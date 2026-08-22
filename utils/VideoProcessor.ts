// import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system';

export interface ProcessResult {
  success: boolean;
  outputUris: string[];
  error?: string;
}

/**
 * MOCKED FOR UI PREVIEW IN EXPO GO
 */
export const compressAndSplitVideo = async (inputUri: string, durationMillis: number): Promise<ProcessResult> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Calculate how many 30-second chunks are needed
      const numChunks = Math.ceil(durationMillis / 30000) || 1;
      
      const chunks = [];
      for (let i = 0; i < numChunks; i++) {
        chunks.push(inputUri); // Mock: return original uri for each chunk
      }

      resolve({
        success: true,
        outputUris: chunks,
      });
    }, 2500);
  });
};
