// Generated with `pnpm db:types` (supabase gen types typescript --linked --schema public) on 2026-10-09.
// Do not edit by hand. Domain types live in src/domain; row-shaped helpers in src/types/database.ts.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string;
          actor_profile_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          organization_id: string | null;
        };
        Insert: {
          action: string;
          actor_profile_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_profile_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey";
            columns: ["actor_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_windows: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["availability_status"];
          technician_profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          starts_at: string;
          status: Database["public"]["Enums"]["availability_status"];
          technician_profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["availability_status"];
          technician_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_windows_technician_profile_id_fkey";
            columns: ["technician_profile_id"];
            isOneToOne: false;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          organization_id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["organization_role"];
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          profile_id: string;
          role?: Database["public"]["Enums"]["organization_role"];
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["organization_role"];
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          country: string | null;
          created_at: string;
          id: string;
          name: string;
          type: Database["public"]["Enums"]["organization_type"];
          updated_at: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          type?: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          type?: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"];
          created_at: string;
          display_name: string;
          id: string;
          platform_role: Database["public"]["Enums"]["platform_role"];
          updated_at: string;
        };
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          display_name: string;
          id: string;
          platform_role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
        };
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          display_name?: string;
          id?: string;
          platform_role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      qualification_types: {
        Row: {
          category: Database["public"]["Enums"]["qualification_category"];
          code: string;
          created_at: string;
          id: string;
          name: string;
          requires_expiry: boolean;
        };
        Insert: {
          category: Database["public"]["Enums"]["qualification_category"];
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          requires_expiry?: boolean;
        };
        Update: {
          category?: Database["public"]["Enums"]["qualification_category"];
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          requires_expiry?: boolean;
        };
        Relationships: [];
      };
      technician_profiles: {
        Row: {
          base_location: string | null;
          created_at: string;
          current_status: Database["public"]["Enums"]["technician_status"];
          mobility: Database["public"]["Enums"]["mobility"];
          profile_id: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["profile_visibility"];
          years_experience: number | null;
        };
        Insert: {
          base_location?: string | null;
          created_at?: string;
          current_status?: Database["public"]["Enums"]["technician_status"];
          mobility?: Database["public"]["Enums"]["mobility"];
          profile_id: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
          years_experience?: number | null;
        };
        Update: {
          base_location?: string | null;
          created_at?: string;
          current_status?: Database["public"]["Enums"]["technician_status"];
          mobility?: Database["public"]["Enums"]["mobility"];
          profile_id?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "technician_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      technician_qualifications: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          issued_at: string | null;
          qualification_type_id: string;
          status: Database["public"]["Enums"]["qualification_status"];
          technician_profile_id: string;
          updated_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          issued_at?: string | null;
          qualification_type_id: string;
          status?: Database["public"]["Enums"]["qualification_status"];
          technician_profile_id: string;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          issued_at?: string | null;
          qualification_type_id?: string;
          status?: Database["public"]["Enums"]["qualification_status"];
          technician_profile_id?: string;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Relationships: [
          {
            foreignKeyName: "technician_qualifications_qualification_type_id_fkey";
            columns: ["qualification_type_id"];
            isOneToOne: false;
            referencedRelation: "qualification_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "technician_qualifications_technician_profile_id_fkey";
            columns: ["technician_profile_id"];
            isOneToOne: false;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      work_requirement_qualifications: {
        Row: {
          id: string;
          qualification_type_id: string;
          requirement_level: Database["public"]["Enums"]["requirement_level"];
          work_requirement_id: string;
        };
        Insert: {
          id?: string;
          qualification_type_id: string;
          requirement_level: Database["public"]["Enums"]["requirement_level"];
          work_requirement_id: string;
        };
        Update: {
          id?: string;
          qualification_type_id?: string;
          requirement_level?: Database["public"]["Enums"]["requirement_level"];
          work_requirement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_requirement_qualifications_qualification_type_id_fkey";
            columns: ["qualification_type_id"];
            isOneToOne: false;
            referencedRelation: "qualification_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_requirement_qualifications_work_requirement_id_fkey";
            columns: ["work_requirement_id"];
            isOneToOne: false;
            referencedRelation: "work_requirements";
            referencedColumns: ["id"];
          },
        ];
      };
      work_requirements: {
        Row: {
          created_at: string;
          created_by: string;
          ends_at: string;
          headcount: number;
          id: string;
          location: string;
          organization_id: string;
          shift: Database["public"]["Enums"]["shift_type"];
          starts_at: string;
          status: Database["public"]["Enums"]["requirement_status"];
          title: string;
          updated_at: string;
          urgency: Database["public"]["Enums"]["requirement_urgency"];
        };
        Insert: {
          created_at?: string;
          created_by: string;
          ends_at: string;
          headcount: number;
          id?: string;
          location: string;
          organization_id: string;
          shift?: Database["public"]["Enums"]["shift_type"];
          starts_at: string;
          status?: Database["public"]["Enums"]["requirement_status"];
          title: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["requirement_urgency"];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          headcount?: number;
          id?: string;
          location?: string;
          organization_id?: string;
          shift?: Database["public"]["Enums"]["shift_type"];
          starts_at?: string;
          status?: Database["public"]["Enums"]["requirement_status"];
          title?: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["requirement_urgency"];
        };
        Relationships: [
          {
            foreignKeyName: "work_requirements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "work_requirements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_view_member: { Args: { p_profile_id: string }; Returns: boolean };
      create_work_requirement: {
        Args: {
          p_ends_at: string;
          p_headcount: number;
          p_location: string;
          p_organization_id: string;
          p_qualifications: Json;
          p_shift: Database["public"]["Enums"]["shift_type"];
          p_starts_at: string;
          p_title: string;
          p_urgency: Database["public"]["Enums"]["requirement_urgency"];
        };
        Returns: string;
      };
      get_requirement_candidate_pool: {
        Args: { p_requirement_id: string };
        Returns: {
          candidate_availability: Json;
          candidate_base_location: string;
          candidate_display_name: string;
          candidate_pool: string;
          candidate_qualifications: Json;
          candidate_ref: string;
          candidate_years_experience: number;
        }[];
      };
      has_org_role: {
        Args: {
          p_organization_id: string;
          p_roles: Database["public"]["Enums"]["organization_role"][];
        };
        Returns: boolean;
      };
      is_org_member: { Args: { p_organization_id: string }; Returns: boolean };
      is_platform_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      account_type: "professional" | "organization";
      availability_status: "available" | "unavailable";
      mobility: "local" | "national" | "international";
      organization_role: "member" | "manager" | "admin";
      organization_type: "mro" | "airline" | "operator" | "staffing_agency" | "other";
      platform_role: "user" | "platform_admin";
      profile_visibility: "private" | "anonymous" | "open";
      qualification_category: "LICENSE" | "TYPE_RATING" | "TRAINING" | "APPROVAL" | "SKILL";
      qualification_status: "active" | "withdrawn";
      requirement_level: "hard" | "soft";
      requirement_status: "draft" | "open" | "covered" | "cancelled" | "closed";
      requirement_urgency: "planned" | "urgent" | "aog";
      shift_type: "day" | "night" | "split" | "flexible";
      technician_status: "employed" | "contractor" | "between_contracts";
      verification_status: "pending" | "verified" | "rejected" | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      account_type: ["professional", "organization"],
      availability_status: ["available", "unavailable"],
      mobility: ["local", "national", "international"],
      organization_role: ["member", "manager", "admin"],
      organization_type: ["mro", "airline", "operator", "staffing_agency", "other"],
      platform_role: ["user", "platform_admin"],
      profile_visibility: ["private", "anonymous", "open"],
      qualification_category: ["LICENSE", "TYPE_RATING", "TRAINING", "APPROVAL", "SKILL"],
      qualification_status: ["active", "withdrawn"],
      requirement_level: ["hard", "soft"],
      requirement_status: ["draft", "open", "covered", "cancelled", "closed"],
      requirement_urgency: ["planned", "urgent", "aog"],
      shift_type: ["day", "night", "split", "flexible"],
      technician_status: ["employed", "contractor", "between_contracts"],
      verification_status: ["pending", "verified", "rejected", "expired"],
    },
  },
} as const;
