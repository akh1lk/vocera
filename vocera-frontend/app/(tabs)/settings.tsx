import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Linking,
  TouchableOpacity,
  useColorScheme,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useVoceraStore } from '../../store/voceraStore';
import { router } from 'expo-router';
import { User, Shield, KeyRound, ChevronRight, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsScreen() {
  const { user, resetVoxKey } = useVoceraStore();
  const colorScheme = useColorScheme();
  const [microphonePermission, setMicrophonePermission] = useState('Not Determined');
  const [isModalVisible, setModalVisible] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [fullName, setFullName] = useState('John Doe');
  const [email, setEmail] = useState('john.doe@example.com');

  const handleCheckMicrophonePermission = async () => {
    // In a real app, you'd use a library like expo-av or react-native-permissions
    // For this example, we'll simulate checking and show an alert.
    setMicrophonePermission('Granted'); // Simulate granted status
    Alert.alert('Microphone Access', 'Microphone permission is currently granted.');
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const handleResetPress = () => {
    setModalVisible(true);
  };

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await resetVoxKey();
      
      setModalVisible(false);
      setIsResetting(false);
      
      router.replace('/(tabs)');
      setTimeout(() => router.push('/voxkey-wizard'), 100);

    } catch (error) {
      console.error("Error resetting Vox Key:", error);
      setIsResetting(false);
      Alert.alert("Error", "Failed to reset Vox Key. Please try again.");
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const styles = getStyles(colorScheme);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['transparent', 'rgba(37, 139, 182, 0.08)', 'rgba(37, 139, 182, 0.18)', 'rgba(37, 139, 182, 0.3)']}
        locations={[0, 0.3, 0.7, 1]}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.headerTitle}>Settings</Text>

          {/* User Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User color={styles.sectionTitle.color} size={22} />
              <Text style={styles.sectionTitle}>Your Information</Text>
            </View>
            <View style={styles.card}>
              <InfoRow label="Full Name" value={fullName} />
              <View style={styles.divider} />
              <InfoRow label="Email" value={email} />
              <View style={styles.divider} />
              <InfoRow label="Vox Key Updated" value={formatDate(user?.lastUpdated)} />
            </View>
          </View>

          {/* Permissions Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield color={styles.sectionTitle.color} size={22} />
              <Text style={styles.sectionTitle}>Permissions</Text>
            </View>
            <View style={styles.card}>
              <TouchableOpacity style={styles.permissionRow} onPress={handleOpenSettings}>
                <View>
                  <Text style={styles.permissionLabel}>Microphone</Text>
                  <Text style={styles.permissionStatus}>
                    Status: <Text style={styles.statusGranted}>{microphonePermission}</Text>
                  </Text>
                </View>
                <ChevronRight color="#888" size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Reset Vox Key Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <KeyRound color={styles.sectionTitle.color} size={22} />
              <Text style={styles.sectionTitle}>Reset Vox Key</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.resetDescription}>
                If you're experiencing issues with voice verification, you can reset your Vox Key. This will require you to create a new voice profile.
              </Text>
              <TouchableOpacity style={styles.resetButton} onPress={handleResetPress}>
                <Text style={styles.resetButtonText}>Reset Vox Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
              <X color={styles.modalTitle.color} size={24} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalText}>
              Resetting your Vox Key will permanently delete your current voice profile. You will need to record 10 new samples to continue using voice verification.
            </Text>
            <TouchableOpacity 
              style={[styles.modalButton, styles.confirmButton]} 
              onPress={handleConfirmReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalButtonText}>Yes, Reset My Vox Key</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]} 
              onPress={() => setModalVisible(false)}
              disabled={isResetting}
            >
              <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const InfoRow = ({ label, value }: { label: string, value: string }) => {
  const styles = getStyles(useColorScheme());
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
};

const getStyles = (colorScheme: 'light' | 'dark' | null | undefined) => {
  const isDark = false;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#000000' : '#F9F6F0',
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 50,
    },
    headerTitle: {
      fontFamily: 'GeorgiaPro-CondBlack',
      fontSize: 36,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : '#1E1E1E',
      marginBottom: 30,
      textAlign: 'center',
    },
    section: {
      marginBottom: 30,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
    },
    sectionTitle: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 20,
      color: isDark ? '#E0E0E0' : '#333333',
      marginLeft: 10,
    },
    card: {
      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
      borderRadius: 12,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.25 : 0.05,
      shadowRadius: 3.84,
      elevation: 5,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    infoLabel: {
      fontFamily: 'Inter-Regular',
      fontSize: 16,
      color: isDark ? '#A0A0A0' : '#666666',
    },
    infoValue: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 16,
      color: isDark ? '#FFFFFF' : '#1E1E1E',
      maxWidth: '60%',
      textAlign: 'right',
    },
    divider: {
      height: 1,
      backgroundColor: isDark ? '#3A3A3C' : '#EAEAEA',
    },
    permissionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    permissionLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 16,
      color: isDark ? '#FFFFFF' : '#1E1E1E',
    },
    permissionStatus: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: isDark ? '#A0A0A0' : '#666666',
      marginTop: 4,
    },
    statusGranted: {
      color: '#34C759',
      fontFamily: 'Inter-SemiBold',
    },
    resetDescription: {
      fontFamily: 'Inter-Regular',
      fontSize: 15,
      color: isDark ? '#A0A0A0' : '#666666',
      lineHeight: 22,
      marginBottom: 20,
    },
    resetButton: {
      backgroundColor: '#D9534F',
      borderRadius: 10,
      paddingVertical: 15,
      alignItems: 'center',
    },
    resetButtonText: {
      fontFamily: 'Inter-Bold',
      fontSize: 16,
      color: '#FFFFFF',
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
      width: '90%',
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderRadius: 20,
      padding: 25,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 10,
    },
    closeButton: {
      position: 'absolute',
      top: 15,
      right: 15,
    },
    modalTitle: {
      fontFamily: 'GeorgiaPro-CondBlack',
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#FFFFFF' : '#1E1E1E',
      marginBottom: 15,
      textAlign: 'center',
    },
    modalText: {
      fontFamily: 'Inter-Regular',
      fontSize: 16,
      color: isDark ? '#E0E0E0' : '#333333',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 30,
    },
    modalButton: {
      width: '100%',
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 10,
    },
    confirmButton: {
      backgroundColor: '#D9534F',
    },
    cancelButton: {
      backgroundColor: isDark ? '#3A3A3C' : '#EFEFEF',
    },
    modalButtonText: {
      fontFamily: 'Inter-Bold',
      fontSize: 16,
      color: '#FFFFFF',
    },
    cancelButtonText: {
      color: isDark ? '#FFFFFF' : '#1E1E1E',
    },
  });
};
