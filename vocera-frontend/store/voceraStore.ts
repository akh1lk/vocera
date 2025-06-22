import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

// Types
export interface Call {
  id: string;
  name: string;
  timestamp: string;
  audioUri: string;
  transcript: string;
  confidence: number;
  verified: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  hasVoxKey: boolean;
  lastUpdated: string;
  autoResetAfterVerification: boolean;
}

interface VoceraStore {
  // User state
  user: User | null;
  authToken: string | null;
  
  // Verification state
  targetUserId: string | null; // ID of user being verified
  
  // Calls state
  savedCalls: Call[];
  
  // Recording state
  isRecording: boolean;
  currentTranscript: string;
  recordingProgress: number;
  voxKeyProgress: number; // 0-10 for wizard
  
  // Actions
  setUser: (user: User) => void;
  updateUser: (updates: Partial<User>) => void;
  setAuthToken: (token: string | null) => void;
  setTargetUserId: (userId: string | null) => void;
  addSavedCall: (call: Call) => void;
  removeSavedCall: (callId: string) => void;
  setIsRecording: (recording: boolean) => void;
  setCurrentTranscript: (transcript: string) => void;
  setRecordingProgress: (progress: number) => void;
  setVoxKeyProgress: (progress: number) => void;
  resetVoxKey: () => void;
  clearStore: () => void;
}

// Secure storage adapter for Zustand persist
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Handle error silently
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Handle error silently
    }
  },
};

export const useVoceraStore = create<VoceraStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      authToken: null,
      targetUserId: null,
      savedCalls: [],
      isRecording: false,
      currentTranscript: '',
      recordingProgress: 0,
      voxKeyProgress: 0,

      // Actions
      setUser: (user: User) => set({ user }),
      
      updateUser: (updates: Partial<User>) => 
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null
        })),
      
      setAuthToken: (token: string | null) => set({ authToken: token }),
      
      setTargetUserId: (userId: string | null) => set({ targetUserId: userId }),
      
      addSavedCall: (call: Call) => 
        set((state) => ({ 
          savedCalls: [call, ...state.savedCalls].slice(0, 50) // Keep last 50 calls
        })),
      
      removeSavedCall: (callId: string) =>
        set((state) => ({
          savedCalls: state.savedCalls.filter(call => call.id !== callId)
        })),
      
      setIsRecording: (recording: boolean) => set({ isRecording: recording }),
      
      setCurrentTranscript: (transcript: string) => set({ currentTranscript: transcript }),
      
      setRecordingProgress: (progress: number) => set({ recordingProgress: progress }),
      
      setVoxKeyProgress: (progress: number) => set({ voxKeyProgress: progress }),
      
      resetVoxKey: () => 
        set((state) => ({
          user: state.user ? {
            ...state.user,
            hasVoxKey: false,
            lastUpdated: new Date().toISOString()
          } : null,
          voxKeyProgress: 0
        })),
      
      clearStore: () => 
        set({
          user: null,
          authToken: null,
          targetUserId: null,
          savedCalls: [],
          isRecording: false,
          currentTranscript: '',
          recordingProgress: 0,
          voxKeyProgress: 0
        }),
    }),
    {
      name: 'vocera-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        authToken: state.authToken,
        savedCalls: state.savedCalls,
      }),
    }
  )
);
