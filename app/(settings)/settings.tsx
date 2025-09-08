import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cancelAllNotifications, requestPermissions, scheduleDailySummary, sendImmediateSummary } from '../../utils/notifications';
import { supabase } from '../../utils/supabase';
import { onUserChange } from '../../utils/userEvents';

export default function SettingsScreen() {
  const [user, setUser] = useState<{ fullName: string; email: string; avatar?: string | null }>({ fullName: 'User', email: 'user@example.com' });
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationHour, setNotificationHour] = useState<number>(19);
  const [notificationMinute, setNotificationMinute] = useState<number>(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Add missing handler for logging access token
  const handleLogAccessToken = async () => {
    try {
      const session = await supabase.auth.getSession();
      const accessToken = session?.data?.session?.access_token;
      console.log('Current user access token:', accessToken);
      Alert.alert('Access Token', accessToken ? 'Check console for token.' : 'No access token found.');
    } catch (err) {
      Alert.alert('Error', 'Failed to get access token.');
    }
  }
  const [autoSave, setAutoSave] = useState(true);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      loadAllSettings();
    }, [])
  );

  React.useEffect(() => {
    const unsub = onUserChange((u) => {
      try {
        // Accept multiple shapes (fullName/name)
        const fullName = (u as any).fullName || (u as any).name || null;
        const email = (u as any).email || null;
        const avatar = (u as any).avatar || null;
        setUser((prev) => ({ ...(prev || {}), fullName: fullName || prev.fullName, email: email || prev.email, avatar: avatar || prev.avatar }));
      } catch (err) {
        console.warn('Error in settings onUserChange:', err);
      }
    });
    return () => unsub();
  }, []);

  const loadAllSettings = async () => {
    try {
      console.log('📱 Loading all settings...');

      // Load user data
      const userData = await AsyncStorage.getItem('user');
      console.log('👤 User data from storage:', userData);
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        console.log('👤 Set user to:', parsedUser);
      }

      // Load settings
  const notifications = await AsyncStorage.getItem('notifications');
      const autoSaveGallery = await AsyncStorage.getItem('autoSave');
  const notificationsTime = await AsyncStorage.getItem('notificationsTime');

      console.log('🔔 Notifications from storage:', notifications);
      console.log('📸 Auto save from storage:', autoSaveGallery);

      if (notifications !== null) {
        const notificationsValue = JSON.parse(notifications);
        setNotificationsEnabled(notificationsValue);
        console.log('🔔 Set notifications to:', notificationsValue);
      }
      if (notificationsTime !== null) {
        try {
          const parsed = JSON.parse(notificationsTime);
          if (typeof parsed.hour === 'number') setNotificationHour(parsed.hour);
          if (typeof parsed.minute === 'number') setNotificationMinute(parsed.minute);
          console.log('⏰ Loaded notification time:', parsed);
        } catch (err) {
          console.warn('Failed to parse notificationsTime', err);
        }
      }
      if (autoSaveGallery !== null) {
        const autoSaveValue = JSON.parse(autoSaveGallery);
        setAutoSave(autoSaveValue);
        console.log('📸 Set auto save to:', autoSaveValue);
      }
    } catch {
      console.error('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      console.log(`💾 Saving ${key}:`, value);
      await AsyncStorage.setItem(key, JSON.stringify(value));
      console.log(`✅ Successfully saved ${key} to AsyncStorage`);
      return true;
    } catch (error) {
      console.log(`❌ Error saving ${key}:`, error);
      return false;
    }
  };

  const saveNotificationTime = async (hour: number, minute: number) => {
    try {
      const payload = { hour, minute };
      await AsyncStorage.setItem('notificationsTime', JSON.stringify(payload));
      setNotificationHour(hour);
      setNotificationMinute(minute);
      console.log('✅ Saved notification time', payload);
      // If notifications are enabled, re-schedule with the new time
      if (notificationsEnabled) {
  const granted = await requestPermissions();
  if (granted) await scheduleDailySummary(hour, minute);
        else Alert.alert('Permission required', 'Enable notifications to receive daily summaries');
      }
      return true;
    } catch (err) {
      console.warn('Failed to save notification time', err);
      return false;
    }
  };

  const handleDarkModeToggle = async (value: boolean) => {
    console.log('🌙 Dark mode toggle called with value:', value);
    toggleDarkMode(value);
    Alert.alert('Theme Changed', `Switched to ${value ? 'dark' : 'light'} mode`, [{ text: 'OK' }]);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    console.log('🔔 Notifications toggle called with value:', value);
    setNotificationsEnabled(value);
    const saveSuccess = await saveSetting('notifications', value);

    if (saveSuccess) {
      if (value) {
        // Request permission and schedule
        const granted = await requestPermissions();
        if (granted) {
          await scheduleDailySummary(notificationHour, notificationMinute);
          Alert.alert('Notifications Enabled', 'You will receive workout reminders and progress updates', [{ text: 'OK' }]);
        } else {
          Alert.alert('Permission required', 'Please allow notifications in your device settings');
          // rollback setting
          setNotificationsEnabled(false);
          await saveSetting('notifications', false);
        }
      } else {
  await cancelAllNotifications();
        Alert.alert('Notifications Disabled', 'You will no longer receive push notifications', [{ text: 'OK' }]);
      }
    } else {
      Alert.alert('Error', 'Failed to save notification setting');
      setNotificationsEnabled(!value);
    }
  };

  // Time is selected via native DateTimePicker; helpers removed

  const handleAutoSaveToggle = async (value: boolean) => {
    console.log('📸 Auto save toggle called with value:', value);
    setAutoSave(value);
    const saveSuccess = await saveSetting('autoSave', value);

    if (saveSuccess) {
      Alert.alert('Auto Save Settings', value ? 'Progress photos will be saved to your gallery automatically' : 'Photos will only be saved in the app', [{ text: 'OK' }]);
    } else {
      Alert.alert('Error', 'Failed to save auto save setting');
      setAutoSave(!value);
    }
  };

  const handleSendTestSummary = async () => {
    try {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Permission required', 'Please enable notifications in your device settings to receive test summaries.');
        return;
      }
      await sendImmediateSummary();
      Alert.alert('Test Sent', 'A test summary notification was scheduled/sent.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send test summary');
    }
  };

  const handleLogout = async () => {
    try {
      // Preserve progressPhotos across logout so user's progress remains locally available.
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter((k) => k !== 'progressPhotos');
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (err) {
      console.warn('Error clearing storage on logout, preserving progressPhotos', err);
    } finally {
      router.replace('/(auth)/login');
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert('Delete Account', 'Are you sure you want to delete your account? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Alert.alert('Delete Account', 'Attempting to call delete-account function...');
          try {
            const session = await supabase.auth.getSession();
            const accessToken = session?.data?.session?.access_token;
            if (!accessToken) throw new Error('No active session');

            // Invoke Supabase Edge Function and pass the user's access token for verification
            const funcRes = await supabase.functions.invoke('delete-account', {
              body: JSON.stringify({}),
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            console.log('delete-account function response:', funcRes);
            if (funcRes.error) {
              throw new Error(funcRes.error.message || 'Failed');
            }
            await AsyncStorage.clear();
            Alert.alert('Account Deleted', 'Your account has been deleted.');
            router.replace('/(auth)/login');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete account.');
          }
        },
      },
    ]);
  };

  // Replace missing theme properties with fallback values
  const colors = isDarkMode
    ? {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.notification,
        primaryDark: '#7C3AED',
        surface: '#1F2937',
        textSecondary: '#D1D5DB',
        textTertiary: '#9CA3AF',
        error: '#EF4444',
      }
    : {
        primary: '#A855F7',
        primaryDark: '#7C3AED',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        card: '#FFFFFF',
        text: '#1F2937',
        textSecondary: '#6B7280',
        textTertiary: '#9CA3AF',
        border: '#E5E7EB',
        error: '#EF4444',
      };

  const SettingsSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );

  const SettingsItem = ({ icon, title, subtitle, onPress, rightElement, isLast = false }: { icon: any, title: string, subtitle?: string, onPress?: () => void, rightElement?: React.ReactNode, isLast?: boolean }) => (
    <TouchableOpacity
      style={[styles.settingsItem, { borderBottomColor: colors.border }, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surface }]}> 
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.settingsItemTextContainer}>
          <Text style={[styles.settingsItemTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingsItemSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />)}
    </TouchableOpacity>
  );
  // removed useSafeAreaInsets to simplify header padding on this screen

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* User Profile Section - No redundant header, works with existing navigation */}
  <View style={[styles.userSection, { backgroundColor: colors.primary, paddingTop: 40 }]}>
    <TouchableOpacity
      onPress={() => router.back()}
      style={{
        position: 'absolute',
        top: 16,
        right:16,
        zIndex: 1,
        padding: 2,
      }}
    >
      <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
    </TouchableOpacity>
    <View style={styles.userContent}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user?.fullName?.charAt(0)?.toUpperCase() || 'U'}</Text>
      </View>
      <View style={styles.userInfo}>
        {/* Only show name/email if user is signed in */}
        {user?.email && user?.email !== 'user@example.com' ? (
          <>
            <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </>
        ) : null}
      </View>
    </View>
  </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Settings */}
        <SettingsSection title="ACCOUNT">
          <SettingsItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your personal information"
            onPress={() => router.push('/(settings)/edit-profile')}
          />
          <SettingsItem
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Update your password"
            onPress={() => router.push('/(settings)/change-password')}
          />
          <SettingsItem
            icon="trash-outline"
            title="Delete Account"
            subtitle="Permanently remove your account"
            onPress={handleDeleteAccount}
          />
          <SettingsItem
            icon="shield-checkmark-outline"
            title="Privacy & Security"
            subtitle="Manage your privacy settings"
            onPress={() => Alert.alert('Privacy & Security', 'Privacy settings coming soon!')}
            isLast
          />
        </SettingsSection>

        {/* Camera & Photos */}
        <SettingsSection title="CAMERA & PHOTOS">
          <SettingsItem
            icon="images-outline"
            title="Auto Save to Gallery"
            subtitle={autoSave ? 'Photos saved to gallery' : 'Photos saved in app only'}
            rightElement={
              <Switch
                value={autoSave}
                onValueChange={(value) => {
                  console.log('📸 Auto save switch toggled to:', value);
                  handleAutoSaveToggle(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={'#FFFFFF'}
              />
            }
            isLast
          />
        </SettingsSection>

      {/* App Settings - NO LANGUAGE OPTION */}
  
        <SettingsSection title="APP SETTINGS">
          <SettingsItem
            icon="notifications-outline"
            title="Notifications"
            subtitle={notificationsEnabled ? 'Workout reminders enabled' : 'All notifications disabled'}
            rightElement={
              <Switch
                value={notificationsEnabled}
                onValueChange={(value) => {
                  console.log('🔔 Notifications switch toggled to:', value);
                  handleNotificationsToggle(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={'#FFFFFF'}
              />
            }
          />
          {notificationsEnabled && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <TouchableOpacity onPress={() => setShowTimePicker(true)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Daily summary time</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{String(notificationHour).padStart(2, '0')}:{String(notificationMinute).padStart(2, '0')}</Text>
                </View>
                <Text style={{ color: colors.primary }}>{Platform.OS === 'android' ? 'Change' : ''}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={new Date(0, 0, 0, notificationHour, notificationMinute)}
                  mode="time"
                  is24Hour={true}
                  onChange={async (event: any, selected?: Date | undefined) => {
                    setShowTimePicker(Platform.OS === 'ios');
                    if (event.type === 'dismissed') return;
                    const date = selected || (event as any)?.nativeEvent?.timestamp;
                    if (!date) return;
                    const d = selected instanceof Date ? selected : new Date(date);
                    const h = d.getHours();
                    const m = d.getMinutes();
                    await saveNotificationTime(h, m);
                  }}
                />
              )}
            </View>
          )}
          <SettingsItem
            icon={isDarkMode ? 'moon' : 'sunny'}
            title="Dark Mode"
            subtitle={isDarkMode ? 'Dark mode enabled' : 'Light mode active'}
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={(value) => {
                  console.log('🌙 Dark mode switch toggled to:', value);
                  handleDarkModeToggle(value);
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={'#FFFFFF'}
              />
            }
            isLast
          />
          <SettingsItem
            icon="send-outline"
            title="Send test summary now"
            subtitle="Sends a test daily-summary notification immediately"
            onPress={handleSendTestSummary}
          />
        </SettingsSection>
        {/* Support */}
        <SettingsSection title="SUPPORT">
          <SettingsItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Contact us at capturefit1@gmail.com"
            onPress={() => {
              Alert.alert(
                'Contact Support',
                'For help, email us at capturefit1@gmail.com',
                [
                  { text: 'Copy Email', onPress: () => {
                    // Copy email to clipboard
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText('capturefit1@gmail.com');
                      Alert.alert('Copied!', 'Email address copied to clipboard.');
                    }
                  }},
                  { text: 'OK' }
                ]
              );
            }}
          />
          <SettingsItem
            icon="document-text-outline"
            title="Terms of Service"
            onPress={() => Alert.alert('Terms of Service', 'Terms coming soon!')}
          />
          <SettingsItem
            icon="shield-outline"
            title="Privacy Policy"
            onPress={() => Alert.alert('Privacy Policy', 'Privacy policy coming soon!')}
          />
          <SettingsItem
            icon="information-circle-outline"
            title="About"
            subtitle="Version 1.0.0"
            onPress={() => Alert.alert('About CaptureFit', 'AI-powered fitness progress tracking app')}
            isLast
          />
        </SettingsSection>
        {/* Logout */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={() => {
              console.log('🚪 Logout button pressed');
              handleLogout();
            }}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}




const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userSection: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingBottom: 24,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#A855F7',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    margin: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    minHeight: 60,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsItemTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  settingsItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  settingsItemSubtitle: {
    fontSize: 14,
    marginTop: 2,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100,
  },
});
