// Gerado a partir do schema Supabase (projeto just-go-karaoke).
// NÃO editar à mão — regenerar via MCP/CLI após cada migration nova.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      performances: {
        Row: {
          created_at: string;
          id: string;
          performer_id: string;
          session_id: string;
          song_id: string;
          status: Database['public']['Enums']['performance_status'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          performer_id: string;
          session_id: string;
          song_id: string;
          status?: Database['public']['Enums']['performance_status'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          performer_id?: string;
          session_id?: string;
          song_id?: string;
          status?: Database['public']['Enums']['performance_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'performances_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'performances_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          id: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          closed_at: string | null;
          code: string;
          created_at: string;
          created_by: string;
          id: string;
          live_at: string | null;
          opened_at: string | null;
          status: Database['public']['Enums']['session_status'];
          title: string | null;
          updated_at: string;
          venue_id: string;
        };
        Insert: {
          closed_at?: string | null;
          /** Gerado pelo trigger sessions_set_code se omitido — não é required na prática. */
          code?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          live_at?: string | null;
          opened_at?: string | null;
          status?: Database['public']['Enums']['session_status'];
          title?: string | null;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          closed_at?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          live_at?: string | null;
          opened_at?: string | null;
          status?: Database['public']['Enums']['session_status'];
          title?: string | null;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      songs: {
        Row: {
          artist: string;
          created_at: string;
          genre: string | null;
          id: string;
          language: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          artist: string;
          created_at?: string;
          genre?: string | null;
          id?: string;
          language?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          artist?: string;
          created_at?: string;
          genre?: string | null;
          id?: string;
          language?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_favorite_songs: {
        Row: {
          created_at: string;
          profile_id: string;
          song_id: string;
        };
        Insert: {
          created_at?: string;
          profile_id: string;
          song_id: string;
        };
        Update: {
          created_at?: string;
          profile_id?: string;
          song_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_favorite_songs_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_favorite_songs_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      venue_staff: {
        Row: {
          created_at: string;
          id: string;
          profile_id: string;
          role: Database['public']['Enums']['staff_role'];
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          profile_id: string;
          role?: Database['public']['Enums']['staff_role'];
          venue_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          role?: Database['public']['Enums']['staff_role'];
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'venue_staff_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'venue_staff_venue_id_fkey';
            columns: ['venue_id'];
            isOneToOne: false;
            referencedRelation: 'venues';
            referencedColumns: ['id'];
          },
        ];
      };
      venues: {
        Row: {
          city: string | null;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          state: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          state?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          state?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'venues_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null;
          display_name: string | null;
          id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      generate_session_code: { Args: never; Returns: string };
    };
    Enums: {
      performance_status:
        | 'QUEUED'
        | 'CALLED'
        | 'PERFORMING'
        | 'VOTING'
        | 'RESULT'
        | 'COMPLETED'
        | 'CANCELLED';
      session_status: 'SCHEDULED' | 'OPEN' | 'LIVE' | 'CLOSED';
      staff_role: 'HOST' | 'ADMIN';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;
type DefaultSchema = DatabaseWithoutInternals['public'];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      performance_status: [
        'QUEUED',
        'CALLED',
        'PERFORMING',
        'VOTING',
        'RESULT',
        'COMPLETED',
        'CANCELLED',
      ],
      session_status: ['SCHEDULED', 'OPEN', 'LIVE', 'CLOSED'],
      staff_role: ['HOST', 'ADMIN'],
    },
  },
} as const;
