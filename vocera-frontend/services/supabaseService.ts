import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Types based on your database schema
export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
}

export interface VoxKey {
  id: number;
  user_id: string;
  passphrase: string;
  instructions: string;
  created_at: string;
  is_active: boolean;
  training_audio_url: string | null;
}

export interface VoxVector {
  id: number;
  vox_key_id: number;
  embedding: number[];
  created_at: string;
}

export interface Result {
  id: number;
  prediction: boolean;
  confidence: number;
  transcript: string;
  target: string | null;
  saved_by: string | null;
  created_at: string;
}

class SupabaseService {
  // Auth methods
  async getCurrentUser(): Promise<SupabaseUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  // User profile methods
  async createUserProfile(user: SupabaseUser, additionalData?: Partial<UserProfile>): Promise<UserProfile> {
    console.log('createUserProfile called with:', { user: user.id, additionalData });
    
    // Ensure required fields are provided
    if (!additionalData?.first_name || !additionalData?.last_name) {
      console.error('Missing required fields:', { additionalData });
      throw new Error('First name and last name are required to create user profile');
    }

    // Trim and validate the strings
    const firstName = additionalData.first_name.trim();
    const lastName = additionalData.last_name.trim();
    
    if (!firstName || !lastName) {
      console.error('Empty names after trimming:', { firstName, lastName });
      throw new Error('First name and last name cannot be empty');
    }

    const profileData = {
      id: user.id,
      email: user.email!,
      first_name: firstName,
      last_name: lastName,
      created_at: new Date().toISOString(),
    };

    console.log('Inserting profile data into Supabase:', profileData);

    const { data, error } = await supabase
      .from('users')
      .insert(profileData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('Profile created successfully:', data);
    return data;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }
    return data;
  }

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Vox Key methods
  async createVoxKey(userId: string, passphrase: string, instructions: string): Promise<VoxKey> {
    const { data, error } = await supabase
      .from('vox_keys')
      .insert({
        user_id: userId,
        passphrase,
        instructions,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserVoxKey(userId: string): Promise<VoxKey | null> {
    const { data, error } = await supabase
      .from('vox_keys')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }
    return data;
  }

  async updateVoxKeyAudioUrl(voxKeyId: number, audioUrl: string): Promise<VoxKey> {
    const { data, error } = await supabase
      .from('vox_keys')
      .update({ training_audio_url: audioUrl })
      .eq('id', voxKeyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deactivateVoxKey(voxKeyId: number): Promise<void> {
    const { error } = await supabase
      .from('vox_keys')
      .update({ is_active: false })
      .eq('id', voxKeyId);

    if (error) throw error;
  }

  // Results methods (for verification history)
  async createResult(data: {
    prediction: boolean;
    confidence: number;
    transcript: string;
    target?: string;
    saved_by?: string;
  }): Promise<Result> {
    const { data: result, error } = await supabase
      .from('results')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async getUserResults(userId: string, limit: number = 50): Promise<Result[]> {
    const { data, error } = await supabase
      .from('results')
      .select(`
        *,
        target_user:users!results_target_fkey(first_name, last_name)
      `)
      .eq('saved_by', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Storage methods for audio files
  async uploadAudioFile(filePath: string, file: Blob | File | Uint8Array): Promise<string> {
    const { data, error } = await supabase.storage
      .from('vocera-audiostore')
      .upload(filePath, file, {
        contentType: 'audio/wav',
        upsert: false
      });

    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('vocera-audiostore')
      .getPublicUrl(data.path);

    return publicUrl;
  }

  async deleteAudioFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from('vocera-audiostore')
      .remove([filePath]);

    if (error) throw error;
  }

  // Real-time subscriptions
  subscribeToUserVoxKeys(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('user-vox-keys')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vox_keys',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }

  // User lookup methods
  async findUserByName(callerName: string): Promise<UserProfile | null> {
    try {
      const nameParts = callerName.trim().split(/\s+/);

      if (nameParts.length !== 2) {
        console.error('Caller name must consist of exactly two words (first and last name).');
        return null;
      }

      const [firstName, lastName] = nameParts;

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('first_name', `%${firstName}%`)
        .ilike('last_name', `%${lastName}%`)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;

    } catch (error) {
      console.error('Error finding user by name:', error);
      return null;
    }
  }

  // Utility methods
  async checkUserHasVoxKey(userId: string): Promise<boolean> {
    const voxKey = await this.getUserVoxKey(userId);
    return voxKey !== null;
  }
}

export const supabaseService = new SupabaseService();