"use client"

import { AuthContext } from "@/app/_layout"
import { Colors } from "@/constants/Colors"
import { useTheme } from "@/contexts/ThemeContext"
import { supabase } from "@/utils/supabase"
import { Ionicons } from "@expo/vector-icons"
import { memo, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import Layout, { ModernCard, ModernHeader, SectionHeader } from "./Layout"

// Define the Photo type locally if it's not easily importable
interface Photo {
  id: string
  url: string
  created_at: string
}

const { width } = Dimensions.get("window")

// Helper function to format date
const formatPhotoDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  
  // Set time to start of day for accurate day comparison
  const photoDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  const diffTime = today.getTime() - photoDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return "Today"
  } else if (diffDays === 1) {
    return "Yesterday"
  } else if (diffDays <= 6) {
    return `${diffDays} days ago`
  } else if (diffDays <= 30) {
    return `${Math.floor(diffDays / 7)} ${Math.floor(diffDays / 7) === 1 ? 'week' : 'weeks'} ago`
  } else {
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    })
  }
}

const PhotoItem = memo(({ photo, onPress, onLongPress, isSelected, editMode, isDragged, reorderMode }: { 
  photo: Photo; 
  onPress?: () => void; 
  onLongPress?: () => void;
  isSelected?: boolean;
  editMode?: boolean;
  isDragged?: boolean;
  reorderMode?: boolean;
}) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.photoContainer,
        isSelected && styles.selectedPhoto,
        isDragged && styles.draggedPhoto,
        reorderMode && styles.reorderPhoto
      ]}
    >
      <Image
        source={{ uri: photo.url }}
        style={styles.photo}
        onError={() => console.log("Failed to load image:", photo.url)}
        resizeMode="cover"
        fadeDuration={200}
      />
      
      {/* Date overlay - always visible */}
      <View style={styles.dateOverlay}>
        <Text style={styles.dateText}>{formatPhotoDate(photo.created_at)}</Text>
      </View>

      {(editMode || reorderMode) && (
        <View style={styles.photoOverlay}>
          {editMode && isSelected && (
            <View style={styles.checkmark}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
          )}
          {reorderMode && (
            <View style={styles.reorderIcon}>
              <Ionicons name="move" size={16} color="white" />
            </View>
          )}
          {isDragged && (
            <View style={styles.dragIndicator}>
              <Text style={styles.dragText}>Drop to reorder</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
})
PhotoItem.displayName = "PhotoItem"

const StatsCard = memo(({ value, label, color }: { value: number; label: string; color: string }) => {
  return (
    <ModernCard>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </ModernCard>
  )
})
StatsCard.displayName = "StatsCard"

const WeeklyChart = memo(({ weeklyPhotoCounts, maxWeeklyPhotos, primary, sub, theme }: any) => {
  const maxBarHeight = 80

  return (
    <View style={[styles.chartContainer, { backgroundColor: theme.colors.card }]}>
      {weeklyPhotoCounts.map((day: any, index: number) => (
        <View key={index} style={styles.barWrapper}>
          <View
            style={[styles.bar, { height: (day.value / maxWeeklyPhotos) * maxBarHeight, backgroundColor: primary }]}
          />
          <Text style={[styles.barLabel, { color: sub }]}>{day.day}</Text>
        </View>
      ))}
    </View>
  )
})
WeeklyChart.displayName = "WeeklyChart"

const calculateStats = (photos: Photo[]) => {
  if (photos.length === 0) {
    return {
      currentStreak: 0,
      daysTracked: 0,
      weeklyPhotoCounts: Array.from({ length: 7 }, (_, i) => ({
        day: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "short" }),
        value: 0,
      })),
    }
  }

  // Calculate current streak more efficiently
  let currentStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const photoDates = new Set(photos.map((photo) => new Date(photo.created_at).toDateString()))

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    if (photoDates.has(checkDate.toDateString())) {
      currentStreak++
    } else {
      break
    }
  }

  // Calculate days tracked (already optimized with Set)
  const daysTracked = photoDates.size

  // Calculate weekly photo counts more efficiently
  const weeklyPhotoCounts = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - i))
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      value: 0,
    }
  })

  const oneWeekAgo = new Date(today)
  oneWeekAgo.setDate(today.getDate() - 6)

  photos.forEach((photo) => {
    const photoDate = new Date(photo.created_at)
    photoDate.setHours(0, 0, 0, 0)

    if (photoDate >= oneWeekAgo && photoDate <= today) {
      const daysDiff = Math.floor((today.getTime() - photoDate.getTime()) / (24 * 60 * 60 * 1000))
      if (daysDiff >= 0 && daysDiff < 7) {
        weeklyPhotoCounts[6 - daysDiff].value++
      }
    }
  })

  return { currentStreak, daysTracked, weeklyPhotoCounts }
}

export default function ProgressScreen() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [reorderMode, setReorderMode] = useState(false)
  const [draggedPhoto, setDraggedPhoto] = useState<Photo | null>(null)

  const auth = useContext(AuthContext)
  const { token } = auth || {}
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    async function getSession() {
      const { data } = await supabase.auth.getSession()
      if (mounted) {
        setSession(data?.session)
      }
    }
    getSession()
    return () => {
      mounted = false
    }
  }, [token])

  const { isDarkMode, theme } = useTheme()
  const palette = isDarkMode ? Colors.dark : Colors.light
  const primary = palette.primary
  const sub = palette.textSecondary

  const stats = useMemo(() => calculateStats(photos), [photos])
  const maxWeeklyPhotos = useMemo(
    () => Math.max(...stats.weeklyPhotoCounts.map((d) => d.value), 1),
    [stats.weeklyPhotoCounts],
  )

  const fetchPhotosFromDB = useCallback(async (userId: string, showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("photos")
        .select("id, url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100) // Limit initial load for better performance

      if (error) throw error
      setPhotos(data || [])
    } catch (err: any) {
      setError(err.message)
      setPhotos([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user?.id) {
      fetchPhotosFromDB(session.user.id)
    }
  }, [session?.user?.id, fetchPhotosFromDB])

  const handleRefresh = useCallback(async () => {
    if (!session?.user?.id) return
    setRefreshing(true)
    await fetchPhotosFromDB(session.user.id, false)
    setRefreshing(false)
  }, [session?.user?.id, fetchPhotosFromDB])

  const toggleEditMode = useCallback(() => {
    setEditMode(!editMode)
    setSelectedPhotos(new Set())
    setReorderMode(false)
    setDraggedPhoto(null)
  }, [editMode])

  const toggleReorderMode = useCallback(() => {
    setReorderMode(!reorderMode)
    setEditMode(false)
    setSelectedPhotos(new Set())
    setDraggedPhoto(null)
  }, [reorderMode])

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(photoId)) {
        newSet.delete(photoId)
      } else {
        newSet.add(photoId)
      }
      return newSet
    })
  }, [])

  const handlePhotoLongPress = useCallback((photo: Photo) => {
    if (reorderMode) {
      setDraggedPhoto(photo)
    } else if (!editMode) {
      setEditMode(true)
    }
  }, [reorderMode, editMode])

  const handlePhotoPress = useCallback((photo: Photo) => {
    if (editMode) {
      togglePhotoSelection(photo.id)
    } else if (reorderMode && draggedPhoto) {
      // Reorder photos
      const fromIndex = photos.findIndex(p => p.id === draggedPhoto.id)
      const toIndex = photos.findIndex(p => p.id === photo.id)
      
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        const newPhotos = [...photos]
        const [moved] = newPhotos.splice(fromIndex, 1)
        newPhotos.splice(toIndex, 0, moved)
        setPhotos(newPhotos)
      }
      setDraggedPhoto(null)
    }
  }, [editMode, reorderMode, draggedPhoto, photos, togglePhotoSelection])

  const selectAllPhotos = useCallback(() => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)))
    }
  }, [selectedPhotos.size, photos])

  const deleteSelectedPhotos = useCallback(async () => {
    if (selectedPhotos.size === 0) return

    Alert.alert(
      "Delete Photos",
      `Are you sure you want to delete ${selectedPhotos.size} photo${selectedPhotos.size > 1 ? 's' : ''}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id) return

            setLoading(true)
            try {
              const photosToDelete = photos.filter(p => selectedPhotos.has(p.id))
              const deletePromises = photosToDelete.map(async (photo) => {
                const urlParts = photo.url.split("/photos/")
                const path = urlParts.length > 1 ? urlParts[1] : photo.url

                return fetch("https://vpnitpweduycfmndmxsf.supabase.co/functions/v1/delete-photo-storage", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    photoId: photo.id,
                    path: path,
                  }),
                })
              })

              await Promise.all(deletePromises)
              
              // Remove deleted photos from state
              setPhotos(prev => prev.filter(p => !selectedPhotos.has(p.id)))
              setSelectedPhotos(new Set())
              setEditMode(false)

            } catch (err: any) {
              setError(err.message)
              fetchPhotosFromDB(session.user.id, false)
            } finally {
              setLoading(false)
            }
          },
        },
      ],
    )
  }, [selectedPhotos, photos, session, fetchPhotosFromDB])

  const resetProgress = useCallback(async () => {
    Alert.alert(
      "Reset Progress",
      "Are you sure you want to delete all your progress photos? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            if (!session?.user?.id || photos.length === 0) return

            setLoading(true)
            try {
              const deletePromises = photos.map(async (photo) => {
                const urlParts = photo.url.split("/photos/")
                const path = urlParts.length > 1 ? urlParts[1] : photo.url

                return fetch("https://vpnitpweduycfmndmxsf.supabase.co/functions/v1/delete-photo-storage", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    photoId: photo.id,
                    path: path,
                  }),
                })
              })

              await Promise.all(deletePromises)
              setPhotos([])

              if (auth?.resetProgress) {
                await auth.resetProgress()
              }
            } catch (err: any) {
              setError(err.message)
              fetchPhotosFromDB(session.user.id, false)
            } finally {
              setLoading(false)
            }
          },
        },
      ],
    )
  }, [session, photos, auth, fetchPhotosFromDB])

  // useBreakpoint()
  // useWindowDimensions()

  const renderPhotoItem = useCallback(({ item }: { item: Photo }) => 
    <PhotoItem 
      photo={item} 
      onPress={() => handlePhotoPress(item)}
      onLongPress={() => handlePhotoLongPress(item)}
      isSelected={selectedPhotos.has(item.id)}
      editMode={editMode}
      isDragged={draggedPhoto?.id === item.id}
      reorderMode={reorderMode}
    />, 
    [editMode, reorderMode, selectedPhotos, draggedPhoto, handlePhotoPress, handlePhotoLongPress]
  )

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: width / 3,
      offset: (width / 3) * index,
      index,
    }),
    [],
  )

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text }}>Error: {error}</Text>
      </View>
    )
  }

  return (
    <Layout>
      <ModernHeader title="Your Progress" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 40,
        }}
      >
        <View style={styles.statsContainer}>
          <StatsCard value={photos.length} label="Total Photos" color={primary} />
          <StatsCard value={stats.currentStreak} label="Current Streak" color={primary} />
          <StatsCard value={stats.daysTracked} label="Days Tracked" color={primary} />
        </View>

        <SectionHeader title="Weekly Activity" />
        <WeeklyChart
          weeklyPhotoCounts={stats.weeklyPhotoCounts}
          maxWeeklyPhotos={maxWeeklyPhotos}
          primary={primary}
          sub={sub}
          theme={theme}
        />

        <SectionHeader title="All Photos" />
        
        {photos.length > 0 && (
          <View style={styles.editToolbar}>
            {!editMode && !reorderMode ? (
              <>
                <TouchableOpacity
                  onPress={toggleEditMode}
                  style={[styles.editButton, styles.editButtonSelect]}
                >
                  <Ionicons name="create-outline" size={16} color="white" />
                  <Text style={[styles.editButtonText, { color: 'white' }]}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={toggleReorderMode}
                  style={[styles.editButton, { backgroundColor: '#FF9500' }]}
                >
                  <Ionicons name="swap-vertical-outline" size={16} color="white" />
                  <Text style={[styles.editButtonText, { color: 'white' }]}>Reorder</Text>
                </TouchableOpacity>
              </>
            ) : editMode ? (
              <>
                <TouchableOpacity
                  onPress={selectAllPhotos}
                  style={[styles.editButton, styles.editButtonSelect]}
                >
                  <Ionicons 
                    name={selectedPhotos.size === photos.length ? "checkbox" : "square-outline"} 
                    size={16} 
                    color="white" 
                  />
                  <Text style={[styles.editButtonText, { color: 'white' }]}>
                    {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={deleteSelectedPhotos}
                  style={[styles.editButton, styles.editButtonDelete]}
                  disabled={selectedPhotos.size === 0}
                >
                  <Ionicons name="trash-outline" size={16} color="white" />
                  <Text style={[styles.editButtonText, { color: 'white' }]}>
                    Delete ({selectedPhotos.size})
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={toggleEditMode}
                  style={[styles.editButton, styles.editButtonCancel]}
                >
                  <Ionicons name="close-outline" size={16} color="white" />
                  <Text style={[styles.editButtonText, { color: 'white' }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.editButtonText, { color: '#FF9500', fontWeight: 'bold' }]}>
                    {draggedPhoto ? 'Tap a photo to reorder' : 'Long press a photo to start'}
                  </Text>
                </View>
                
                <TouchableOpacity
                  onPress={toggleReorderMode}
                  style={[styles.editButton, styles.editButtonCancel]}
                >
                  <Ionicons name="close-outline" size={16} color="white" />
                  <Text style={[styles.editButtonText, { color: 'white' }]}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={handleRefresh}
          style={[styles.refreshButton, { backgroundColor: primary }]}
          disabled={refreshing}
        >
          <Text style={styles.refreshButtonText}>{refreshing ? "Refreshing..." : "Refresh"}</Text>
        </TouchableOpacity>

        <FlatList
          data={photos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          getItemLayout={getItemLayout}
          initialNumToRender={21} // 7 rows of 3 photos
          maxToRenderPerBatch={21}
          windowSize={10}
          removeClippedSubviews={true}
          scrollEnabled={false} // Disable scroll since it's inside ScrollView
          contentContainerStyle={styles.photoGrid}
        />

        <TouchableOpacity onPress={resetProgress} style={styles.resetButton} disabled={loading}>
          <Text style={styles.resetButtonText}>{loading ? "Resetting..." : "Reset Progress"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </Layout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  statLabel: {
    fontSize: 14,
    textAlign: "center",
  },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    padding: 10,
    borderRadius: 10,
    margin: 10,
    height: 120,
  },
  barWrapper: {
    alignItems: "center",
  },
  bar: {
    width: 20,
    borderRadius: 5,
  },
  barLabel: {
    marginTop: 5,
    fontSize: 12,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  photoContainer: {
    width: width / 3 - 2,
    height: width / 3 - 2,
    margin: 1,
    position: 'relative',
  },
  selectedPhoto: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  draggedPhoto: {
    opacity: 0.5,
    transform: [{ scale: 1.1 }],
  },
  reorderPhoto: {
    borderWidth: 2,
    borderColor: '#FF9500',
    borderStyle: 'dashed',
  },
  photoOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 4,
  },
  checkmark: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderIcon: {
    backgroundColor: '#FF9500',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 5,
    padding: 5,
    transform: [{ translateX: -50 }, { translateY: -10 }],
  },
  dragText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photo: {
    flex: 1,
    width: undefined,
    height: undefined,
  },
  resetButton: {
    margin: 20,
    padding: 15,
    backgroundColor: "#ff3b30",
    borderRadius: 10,
    alignItems: "center",
  },
  resetButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  refreshButton: {
    margin: 10,
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  loadMoreButton: {
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  loadMoreButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  editToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    margin: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  editButtonText: {
    marginLeft: 5,
    fontWeight: '600',
  },
  editButtonDelete: {
    backgroundColor: '#ff3b30',
  },
  editButtonCancel: {
    backgroundColor: '#8e8e93',
  },
  editButtonSelect: {
    backgroundColor: '#007AFF',
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dateText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
})
