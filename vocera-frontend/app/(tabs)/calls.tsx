import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { VoxButton } from '../../components/VoxButton';
import { useVoceraStore } from '../../store/voceraStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, CheckCircle2, XCircle } from 'lucide-react-native';
import { supabaseService } from '../../services/supabaseService';

export default function CallsScreen() {
  const { user, savedCalls } = useVoceraStore();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [user]);

  const loadResults = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userResults = await supabaseService.getUserResults(user.id);
      setResults(userResults);
    } catch (error) {
      console.error('Error loading results:', error);
      Alert.alert('Error', 'Failed to load verification history.');
    } finally {
      setLoading(false);
    }
  };


  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
        locations={[0, 0.4, 0.8, 1]}
        style={styles.gradientContainer}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Verification History</Text>
            <Text style={styles.subtitle}>
              {results.length} {results.length === 1 ? 'result' : 'results'}
            </Text>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Loading...</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.emptyState}>
                <Phone size={64} color="#258bb6" style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>No Verification History</Text>
                <Text style={styles.emptySubtitle}>
                  Voice verification results will appear here
                </Text>
              </View>
            ) : (
              results.map((result) => (
                <View key={result.id} style={styles.callCard}>
                  <View style={styles.callHeader}>
                    <View style={styles.callInfo}>
                      <Text style={styles.callerName}>
                        {result.target_user 
                          ? `${result.target_user.first_name} ${result.target_user.last_name}`
                          : 'Unknown Caller'
                        }
                      </Text>
                      <Text style={styles.timestamp}>
                        {formatTimestamp(result.created_at)}
                      </Text>
                    </View>
                    <View style={styles.verificationBadge}>
                      <View style={styles.verificationRow}>
                        {result.prediction ? (
                          <CheckCircle2 size={16} color="#34C759" style={{ marginRight: 4 }} />
                        ) : (
                          <XCircle size={16} color="#FF3B30" style={{ marginRight: 4 }} />
                        )}
                        <Text style={[
                          styles.verificationText,
                          { color: result.prediction ? '#34C759' : '#FF3B30' }
                        ]}>
                          {result.prediction ? 'Verified' : 'Failed'}
                        </Text>
                      </View>
                      <Text style={styles.confidenceText}>
                        {Math.round(result.confidence)}%
                      </Text>
                    </View>
                  </View>

                  {result.transcript && (
                    <View style={styles.transcriptContainer}>
                      <Text style={styles.transcriptLabel}>Transcript:</Text>
                      <Text style={styles.transcriptText}>{result.transcript}</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f6f0',
  },
  gradientContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(37, 139, 182, 0.1)',
    paddingBottom: 20,
  },
  title: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 40, // reduced from 64
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 18,
    color: '#333333',
    fontWeight: '500',
  },
  clearButtonContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'GeorgiaPro-CondBlack',
    fontSize: 32,
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 139, 182, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  verificationText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    fontWeight: '600',
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