import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { VoxButton } from '../../components/VoxButton';
import { useVoceraStore } from '../../store/voceraStore';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { user, setUser, resetVoxKey, clearStore } = useVoceraStore();
  const [autoReset, setAutoReset] = useState(user?.autoResetAfterVerification ?? false);

  const handleResetVoxKey = () => {
    Alert.alert(
      'Reset Vox Key',
      'This will delete your current voice profile and require you to record 10 new samples. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            resetVoxKey();
            // Navigate to wizard
            router.push('/voxkey-wizard');
          }
        },
      ]
    );
  };

  const handleToggleAutoReset = (value: boolean) => {
    setAutoReset(value);
    if (user) {
      setUser({
        ...user,
        autoResetAfterVerification: value,
      });
    }
  };

  const handleOpenMicrophoneSettings = () => {
    Alert.alert(
      'Microphone Settings',
      'Please go to your device settings to manage microphone permissions for Vocera.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Settings', 
          onPress: () => Linking.openSettings()
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your data including Vox Key, saved calls, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            clearStore();
            Alert.alert('Success', 'All data has been cleared.');
          }
        },
      ]
    );
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your Vox Key and preferences</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vox Key Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vox Key Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <Text style={[
                styles.statusValue,
                { color: user?.hasVoxKey ? '#34C759' : '#FF3B30' }
              ]}>
                {user?.hasVoxKey ? '✅ Active' : '❌ Not Set Up'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Last Updated:</Text>
              <Text style={styles.statusValue}>
                {formatDate(user?.lastUpdated)}
              </Text>
            </View>
          </View>
        </View>

        {/* Vox Key Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vox Key Management</Text>
          
          {!user?.hasVoxKey ? (
            <VoxButton
              title="Set Up Vox Key"
              onPress={() => router.push('/voxkey-wizard')}
              size="large"
              style={styles.actionButton}
            />
          ) : (
            <VoxButton
              title="Reset Vox Key"
              onPress={handleResetVoxKey}
              variant="danger"
              size="large"
              style={styles.actionButton}
            />
          )}
          
          <Text style={styles.helpText}>
            {!user?.hasVoxKey 
              ? 'Create your voice profile by recording 10 samples of your voice'
              : 'Reset and record a new voice profile with 10 new samples'
            }
          </Text>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <Text style={styles.preferenceLabel}>Auto-Reset After Verification</Text>
              <Text style={styles.preferenceDescription}>
                Automatically return to home screen after each verification
              </Text>
            </View>
            <Switch
              value={autoReset}
              onValueChange={handleToggleAutoReset}
              trackColor={{ false: '#E0E0E0', true: '#007AFF' }}
              thumbColor={autoReset ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          
          <VoxButton
            title="Manage Microphone Access"
            onPress={handleOpenMicrophoneSettings}
            variant="secondary"
            size="large"
            style={styles.actionButton}
          />
          
          <Text style={styles.helpText}>
            Vocera needs microphone access to record voice samples for verification
          </Text>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#FF3B30' }]}>Danger Zone</Text>
          
          <VoxButton
            title="Clear All Data"
            onPress={handleClearAllData}
            variant="danger"
            size="large"
            style={styles.actionButton}
          />
          
          <Text style={styles.helpText}>
            This will permanently delete all your data including Vox Key, saved calls, and settings
          </Text>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Vocera Voice Verification</Text>
            <Text style={styles.infoText}>Version 1.0.0</Text>
            <Text style={styles.infoSubtext}>
              Secure voice-based identity verification using advanced audio analysis
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontFamily: 'GeorgiaProCondensed',
    fontSize: 32,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter',
    fontSize: 16,
    color: '#666666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'GeorgiaProCondensed',
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontFamily: 'Inter',
    fontSize: 16,
    color: '#666666',
  },
  statusValue: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    marginBottom: 8,
  },
  helpText: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginTop: 8,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceLabel: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  infoText: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  infoSubtext: {
    fontFamily: 'Inter',
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
});
