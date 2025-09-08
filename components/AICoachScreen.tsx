"use client"

import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { LinearGradient } from "expo-linear-gradient"
import { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native"
import { useTheme } from "../contexts/ThemeContext"
import { ImageAnalysis } from "../utils/imageAnalysis"
import { supabase, SupabaseService } from "../utils/supabase"

interface Message {
  id: string
  type: "user" | "ai"
  text: string
  timestamp: number
  images?: string[]
  isStreaming?: boolean
  analysisData?: any
}

interface UserProfile {
  fitnessGoal: string
  fitnessLevel: string
  age: string
  weight: string
  targetWeight: string
  injuries: string[]
}

interface ProgressData {
  currentPhoto?: string
  previousPhoto?: string
  analysisResults?: any
  comparisonResults?: any
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

export default function AICoachScreen() {
  // Status for analysis and comparison
  const [statusMessage, setStatusMessage] = useState<string>("")
  const colorScheme = useColorScheme()
  const isDark = colorScheme === "dark"

  // Theme colors
  const { isDarkMode, theme } = useTheme()
  const styles = getStyles(isDarkMode, theme, screenWidth)

  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [progressData, setProgressData] = useState<ProgressData>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const scrollViewRef = useRef<ScrollView>(null)
  const imageAnalysis = useRef(new ImageAnalysis())
  const streamingAnimation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    initializeCoach()
    loadUserProfile()
    startStreamingAnimation()
  }, [])

  const startStreamingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(streamingAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(streamingAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }

  const initializeCoach = async () => {
    try {
      const welcomeMessage: Message = {
        id: "welcome",
        type: "ai",
        text: "🏋️‍♂️ Welcome to your AI Fitness Coach! I'm here to help you achieve your fitness goals through:\n\n• 📸 Advanced photo progress analysis using AI\n• 💪 Personalized workout recommendations\n• 🥗 Nutrition guidance\n• 📊 Real-time progress tracking\n\nUpload a progress photo or ask me anything about fitness!",
        timestamp: Date.now(),
        images: [],
      }

      setMessages([welcomeMessage])

      // Initialize TensorFlow.js
      await imageAnalysis.current.initialize()

      console.log("[v0] AI Coach initialized successfully")
    } catch (error) {
      console.error("[v0] AI Coach initialization failed:", error)
    }
  }

  const loadUserProfile = async () => {
    try {
      const profile = await SupabaseService.getUserProfile()
      if (profile) {
        setUserProfile({
          fitnessGoal: profile.fitness_goal || "",
          fitnessLevel: profile.fitness_level || "beginner",
          age: profile.age?.toString() || "",
          weight: profile.weight?.toString() || "",
          targetWeight: profile.target_weight?.toString() || "",
          injuries: profile.injuries || [],
        })
      }
    } catch (error) {
      console.error("[v0] Failed to load user profile:", error)
    }
  }

  const handleSendMessage = async () => {
    const text = inputText.trim()
    if (!text || isTyping) return

    try {
      const userMessage: Message = {
        id: generateMessageId(),
        type: "user",
        text,
        timestamp: Date.now(),
        images: [],
      }

      setMessages((prev) => [...prev, userMessage])
      setInputText("")
      setIsStreaming(true)

      // Create streaming AI message placeholder
      const streamingMessage: Message = {
        id: generateMessageId(),
        type: "ai",
        text: "",
        timestamp: Date.now(),
        images: [],
        isStreaming: true,
      }

      setMessages((prev) => [...prev, streamingMessage])

      const payload = await preparePayload(text)
      await sendToAIWithStreaming(payload, streamingMessage.id)
    } catch (error) {
      console.error("[v0] Failed to send message:", error)
      setIsStreaming(false)

      const errorMessage: Message = {
        id: generateMessageId(),
        type: "ai",
        text: "I'm temporarily unavailable. Please try again in a moment. 🔄",
        timestamp: Date.now(),
        images: [],
      }

      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const sendToAIWithStreaming = async (payload: any, messageId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("aicoach", {
        body: payload,
      })

      if (error) throw error

      setIsStreaming(false)

      let responseText = ""
      if (typeof data === "string") {
        responseText = data
      } else if (data?.response) {
        responseText = data.response
      } else {
        responseText = "I received your message but couldn't generate a proper response. Please try again. 🤔"
      }

      // Simulate streaming effect
      await simulateStreamingText(responseText, messageId)
    } catch (error) {
      console.error("[v0] AI request failed:", error)
      setIsStreaming(false)
      throw error
    }
  }

  const simulateStreamingText = async (fullText: string, messageId: string) => {
    const words = fullText.split(" ")
    let currentText = ""

    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? " " : "") + words[i]

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, text: currentText, isStreaming: i < words.length - 1 } : msg,
        ),
      )

      // Add delay for streaming effect
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  const preparePayload = async (text: string) => {
    let enhancedText = text

    if (progressData.analysisResults) {
      enhancedText += `\n\nLatest Photo Analysis Results:\n${JSON.stringify(progressData.analysisResults, null, 2)}`
    }

    if (progressData.comparisonResults) {
      enhancedText += `\n\nProgress Comparison:\n${JSON.stringify(progressData.comparisonResults, null, 2)}`
    }

    if (userProfile?.fitnessGoal) {
      enhancedText += `\n\nUser's fitness goal: ${userProfile.fitnessGoal}`
    }
    if (userProfile?.fitnessLevel) {
      enhancedText += `\nFitness level: ${userProfile.fitnessLevel}`
    }

    return {
      text: enhancedText,
      goal: userProfile?.fitnessGoal || "",
      userProfile: {
        fitnessLevel: userProfile?.fitnessLevel || "beginner",
        age: userProfile?.age ? Number.parseInt(userProfile.age) : undefined,
        injuries: userProfile?.injuries || [],
      },
    }
  }

  const handlePhotoUpload = async () => {
    try {
      console.log("[v0] === Starting photo upload process ===")

      console.log("[v0] Requesting media library permissions...")
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      console.log("[v0] Requesting camera permissions...")
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync()

      console.log("[v0] Media library permission:", mediaStatus)
      console.log("[v0] Camera permission:", cameraStatus)

      if (mediaStatus !== "granted") {
        console.log("[v0] Media library permission denied")
        Alert.alert("Permission needed", "We need access to your photos to analyze your fitness progress.")
        return
      }

      console.log("[v0] Launching image picker with enhanced options...")
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        allowsMultipleSelection: false,
        selectionLimit: 1,
        exif: false,
        base64: true, // Request base64 directly from ImagePicker
      })

      console.log("[v0] Image picker result:", {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
        firstAsset: result.assets?.[0]
          ? {
              uri: result.assets[0].uri,
              width: result.assets[0].width,
              height: result.assets[0].height,
              fileSize: result.assets[0].fileSize,
              type: result.assets[0].type,
              hasBase64: !!result.assets[0].base64,
            }
          : null,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        console.log("[v0] ✓ Image selected successfully:", asset.uri)
        console.log("[v0] Image dimensions:", asset.width, "x", asset.height)
        console.log("[v0] File size:", asset.fileSize, "bytes")

        if (!asset.base64) {
          console.error("[v0] ❌ No base64 data available from ImagePicker")
          Alert.alert("Upload Error", "Failed to process image data. Please try again.")
          return
        }

        setIsAnalyzing(true)

        try {
          console.log("[v0] Getting current user...")
          const user = await SupabaseService.getCurrentUser()
          if (!user) {
            console.log("[v0] ❌ User not authenticated")
            Alert.alert("Authentication Error", "Please sign in to upload photos.")
            setIsAnalyzing(false)
            return
          }
          console.log("[v0] ✓ User authenticated:", user.id)

          console.log("[v0] Fetching previous photos for comparison...")
          const { data: lastPhoto, error: fetchError } = await supabase
            .from("photos")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

          let previousPhotoUrl = null
          if (!fetchError && lastPhoto) {
            previousPhotoUrl = lastPhoto.url || SupabaseService.getPhotoUrl(lastPhoto.file_name)
            console.log("[v0] ✓ Found previous photo for comparison:", previousPhotoUrl)
          } else {
            console.log("[v0] No previous photo found, this will be the first photo")
            if (fetchError && fetchError.code !== "PGRST116") {
              console.log("[v0] Previous photo fetch error:", fetchError)
            }
          }

          const fileName = `${user.id}/${Date.now()}_progress.jpg`
          console.log("[v0] Preparing file upload via Edge Function:", fileName)

          console.log("[v0] ✓ Base64 data available from ImagePicker, length:", asset.base64.length)

          const uploadPayload = {
            userId: user.id,
            fileName,
            fileBase64: asset.base64,
            contentType: "image/jpeg",
          }

          console.log("[v0] Invoking upload-photo Edge Function with payload structure:", {
            userId: uploadPayload.userId,
            fileName: uploadPayload.fileName,
            contentType: uploadPayload.contentType,
            base64Length: uploadPayload.fileBase64.length,
          })

          const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-photo", {
            body: uploadPayload,
          })

          if (uploadError) {
            console.error("[v0] ❌ Upload-photo Edge Function error:", uploadError)
            throw new Error(`Edge Function upload failed: ${uploadError.message}`)
          }

          console.log("[v0] Edge Function response:", uploadData)

          if (!uploadData?.publicUrl) {
            console.error("[v0] ❌ No public URL returned from Edge Function:", uploadData)
            throw new Error("Edge Function did not return a valid public URL")
          }

            const photoUrl = uploadData.publicUrl
            setStatusMessage("Starting image analysis...")
            const currentAnalysis = await imageAnalysis.current.analyzeSingleImage(asset.uri)
            setStatusMessage("")

          let comparisonAnalysis = null
          let progressMessage = ""

          if (previousPhotoUrl) {
            setStatusMessage("Performing progress comparison...")
            comparisonAnalysis = await imageAnalysis.current.compareImages(previousPhotoUrl, asset.uri)
            setStatusMessage("")

            progressMessage =
              `\n\n📊Progress Comparison Results\n` +
              `• Overall Progress Score: ${comparisonAnalysis.progressScore}/100\n` +
              `• Total Change: ${comparisonAnalysis.changePercentage}%\n` +
              `• Upper Body: ${comparisonAnalysis.regionAnalysis.upper.score}/100\n` +
              `• Core: ${comparisonAnalysis.regionAnalysis.middle.score}/100\n` +
              `• Lower Body: ${comparisonAnalysis.regionAnalysis.lower.score}/100\n\n` +
              `🎯Recommendations\n${comparisonAnalysis.recommendations.map((r) => `• ${r}`).join("\n")}`
          } else {
            progressMessage =
              "\n\n📸First Progress Photo\nThis is your baseline photo. Upload another photo later to see your progress comparison!"
          }

          // Update progress data with Edge Function photo URL
          setProgressData({
            previousPhoto: previousPhotoUrl,
            currentPhoto: photoUrl,
            analysisResults: currentAnalysis,
            comparisonResults: comparisonAnalysis,
          })

          const photoMessage =
            `📸New Progress Photo Analyzed\n\n` +
            `🔍Image Analysis\n` +
            `• Muscle Definition Score: ${currentAnalysis.muscleDefinitionScore.toFixed(1)}/100\n` +
            `• Image Quality: ${currentAnalysis.imageQuality.quality} (${currentAnalysis.imageQuality.score}/100)\n` +
            `• Lighting Quality: ${currentAnalysis.lightingQuality.quality}\n` +
            `• Edge Intensity: ${currentAnalysis.edgeIntensity.toFixed(3)}\n` +
            `• Contrast: ${currentAnalysis.contrast.toFixed(3)}` +
            progressMessage +
            `\n\nPlease provide personalized coaching advice based on these results! 💪`

          // Add user message with photo
          const userMessage: Message = {
            id: generateMessageId(),
            type: "user",
            text: "I uploaded a new progress photo for analysis! 📸",
            timestamp: Date.now(),
            images: [asset.uri],
            analysisData: { currentAnalysis, comparisonAnalysis },
          }

          setMessages((prev) => [...prev, userMessage])
          setIsAnalyzing(false)
          console.log("[v0] ✓ Photo upload and analysis completed successfully")

          // Send analysis to AI coach with streaming
          const payload = await preparePayload(photoMessage)

          const streamingMessage: Message = {
            id: generateMessageId(),
            type: "ai",
            text: "",
            timestamp: Date.now(),
            images: [],
            isStreaming: true,
          }

          setMessages((prev) => [...prev, streamingMessage])
          await sendToAIWithStreaming(payload, streamingMessage.id)
        } catch (error) {
          console.error("[v0] ❌ Photo analysis failed:", error)
          setIsAnalyzing(false)

          let errorMessage = "Failed to analyze photo. Please try again."
          if (error.message?.includes("fetch")) {
            errorMessage = "Failed to process the image file. Please try selecting a different photo."
          } else if (error.message?.includes("Edge Function")) {
            errorMessage = "Failed to upload photo via Edge Function. Please check your internet connection."
          } else if (error.message?.includes("Database")) {
            errorMessage = "Failed to save photo record. Please try again."
          }

          Alert.alert("Analysis Error", errorMessage)
        }
      } else {
        console.log("[v0] Image picker was canceled or no image selected")
      }
    } catch (error) {
      console.error("[v0] ❌ Photo upload failed:", error)

      let errorMessage = "Failed to upload photo. Please try again."
      if (error.message?.includes("permission")) {
        errorMessage = "Camera or photo library permission denied. Please enable permissions in Settings."
      } else if (error.message?.includes("picker")) {
        errorMessage = "Failed to open image picker. Please restart the app and try again."
      }

      Alert.alert("Upload Error", errorMessage)
    }
  }

  const generateMessageId = (): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const renderMessage = (message: Message) => {
    const isUser = message.type === "user"

    return (
      <View key={message.id} style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: isUser ? theme.colors.primary : theme.colors.surface,
            },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              {
                color: isUser ? theme.colors.background : theme.colors.text,
              },
            ]}
          >
            {message.text}
          </Text>

          {/* Render all numerical analysis data if available */}
          {message.analysisData && (
            <View style={{ marginTop: 8 }}>
              {Object.entries(message.analysisData).map(([key, value]) => {
                // Only render if value is a number or a simple object with numbers
                if (typeof value === "number") {
                  return (
                    <Text key={key} style={{ fontSize: 13, color: isUser ? "#333" : "#007AFF" }}>
                      {key}: {value}
                    </Text>
                  )
                }
                if (typeof value === "object" && value !== null) {
                  return Object.entries(value)
                    .filter(([k, v]) => typeof v === "number")
                    .map(([k, v]) => (
                      <Text key={key + k} style={{ fontSize: 13, color: isUser ? "#333" : "#007AFF" }}>
                        {key} - {k}: {v}
                      </Text>
                    ))
                }
                return null
              })}
            </View>
          )}

          {message.isStreaming && (
            <Animated.View
              style={[
                styles.streamingIndicator,
                {
                  opacity: streamingAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ]}
            >
              <ActivityIndicator size="small" color={isDark ? "#64FFDA" : "#007AFF"} />
              <Text style={styles.streamingText}>AI is thinking...</Text>
            </Animated.View>
          )}

          <Text style={styles.timestamp}>{formatTimestamp(message.timestamp)}</Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {statusMessage ? (
        <View style={{ padding: 12, backgroundColor: theme.colors.card, borderRadius: 10, margin: 10, marginTop: 60 }}>
          <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 15 }}>{statusMessage}</Text>
        </View>
      ) : null}
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <LinearGradient
        colors={isDarkMode ? [theme.colors.background, theme.colors.background] : ["#fff", "#fff"]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? theme.colors.text : theme.colors.primary }]}>AI Fitness Coach</Text>
          <View style={[styles.statusBadge, { backgroundColor: isDarkMode ? theme.colors.primary : theme.colors.accent }]}>
            <View style={[styles.statusDot, { backgroundColor: isDarkMode ? theme.colors.background : theme.colors.primary }]} />
            <Text style={[styles.statusText, { color: isDarkMode ? theme.colors.background : theme.colors.primary }]}>Online</Text>
          </View>
        </View>

        {progressData.currentPhoto && (
          <View style={styles.progressIndicator}>
            <Ionicons name="trending-up" size={16} color="white" />
            <Text style={styles.progressText}>
              {progressData.comparisonResults
                ? `Progress Score: ${progressData.comparisonResults.progressScore}/100`
                : "Ready for comparison"}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.messagesContainer, { minHeight: 0, flexGrow: 1, backgroundColor: isDarkMode ? theme.colors.background : theme.colors.card }]}
        contentContainerStyle={[styles.messagesContent, { paddingBottom: 140, minHeight: 0, flexGrow: 1 }]}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View key={message.id} style={[styles.messageContainer, message.type === "user" ? styles.userMessage : styles.aiMessage]}>
            <View
              style={[
                styles.messageBubble,
                {
                  backgroundColor: message.type === "user"
                    ? (isDarkMode ? theme.colors.primary : theme.colors.primary)
                    : (isDarkMode ? theme.colors.surface : theme.colors.card),
                  minHeight: undefined, // Remove forced minHeight
                  maxHeight: undefined, // Remove forced maxHeight
                },
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color: message.type === "user"
                      ? (isDarkMode ? theme.colors.background : theme.colors.background)
                      : (isDarkMode ? theme.colors.text : theme.colors.text),
                  },
                ]}
              >
                {message.text}
              </Text>
              {/* ...existing code for analysisData, streaming, timestamp... */}
            </View>
          </View>
        ))}

        {isAnalyzing && (
          <View style={styles.analyzingContainer}>
            <View style={styles.analyzingBubble}>
              <ActivityIndicator size="small" color={isDark ? "#64FFDA" : "#007AFF"} />
              <Text style={styles.analyzingText}>Analyzing your photo with AI... 🔍</Text>
            </View>
          </View>
        )}

        {isStreaming || isAnalyzing ? (
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 16, padding: 10 }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={{ marginLeft: 10, color: theme.colors.text, fontWeight: 'bold' }}>
                {isAnalyzing ? 'AI is analyzing your photo...' : 'AI is thinking...'}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.photoButton, { backgroundColor: isDarkMode ? theme.colors.surface : theme.colors.card }]}
            onPress={handlePhotoUpload}
          >
            <Ionicons name="camera" size={24} color={isDarkMode ? theme.colors.primary : theme.colors.accent} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: isDarkMode ? theme.colors.surface : theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border,
                fontSize: 15,
                minHeight: 36,
                maxHeight: 60,
                paddingVertical: 6,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about training, nutrition, or upload a photo..."
            placeholderTextColor={isDarkMode ? theme.colors.textSecondary : theme.colors.subtitle}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: isDarkMode ? theme.colors.primary : theme.colors.accent },
              (!inputText.trim() || isStreaming) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isStreaming}
          >
            <Ionicons name="send" size={20} color={isDarkMode ? theme.colors.background : theme.colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.quickActions}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {quickActionButtons.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.quickActionButton,
                  {
                    backgroundColor: isDarkMode ? theme.colors.surface : theme.colors.card,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => setInputText(action.text)}
              >
                <Text
                  style={[
                    styles.quickActionText,
                    {
                      color: isDarkMode ? theme.colors.primary : theme.colors.primary,
                    },
                  ]}
                >
                  {action.icon} {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  )
}

const quickActionButtons = [
  { icon: "💪", label: "Weekly Plan", text: "Create my weekly workout plan" },
  { icon: "🥗", label: "Nutrition", text: "What should I eat for my goals?" },
  { icon: "📊", label: "Progress", text: "Analyze my fitness progress" },
  { icon: "🏃‍♂️", label: "Cardio", text: "Best cardio for fat loss?" },
  { icon: "🎯", label: "Form Check", text: "How can I improve my form?" },
  { icon: "💤", label: "Recovery", text: "Recovery and rest day advice" },
]

const getStyles = (isDarkMode: boolean, theme: any, screenWidth: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.colors.text,
      // Remove shadow in dark mode
      textShadowColor: isDarkMode ? 'transparent' : theme.colors.border,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 0,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginRight: 6,
    },
    statusText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "600",
    },
    progressIndicator: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      alignSelf: "flex-start",
    },
    progressText: {
      color: theme.colors.text,
      fontSize: 12,
      marginLeft: 6,
      fontWeight: "500",
    },
    messagesContainer: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
    },
    messagesContent: {
      padding: 20,
      paddingBottom: 80, // Match inputContainer height to prevent overlap
    },
    messageContainer: {
      marginBottom: 16,
    },
    userMessage: {
      alignItems: "flex-end",
    },
    aiMessage: {
      alignItems: "flex-start",
    },
    messageBubble: {
      maxWidth: screenWidth * 0.8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      shadowColor: isDarkMode ? 'transparent' : theme.colors.border,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDarkMode ? 0 : 0.08,
      shadowRadius: isDarkMode ? 0 : 3,
      elevation: isDarkMode ? 0 : 2,
      backgroundColor: theme.colors.card,
    },
    messageText: {
      fontSize: 14,
      lineHeight: 18,
      color: theme.colors.text,
    },
    timestamp: {
      fontSize: 12,
      color: theme.colors.subtitle,
      marginTop: 6,
    },
    streamingIndicator: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },
    streamingText: {
      marginLeft: 8,
      color: theme.colors.subtitle,
      fontSize: 14,
      fontStyle: "italic",
    },
    analyzingContainer: {
      alignItems: "flex-start",
      marginBottom: 16,
    },
    analyzingBubble: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      padding: 12,
      borderRadius: 20,
      borderBottomLeftRadius: 4,
    },
    analyzingText: {
      marginLeft: 8,
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    inputContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: isDarkMode ? theme.colors.background : theme.colors.card,
      paddingHorizontal: 12,
      paddingVertical: 10,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      shadowColor: isDarkMode ? 'transparent' : theme.colors.border,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: isDarkMode ? 0 : 0.07,
      shadowRadius: isDarkMode ? 0 : 8,
      elevation: isDarkMode ? 0 : 6,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginBottom: 12,
    },
    photoButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      backgroundColor: theme.colors.card,
    },
    textInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 15,
      maxHeight: 80,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      borderColor: theme.colors.border,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 12,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
      backgroundColor: theme.colors.accent,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    quickActions: {
      height: 44,
    },
    quickActionButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 22,
      marginRight: 8,
      borderWidth: 1,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
    },
    quickActionText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.primary,
    },
  })
