export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string;
          finished_at: string | null;
          id: string;
          model: string | null;
          tokens: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          finished_at?: string | null;
          id: string;
          model?: string | null;
          tokens?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          model?: string | null;
          tokens?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      exports: {
        Row: {
          created_at: string;
          epoch: number;
          expires_at: string;
          id: string;
          path: string | null;
          state: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          epoch: number;
          expires_at?: string;
          id: string;
          path?: string | null;
          state?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          epoch?: number;
          expires_at?: string;
          id?: string;
          path?: string | null;
          state?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exports_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      index_usage: {
        Row: {
          day: string;
          requests: number;
          user_id: string;
        };
        Insert: {
          day?: string;
          requests?: number;
          user_id: string;
        };
        Update: {
          day?: string;
          requests?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "index_usage_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      jobs: {
        Row: {
          attempts: number;
          available_at: string;
          created_at: string;
          error_code: string | null;
          id: string;
          kind: string;
          lease_token: string | null;
          lease_until: string | null;
          note_id: string | null;
          revision: number | null;
          state: string;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          kind: string;
          lease_token?: string | null;
          lease_until?: string | null;
          note_id?: string | null;
          revision?: number | null;
          state?: string;
          user_id: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          kind?: string;
          lease_token?: string | null;
          lease_until?: string | null;
          note_id?: string | null;
          revision?: number | null;
          state?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      note_chunks: {
        Row: {
          embedding: string | null;
          id: string;
          model: string;
          note_id: string;
          ordinal: number;
          revision: number;
          text: string;
          user_id: string;
        };
        Insert: {
          embedding?: string | null;
          id?: string;
          model: string;
          note_id: string;
          ordinal: number;
          revision: number;
          text: string;
          user_id: string;
        };
        Update: {
          embedding?: string | null;
          id?: string;
          model?: string;
          note_id?: string;
          ordinal?: number;
          revision?: number;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_chunks_note_id_user_id_fkey";
            columns: ["note_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "notes";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      notes: {
        Row: {
          ai_excluded: boolean;
          content: NonNullable<Json>;
          created_at: string;
          deleted_at: string | null;
          id: string;
          pinned: boolean;
          plain_text: string;
          revision: number;
          search_vector: unknown;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_excluded?: boolean;
          content?: NonNullable<Json>;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          pinned?: boolean;
          plain_text?: string;
          revision?: number;
          search_vector?: never;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_excluded?: boolean;
          content?: NonNullable<Json>;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          pinned?: boolean;
          plain_text?: string;
          revision?: number;
          search_vector?: never;
          tags?: string[];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          ai_enabled: boolean;
          created_at: string;
          privacy_epoch: number;
          state: string;
          user_id: string;
        };
        Insert: {
          ai_enabled?: boolean;
          created_at?: string;
          privacy_epoch?: number;
          state?: string;
          user_id: string;
        };
        Update: {
          ai_enabled?: boolean;
          created_at?: string;
          privacy_epoch?: number;
          state?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      active_account: { Args: Record<PropertyKey, never>; Returns: boolean };
      begin_account_delete: { Args: { p_user: string }; Returns: undefined };
      begin_delete: { Args: Record<PropertyKey, never>; Returns: undefined };
      claim_jobs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          attempts: number;
          available_at: string;
          created_at: string;
          error_code: string | null;
          id: string;
          kind: string;
          lease_token: string | null;
          lease_until: string | null;
          note_id: string | null;
          revision: number | null;
          state: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      dispatch_jobs: { Args: Record<PropertyKey, never>; Returns: number };
      finish_ai: {
        Args: { p_id: string; p_model: string; p_tokens: number };
        Returns: undefined;
      };
      index_health: {
        Args: Record<PropertyKey, never>;
        Returns: {
          failed: number;
          pending: number;
        }[];
      };
      match_chunks: {
        Args: { p_embedding: string; p_model: string; p_query: string };
        Returns: {
          id: string;
          note_id: string;
          revision: number;
          score: number;
          text: string;
          title: string;
        }[];
      };
      note_action: {
        Args: { p_action: string; p_id: string };
        Returns: undefined;
      };
      publish_chunks: {
        Args: {
          p_chunks: Json;
          p_job: string;
          p_lease: string;
          p_model: string;
        };
        Returns: boolean;
      };
      reconcile_jobs: { Args: Record<PropertyKey, never>; Returns: undefined };
      request_export: { Args: Record<PropertyKey, never>; Returns: string };
      reserve_ai: {
        Args: { p_daily: number; p_global: number; p_id: string };
        Returns: undefined;
      };
      reserve_index: { Args: { p_user: string }; Returns: boolean };
      save_note: {
        Args: {
          p_content: Json;
          p_excluded: boolean;
          p_id: string;
          p_pinned: boolean;
          p_revision: number;
          p_tags: string[];
          p_text: string;
          p_title: string;
        };
        Returns: {
          ai_excluded: boolean;
          content: NonNullable<Json>;
          created_at: string;
          deleted_at: string | null;
          id: string;
          pinned: boolean;
          plain_text: string;
          revision: number;
          search_vector: unknown;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "notes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_ai: { Args: { p_enabled: boolean }; Returns: undefined };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
