import { FFmpegKit, ReturnCode } from '@nikhil-cephei/ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

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
 * FFMPEG Implementation for ReginaStatus
 */
export const compressAndSplitVideo = async (
  inputUri: string, 
  durationMillis: number,
  options: VideoProcessingOptions = {}
): Promise<ProcessResult> => {
  try {
    const {
      trimStartMillis = 0,
      trimEndMillis = durationMillis,
      watermarkText = 'ReginaStatus',
      musicUri = null,
      videoVolume = 1.0,
      musicVolume = 1.0,
    } = options;

    const outputDir = (FileSystem as any).cacheDirectory + 'reginastatus_exports/';
    await FileSystem.getInfoAsync(outputDir).then(async (info) => {
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
      }
    });

    const timestamp = Date.now();
    const outputPattern = `${outputDir}output_${timestamp}_%03d.mp4`;

    const startSec = trimStartMillis / 1000;
    const endSec = trimEndMillis / 1000;
    const durationSec = endSec - startSec;

    // Clean up input URI for FFmpeg (handle file:// and ph://)
    let safeInput = inputUri;
    if (safeInput.startsWith('file://')) {
      safeInput = safeInput.replace('file://', '');
    }
    
    // We will build a complex filter_complex string
    let filterComplex = '';
    let inputs = `-ss ${startSec} -t ${durationSec} -i "${safeInput}"`;

    if (musicUri) {
      let safeMusic = musicUri;
      if (safeMusic.startsWith('file://')) safeMusic = safeMusic.replace('file://', '');
      inputs += ` -i "${safeMusic}"`;
      
      // Mix audio: [0:a] volume [1:a] volume, amix
      filterComplex += `[0:a]volume=${videoVolume}[a1];[1:a]volume=${musicVolume}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout];`;
    } else {
      // Just adjust video volume if no music
      if (videoVolume !== 1.0) {
        filterComplex += `[0:a]volume=${videoVolume}[aout];`;
      }
    }

    // Video Filter: scale to 720p HD and add watermark
    const sanitizedWatermark = watermarkText.replace(/:/g, '\\:').replace(/'/g, "\\'");
    let videoFilter = `scale=-2:720,drawtext=text='${sanitizedWatermark}':fontcolor=white:fontsize=32:x=w-tw-20:y=h-th-20:shadowcolor=black:shadowx=2:shadowy=2`;
    
    filterComplex += `[0:v]${videoFilter}[vout]`;

    // Map the outputs
    let maps = `-map "[vout]"`;
    if (musicUri || videoVolume !== 1.0) {
      maps += ` -map "[aout]"`;
    } else {
      maps += ` -map 0:a?`;
    }

    // Combine the FFmpeg command
    // Segment it into 30 second chunks
    const ffmpegCommand = `${inputs} -filter_complex "${filterComplex}" ${maps} -c:v libx264 -crf 23 -preset ultrafast -c:a aac -f segment -segment_time 30 -reset_timestamps 1 "${outputPattern}"`;

    console.log("Executing FFMPEG Command: ", ffmpegCommand);

    const session = await FFmpegKit.execute(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (ReturnCode.isSuccess(returnCode)) {
      // Find the output files
      const files = await FileSystem.readDirectoryAsync(outputDir);
      const generatedFiles = files
        .filter(f => f.startsWith(`output_${timestamp}_`))
        .sort()
        .map(f => `file://${outputDir}${f}`);

      return {
        success: true,
        outputUris: generatedFiles,
      };
    } else {
      const logs = await session.getLogsAsString();
      console.error("FFmpeg execution failed: ", logs);
      return {
        success: false,
        outputUris: [],
        error: "Video processing failed. Check logs.",
      };
    }
  } catch (err: any) {
    console.error("FFmpeg Error:", err);
    return {
      success: false,
      outputUris: [],
      error: err.message,
    };
  }
};
