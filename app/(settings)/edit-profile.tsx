import { ThemeContext } from '@/app/_layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';
import { emitUserChange } from '../../utils/userEvents';
// Removed unused environment variable declarations

export default function EditProfileScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext?.isDarkMode ?? false;
  const { theme } = useTheme();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      // Prefer loading fresh data from Supabase when possible
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.warn('supabase.auth.getUser error', userErr);
      }

      if (userData?.user) {
        const user = userData.user;
        setEmail(user.email ?? '');

        // fetch profile row
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (profileErr) {
          console.warn('Failed to load profile from DB, falling back to cache', profileErr);
          const cached = await AsyncStorage.getItem('user');
          if (cached) {
            const parsed = JSON.parse(cached);
            setFullName(parsed.fullName || '');
          }
        } else {
          setFullName(profile?.full_name || '');
          await AsyncStorage.setItem('user', JSON.stringify({ fullName: profile?.full_name || '', email: user.email || '' }));
        }
      } else {
        // no active session: fall back to AsyncStorage cache
        const userCache = await AsyncStorage.getItem('user');
        if (userCache) {
          const parsed = JSON.parse(userCache);
          setFullName(parsed.fullName || '');
          setEmail(parsed.email || '');
        }
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      Alert.alert('Error', 'Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName || !email) {
      Alert.alert('Error', 'Full Name and Email cannot be empty.');
      return;
    }
    try {
      setSaving(true);
      // Ensure we have a valid authenticated user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) {
        Alert.alert('Session required', 'Please sign in again to update your profile.');
        return;
      }

      // If email changed, update auth email
      if (email !== user.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email });
        if (emailErr) throw emailErr;
      }

      // Upsert profiles table with new full name
      const { error: dbErr } = await supabase.from('profiles').upsert({ id: user.id, full_name: fullName });
      if (dbErr) throw dbErr;

      // Update local cache and notify listeners
      await AsyncStorage.setItem('user', JSON.stringify({ fullName, email }));
      try { emitUserChange({ fullName, email, avatar: null }); } catch (e) { console.warn('emitUserChange failed:', e); }

      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error: any) {
      console.error('Failed to save user profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile.');
    }
    finally {
      setSaving(false);
    }
  };

  // Use a direct fallback value for 'surface'
  const colors = isDarkMode
    ? {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.notification,
        surface: '#1F2937',
        textSecondary: theme.colors.text || '#D1D5DB',
        textTertiary: theme.colors.text || '#9CA3AF',
        error: '#EF4444',
      }
    : {
        primary: theme.colors.primary,
        background: theme.colors.background,
        surface: '#0c0b0bff',
        card: theme.colors.card || '#FFFFFF',
        text: theme.colors.text || '#1d1d1eff',
        textSecondary: theme.colors.text || '#0e0e0eff',
        textTertiary: theme.colors.text || '#000000ff',
        border: theme.colors.border || '#E5E7EB',
        error: '#EF4444',
      };

  useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Edit Profile',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: 'white',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.formContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          placeholderTextColor={isDarkMode ? '#161616ff' : colors.textSecondary || '#191919ff'}
        />

        <Text style={[styles.label, { color: colors.text, marginTop: 20 }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          placeholderTextColor={isDarkMode ? '#000000ff' : colors.textSecondary || '#000000ff'}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <Text style={styles.saveButtonText}>Saving...</Text>
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    margin: 24,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  saveButton: {
    marginTop: 30,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});