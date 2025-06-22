import React, { useState } from 'react'
import { 
  Alert, 
  StyleSheet, 
  View, 
  AppState, 
  SafeAreaView, 
  Text, 
  TextInput, 
  TouchableOpacity,
  useColorScheme
} from 'react-native'
import { supabase } from '../lib/supabase'
import { supabaseService } from '../services/supabaseService'
import { LinearGradient } from 'expo-linear-gradient'
import { Lock, Mail, User } from 'lucide-react-native'

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(true)
  const colorScheme = useColorScheme()

  async function signInWithEmail() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) Alert.alert(error.message)
    setLoading(false)
  }

  async function signUpWithEmail() {
    // Validate required fields
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required')
      return
    }

    setLoading(true)
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.signUp({
        email: email,
        password: password,
      })

      if (error) {
        Alert.alert('Signup Error', error.message)
        setLoading(false)
        return
      }

      if (user) {
        // Create user profile in database
        try {
          console.log('Creating profile with data:', {
            userId: user.id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: user.email
          })
          
          await supabaseService.createUserProfile(user, {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
          })
          Alert.alert('Success', 'Account created successfully!')
        } catch (profileError) {
          console.error('Error creating user profile:', profileError)
          Alert.alert('Error', 'Failed to create user profile. Please try again.')
        }
      } else {
        Alert.alert('Please check your inbox for email verification!')
      }
    } catch (error) {
      console.error('Signup error:', error)
      Alert.alert('Error', 'Failed to create account. Please try again.')
    }
    setLoading(false)
  }

  const styles = getStyles(colorScheme)

  return (
    <View style={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Vocera</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
      </View>

      {/* Auth Form */}
      <View style={styles.formContainer}>
        <View style={styles.card}>
          {/* Name Inputs - Only show for signup */}
          {isSignUp && (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <User color="#666666" size={20} />
                  <Text style={styles.inputLabel}>First Name *</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  onChangeText={setFirstName}
                  value={firstName}
                  placeholder="First name"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>


              <View style={styles.inputContainer}>
                <View style={styles.inputHeader}>
                  <User color="#666666" size={20} />
                  <Text style={styles.inputLabel}>Last Name *</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  onChangeText={setLastName}
                  value={lastName}
                  placeholder="Last name"
                  placeholderTextColor="#999"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </>
          )}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <Mail color="#666666" size={20} />
              <Text style={styles.inputLabel}>Email</Text>
            </View>
            <TextInput
              style={styles.textInput}
              onChangeText={setEmail}
              value={email}
              placeholder="email@address.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputHeader}>
              <Lock color="#666666" size={20} />
              <Text style={styles.inputLabel}>Password</Text>
            </View>
            <TextInput
              style={styles.textInput}
              onChangeText={setPassword}
              value={password}
              placeholder="Password"
              placeholderTextColor="#999"
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
            onPress={isSignUp ? signUpWithEmail : signInWithEmail}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Text>
          </TouchableOpacity>

          {/* Toggle Sign Up/Sign In */}
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => {
              setIsSignUp(!isSignUp)
              // Clear name fields when switching
              setFirstName('')
              setLastName('')
            }}
          >
            <Text style={styles.toggleButtonText}>
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"
              }
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const getStyles = (colorScheme: 'light' | 'dark' | null | undefined) => {
  const isDark = false; // Keep consistent with your app's light theme
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F9F6F0',
    },
    gradientContainer: {
      flex: 1,
    },
    content: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    title: {
      fontFamily: 'GeorgiaPro-CondBlack',
      fontSize: 64,
      fontWeight: '700',
      color: '#000000',
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Inter-Medium',
      fontSize: 18,
      color: '#333333',
      fontWeight: '500',
    },
    formContainer: {
      alignItems: 'center',
    },
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 3.84,
      elevation: 5,
    },
    inputContainer: {
      marginBottom: 20,
    },
    inputHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    inputLabel: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 16,
      color: '#333333',
      marginLeft: 8,
    },
    textInput: {
      backgroundColor: '#F8F8F8',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: '#333333',
      borderWidth: 1,
      borderColor: '#E5E5E5',
      fontFamily: 'Inter-Regular',
    },
    submitButton: {
      backgroundColor: '#258bb6',
      borderRadius: 8,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    submitButtonDisabled: {
      backgroundColor: '#A0A0A0',
    },
    submitButtonText: {
      fontFamily: 'Inter-Bold',
      fontSize: 16,
      color: '#FFFFFF',
    },
    toggleButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    toggleButtonText: {
      fontFamily: 'Inter-Regular',
      fontSize: 14,
      color: '#258bb6',
    },
  })
}