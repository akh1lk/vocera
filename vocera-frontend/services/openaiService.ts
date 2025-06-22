import axios, { AxiosInstance, AxiosResponse } from 'axios';

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
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 60000, // 60 seconds for audio processing
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
    });
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

      // Convert audio file to blob-like object for FormData
      const audioBlob = {
        uri: audioUri,
        type: 'audio/wav',
        name: 'audio.wav',
      };

      // Create FormData
      const formData = new FormData();
      formData.append('file', audioBlob as any);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'text');

      // Make the API call
      const response: AxiosResponse<WhisperResponse> = await this.client.post(
        '/audio/transcriptions',
        formData
      );

      // Handle both string and object responses
      if (typeof response.data === 'string') {
        return response.data;
      } else if (response.data && typeof response.data.text === 'string') {
        return response.data.text;
      } else {
        throw new Error('Invalid response format from OpenAI Whisper');
      }

    } catch (error: any) {
      console.error('OpenAI Whisper transcription error:', error);
      
      if (error.response?.data?.error) {
        throw new Error(`OpenAI API Error: ${error.response.data.error.message}`);
      } else if (error.message) {
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

export const openaiService = new OpenAIService();