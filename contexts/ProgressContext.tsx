import { create } from 'zustand';
import { supabase } from '../utils/supabase';

interface ProgressPhoto {
  id: string;
  url: string;
  created_at: string;
}

interface ProgressState {
  photos: ProgressPhoto[];
  loading: boolean;
  error: string | null;
  fetchPhotos: (userId: string) => Promise<void>;
}

export const useProgressStore = create<ProgressState>((set) => ({
  photos: [],
  loading: false,
  error: null,
  fetchPhotos: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('id, url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      set({ photos: data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
}));
