import * as FileSystem from 'expo-file-system';

export interface AudioSegment {
  uri: string;
  duration: number;
}

class AudioUtils {
  // Create a temporary directory for audio processing
  private async ensureTempDirectory(): Promise<string> {
    const tempDir = `${FileSystem.documentDirectory}temp_audio/`;
    const dirInfo = await FileSystem.getInfoAsync(tempDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(tempDir);
    }
    
    return tempDir;
  }

  // Get the duration of an audio file (estimation based on file size)
  async getAudioDuration(audioUri: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (fileInfo.exists && fileInfo.size) {
        // Rough estimation for WAV files: 44.1kHz, 16-bit, mono ≈ 88.2 KB/second
        // For high quality recordings, adjust the multiplier
        const estimatedSeconds = fileInfo.size / 176400; // Stereo, 16-bit, 44.1kHz
        return Math.max(estimatedSeconds, 0);
      }
      return 0;
    } catch (error) {
      console.error('Error getting audio duration:', error);
      return 0;
    }
  }

  // Segment audio from a start time to the end of the file
  async segmentAudio(
    audioUri: string,
    startTimeSeconds: number,
    endTimeSeconds?: number
  ): Promise<AudioSegment | null> {
    try {
      const tempDir = await this.ensureTempDirectory();
      const outputPath = `${tempDir}segment_${Date.now()}.wav`;

      // For React Native, we'll use a simpler approach
      // In a real production app, you might want to use a native module
      // or send the audio to a backend service for processing
      
      // For now, we'll copy the original file and mark the segment timing
      // In production, you would use FFmpeg or similar to actually cut the audio
      await FileSystem.copyAsync({
        from: audioUri,
        to: outputPath,
      });

      // Calculate duration (for now, assume 5 seconds or until end)
      const totalDuration = await this.getAudioDuration(audioUri);
      const segmentDuration = endTimeSeconds 
        ? Math.min(endTimeSeconds - startTimeSeconds, totalDuration - startTimeSeconds)
        : Math.min(5, totalDuration - startTimeSeconds);

      return {
        uri: outputPath,
        duration: segmentDuration,
      };

    } catch (error) {
      console.error('Error segmenting audio:', error);
      return null;
    }
  }

  // Clean up temporary files
  async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = `${FileSystem.documentDirectory}temp_audio/`;
      const dirInfo = await FileSystem.getInfoAsync(tempDir);
      
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(tempDir, { idempotent: true });
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }

  // Convert timestamp to seconds
  timestampToSeconds(timestamp: number): number {
    return timestamp / 1000;
  }

  // Format duration for display
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export const audioUtils = new AudioUtils();