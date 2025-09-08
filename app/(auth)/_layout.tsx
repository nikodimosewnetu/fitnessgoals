import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";

export default function AuthLayout() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("onboarded").then((val) => {
      setOnboarded(!!val);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <Stack
      initialRouteName={onboarded ? "login" : "index"}
    
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
    </Stack>
  );
}
