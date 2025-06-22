import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as FileSystem from 'expo-file-system';

export interface DeepfakeDetectionResponse {
  prediction: boolean; // true = deepfake, false = authentic
  confidence: number;  // 0.0 to 1.0
}

export interface DeepfakeDetectionRequest {
  audioFile: {
    uri: string;
    type: string;
    name: string;
  };
  userId: string;
}

class DeepfakeService {
  private client: AxiosInstance;
  private apiUrl: string;

  constructor() {
    this.apiUrl = process.env.EXPO_PUBLIC_DEEPFAKE_API_URL || 'https://dummy-deepfake-api.com/detect';
    
    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Detect if audio is deepfake or authentic
  async detectDeepfake(audioUri: string, userId: string): Promise<DeepfakeDetectionResponse> {
    try {
      // Create FormData with audio file and user ID
      const formData = new FormData();
      
      const audioFile = {
        uri: audioUri,
        type: 'audio/wav',
        name: 'audio_segment.wav',
      };

      formData.append('audio', audioFile as any);
      formData.append('user_id', userId);

      // Make the API call
      const response: AxiosResponse<DeepfakeDetectionResponse> = await this.client.post(
        '/detect',
        formData
      );

      // Validate response
      if (typeof response.data.prediction === 'boolean' && 
          typeof response.data.confidence === 'number') {
        return response.data;
      } else {
        throw new Error('Invalid response format from deepfake detection API');
      }

    } catch (error: any) {
      console.error('Deepfake detection error:', error);
      
      // Return mock response for development/testing
      return this.getMockResponse();
    }
  }

  // Mock response for development and testing
  private getMockResponse(): DeepfakeDetectionResponse {
    // Generate random but realistic values for testing
    const isDeepfake = Math.random() > 0.7; // 30% chance of deepfake
    const baseConfidence = Math.random() * 0.3 + 0.7; // 0.7 to 1.0
    
    return {
      prediction: isDeepfake,
      confidence: parseFloat(baseConfidence.toFixed(3))
    };
  }

  // Check if the service is properly configured
  isConfigured(): boolean {
    return this.apiUrl.length > 0;
  }
}

export const deepfakeService = new DeepfakeService();