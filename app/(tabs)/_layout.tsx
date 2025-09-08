import { Colors } from "@/constants/Colors";
import { useTheme } from "@/contexts/ThemeContext";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import React, { createContext, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { requestPermissions, scheduleDailySummary } from '../../utils/notifications';
import { supabase } from '../../utils/supabase';

export type RootStackParamList = {
  homepage: undefined;
  camera: undefined;
  aicoach: undefined;
  progress: undefined;
  profile: undefined;
  settings: undefined;
};

export interface Photo {
  id: string;
  uri: string;
  timestamp: string;
  analysis: string | null;
  analyzed: boolean;
  progressScore: number | null;
}

export const PhotoContext = createContext<{
  photos: Photo[];
  setPhotos: React.Dispatch<React.SetStateAction<Photo[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  reloadPhotos: () => Promise<void>;
}>({
  photos: [],
  setPhotos: () => {},
  loading: false,
  setLoading: () => {},
  reloadPhotos: async () => {},
});

export default function TabLayout() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useTheme();
  const themeColors = isDarkMode ? Colors.dark : Colors.light;
  const bg = theme.colors.background;
  const activeTint = isDarkMode ? theme.colors.text : themeColors.tabIconSelected;
  const inactiveTint = isDarkMode ? Colors.dark.icon : Colors.light.tabIconDefault;


  // Expose reloadPhotos for other components
  const reloadPhotos = async () => {
    await loadPhotos();
  };

  useEffect(() => {
    const synchronizeStorageAndDatabase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Get all files from Storage
        const { data: files, error: listError } = await supabase.storage
          .from('photos')
          .list(user.id, { limit: 1000 }); // Increase limit if needed
        if (listError) throw listError;

        // 2. Get all photo URLs from the database
        const { data: dbPhotos, error: dbError } = await supabase
          .from('photos')
          .select('url')
          .eq('user_id', user.id);
        if (dbError) throw dbError;

        const dbUrls = new Set(dbPhotos.map(p => p.url));

        // 3. Find files that are in storage but not in the database
        const missingPhotos = [];
        for (const file of files) {
          const { data: { publicUrl } } = supabase.storage
            .from('photos')
            .getPublicUrl(`${user.id}/${file.name}`);
          
          if (!dbUrls.has(publicUrl)) {
            missingPhotos.push({
              user_id: user.id,
              url: publicUrl,
              timestamp: file.created_at,
              analysis: 'No analysis available for this photo.', // Default analysis
            });
          }
        }

        // 4. Insert missing photo records into the database
        if (missingPhotos.length > 0) {
          console.log(`Found ${missingPhotos.length} photos to backfill. Syncing...`);
          const { error: insertError } = await supabase.from('photos').insert(missingPhotos);
          if (insertError) {
            console.error('Error backfilling photos:', insertError);
          } else {
            console.log('Successfully backfilled photos.');
            // Reload photos to reflect the changes
            await loadPhotos();
          }
        }
      } catch (error) {
        console.error('Failed to synchronize storage and database:', error);
      }
    };

    const handleSync = async () => {
      try {
        const lastSync = await AsyncStorage.getItem('lastPhotoSync');
        const now = new Date().getTime();
        // Sync if it's been more than an hour, or never synced
        const oneHour = 60 * 60 * 1000;

        if (!lastSync || (now - parseInt(lastSync, 10)) > oneHour) {
          console.log('Starting photo synchronization...');
          await synchronizeStorageAndDatabase();
          await AsyncStorage.setItem('lastPhotoSync', now.toString());
          console.log('Photo synchronization finished.');
        } else {
          console.log('Skipping photo synchronization, recently performed.');
        }
      } catch (error) {
        console.warn('Failed to run photo sync:', error);
      }
    };

    loadPhotos(); // Load photos immediately from DB

    // Run synchronization in the background after a short delay
    const timer = setTimeout(() => {
      handleSync();
    }, 2000); // Increased delay slightly

    // On app start, if notifications enabled, restore scheduling
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('notifications');
        const enabled = raw !== null ? JSON.parse(raw) : false;
        if (enabled) {
          const timeRaw = await AsyncStorage.getItem('notificationsTime');
          let hour = 19;
          let minute = 0;
          if (timeRaw) {
            try {
              const parsed = JSON.parse(timeRaw);
              if (typeof parsed.hour === 'number') hour = parsed.hour;
              if (typeof parsed.minute === 'number') minute = parsed.minute;
            } catch {
              // ignore parse errors and use defaults
            }
          }
          const granted = await requestPermissions();
          if (granted) {
            await scheduleDailySummary(hour, minute);
          } else {
            console.log('Notifications permission not granted; skipping schedule');
          }
        }
      } catch (err) {
        console.warn('Error restoring notifications schedule:', err);
      }
    })();

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhotos([]);
        return;
      }

      // Fetch photo metadata from the 'photos' table
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error("Error fetching photos from database:", error);
        throw error;
      }

      if (data) {
        // The 'url' from the database is already the public URL
        const loadedPhotos = data.map(photo => ({
          id: photo.id,
          uri: photo.url, // Use the URL directly from the table
          timestamp: photo.timestamp,
          analysis: photo.analysis,
          analyzed: !!photo.analysis, 
          progressScore: null, // Do not compare or score
        }));
        setPhotos(loadedPhotos);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PhotoContext.Provider value={{ photos, setPhotos, loading, setLoading, reloadPhotos }}>
      <Tabs
        initialRouteName="homepage"
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: activeTint,
          tabBarInactiveTintColor: inactiveTint,
          tabBarStyle: {
            backgroundColor: bg,
            borderTopWidth: 0,
            elevation: isDarkMode ? 0 : 5,
            shadowColor: isDarkMode ? "transparent" : undefined,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
        }}
      >
        <Tabs.Screen
          name="homepage"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="aicoach"
          options={{
            title: "AI Coach",
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="robot" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: "Progress",
            tabBarIcon: ({ color, size }) => (
              <Feather name="bar-chart-2" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
  {/* Settings tab removed. Now accessible from Profile tab only. */}
      </Tabs>
    </PhotoContext.Provider>
  );
}

