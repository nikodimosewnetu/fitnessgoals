import HomeScreen from "@/components/HomeScreen";
import React, { useContext } from "react";
import { PhotoContext } from "./_layout";

import Constants from 'expo-constants';

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "expo-router";

type RootStackParamList = {
  homepage: undefined;
  camera: undefined;
  aicoach: undefined;
  progress: undefined;
  profile: undefined;
  settings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomePage() {
  const { photos, setPhotos, loading, setLoading } = useContext(PhotoContext);
  const navigation = useNavigation<NavigationProp>();
  const supabaseUrl = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const openaiApiKey = Constants.expoConfig.extra.OPENAI_API_KEY;
  const cloudinaryUrl = Constants.expoConfig.extra.EXPO_PUBLIC_CLOUDINARY_URL;
  const uploadPreset = Constants.expoConfig.extra.EXPO_PUBLIC_UPLOAD_PRESET;
  const supabaseProjectRef = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_PROJECT_REF;
  return (
    <HomeScreen
      photos={photos}
      setPhotos={setPhotos}
      loading={loading}
      setLoading={setLoading}
      navigation={navigation}
    />
  );
}

