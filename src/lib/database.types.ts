// Gerado a partir do schema Supabase (projeto just-go-karaoke).
// Contém apenas as tabelas karaoke_* — o domínio desta aplicação. As tabelas
// legadas do app anterior seguem no banco mas não são consumidas pelo código.
// Regenerar após cada migration: npx supabase gen types typescript --project-id <ref>

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      karaoke_advertisements: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          id: string;
          image_url: string;
          room_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          image_url: string;
          room_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          image_url?: string;
          room_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'karaoke_advertisements_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'karaoke_rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      karaoke_queue_entries: {
        Row: {
          finished_at: string | null;
          id: string;
          participant: string;
          phone: string | null;
          position: number;
          requested_at: string;
          room_id: string;
          song_artist: string;
          song_duration: string;
          song_thumbnail: string | null;
          song_title: string;
          started_at: string | null;
          status: Database['public']['Enums']['karaoke_entry_status'];
          youtube_id: string;
        };
        Insert: {
          finished_at?: string | null;
          id?: string;
          participant: string;
          phone?: string | null;
          position?: number;
          requested_at?: string;
          room_id: string;
          song_artist?: string;
          song_duration?: string;
          song_thumbnail?: string | null;
          song_title: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['karaoke_entry_status'];
          youtube_id: string;
        };
        Update: {
          finished_at?: string | null;
          id?: string;
          participant?: string;
          phone?: string | null;
          position?: number;
          requested_at?: string;
          room_id?: string;
          song_artist?: string;
          song_duration?: string;
          song_thumbnail?: string | null;
          song_title?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['karaoke_entry_status'];
          youtube_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'karaoke_queue_entries_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'karaoke_rooms';
            referencedColumns: ['id'];
          },
        ];
      };
      karaoke_rooms: {
        Row: {
          created_at: string;
          host_name: string | null;
          id: string;
          name: string;
          screen_content_id: string | null;
          screen_expires_at: string | null;
          screen_online: boolean;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          host_name?: string | null;
          id?: string;
          name: string;
          screen_content_id?: string | null;
          screen_expires_at?: string | null;
          screen_online?: boolean;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          host_name?: string | null;
          id?: string;
          name?: string;
          screen_content_id?: string | null;
          screen_expires_at?: string | null;
          screen_online?: boolean;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'karaoke_rooms_screen_content_id_fkey';
            columns: ['screen_content_id'];
            isOneToOne: false;
            referencedRelation: 'karaoke_screen_contents';
            referencedColumns: ['id'];
          },
        ];
      };
      karaoke_screen_contents: {
        Row: {
          body: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          image_url: string | null;
          priority: number;
          room_id: string;
          title: string;
          type: Database['public']['Enums']['karaoke_screen_content_type'];
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          image_url?: string | null;
          priority?: number;
          room_id: string;
          title: string;
          type: Database['public']['Enums']['karaoke_screen_content_type'];
        };
        Update: {
          body?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          image_url?: string | null;
          priority?: number;
          room_id?: string;
          title?: string;
          type?: Database['public']['Enums']['karaoke_screen_content_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'karaoke_screen_contents_room_id_fkey';
            columns: ['room_id'];
            isOneToOne: false;
            referencedRelation: 'karaoke_rooms';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      karaoke_entry_status: 'pending' | 'waiting' | 'playing' | 'completed' | 'cancelled';
      karaoke_screen_content_type: 'karaoke' | 'cta' | 'notice' | 'ad' | 'qrcode';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database['public'];

export type KaraokeEntryStatus = PublicSchema['Enums']['karaoke_entry_status'];
export type KaraokeScreenContentType = PublicSchema['Enums']['karaoke_screen_content_type'];

export type KaraokeRoomRow = PublicSchema['Tables']['karaoke_rooms']['Row'];
export type KaraokeQueueEntryRow = PublicSchema['Tables']['karaoke_queue_entries']['Row'];
export type KaraokeScreenContentRow = PublicSchema['Tables']['karaoke_screen_contents']['Row'];
export type KaraokeAdvertisementRow = PublicSchema['Tables']['karaoke_advertisements']['Row'];
