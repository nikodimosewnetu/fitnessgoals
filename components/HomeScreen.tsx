"use client"

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import type { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Camera } from "expo-camera"
// FileSystem not used in HomeScreen
// ImagePicker not used directly in HomeScreen
import { LinearGradient } from "expo-linear-gradient"
import React, { useCallback, useEffect, useState } from "react"
import {
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useTheme } from "@/contexts/ThemeContext"
import { normalizeFont, useBreakpoint } from "@/utils/responsive"
import type { Photo, RootStackParamList } from "../app/(tabs)/_layout" // Import Photo and RootStackParamList from _layout.tsx
import { supabase } from "../utils/supabase"
import { onUserChange } from "../utils/userEvents"

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Notification {
  id: string
  message: string
  timestamp: string
  read: boolean
}

interface UserStats {
  totalPhotos: number
  lastPhotoDate: string | null
  startDate: string
  currentStreak: number
  photosThisWeek: number
  updatedAt: string
}

interface HomeScreenProps {
  photos: Photo[]
  setPhotos: (photos: Photo[]) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  navigation?: NavigationProp
}

// UserType interface
interface UserType {
  fullName: string
  email: string
  avatar?: string | null
}

// screenWidth replaced by hook-driven width
// OPENAI_API_KEY not used in HomeScreen

// Helper Functions for Data Tracking
const getCurrentStreak = (photos: Photo[]): number => {
  if (photos.length === 0) return 0

  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)

    const hasPhotoOnDate = photos.some((photo) => {
      const photoDate = new Date(photo.timestamp)
      return photoDate.toDateString() === checkDate.toDateString()
    })

    if (hasPhotoOnDate) {
      streak++
    } else {
      break
    }
  }

  return streak
}

const getPhotosThisWeek = (photos: Photo[]): number => {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  return photos.filter((photo) => {
    const photoDate = new Date(photo.timestamp)
    return photoDate >= weekAgo
  }).length
}

const hasPhotoOnDate = (photos: Photo[], targetDate: Date): boolean => {
  return photos.some((photo) => {
    const photoDate = new Date(photo.timestamp)
    return photoDate.toDateString() === targetDate.toDateString()
  })
}

const saveUserStats = async (photos: Photo[]): Promise<UserStats | null> => {
  const stats: UserStats = {
    totalPhotos: photos.length,
    lastPhotoDate: photos.length > 0 ? photos[photos.length - 1].timestamp : null,
    startDate: photos.length > 0 ? photos[0].timestamp : new Date().toISOString(),
    currentStreak: getCurrentStreak(photos),
    photosThisWeek: getPhotosThisWeek(photos),
    updatedAt: new Date().toISOString(),
  }

  try {
    await AsyncStorage.setItem("userStats", JSON.stringify(stats))
    return stats
  } catch (error) {
    console.error("Error saving user stats:", error)
    return null
  }
}

const loadUserStats = async (): Promise<UserStats> => {
  try {
    const stats = await AsyncStorage.getItem("userStats")
    return stats
      ? JSON.parse(stats)
      : {
          totalPhotos: 0,
          lastPhotoDate: null,
          startDate: new Date().toISOString(),
          currentStreak: 0,
          photosThisWeek: 0,
          updatedAt: new Date().toISOString(),
        }
  } catch (error) {
    console.error("Error loading user stats:", error)
    return {
      totalPhotos: 0,
      lastPhotoDate: null,
      startDate: new Date().toISOString(),
      currentStreak: 0,
      photosThisWeek: 0,
      updatedAt: new Date().toISOString(),
    }
  }
}

// extractProgressScore removed (not used in this file)

// Main Component
export default function HomeScreen({
  photos = [],
  setPhotos = () => {},
  loading = false,
  setLoading = () => {},
  navigation,
}: HomeScreenProps) {
  const { isDarkMode, theme } = useTheme()
  useWindowDimensions() // invoke to trigger re-render on orientation change (width not directly needed here)
  const bp = useBreakpoint()
  const dim = useWindowDimensions()
  const isLandscape = dim.width > dim.height
  const styles = getStyles(isDarkMode, theme, bp, isLandscape) as any
  const barStyle = isDarkMode ? ("light-content" as const) : ("dark-content" as const)
  const barBg = isDarkMode ? theme.colors.background : "white"

  // cameraPermission state removed (not needed in HomeScreen)
  const [showWelcome, setShowWelcome] = useState<boolean>(true)
  const [currentDate] = useState<Date>(new Date())
  const [isModalVisible, setModalVisible] = useState(false)
  const [generalNotifications, setGeneralNotifications] = useState<Notification[]>([])
  const [user, setUser] = useState<UserType | null>(null)
  const [userStats, setUserStats] = useState<UserStats>({
    totalPhotos: 0,
    currentStreak: 0,
    photosThisWeek: 0,
    lastPhotoDate: null,
    startDate: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  const [userPhotos, setUserPhotos] = useState<Photo[]>([])
  // Track if we've already handled camera permission to avoid spammy logs/requests
  const cameraPermissionCheckedRef = React.useRef<boolean>(false)

  useFocusEffect(() => {
    getCameraPermission()
    checkWelcomeStatus()
    loadGeneralNotificationsData()
    // Fetch user and photos from Supabase
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        setUser(null)
        setUserPhotos([])
        setUserStats({
          totalPhotos: 0,
          currentStreak: 0,
          photosThisWeek: 0,
          lastPhotoDate: null,
          startDate: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        return
      }
      // Fetch profile info from Supabase (if you have a profiles table)
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      setUser({
        fullName: profileData?.full_name || "User",
        email: profileData?.email || "",
        avatar: profileData?.avatar_url || null,
      })
      // Fetch photos from Supabase
      const { data: photosData } = await supabase
        .from("photos")
        .select("*")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: true })
      setUserPhotos(photosData || [])
      // Compute stats
      const totalPhotos = photosData?.length || 0
      const lastPhotoDate = totalPhotos > 0 ? photosData[totalPhotos - 1].timestamp : null
      const startDate = totalPhotos > 0 ? photosData[0].timestamp : new Date().toISOString()
      const currentStreak = getCurrentStreak(photosData || [])
      const photosThisWeek = getPhotosThisWeek(photosData || [])
      setUserStats({
        totalPhotos,
        lastPhotoDate,
        startDate,
        currentStreak,
        photosThisWeek,
        updatedAt: new Date().toISOString(),
      })
    })()
  })

  // Subscribe to external user updates (from ProfileScreen)
  // loadUserData needs to be stable for effects; define above as useCallback
  const loadUserData = React.useCallback(async (): Promise<void> => {
    try {
      const userData = await AsyncStorage.getItem("user")
      if (userData) {
        const parsed = JSON.parse(userData)
        const nextUser = {
          fullName: parsed.name || parsed.fullName || "User",
          email: parsed.email || "",
          avatar: normalizeAvatarUri(parsed.avatar) || null,
        }
        // Avoid unnecessary state updates
        setUser((prev) => {
          if (!prev) return nextUser
          if (prev.fullName === nextUser.fullName && prev.email === nextUser.email && prev.avatar === nextUser.avatar)
            return prev
          return nextUser
        })
      }
    } catch (error) {
      console.error("Error loading user data:", error)
    }
  }, [])

  useEffect(() => {
    const unsub = onUserChange((u) => {
      try {
        const fullName = (u as any).fullName || (u as any).name || null
        const email = (u as any).email || null
        const avatarRaw = (u as any).avatar || (u as any).uri || (u as any).avatarUri || null
        const avatar = normalizeAvatarUri(avatarRaw) || null
        // If the payload contains at least one user field, update state directly and skip async reload
        if (fullName || email || avatar) {
          setUser((prev) => {
            const next = {
              ...(prev || { fullName: fullName || "User", email: email || "" }),
              avatar: avatar || prev?.avatar || null,
              fullName: fullName || prev?.fullName,
            } as any
            if (prev && prev.fullName === next.fullName && prev.email === next.email && prev.avatar === next.avatar)
              return prev
            return next
          })

          // If a weekStreak is provided by the profile, update userStats.currentStreak only if different
          const weekStreak = (u as any).weekStreak
          if (typeof weekStreak === "number") {
            setUserStats((s) => {
              if (s && s.currentStreak === weekStreak) return s
              return { ...(s || {}), currentStreak: weekStreak }
            })
          }
        } else {
          // Fallback: if payload is empty/unknown, reload stored user
          loadUserData()
        }
      } catch (err) {
        console.error("Error handling onUserChange:", err)
      }
    })
    return () => unsub()
  }, [loadUserData])

  const normalizeAvatarUri = (uri: string | null | undefined): string | null => {
    if (!uri) return null
    const s = String(uri)
    if (s.startsWith("http") || s.startsWith("data:") || s.startsWith("file:") || s.startsWith("content:")) return s
    if (s.startsWith("/")) return `file://${s}`
    return s
  }

  const updateUserStats = useCallback(async () => {
    // Stats now loaded from Supabase, no need to update from local photos
  }, [photos])

  useEffect(() => {
    updateUserStats()
  }, [updateUserStats])

  const loadUserStatsData = async (): Promise<void> => {
    const stats = await loadUserStats()
    setUserStats(stats)
  }

  const checkWelcomeStatus = async (): Promise<void> => {
    try {
      const hasSeenWelcome = await AsyncStorage.getItem("hasSeenWelcome")
      if (hasSeenWelcome === "true") {
        setShowWelcome(false)
      }
    } catch (error) {
      console.error("Error checking welcome status:", error)
    }
  }

  const handleGetStarted = async (): Promise<void> => {
    try {
      await AsyncStorage.setItem("hasSeenWelcome", "true")
      setShowWelcome(false)
    } catch (error) {
      console.error("Error saving welcome status:", error)
    }
  }

  const getCameraPermission = async (): Promise<void> => {
    if (cameraPermissionCheckedRef.current) return // already checked this session
    try {
      // First see current status without prompting
      const current = await Camera.getCameraPermissionsAsync()
      if (current.status !== "granted" && current.status !== "denied") {
        // Only request if it's undetermined
        await Camera.requestCameraPermissionsAsync()
      }
      // Mark as checked to prevent repeated logs/requests
      cameraPermissionCheckedRef.current = true
      // (Optional one-time log — commented out to keep console clean)
      // console.log('[camera] permission:', (await Camera.getCameraPermissionsAsync()).status);
    } catch (err) {
      console.error("Error requesting camera permission:", err)
    }
  }

  // Camera/photo processing is handled in CameraScreen; Home no longer defines processNewPhoto.

  // uriToBase64 moved to CameraScreen where needed

  const saveGeneralNotifications = async (newNotifications: Notification[]): Promise<void> => {
    try {
      await AsyncStorage.setItem("generalNotifications", JSON.stringify(newNotifications))
    } catch (error) {
      console.error("Error saving general notifications:", error)
    }
  }

  const loadGeneralNotifications = async (): Promise<Notification[]> => {
    try {
      const storedNotifications = await AsyncStorage.getItem("generalNotifications")
      return storedNotifications ? JSON.parse(storedNotifications) : []
    } catch (error) {
      console.error("Error loading general notifications:", error)
      return []
    }
  }

  const loadGeneralNotificationsData = async (): Promise<void> => {
    const loadedNotifications = await loadGeneralNotifications()
    setGeneralNotifications(loadedNotifications)
    if (loadedNotifications.length === 0) {
      // Add a welcome notification if no notifications exist
      addGeneralNotification({
        message: "Welcome to CaptureFit Progress! Start by taking your first progress photo.",
        read: false,
      })
    }
  }

  const addGeneralNotification = async (notification: Omit<Notification, "id" | "timestamp">): Promise<void> => {
    const newNotification: Notification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...notification,
    }
    const updatedNotifications = [...generalNotifications, newNotification]
    setGeneralNotifications(updatedNotifications)
    await saveGeneralNotifications(updatedNotifications)
    // Integrate push notification
    try {
      const { sendImmediateSummary } = require("../utils/notifications")
      await sendImmediateSummary()
    } catch (err) {
      console.warn("Failed to send push notification:", err)
    }
  }

  const markGeneralNotificationAsRead = async (id: string): Promise<void> => {
    const updatedNotifications = generalNotifications.map((notif) =>
      notif.id === id ? { ...notif, read: true } : notif,
    )
    setGeneralNotifications(updatedNotifications)
    await saveGeneralNotifications(updatedNotifications)
  }

  // duplicate loadUserData removed; using the stable useCallback version defined earlier

  // savePhotos removed from HomeScreen; CameraScreen owns photo persistence

  const generateWeekDays = (): { day: string; date: number; isToday: boolean; fullDate: Date; hasPhoto: boolean }[] => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const today = new Date()
    const currentDay = today.getDay()

    return days.map((day, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - currentDay + index)

      return {
        day,
        date: date.getDate(),
        isToday: index === currentDay,
        fullDate: date,
        hasPhoto: hasPhotoOnDate(photos, date),
      }
    })
  }

  const weekDays = generateWeekDays()
  const firstRowDays = isLandscape ? weekDays.slice(0, 4) : weekDays
  const secondRowDays = isLandscape ? weekDays.slice(4) : []

  const toggleModal = () => {
    setModalVisible(!isModalVisible)
  }

  const NotificationModal = () => {
    return (
      <Modal animationType="fade" transparent={true} visible={isModalVisible} onRequestClose={toggleModal}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" }}>
          <SafeAreaView
            style={[styles.modalContainer, { justifyContent: "center", alignItems: "center", width: "100%" }]}
          >
            <View
              style={[
                styles.modalContent,
                {
                  maxHeight: "80%",
                  width: "90%",
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: "white",
                  elevation: 10,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Notifications</Text>
              <ScrollView
                style={[styles.notificationScrollView, { maxHeight: 320 }]}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {generalNotifications.length === 0 ? (
                  <Text style={styles.noNotificationsText}>No notifications yet.</Text>
                ) : (
                  generalNotifications.map((notif) => (
                    <View
                      key={notif.id}
                      style={[
                        styles.notificationItem,
                        !notif.read && styles.unreadNotification,
                        { marginBottom: 10, borderRadius: 10, backgroundColor: "#F3F4F6", padding: 10 },
                      ]}
                    >
                      <View style={styles.notificationTextContent}>
                        <Text style={styles.notificationMessage}>{notif.message}</Text>
                        <Text style={styles.notificationTimestamp}>{new Date(notif.timestamp).toLocaleString()}</Text>
                      </View>
                      {!notif.read && (
                        <TouchableOpacity
                          onPress={() => markGeneralNotificationAsRead(notif.id)}
                          style={styles.markReadButton}
                        >
                          <Feather name="check-circle" size={20} color="#10B981" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity
                onPress={toggleModal}
                style={[
                  styles.closeButton,
                  {
                    marginTop: 10,
                    alignSelf: "center",
                    backgroundColor: "#a8e6cf",
                    borderRadius: 20,
                    paddingHorizontal: 24,
                    paddingVertical: 8,
                  },
                ]}
              >
                <Text style={[styles.closeButtonText, { color: "#333", fontWeight: "bold" }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    )
  }

  // Welcome Screen
  if (showWelcome) {
    return (
      <View style={styles.welcomeContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <TouchableOpacity style={styles.skipButton} onPress={handleGetStarted}>
          <Text style={styles.skipText}>Skip</Text>
          <Feather name="chevron-right" size={18} color="#666" />
        </TouchableOpacity>
        <View style={styles.heroImageContainer}>
          <View style={styles.heroImageBackground}>
            <Feather name="activity" size={80} color="#000" />
            <Text style={styles.heroImageText}>CaptureFit Progress</Text>
          </View>
        </View>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>Track Your Fitness{"\n"}Journey with AI</Text>
          <Text style={styles.welcomeSubtitle}>
            Capture progress photos and get AI-powered insights to achieve your fitness goals faster.
          </Text>
          <View style={styles.pageIndicators}>
            <View style={[styles.indicator, styles.indicatorActive]} />
            <View style={styles.indicator} />
            <View style={styles.indicator} />
            <View style={styles.indicator} />
          </View>
          <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted} activeOpacity={0.9}>
            <Text style={styles.getStartedText}>Start Tracking</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Main Home Screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={barStyle} backgroundColor={barBg} />
      <NotificationModal />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userProfile}>
            <View style={styles.profileImageContainer}>
              {user?.avatar ? (
                <Image
                  source={{ uri: normalizeAvatarUri(user.avatar) || undefined }}
                  style={styles.avatarImage}
                  onLoad={() => console.log("Header avatar loaded:", user?.avatar)}
                  onError={(e) => {
                    console.error("Header avatar failed to load", e.nativeEvent || e)
                    // Fallback: show initial or icon if image fails
                    setUser((prev) => (prev ? { ...prev, avatar: null } : prev))
                  }}
                />
              ) : user?.fullName ? (
                <Text style={styles.avatarText}>{user.fullName.charAt(0).toUpperCase()}</Text>
              ) : (
                <Feather name="user" size={24} color="#FF6B35" />
              )}
            </View>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{user?.fullName || "CaptureFit Progress"}</Text>
              <Text style={styles.date}>
                {user?.email || "Today "}
                {user?.email
                  ? ""
                  : currentDate.toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                    })}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={toggleModal}
            activeOpacity={0.9}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="bell"
              size={24}
              color={isDarkMode ? theme.colors.text : theme.colors.primary}
              style={styles.notificationIcon}
            />
            {generalNotifications.filter((notif) => !notif.read).length > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Home Screen */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* AI Analysis Challenge Card */}
        <View style={styles.challengeCard}>
          <LinearGradient
            colors={["#A855F7", "#7C3AED"]}
            style={styles.challengeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.challengeContent}>
              <Text style={styles.challengeTitle}>AI Analysis{"\n"}Ready</Text>
              <Text style={styles.challengeSubtitle}>
                {userStats.totalPhotos === 0
                  ? "Take your first progress photo"
                  : `${userStats.totalPhotos} photos analyzed • 🔥 ${userStats.currentStreak} day streak`}
              </Text>

              <View style={styles.progressIndicators}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressNumber}>{userStats.totalPhotos}</Text>
                  <Text style={styles.progressLabel}>Photos</Text>
                </View>
                <View style={styles.progressItem}>
                  <Text style={styles.progressNumber}>{userStats.currentStreak}</Text>
                  <Text style={styles.progressLabel}>Day Streak</Text>
                </View>
              </View>
            </View>

            {/* 3D Spheres with Icons */}
            <View style={styles.challengeDecorations}>
              <View style={[styles.sphere, styles.aiSphere]}>
                <MaterialCommunityIcons name="brain" size={20} color="white" />
              </View>
              <View style={[styles.sphere, styles.cameraSphere]}>
                <Feather name="camera" size={16} color="white" />
              </View>
              <View style={[styles.sphere, styles.analysisSphere]}>
                <Feather name="bar-chart-2" size={18} color="white" />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Photo Tracking Calendar */}
        <View style={[styles.calendarContainer, isLandscape && styles.calendarContainerLandscape]}>
          {firstRowDays.map((dayInfo, index) => (
            <TouchableOpacity
              key={`r1-${index}`}
              style={[
                styles.dayButton,
                dayInfo.isToday && styles.dayButtonActive,
                isLandscape && styles.dayButtonLandscape,
              ]}
            >
              <Text style={[styles.dayText, dayInfo.isToday && styles.dayTextActive]}>{dayInfo.day}</Text>
              <View
                style={[
                  styles.photoIndicator,
                  dayInfo.hasPhoto && styles.hasPhoto,
                  dayInfo.isToday && dayInfo.hasPhoto && styles.todayPhoto,
                ]}
              />
            </TouchableOpacity>
          ))}
          {isLandscape && <View style={styles.calendarRowBreak} />}
          {secondRowDays.map((dayInfo, index) => (
            <TouchableOpacity
              key={`r2-${index}`}
              style={[styles.dayButton, dayInfo.isToday && styles.dayButtonActive, styles.dayButtonLandscape]}
            >
              <Text style={[styles.dayText, dayInfo.isToday && styles.dayTextActive]}>{dayInfo.day}</Text>
              <View
                style={[
                  styles.photoIndicator,
                  dayInfo.hasPhoto && styles.hasPhoto,
                  dayInfo.isToday && dayInfo.hasPhoto && styles.todayPhoto,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.planGrid}>
          {/* Capture Progress Card */}
          <TouchableOpacity
            style={[styles.planCard, styles.captureCard]}
            onPress={() => navigation?.navigate("aicoach")}
          >
            <View style={styles.planCardHeader}>
              <Feather name="camera" size={20} color="white" />
              <Text style={styles.planCardLabel}>Capture</Text>
            </View>
            <View style={styles.planCardBody}>
              <Text style={styles.planCardTitle}>Progress{"\n"}Photo</Text>
              <Text style={styles.planCardSubtitle}>
                {userStats.totalPhotos === 0 ? "Start your journey" : "Continue tracking"}
              </Text>
              <Text style={styles.planCardDetail}>AI analysis included</Text>
            </View>
            <View style={styles.planCardFooter}>
              <View style={styles.aiIcon}>
                <Feather name="zap" size={12} color="#FFA726" />
              </View>
              <Text style={styles.aiLabel}>AI Ready</Text>
            </View>
          </TouchableOpacity>

          {/* View Analysis Card */}
          <TouchableOpacity
            style={[styles.planCard, styles.analysisCard]}
            onPress={() => navigation?.navigate("progress")}
          >
            <View style={styles.planCardHeader}>
              <Feather name="trending-up" size={20} color="white" />
              <Text style={styles.planCardLabel}>Analysis</Text>
            </View>
            <View style={styles.planCardBody}>
              <Text style={styles.planCardTitle}>Progress{"\n"}Report</Text>
              <Text style={styles.planCardSubtitle}>
                {userStats.totalPhotos === 0 ? "No data yet" : `${userStats.totalPhotos} photos analyzed`}
              </Text>
              <Text style={styles.planCardDetail}>AI insights & trends</Text>
            </View>
            <View style={styles.planCardFooter}>
              <View style={styles.analysisIcon}>
                <Feather name="bar-chart-2" size={12} color="#7986CB" />
              </View>
              <Text style={styles.aiLabel}>{userStats.totalPhotos === 0 ? "Waiting" : "View Report"}</Text>
            </View>

            {userStats.totalPhotos > 0 && (
              <View style={styles.progressVisualization}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(userStats.totalPhotos * 10, 100)}%` }]} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* AI Features Row */}
        <View style={styles.aiFeatures}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: "#E91E63" }]}>
              <Feather name="eye" size={16} color="white" />
            </View>
            <Text style={styles.featureLabel}>Body Analysis</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: "#9C27B0" }]}>
              <Feather name="activity" size={16} color="white" />
            </View>
            <Text style={styles.featureLabel}>Progress Tracking</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: "#4CAF50" }]}>
              <Feather name="target" size={16} color="white" />
            </View>
            <Text style={styles.featureLabel}>Goal Insights</Text>
          </View>
        </View>

        {/* Recent Analysis Preview */}
        {userStats.totalPhotos > 0 && photos.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest Analysis</Text>
              <TouchableOpacity onPress={() => navigation?.navigate("progress")}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentAnalysis}>
              <View style={styles.recentPhotoPlaceholder}>
                <Feather name="image" size={24} color="#9CA3AF" />
              </View>
              <View style={styles.recentContent}>
                <Text style={styles.recentTitle}>Latest Progress</Text>
                <Text style={styles.recentDate}>
                  {new Date(photos[photos.length - 1].timestamp).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })}
                </Text>
                <Text style={styles.recentAnalysisText} numberOfLines={2}>
                  {photos[photos.length - 1].analysis || "Analysis complete!"}
                </Text>
              </View>
              <TouchableOpacity style={styles.viewButton} onPress={() => navigation?.navigate("progress")}>
                <Feather name="chevron-right" size={16} color="#A855F7" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Removed loading overlay card */}
    </SafeAreaView>
  )
}

function getStyles(isDarkMode: boolean, theme: any, bp: ReturnType<typeof useBreakpoint>, isLandscape: boolean): any {
  const width = bp.width
  const baseHorizontal = bp.isSmallPhone ? 16 : 20
  const cardGap = 12
  const calcPlanCardWidth = width ? (width - baseHorizontal * 2 - cardGap) / 2 : 160
  const fullWidthCard = width ? width - baseHorizontal * 2 : calcPlanCardWidth
  const titleFont = normalizeFont(bp.isTablet ? 26 : 24)
  const sectionFont = normalizeFont(bp.isTablet ? 24 : 22)
  const smallFont = normalizeFont(11)
  const bodyFont = normalizeFont(14)
  if (!isDarkMode) {
    // Exact LIGHT mode styles as provided
    return StyleSheet.create({
      // Welcome Screen Styles
      welcomeContainer: {
        flex: 1,
        backgroundColor: "white",
        paddingTop: 50,
      },
      skipButton: {
        position: "absolute",
        top: 60,
        right: 20,
        flexDirection: "row",
        alignItems: "center",
        zIndex: 10,
      },
      skipText: {
        fontSize: 16,
        color: "#666",
        marginRight: 4,
      },
      heroImageContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
        paddingTop: 40,
      },
      heroImageBackground: {
        width: 280,
        height: 280,
        backgroundColor: "#a8e6cf",
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        elevation: 10,
      },
      heroImageText: {
        fontSize: 18,
        fontWeight: "600",
        color: "#333",
        marginTop: 10,
      },
      welcomeContent: {
        paddingHorizontal: 30,
        paddingBottom: 50,
        alignItems: "center",
      },
      welcomeTitle: {
        fontSize: 32,
        fontWeight: "bold",
        color: "#000",
        textAlign: "center",
        lineHeight: 38,
        marginBottom: 16,
      },
      welcomeSubtitle: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 40,
        paddingHorizontal: 10,
      },
      pageIndicators: {
        flexDirection: "row",
        marginBottom: 40,
      },
      indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#e0e0e0",
        marginHorizontal: 4,
      },
      indicatorActive: {
        backgroundColor: "#a8e6cf",
        width: 24,
      },
      getStartedButton: {
        backgroundColor: "#a8e6cf",
        paddingVertical: 18,
        paddingHorizontal: 80,
        borderRadius: 30,
        width: "100%",
        alignItems: "center",
        elevation: 8,
      },
      getStartedText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#000",
      },

      // Main App Styles
      container: {
        flex: 1,
        backgroundColor: "white",
      },
      header: {
        backgroundColor: "white",
        paddingRight: 55,
        paddingLeft: 15,
        paddingBottom: 16,
      },
      headerContent: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      },
      userProfile: {
        flexDirection: "row",
        alignItems: "center",
      },
      profileImageContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
      },
      avatarImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        resizeMode: "cover",
        borderWidth: 2,
        borderColor: isDarkMode ? "#F3F4F6" : theme.colors.border,
        backgroundColor: isDarkMode ? "#F3F4F6" : theme.colors.card,
      },
      greetingContainer: {
        flex: 1,
      },
      greeting: {
        fontSize: 17,
        fontWeight: "600",
        color: "#1F2937",
        marginBottom: 2,
      },
      date: {
        fontSize: 13,
        color: "#6B7280",
      },
      notificationButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      },
      notificationIcon: {
        color: isDarkMode ? theme.colors.text : theme.colors.primary,
        paddingRight: 8, // Reduced padding
      },
      notificationDot: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#EF4444",
      },
      notBell: {
        marginRight: 20,
      },
      scrollView: {
        flex: 1,
      },
      scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100,
      },
      challengeCard: {
        marginTop: 16,
        marginBottom: 20,
        borderRadius: 20,
        overflow: "hidden",
        elevation: 8,
        shadowColor: "#A855F7",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      challengeGradient: {
        padding: 20,
        height: 140,
        flexDirection: "row",
        justifyContent: "space-between",
        position: "relative",
      },
      challengeContent: {
        flex: 1,
        zIndex: 2,
      },
      challengeTitle: {
        fontSize: titleFont,
        fontWeight: "bold",
        color: "white",
        lineHeight: 28,
        marginBottom: 4,
      },
      challengeSubtitle: {
        fontSize: bodyFont,
        color: "rgba(255,255,255,0.9)",
        marginBottom: 16,
      },
      progressIndicators: {
        flexDirection: "row",
        gap: 20,
      },
      progressItem: {
        alignItems: "center",
      },
      progressNumber: {
        fontSize: normalizeFont(18),
        fontWeight: "bold",
        color: "white",
      },
      progressLabel: {
        fontSize: smallFont,
        color: "rgba(255,255,255,0.8)",
      },
      challengeDecorations: {
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: 120,
        zIndex: 1,
      },
      sphere: {
        position: "absolute",
        borderRadius: 50,
        justifyContent: "center",
        alignItems: "center",
      },
      aiSphere: {
        width: 45,
        height: 45,
        backgroundColor: "#10B981",
        top: 15,
        right: 20,
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
      },
      cameraSphere: {
        width: 35,
        height: 35,
        backgroundColor: "#FFA726",
        top: 40,
        right: 45,
        shadowColor: "#FFA726",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
      },
      analysisSphere: {
        width: 40,
        height: 40,
        backgroundColor: "#42A5F5",
        bottom: 15,
        right: 30,
        shadowColor: "#42A5F5",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
      },
      calendarContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: "white",
        borderRadius: 16,
        padding: 12,
        marginBottom: 20,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      dayButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 12,
        alignItems: "center",
      },
      dayButtonActive: {
        backgroundColor: "#1F2937",
      },
      dayText: {
        fontSize: 11,
        color: "#9CA3AF",
        fontWeight: "500",
        marginBottom: 6,
      },
      dayTextActive: {
        color: "white",
      },
      photoIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#E5E7EB",
      },
      hasPhoto: {
        backgroundColor: "#10B981",
      },
      todayPhoto: {
        backgroundColor: "#EF4444",
      },
      sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
      },
      sectionTitle: {
        fontSize: sectionFont,
        fontWeight: "bold",
        color: "#1F2937",
      },
      viewAllText: {
        fontSize: 14,
        color: "#A855F7",
        fontWeight: "500",
      },
      planGrid: {
        flexDirection: bp.isSmallPhone ? "column" : "row",
        justifyContent: bp.isSmallPhone ? "flex-start" : "space-between",
        marginBottom: 20,
        gap: 12,
      },
      planCard: {
        width: bp.isSmallPhone ? fullWidthCard : calcPlanCardWidth,
        height: 200,
        borderRadius: 20,
        padding: 16,
        position: "relative",
        elevation: 4,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      captureCard: {
        backgroundColor: "#FFA726",
        shadowColor: "#FFA726",
      },
      analysisCard: {
        backgroundColor: "#7986CB",
        shadowColor: "#7986CB",
      },
      planCardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
      },
      planCardLabel: {
        fontSize: 11,
        color: "rgba(255,255,255,0.8)",
        fontWeight: "500",
        marginLeft: 6,
      },
      planCardBody: {
        flex: 1,
      },
      planCardTitle: {
        fontSize: normalizeFont(18),
        fontWeight: "bold",
        color: "white",
        marginBottom: 8,
      },
      planCardSubtitle: {
        fontSize: normalizeFont(12),
        color: "rgba(255,255,255,0.9)",
        marginBottom: 4,
      },
      planCardDetail: {
        fontSize: smallFont,
        color: "rgba(255,255,255,0.8)",
      },
      planCardFooter: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
      },
      aiIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 6,
      },
      analysisIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "rgba(255,255,255,0.2)",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 6,
      },
      aiLabel: {
        fontSize: normalizeFont(10),
        color: "white",
        fontWeight: "500",
      },
      progressVisualization: {
        position: "absolute",
        bottom: 12,
        right: 16,
        left: 16,
      },
      progressBar: {
        height: 3,
        backgroundColor: "rgba(255,255,255,0.3)",
        borderRadius: 2,
      },
      progressFill: {
        height: 3,
        backgroundColor: "white",
        borderRadius: 2,
      },
      aiFeatures: {
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      featureItem: {
        alignItems: "center",
      },
      featureIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
      },
      featureLabel: {
        fontSize: smallFont,
        color: "#6B7280",
        fontWeight: "500",
        textAlign: "center",
      },
      recentSection: {
        marginBottom: 20,
      },
      recentAnalysis: {
        backgroundColor: "white",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      recentPhotoPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
      },
      recentContent: {
        flex: 1,
      },
      recentTitle: {
        fontSize: normalizeFont(14),
        fontWeight: "600",
        color: "#1F2937",
        marginBottom: 2,
      },
      recentDate: {
        fontSize: normalizeFont(12),
        color: "#6B7280",
        marginBottom: 4,
      },
      recentAnalysisText: {
        fontSize: normalizeFont(12),
        color: "#9CA3AF",
        lineHeight: 16,
      },
      calendarContainerLandscape: {
        flexWrap: "wrap",
        rowGap: 8,
      },
      dayButtonLandscape: {
        width: "22%",
      },
      calendarRowBreak: {
        width: "100%",
        height: 0,
      },
      viewButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#F3F4F6",
        justifyContent: "center",
        alignItems: "center",
      },
      loadingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
      },
      loadingCard: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 30,
        alignItems: "center",
        margin: 40,
      },
      loadingTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#000",
        marginTop: 16,
        marginBottom: 8,
      },
      loadingSubtext: {
        fontSize: 14,
        color: "#666",
      },
      // Modal Styles (light)
      modalContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      },
      modalContent: {
        width: "80%",
        backgroundColor: "white",
        borderRadius: 10,
        padding: 20,
        alignItems: "center",
      },
      modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 10,
      },
      closeButton: {
        marginTop: 20,
        backgroundColor: "#2196F3",
        borderRadius: 20,
        padding: 10,
        elevation: 2,
      },
      closeButtonText: {
        color: "white",
        fontWeight: "bold",
        textAlign: "center",
      },
      notificationScrollView: {
        maxHeight: (bp.height || 800) * 0.5,
        width: "100%",
        paddingHorizontal: 10,
      },
      noNotificationsText: {
        textAlign: "center",
        color: "#6B7280",
        marginTop: 20,
      },
      notificationItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F9FAFB",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      },
      unreadNotification: {
        backgroundColor: "#EEF2FF",
        borderColor: "#C7D2FE",
      },
      notificationTextContent: {
        flex: 1,
      },
      notificationMessage: {
        fontSize: 14,
        color: "#1F2937",
        fontWeight: "500",
      },
      notificationTimestamp: {
        fontSize: 10,
        color: "#9CA3AF",
        marginTop: 4,
      },
      markReadButton: {
        marginLeft: 10,
        padding: 5,
      },
      avatarText: {
        fontSize: 24,
        fontWeight: "bold",
        color: "white",
      },
    })
  }

  // DARK mode styles (theme-driven)
  return StyleSheet.create({
    // Welcome Screen Styles
    welcomeContainer: {
      flex: 1,
      backgroundColor: "white",
      paddingTop: 50,
    },
    skipButton: {
      position: "absolute",
      top: 60,
      right: 20,
      flexDirection: "row",
      alignItems: "center",
      zIndex: 10,
    },
    skipText: {
      fontSize: 16,
      color: "#666",
      marginRight: 4,
    },
    heroImageContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
      paddingTop: 40,
    },
    heroImageBackground: {
      width: 280,
      height: 280,
      backgroundColor: "#a8e6cf",
      borderRadius: 40,
      justifyContent: "center",
      alignItems: "center",
      elevation: 10,
    },
    heroImageText: {
      fontSize: 18,
      fontWeight: "600",
      color: "#333",
      marginTop: 10,
    },
    welcomeContent: {
      paddingHorizontal: 30,
      paddingBottom: 50,
      alignItems: "center",
    },
    welcomeTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: "#000",
      textAlign: "center",
      lineHeight: 38,
      marginBottom: 16,
    },
    welcomeSubtitle: {
      fontSize: 16,
      color: "#666",
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 40,
      paddingHorizontal: 10,
    },
    pageIndicators: {
      flexDirection: "row",
      marginBottom: 40,
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#e0e0e0",
      marginHorizontal: 4,
    },
    indicatorActive: {
      backgroundColor: "#a8e6cf",
      width: 24,
    },
    getStartedButton: {
      backgroundColor: "#a8e6cf",
      paddingVertical: 18,
      paddingHorizontal: 80,
      borderRadius: 30,
      width: "100%",
      alignItems: "center",
      elevation: 8,
    },
    getStartedText: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#000",
    },

    // Main App Styles
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.background,
      paddingRight: 55,
      paddingLeft: 15,
      paddingBottom: 16,
    },
    headerContent: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      // No background here to avoid nested mismatch in dark mode; header provides background
    },
    userProfile: {
      flexDirection: "row",
      alignItems: "center",
    },
    greetingContainer: {
      marginLeft: 12,
    },
    greeting: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    date: {
      fontSize: 13,
      color: theme.colors.text,
    },
    notificationButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      right: -25,
      top: 16,
      backgroundColor: theme.colors.card,
      borderRadius: 10,
      padding: 8,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    notificationIcon: {
      color: isDarkMode ? theme.colors.text : theme.colors.primary,
      paddingRight: 3, // Reduced padding
    },
    notificationDot: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 8,
      backgroundColor: theme.colors.notification,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 100,
    },
    challengeCard: {
      marginTop: 16,
      marginBottom: 20,
      borderRadius: 20,
      overflow: "hidden",
      elevation: 8,
      shadowColor: theme.colors.notification,
      shadowOffset: { width: 0, height: 4 },
    },
    challengeGradient: {
      padding: 20,
      height: 140,
      flexDirection: "row",
      justifyContent: "space-between",
      position: "relative",
    },
    challengeTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
      lineHeight: 28,
      marginBottom: 4,
    },
    challengeSubtitle: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 16,
    },
    progressIndicators: {
      flexDirection: "row",
      gap: 20,
    },
    progressItem: {
      alignItems: "center",
    },
    progressNumber: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    progressLabel: {
      fontSize: 11,
      color: theme.colors.text,
    },
    calendarContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 20,
      elevation: 2,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    dayButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 12,
      alignItems: "center",
    },
    dayButtonActive: {
      backgroundColor: theme.colors.notification,
    },
    dayText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "500",
      marginBottom: 6,
    },
    dayTextActive: {
      color: theme.colors.text,
    },
    photoIndicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
    },
    hasPhoto: {
      backgroundColor: theme.colors.notification,
    },
    todayPhoto: {
      backgroundColor: theme.colors.notification,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: sectionFont,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    viewAllText: {
      fontSize: 14,
      color: theme.colors.notification,
      fontWeight: "500",
    },
    planGrid: {
      flexDirection: bp.isSmallPhone ? "column" : "row",
      justifyContent: bp.isSmallPhone ? "flex-start" : "space-between",
      marginBottom: 20,
      gap: 12,
    },
    planCard: {
      width: bp.isSmallPhone ? fullWidthCard : calcPlanCardWidth,
      height: 200,
      borderRadius: 20,
      padding: 16,
      position: "relative",
      elevation: 4,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    captureCard: {
      backgroundColor: theme.colors.notification,
      shadowColor: theme.colors.notification,
    },
    analysisCard: {
      backgroundColor: "#7C3AED",
      shadowColor: theme.colors.card,
    },
    planCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    planCardLabel: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "500",
      marginLeft: 6,
    },
    planCardBody: {
      flex: 1,
    },
    planCardTitle: {
      fontSize: normalizeFont(18),
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 8,
    },
    planCardSubtitle: {
      fontSize: normalizeFont(12),
      color: theme.colors.text,
      marginBottom: 4,
    },
    planCardDetail: {
      fontSize: smallFont,
      color: theme.colors.text,
    },
    planCardFooter: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },
    aiIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 6,
    },
    analysisIcon: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 6,
    },
    aiLabel: {
      fontSize: normalizeFont(10),
      color: theme.colors.text,
      fontWeight: "500",
    },
    progressVisualization: {
      position: "absolute",
      bottom: 12,
      right: 16,
      left: 16,
    },
    progressBar: {
      height: 3,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
    },
    progressFill: {
      height: 3,
      backgroundColor: theme.colors.notification,
      borderRadius: 2,
    },
    aiFeatures: {
      flexDirection: "row",
      justifyContent: "space-around",
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      elevation: 2,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    featureItem: {
      alignItems: "center",
    },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },
    featureLabel: {
      fontSize: smallFont,
      color: theme.colors.text,
      fontWeight: "500",
      textAlign: "center",
    },
    recentSection: {
      marginBottom: 20,
    },
    recentAnalysis: {
      backgroundColor: theme.colors.card,
      borderRadius: 16,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      elevation: 2,
      shadowColor: theme.colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    recentPhotoPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    recentContent: {
      flex: 1,
    },
    recentTitle: {
      fontSize: normalizeFont(14),
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: 2,
    },
    recentDate: {
      fontSize: normalizeFont(12),
      color: theme.colors.text,
      marginBottom: 4,
    },
    recentAnalysisText: {
      fontSize: normalizeFont(12),
      color: theme.colors.text,
      lineHeight: 16,
    },
    calendarContainerLandscape: {
      flexWrap: "wrap",
      rowGap: 8,
    },
    dayButtonLandscape: {
      width: "22%",
    },
    calendarRowBreak: {
      width: "100%",
      height: 0,
    },
    viewButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    loadingCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 30,
      alignItems: "center",
      margin: 40,
    },
    loadingTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    loadingSubtext: {
      fontSize: 14,
      color: theme.colors.text,
    },
    challengeContent: {
      flex: 1,
      zIndex: 2,
    },
    challengeDecorations: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: 120,
      zIndex: 1,
    },
    sphere: {
      position: "absolute",
      borderRadius: 50,
      justifyContent: "center",
      alignItems: "center",
    },
    aiSphere: {
      width: 45,
      height: 45,
      backgroundColor: theme.colors.notification,
      top: 15,
      right: 20,
      shadowColor: theme.colors.notification,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    cameraSphere: {
      width: 35,
      height: 35,
      backgroundColor: "#FFA726",
      top: 40,
      right: 45,
      shadowColor: "#FFA726",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    analysisSphere: {
      width: 40,
      height: 40,
      backgroundColor: "#42A5F5",
      bottom: 15,
      right: 30,
      shadowColor: "#42A5F5",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
      width: "90%",
      backgroundColor: theme.colors.card,
      borderRadius: 10,
      padding: 20,
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 10,
    },
    notificationScrollView: {
      width: "100%",
      marginVertical: 10,
    },
    noNotificationsText: {
      fontSize: 14,
      color: theme.colors.text,
      textAlign: "center",
    },
    notificationItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 10,
      backgroundColor: theme.colors.background,
      borderRadius: 5,
      marginBottom: 5,
    },
    unreadNotification: {
      backgroundColor: theme.colors.notification,
    },
    notificationTextContent: {
      flex: 1,
    },
    notificationMessage: {
      fontSize: 14,
      color: theme.colors.text,
    },
    notificationTimestamp: {
      fontSize: 12,
      color: theme.colors.border,
    },
    markReadButton: {
      padding: 5,
    },
    closeButton: {
      marginTop: 10,
      padding: 10,
      backgroundColor: theme.colors.notification,
      borderRadius: 5,
    },
    closeButtonText: {
      fontSize: 14,
      color: "white",
      textAlign: "center",
    },
    profileImageContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDarkMode ? "#374151" : theme.colors.card,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    avatarImage: {
      width: 44,
      height: 44,
      borderRadius: 22,
      resizeMode: "cover",
      borderWidth: 2,
      borderColor: isDarkMode ? "#374151" : theme.colors.border,
      backgroundColor: isDarkMode ? "#374151" : theme.colors.card,
    },
  })
}
