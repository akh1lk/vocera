import * as FileSystem from 'expo-file-system';

export interface WhisperResponse {
  text: string;
}

export interface WhisperError {
  error: {
    message: string;
    type: string;
  };
}

class OpenAIService {
  private apiKey: string;
  private openAIEndpoint: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    this.openAIEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
  }

  // Check if API is properly configured
  isConfigured(): boolean {
    return this.apiKey.length > 0 && this.apiKey.startsWith('sk-');
  }

  // Transcribe audio using OpenAI Whisper
  async transcribeAudio(audioUri: string): Promise<string> {
    try {
      if (!this.isConfigured()) {
        throw new Error('OpenAI API key not configured');
      }

      console.log('Starting Whisper transcription for:', audioUri);

      // Check if file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      console.log('File size:', fileInfo.size, 'bytes');

      // Try different audio formats - expo-audio might produce different formats
      let mimeType = 'audio/wav';
      
      // Check the file extension or try common formats
      if (audioUri.includes('.m4a') || audioUri.includes('.aac')) {
        mimeType = 'audio/mp4';
      } else if (audioUri.includes('.mp3')) {
        mimeType = 'audio/mpeg';
      } else if (audioUri.includes('.wav')) {
        mimeType = 'audio/wav';
      }

      console.log('Using MIME type:', mimeType);

      const response = await FileSystem.uploadAsync(
        this.openAIEndpoint,
        audioUri,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: mimeType,
          parameters: {
            model: 'whisper-1',
            response_format: 'text',
          },
        }
      );

      console.log('Whisper API response status:', response.status);
      console.log('Whisper API response body:', response.body);

      if (response.status === 200) {
        return response.body;
      } else {
        throw new Error(`OpenAI API Error: ${response.status} - ${response.body}`);
      }

    } catch (error: any) {
      console.error('OpenAI Whisper transcription error:', error);

      if (error.message) {
        throw new Error(`Transcription failed: ${error.message}`);
      } else {
        throw new Error('Failed to transcribe audio');
      }
    }
  }

  // Get a fallback transcription when API fails
  getFallbackTranscription(): string {
    return 'Transcription unavailable - please check your connection and try again.';
  }
}

// Heroku service for uploading .wav audio files
class HerokuService {
  private herokuEndpoint: string;

  constructor() {
    this.herokuEndpoint = 'https://vocera-b8ea46a65e5a.herokuapp.com';
  }

  // Upload .wav audio file to Heroku endpoint
  async uploadWavFile(audioUri: string, endpoint: string = '/upload', additionalParams: Record<string, any> = {}): Promise<any> {
    try {
      console.log('Starting Heroku .wav upload for:', audioUri);

      // Check if file exists and get info
      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      console.log('Audio file info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Audio file does not exist');
      }

      console.log('File size:', fileInfo.size, 'bytes');

      // Detect actual audio format (files are typically m4a from expo-audio)
      let mimeType = 'audio/wav';
      
      if (audioUri.includes('.m4a') || audioUri.includes('.aac')) {
        mimeType = 'audio/mp4';
      } else if (audioUri.includes('.mp3')) {
        mimeType = 'audio/mpeg';
      } else if (audioUri.includes('.wav')) {
        mimeType = 'audio/wav';
      }
      
      console.log('Using MIME type:', mimeType);

      const response = await FileSystem.uploadAsync(
        `${this.herokuEndpoint}${endpoint}`,
        audioUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: mimeType,
          parameters: additionalParams,
        }
      );

      console.log('Heroku API response status:', response.status);
      console.log('Heroku API response body:', response.body);

      if (response.status === 200 || response.status === 201) {
        return JSON.parse(response.body);
      } else {
        throw new Error(`Heroku API Error: ${response.status} - ${response.body}`);
      }

    } catch (error: any) {
      console.error('Heroku .wav upload error:', error);

      if (error.message) {
        throw new Error(`Upload failed: ${error.message}`);
      } else {
        throw new Error('Failed to upload .wav file to Heroku');
      }
    }
  }
}

export const herokuService = new HerokuService();
export const openaiService = new OpenAIService();