import ProgressScreen from "@/components/ProgressScreen";
import Constants from 'expo-constants';
import React, { useContext } from "react";
import { PhotoContext } from "./_layout";

export default function ProgressPage() {
  const { photos } = useContext(PhotoContext);
  const supabaseUrl = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const openaiApiKey = Constants.expoConfig.extra.OPENAI_API_KEY;
  const cloudinaryUrl = Constants.expoConfig.extra.EXPO_PUBLIC_CLOUDINARY_URL;
  const uploadPreset = Constants.expoConfig.extra.EXPO_PUBLIC_UPLOAD_PRESET;
  const supabaseProjectRef = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_PROJECT_REF;
  
  return <ProgressScreen photos={photos} />;
}

