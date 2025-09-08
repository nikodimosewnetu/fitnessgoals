import { AuthContext } from "@/app/_layout";
import { theme } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { supabase } from '../../utils/supabase';
import { emitUserChange } from '../../utils/userEvents';

export default function SignupScreen() {
  const auth = useContext(AuthContext);
  const signIn = auth?.signIn;
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
    const [passwordError, setPasswordError] = useState("");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const inputTextColor = isDark ? "#F3F4F6" : theme.colors.text;
  const inputBgColor = isDark ? "#1F2937" : "#fff";
  const placeholderColor = isDark ? "#9CA3AF" : "#6B7280";

  // Password validation function
  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pwd)) return "Password must include an uppercase letter.";
    if (!/[a-z]/.test(pwd)) return "Password must include a lowercase letter.";
    if (!/[0-9]/.test(pwd)) return "Password must include a number.";
    if (!/[!@#$%^&*(),.?\":{}|<>\[\]\\/;'`~_-]/.test(pwd)) return "Password must include a special character.";
    return "";
  };

  const handlePasswordChange = (pwd: string) => {
    setPassword(pwd);
    setPasswordError(validatePassword(pwd));
  };

  const handleSignup = async () => {
    setFeedback("");
    if (validatePassword(password)) {
      setFeedback(validatePassword(password));
      return;
    }
    try {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { fullName: name } } });
      if (error) throw error;

      // signUp may not return a session if your Supabase project requires email confirmation.
      let user = (data as any)?.user ?? null;
      let session = (data as any)?.session ?? null;

      // If no session, try signing in (works if confirmation is not required)
      if (!session) {
        try {
          const signInRes = await supabase.auth.signInWithPassword({ email, password });
          if (!signInRes.error) {
            session = signInRes.data.session ?? null;
            user = signInRes.data.user ?? user;
          }
        } catch (inner) {
          console.warn('signInWithPassword after signUp failed:', inner);
        }
      }

      // Only upsert profile if we have an authenticated session (required by RLS)
      if (user?.id && session?.access_token) {
        try {
          await supabase.from('profiles').upsert({ id: user.id, full_name: name });
        } catch (upsertErr) {
          console.warn('Failed to upsert profile immediately after signup:', upsertErr);
        }
      } else {
        // No session: skip server-side profile write to avoid AuthSessionMissingError
        console.log('No session available after signup; profile upsert skipped. User may need to confirm email.');
      }

      // Persist lightweight local user info and notify UI
      await AsyncStorage.setItem('user', JSON.stringify({ fullName: name, email }));
      try { emitUserChange({ fullName: name, email, avatar: null }); } catch (e) { console.warn('emitUserChange failed:', e); }

      if (session?.access_token) {
        if (!signIn) throw new Error('Auth context not available');
        await signIn(session.access_token);
        setFeedback('Signup successful!');
        router.replace('/(tabs)/homepage');
      } else {
        setFeedback('Check your email to confirm your account before logging in.');
        router.replace('/(auth)/login');
      }
    } catch (error: any) {
      setFeedback(error.message || 'Network error. Please try again.');
      console.log('❌ Signup error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <View style={styles.form}>
        <TextInput
          placeholder="Full Name"
          value={name}
          onChangeText={setName}
          style={[styles.input, { color: inputTextColor, backgroundColor: inputBgColor }]}
          placeholderTextColor={placeholderColor}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { color: inputTextColor, backgroundColor: inputBgColor }]}
          placeholderTextColor={placeholderColor}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Password"
          value={password}
            onChangeText={handlePasswordChange}
          style={[styles.input, { color: inputTextColor, backgroundColor: inputBgColor }]}
          placeholderTextColor={placeholderColor}
          secureTextEntry
        />
          {passwordError ? (
            <Text style={{ color: 'red', marginBottom: 4 }}>{passwordError}</Text>
          ) : null}
        <Pressable style={styles.button} onPress={handleSignup}>
          <Text style={styles.buttonText}>Create Account</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.switchText}>
            Already have an account?{" "}
            <Text style={styles.link}>Sign In</Text>
          </Text>
        </Pressable>
        <Text style={{ color: feedback.includes('successful') ? 'green' : 'red', textAlign: 'center', marginBottom: 10 }}>{feedback}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "white",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 40,
    color: theme.colors.text,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  switchText: {
    textAlign: "center",
    marginTop: 16,
    color: "#6B7280",
  },
  link: {
    color: theme.colors.primary,
    fontWeight: "600",
  },
});

