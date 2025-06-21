import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as FileSystem from 'expo-file-system';
import CryptoJS from 'crypto-js';

// Types
export interface VoxKeyResponse {
  success: boolean;
  message: string;
  userId?: string;
}

export interface VerificationResponse {
  match: boolean;
  confidence: number;
  transcript: string;
  message?: string;
}

export interface AudioUpload {
  uri: string;
  name: string;
  type: string;
}

class VoceraAPI {
  private client: AxiosInstance;
  private encryptionKey: string = 'vocera-secure-key-2025'; // In production, use env variable

  constructor() {
    // Replace with your actual backend URL
    const baseURL = __DEV__ 
      ? 'http://localhost:5000/api' 
      : 'https://your-heroku-app.herokuapp.com/api';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add retry interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.code === 'ECONNABORTED' && !originalRequest._retry) {
          originalRequest._retry = true;
          return this.client(originalRequest);
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Set auth token for requests
  setAuthToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  // Encrypt audio file before upload
  private async encryptAudioFile(audioUri: string): Promise<string> {
    try {
      const audioData = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const encrypted = CryptoJS.AES.encrypt(audioData, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      console.error('Error encrypting audio:', error);
      throw new Error('Failed to encrypt audio file');
    }
  }

  // Create Vox Key with 10 audio samples
  async createVoxKey(
    audioFiles: AudioUpload[],
    userName: string,
    userId?: string
  ): Promise<VoxKeyResponse> {
    try {
      const formData = new FormData();
      
      // Add user metadata
      formData.append('userName', userName);
      if (userId) formData.append('userId', userId);
      
      // Encrypt and add audio files
      for (let i = 0; i < audioFiles.length; i++) {
        const audioFile = audioFiles[i];
        const encryptedData = await this.encryptAudioFile(audioFile.uri);
        
        formData.append(`audio_${i}`, {
          uri: audioFile.uri,
          type: 'audio/wav',
          name: `voxkey_sample_${i}.wav`,
        } as any);
      }

      const response: AxiosResponse<VoxKeyResponse> = await this.client.post(
        '/createVoxKey',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 1 minute timeout for large uploads
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error creating Vox Key:', error);
      throw new Error('Failed to create Vox Key');
    }
  }

  // Verify voice with existing Vox Key
  async verifyVoxKey(
    audioFile: AudioUpload,
    callerName: string,
    userId?: string
  ): Promise<VerificationResponse> {
    try {
      const formData = new FormData();
      
      // Add metadata
      formData.append('callerName', callerName);
      if (userId) formData.append('userId', userId);
      
      // Encrypt and add audio file
      formData.append('audio', {
        uri: audioFile.uri,
        type: 'audio/wav',
        name: 'verification_sample.wav',
      } as any);

      const response: AxiosResponse<VerificationResponse> = await this.client.post(
        '/verifyVoxKey',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error verifying Vox Key:', error);
      throw new Error('Failed to verify voice');
    }
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await this.client.get(`/user/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  // Delete Vox Key
  async deleteVoxKey(userId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.client.delete(`/voxkey/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting Vox Key:', error);
      throw new Error('Failed to delete Vox Key');
    }
  }
}

export const voceraAPI = new VoceraAPI();
