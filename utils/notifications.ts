import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Show notifications when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Can't request permissions on simulator/emulator
    return false;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

type ProgressPhoto = {
  timestamp?: string | number;
  date?: string | number;
  createdAt?: string | number;
  uri?: string;
};

function parsePhotoDate(p?: ProgressPhoto): Date | null {
  if (!p) return null;
  const raw = p.timestamp ?? p.date ?? p.createdAt ?? p.uri;
  if (!raw) return null;
  const d = new Date(raw as string | number);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function getTodayPhotoCount(): Promise<number> {
  try {
    const json = await AsyncStorage.getItem('progressPhotos');
    if (!json) return 0;
    const photos = (JSON.parse(json) as ProgressPhoto[]) ?? [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return photos.reduce((acc, p) => {
      try {
        const d = parsePhotoDate(p);
        if (!d) return acc;
        d.setHours(0, 0, 0, 0);
        return acc + (d.getTime() === today.getTime() ? 1 : 0);
      } catch {
        // ignore malformed entries
        return acc;
      }
    }, 0);
  } catch {
    console.warn('Failed to read progressPhotos from storage');
    return 0;
  }
}

export async function scheduleDailySummary(hour = 19, minute = 0): Promise<void> {
  // Cancel existing scheduled notifications to avoid duplicates
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('Failed to cancel scheduled notifications', err);
  }

  const granted = await requestPermissions();
  if (!granted) return;

  const count = await getTodayPhotoCount();
  const body =
    count === 0
      ? "You haven't taken any progress photos today. Tap to capture your progress."
      : `You've taken ${count} photo${count === 1 ? '' : 's'} today. Keep going!`;

  const trigger: Notifications.NotificationTriggerInput = {
    type: 'calendar',
    hour,
    minute,
    repeats: true,
  } as Notifications.NotificationTriggerInput;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Capture Fit — Daily Summary',
      body,
      data: { type: 'daily-summary' },
    },
    trigger,
  });
}

export async function sendImmediateSummary(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  const count = await getTodayPhotoCount();
  const body =
    count === 0
      ? 'No progress photos yet today. Take one to track your progress.'
      : `You have ${count} photo${count === 1 ? '' : 's'} so far today.`;

  await Notifications.scheduleNotificationAsync({
    content: { title: 'Capture Fit — Status', body },
    // undefined trigger -> immediate
    trigger: undefined as unknown as Notifications.NotificationTriggerInput,
  });
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('Failed to cancel scheduled notifications', err);
  }
}

export default {
  requestPermissions,
  scheduleDailySummary,
  sendImmediateSummary,
  cancelAllNotifications,
};
