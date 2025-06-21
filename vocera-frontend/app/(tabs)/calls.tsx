import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { AudioPlayer } from '../../components/AudioPlayer';
import { VoxButton } from '../../components/VoxButton';
import { useVoceraStore } from '../../store/voceraStore';

export default function CallsScreen() {
  const { savedCalls, removeSavedCall } = useVoceraStore();

  const handleDeleteCall = (callId: string) => {
    removeSavedCall(callId);
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Calls',
      'Are you sure you want to delete all saved calls? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => {
            savedCalls.forEach(call => removeSavedCall(call.id));
          }
        },
      ]
    );
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Calls</Text>
        <Text style={styles.subtitle}>
          {savedCalls.length} {savedCalls.length === 1 ? 'call' : 'calls'}
        </Text>
      </View>

      {savedCalls.length > 0 && (
        <View style={styles.clearButtonContainer}>
          <VoxButton
            title="Clear All"
            onPress={handleClearAll}
            variant="danger"
            size="small"
          />
        </View>
      )}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {savedCalls.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📞</Text>
            <Text style={styles.emptyTitle}>No Saved Calls</Text>
            <Text style={styles.emptySubtitle}>
              Verified calls will appear here for review and playback
            </Text>
          </View>
        ) : (
          savedCalls.map((call) => (
            <View key={call.id} style={styles.callCard}>
              <View style={styles.callHeader}>
                <View style={styles.callInfo}>
                  <Text style={styles.callerName}>{call.name}</Text>
                  <Text style={styles.timestamp}>
                    {formatTimestamp(call.timestamp)}
                  </Text>
                </View>
                <View style={styles.verificationBadge}>
                  <Text style={styles.verificationText}>
                    {call.verified ? '✅ Verified' : '❌ Failed'}
                  </Text>
                  <Text style={styles.confidenceText}>
                    {Math.round(call.confidence * 100)}%
                  </Text>
                </View>
              </View>

              <AudioPlayer
                audioUri={call.audioUri}
                title={`${call.name} - Voice Sample`}
                onDelete={() => handleDeleteCall(call.id)}
              />

              {call.transcript && (
                <View style={styles.transcriptContainer}>
                  <Text style={styles.transcriptLabel}>Transcript:</Text>
                  <Text style={styles.transcriptText}>{call.transcript}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f6f0',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 32,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666666',
  },
  clearButtonContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  callCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  callInfo: {
    flex: 1,
  },
  callerName: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  timestamp: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#666666',
  },
  verificationBadge: {
    alignItems: 'flex-end',
  },
  verificationText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 2,
  },
  confidenceText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#666666',
  },
  transcriptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  transcriptLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  transcriptText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
  },
});
