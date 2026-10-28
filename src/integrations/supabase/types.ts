export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_records: {
        Row: {
          activity: string
          created_at: string
          local_date: string
          user_id: string
        }
        Insert: {
          activity: string
          created_at?: string
          local_date: string
          user_id: string
        }
        Update: {
          activity?: string
          created_at?: string
          local_date?: string
          user_id?: string
        }
        Relationships: []
      }
      app_event_logs: {
        Row: {
          created_at: string
          detail: string | null
          event: string
          id: string
          level: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          level?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          level?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_reminders: {
        Row: {
          created_at: string
          delivery_time: string
          enabled: boolean
          id: string
          legacy_source: boolean
          message: string
          timezone: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_time?: string
          enabled?: boolean
          id?: string
          legacy_source?: boolean
          message?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_time?: string
          enabled?: boolean
          id?: string
          legacy_source?: boolean
          message?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entries: {
        Row: {
          archived_import: boolean
          content: Json
          created_at: string
          id: string
          kind: string
          local_date: string
          subtype: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_import?: boolean
          content?: Json
          created_at?: string
          id: string
          kind: string
          local_date: string
          subtype?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_import?: boolean
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          local_date?: string
          subtype?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_sent_date: string | null
          last_test_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_sent_date?: string | null
          last_test_at?: string | null
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_sent_date?: string | null
          last_test_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      push_signing_config: {
        Row: {
          encrypted_private_key: string
          id: boolean
          iv: string
          public_key: string
        }
        Insert: {
          encrypted_private_key: string
          id?: boolean
          iv: string
          public_key: string
        }
        Update: {
          encrypted_private_key?: string
          id?: boolean
          iv?: string
          public_key?: string
        }
        Relationships: []
      }
      reminder_delivery_claims: {
        Row: {
          created_at: string
          device_id: string
          local_date: string
          reminder_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          local_date: string
          reminder_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          local_date?: string
          reminder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_delivery_claims_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "push_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_delivery_claims_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "daily_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_preferences: {
        Row: {
          delivery_time: string
          enabled: boolean
          message: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          delivery_time?: string
          enabled?: boolean
          message?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          delivery_time?: string
          enabled?: boolean
          message?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_rooted_backup_data: { Args: never; Returns: Json }
      claim_rooted_reminders_v3: {
        Args: never
        Returns: { device_id: string; reminder_id: string; user_id: string; endpoint: string; p256dh: string; auth: string; title: string; message: string; local_date: string; lease_token: string; attempt: number }[]
      }
      finish_rooted_delivery: {
        Args: { p_reminder_id: string; p_device_id: string; p_local_date: string; p_lease_token: string; p_ok: boolean; p_retryable: boolean; p_status: number }
        Returns: boolean
      }
      restore_rooted_backup: {
        Args: { p_user_id: string; p_backup: Json }
        Returns: Json
      }

      claim_rooted_reminders: {
        Args: never
        Returns: {
          auth: string
          device_id: string
          endpoint: string
          message: string
          p256dh: string
        }[]
      }
      claim_rooted_reminders_v2: {
        Args: never
        Returns: {
          auth: string
          device_id: string
          endpoint: string
          message: string
          p256dh: string
          reminder_id: string
          title: string
          user_id: string
        }[]
      }
      rooted_scoring_date: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
