import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Slide = {
  title: string;
  subtitle: string;
  icon: string;
  colors: readonly [string, string];
};

const slides: Slide[] = [
  {
    title: "Track Your Progress",
    subtitle: "Take photos and let AI analyze your fitness journey",
    icon: "📷",
    colors: ["#A855F7", "#7C3AED"],
  },
  {
    title: "AI-Powered Analysis",
    subtitle: "Get detailed insights about your body transformation",
    icon: "⚡",
    colors: ["#10B981", "#059669"],
  },
  {
    title: "Stay Motivated",
    subtitle: "Build streaks and celebrate your achievements",
    icon: "📈",
    colors: ["#F59E0B", "#D97706"],
  },
];

export default function IntroScreen() {
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const slide = slides[index];

  const next = async () => {
    console.log("Next button pressed", index);
    if (index < slides.length - 1) {
      setIndex(index + 1);
    } else {
      try {
        await AsyncStorage.setItem("onboarded", "true");
        router.replace("/(auth)/login");
      } catch (e) {
        console.log("Error onboarding, fallback to login", e);
        router.replace("/(auth)/login");
      }
    }
  };

  return (
    <LinearGradient colors={slide.colors} style={styles.container}>
      <Pressable
        onPress={async () => {
          console.log("Skip button pressed");
          try {
            await AsyncStorage.setItem("onboarded", "true");
            console.log("Onboarded flag set");
          } catch (e) {
            console.log("Error setting onboarded flag", e);
          }
          router.replace("/(auth)/login");
        }}
        style={styles.skip}
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.icon}>{slide.icon}</Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable style={styles.nextButton} onPress={next}>
          <Text style={styles.nextText}>
            {index === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  skip: {
    alignSelf: "flex-end",
  },
  skipText: {
    color: "white",
    fontSize: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 60,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "white",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  footer: {
    alignItems: "center",
    marginBottom: 40,
  },
  pagination: {
    flexDirection: "row",
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: "white",
    width: 20,
  },
  nextButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  nextText: {
    color: "white",
    fontWeight: "600",
  },
});

