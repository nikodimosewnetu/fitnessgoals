import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"

// Supabase configuration
const supabaseUrl = "https://vpnitpweduycfmndmxsf.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbml0cHdlZHV5Y2ZtbmRteHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTU3MjksImV4cCI6MjA3MDg3MTcyOX0.LRVY6boXeixgCHJi1BelSdO6UHIePJYIJk-T7eWxY9s"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Types for database schema
export interface User {
  id: string
  email: string
  created_at: string
}

export interface Photo {
  id: string
  user_id: string
  url: string
  file_name: string
  file_size: number
  created_at: string
  analysis_data?: any
}

export interface ChatMessage {
  id: string
  user_id: string
  message_type: "user" | "ai"
  content: string
  created_at: string
}

export interface UserProfile {
  id: string
  fitness_goal: string
  fitness_level: string
  age?: number
  weight?: number
  target_weight?: number
  injuries?: string[]
  created_at: string
  updated_at: string
}

// Helper functions for Supabase operations
export class SupabaseService {
  /**
   * Sign up with email and password
   */
  static async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  /**
   * Sign out current user
   */
  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  /**
   * Get current session
   */
  static async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    if (error) throw error
    return session
  }

  /**
   * Get current user
   */
  static async getCurrentUser() {
    try {
      console.log("[v0] Getting current user...")
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error) {
        console.error("[v0] Get user error:", error)
        throw new Error(`Authentication error: ${error.message}`)
      }

      if (!user) {
        console.log("[v0] No authenticated user found")
        return null
      }

      console.log("[v0] ✓ Current user:", user.id)
      return user
    } catch (error) {
      console.error("[v0] ❌ Get current user failed:", error)
      throw error
    }
  }

  /**
   * Upload photo to storage
   */
  static async uploadPhoto(file: File | Blob, filePath: string) {
    try {
      console.log("[v0] Starting Supabase upload:", filePath)
      console.log("[v0] File details:", {
        size: file.size,
        type: file.type,
        constructor: file.constructor.name,
      })

      if (!file || file.size === 0) {
        throw new Error("Invalid file: File is empty or undefined")
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        throw new Error("File too large: Maximum size is 10MB")
      }

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Invalid file type: ${file.type}. Allowed types: ${allowedTypes.join(", ")}`)
      }

      console.log("[v0] File validation passed, uploading to storage...")

      const { data, error } = await supabase.storage.from("photos").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        console.error("[v0] Supabase upload error:", error)
        throw new Error(`Upload failed: ${error.message}`)
      }

      console.log("[v0] ✓ Supabase upload successful:", data)
      return data
    } catch (error) {
      console.error("[v0] ❌ Upload photo failed:", error)
      throw error
    }
  }

  /**
   * Get public URL for photo
   */
  static getPhotoUrl(filePath: string) {
    try {
      if (!filePath || filePath.trim() === "") {
        throw new Error("Invalid file path: Path is empty")
      }

      console.log("[v0] Getting public URL for:", filePath)
      const { data } = supabase.storage.from("photos").getPublicUrl(filePath)

      console.log("[v0] ✓ Public URL generated:", data.publicUrl)
      return data.publicUrl
    } catch (error) {
      console.error("[v0] ❌ Get photo URL failed:", error)
      throw error
    }
  }

  /**
   * List user photos
   */
  static async listUserPhotos(userId: string) {
    const { data, error } = await supabase.storage.from("photos").list(userId)

    if (error) throw error
    return data
  }

  /**
   * Delete photo from storage
   */
  static async deletePhoto(filePath: string) {
    const { error } = await supabase.storage.from("photos").remove([filePath])

    if (error) throw error
  }

  /**
   * Save user profile
   */
  static async saveUserProfile(profile: Partial<UserProfile>) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get user profile
   */
  static async getUserProfile() {
    const user = await this.getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      throw error
    }

    return data
  }

  /**
   * Save chat message
   */
  static async saveChatMessage(messageType: "user" | "ai", content: string) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const { data, error } = await supabase
      .from("chat_messages")
      .insert({
        user_id: user.id,
        message_type: messageType,
        content,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get chat history
   */
  static async getChatHistory(limit = 50) {
    const user = await this.getCurrentUser()
    if (!user) throw new Error("User not authenticated")

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }

  /**
   * Invoke AI coach edge function
   */
  static async invokeAICoach(payload: any) {
    const { data, error } = await supabase.functions.invoke("aicoach", {
      body: payload,
    })

    if (error) throw error
    return data
  }

  /**
   * Get the latest photo for a user
   */
  static async getLatestUserPhoto(userId: string) {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      throw error
    }

    return data
  }

  /**
   * Get all photos for a user with pagination
   */
  static async getUserPhotos(userId: string, limit = 10, offset = 0) {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data
  }

  /**
   * Save photo record with analysis data to database
   */
  static async savePhotoWithAnalysis(userId: string, fileName: string, fileSize: number, analysisData?: any) {
    const { data, error } = await supabase
      .from("photos")
      .insert({
        user_id: userId,
        url: this.getPhotoUrl(fileName),
        file_name: fileName,
        file_size: fileSize,
        analysis_data: analysisData,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Get user photos with analysis data for progress comparison
   */
  static async getUserPhotosWithAnalysis(userId: string, limit = 5) {
    const { data, error } = await supabase
      .from("photos")
      .select("*, analysis_data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  }

  /**
   * Set access token for Supabase client (used when restoring session from storage)
   */
  static async setAccessToken(accessToken: string, refreshToken?: string) {
    try {
      console.log("[v0] Setting access token for Supabase client...")

      if (!accessToken) {
        console.log("[v0] No access token provided")
        return
      }

      // Set the session with the provided tokens
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || accessToken, // Use access token as fallback if no refresh token
      })

      if (error) {
        console.error("[v0] Failed to set session with token:", error)
        throw error
      }

      console.log("[v0] ✓ Access token set successfully")
      return data
    } catch (error) {
      console.error("[v0] ❌ Set access token failed:", error)
      throw error
    }
  }
}
