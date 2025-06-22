import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';
import { useVoceraStore } from '../store/voceraStore';
import Auth from './Auth';

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { setUser, setAuthToken, clearStore } = useVoceraStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      handleSessionChange(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      handleSessionChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSessionChange = async (session: Session | null) => {
    if (session?.user) {
      // User is logged in
      setAuthToken(session.access_token);
      
      try {
        // Get user profile (should exist from signup)
        const userProfile = await supabaseService.getUserProfile(session.user.id);
        
        if (!userProfile) {
          // Profile doesn't exist - this shouldn't happen with the new signup flow
          console.error('User profile not found for user:', session.user.id, 'email:', session.user.email);
          console.error('This indicates signup did not complete properly - signing out');
          
          // Sign out the user so they can try signing up again
          await supabase.auth.signOut();
          
          // Show alert to inform user they need to sign up again
          setTimeout(() => {
            alert('Your account setup was incomplete. Please sign up again with your name information.');
          }, 100);
          
          return;
        }

        // Check if user has vox key
        const hasVoxKey = await supabaseService.checkUserHasVoxKey(session.user.id);

        // Update store with user info
        setUser({
          id: session.user.id,
          email: userProfile.email,
          firstName: userProfile.first_name,
          lastName: userProfile.last_name,
          hasVoxKey,
          lastUpdated: new Date().toISOString(),
          autoResetAfterVerification: false,
        });
      } catch (error) {
        console.error('Error setting up user:', error);
        // If there's an error, sign out to prevent broken state
        await supabase.auth.signOut();
      }
    } else {
      // User is logged out
      setAuthToken(null);
      clearStore();
    }
  };

  // Show loading or auth screen
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
          locations={[0, 0.4, 0.8, 1]}
          style={styles.gradientContainer}
        >
          <View style={styles.centered}>
            {/* You could add a loading spinner here */}
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
          locations={[0, 0.4, 0.8, 1]}
          style={styles.gradientContainer}
        >
          <Auth />
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // User is authenticated, show main app
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f6f0',
  },
  gradientContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});