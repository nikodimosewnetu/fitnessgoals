import { ThemeContext } from '@/app/_layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import React, { useContext, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../utils/supabase';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const themeContext = useContext(ThemeContext);
  const { theme } = useTheme();
  const isDarkMode = themeContext?.isDarkMode ?? false;

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New password and confirm new password do not match.');
      return;
    }
    try {
      const userData = await AsyncStorage.getItem('user');
      const email = userData ? JSON.parse(userData).email : '';
      // re-authenticate by signing in with current password
      const { error: signInError } = (await supabase.auth.signInWithPassword({ email, password: currentPassword }));
      if (signInError) throw signInError;
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      Alert.alert('Success', 'Password changed successfully!');
      router.back();
    } catch (error: any) {
      console.error('Failed to change password:', error);
      Alert.alert('Error', error.message || 'Failed to change password. Please try again.');
    }
  };

  // Update dark mode colors to match HomeScreen
  const colors = isDarkMode
    ? {
        primary: theme.colors.primary,
        background: theme.colors.background,
        surface: theme.colors.card || '#000000ff',
        card: theme.colors.card,
        text: theme.colors.text,
        textSecondary: theme.colors.text || '#000000ff',
        textTertiary: theme.colors.text || '#010101ff',
        border: theme.colors.border,
        error: '#EF4444',
      }
    : {
        primary: theme.colors.primary,
        background: theme.colors.background,
        surface: '#010101ff',
        card: theme.colors.card || '#000000ff',
        text: theme.colors.text || '#1F2937',
        textSecondary: theme.colors.text || '#6B7280',
        textTertiary: theme.colors.text || '#9CA3AF',
        border: theme.colors.border || '#E5E7EB',
        error: '#EF4444',
      };

  // no insets used here

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Change Password',
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
        <Text style={[styles.label, { color: colors.text }]}>Current Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Enter current password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
        />

        <Text style={[styles.label, { color: colors.text, marginTop: 20 }]}>New Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Enter new password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
        />

        <Text style={[styles.label, { color: colors.text, marginTop: 20 }]}>Confirm New Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
          placeholder="Confirm new password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleChangePassword}>
          <Text style={styles.saveButtonText}>Change Password</Text>
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