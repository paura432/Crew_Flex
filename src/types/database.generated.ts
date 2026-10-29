// Generated with `pnpm db:types:local` (scripts/local/db-types.sh) from the LOCAL stack, schema =
// migrations up to 20261027300000. Do not edit by hand.
// Domain types live in src/domain; row-shaped helpers in src/types/database.ts.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      account_invitations: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"];
          code_hash: string;
          consumed_at: string | null;
          consumed_by: string | null;
          created_at: string;
          created_by: string | null;
          email: string;
          expires_at: string;
          id: string;
          revoked_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"];
          code_hash: string;
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          email: string;
          expires_at: string;
          id?: string;
          revoked_at?: string | null;
        };
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"];
          code_hash?: string;
          consumed_at?: string | null;
          consumed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          expires_at?: string;
          id?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "account_invitations_consumed_by_fkey";
            columns: ["consumed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_invitations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      application_events: {
        Row: {
          actor: string;
          application_id: string;
          created_at: string;
          from_status: Database["public"]["Enums"]["application_status"] | null;
          id: string;
          proposal_id: string | null;
          seq: number;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        ComputedFields: never;
        Insert: {
          actor: string;
          application_id: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["application_status"] | null;
          id?: string;
          proposal_id?: string | null;
          seq: number;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        Update: {
          actor?: string;
          application_id?: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["application_status"] | null;
          id?: string;
          proposal_id?: string | null;
          seq?: number;
          to_status?: Database["public"]["Enums"]["application_status"];
        };
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_events_application_id_proposal_id_fkey";
            columns: ["application_id", "proposal_id"];
            isOneToOne: false;
            referencedRelation: "application_proposals";
            referencedColumns: ["application_id", "id"];
          },
        ];
      };
      application_packs: {
        Row: {
          aircraft: string[];
          application_id: string;
          base_country: string | null;
          base_location: string | null;
          categories: string[];
          created_at: string;
          engines: string[];
          english_level: string | null;
          experience: NonNullable<Json>;
          general_restrictions: string | null;
          min_rate: number | null;
          primary_category: string | null;
          qualifications: NonNullable<Json>;
          rate_unit: string | null;
          skills: string[];
          type_ratings: NonNullable<Json>;
          work_permits: string[];
          years_experience: number | null;
        };
        ComputedFields: never;
        Insert: {
          aircraft?: string[];
          application_id: string;
          base_country?: string | null;
          base_location?: string | null;
          categories?: string[];
          created_at?: string;
          engines?: string[];
          english_level?: string | null;
          experience?: NonNullable<Json>;
          general_restrictions?: string | null;
          min_rate?: number | null;
          primary_category?: string | null;
          qualifications?: NonNullable<Json>;
          rate_unit?: string | null;
          skills?: string[];
          type_ratings?: NonNullable<Json>;
          work_permits?: string[];
          years_experience?: number | null;
        };
        Update: {
          aircraft?: string[];
          application_id?: string;
          base_country?: string | null;
          base_location?: string | null;
          categories?: string[];
          created_at?: string;
          engines?: string[];
          english_level?: string | null;
          experience?: NonNullable<Json>;
          general_restrictions?: string | null;
          min_rate?: number | null;
          primary_category?: string | null;
          qualifications?: NonNullable<Json>;
          rate_unit?: string | null;
          skills?: string[];
          type_ratings?: NonNullable<Json>;
          work_permits?: string[];
          years_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "application_packs_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: true;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_proposals: {
        Row: {
          application_id: string;
          created_at: string;
          id: string;
          terms: NonNullable<Json>;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          id?: string;
          terms: NonNullable<Json>;
          version: number;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          id?: string;
          terms?: NonNullable<Json>;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "application_proposals_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          accepted_proposal_id: string | null;
          created_at: string;
          current_proposal_id: string | null;
          id: string;
          reason: string | null;
          requirement_id: string;
          status: Database["public"]["Enums"]["application_status"];
          technician_profile_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_proposal_id?: string | null;
          created_at?: string;
          current_proposal_id?: string | null;
          id?: string;
          reason?: string | null;
          requirement_id: string;
          status?: Database["public"]["Enums"]["application_status"];
          technician_profile_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accepted_proposal_id?: string | null;
          created_at?: string;
          current_proposal_id?: string | null;
          id?: string;
          reason?: string | null;
          requirement_id?: string;
          status?: Database["public"]["Enums"]["application_status"];
          technician_profile_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_accepted_proposal_fk";
            columns: ["id", "accepted_proposal_id"];
            isOneToOne: false;
            referencedRelation: "application_proposals";
            referencedColumns: ["application_id", "id"];
          },
          {
            foreignKeyName: "applications_current_proposal_fk";
            columns: ["id", "current_proposal_id"];
            isOneToOne: false;
            referencedRelation: "application_proposals";
            referencedColumns: ["application_id", "id"];
          },
          {
            foreignKeyName: "applications_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "work_requirements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_technician_profile_id_fkey";
            columns: ["technician_profile_id"];
            isOneToOne: false;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_profile_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: NonNullable<Json>;
          organization_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_profile_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: NonNullable<Json>;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_profile_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: NonNullable<Json>;
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
      availability_rotations: {
        Row: {
          anchor: string;
          custom_cycle: string[];
          pattern: string;
          technician_profile_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          anchor: string;
          custom_cycle?: string[];
          pattern: string;
          technician_profile_id: string;
          updated_at?: string;
        };
        Update: {
          anchor?: string;
          custom_cycle?: string[];
          pattern?: string;
          technician_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_rotations_technician_profile_id_fkey";
            columns: ["technician_profile_id"];
            isOneToOne: true;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
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
        ComputedFields: never;
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
      logbook_entries: {
        Row: {
          aircraft: string;
          archived: boolean;
          ata: string | null;
          category: Database["public"]["Enums"]["logbook_category"];
          created_at: string;
          cv_relevant: boolean;
          description: string;
          entry_date: string;
          environment: Database["public"]["Enums"]["logbook_environment"];
          hours: number;
          id: string;
          technician_profile_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aircraft: string;
          archived?: boolean;
          ata?: string | null;
          category?: Database["public"]["Enums"]["logbook_category"];
          created_at?: string;
          cv_relevant?: boolean;
          description: string;
          entry_date: string;
          environment?: Database["public"]["Enums"]["logbook_environment"];
          hours: number;
          id?: string;
          technician_profile_id: string;
          updated_at?: string;
        };
        Update: {
          aircraft?: string;
          archived?: boolean;
          ata?: string | null;
          category?: Database["public"]["Enums"]["logbook_category"];
          created_at?: string;
          cv_relevant?: boolean;
          description?: string;
          entry_date?: string;
          environment?: Database["public"]["Enums"]["logbook_environment"];
          hours?: number;
          id?: string;
          technician_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logbook_entries_technician_profile_id_fkey";
            columns: ["technician_profile_id"];
            isOneToOne: false;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      notifications: {
        Row: {
          application_id: string | null;
          application_status: Database["public"]["Enums"]["application_status"] | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          read_at: string | null;
          recipient_id: string;
          requirement_id: string | null;
          requirement_status: Database["public"]["Enums"]["requirement_status"] | null;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          application_status?: Database["public"]["Enums"]["application_status"] | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          read_at?: string | null;
          recipient_id: string;
          requirement_id?: string | null;
          requirement_status?: Database["public"]["Enums"]["requirement_status"] | null;
        };
        Update: {
          application_id?: string | null;
          application_status?: Database["public"]["Enums"]["application_status"] | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["notification_kind"];
          read_at?: string | null;
          recipient_id?: string;
          requirement_id?: string | null;
          requirement_status?: Database["public"]["Enums"]["requirement_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "work_requirements";
            referencedColumns: ["id"];
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
        ComputedFields: never;
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
      organization_reviews: {
        Row: {
          created_at: string;
          id: string;
          note: string;
          organization_id: string;
          organization_version: string;
          reviewed_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          note: string;
          organization_id: string;
          organization_version: string;
          reviewed_by?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string;
          organization_id?: string;
          organization_version?: string;
          reviewed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_reviews_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_reviews_reviewed_by_fkey";
            columns: ["reviewed_by"];
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
          review_status: Database["public"]["Enums"]["organization_review_status"];
          reviewed_at: string | null;
          tax_address: string | null;
          tax_id: string | null;
          type: Database["public"]["Enums"]["organization_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          country?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          review_status?: Database["public"]["Enums"]["organization_review_status"];
          reviewed_at?: string | null;
          tax_address?: string | null;
          tax_id?: string | null;
          type?: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          review_status?: Database["public"]["Enums"]["organization_review_status"];
          reviewed_at?: string | null;
          tax_address?: string | null;
          tax_id?: string | null;
          type?: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_distributions: {
        Row: {
          created_at: string;
          notified_count: number | null;
          requirement_id: string;
          urgency: Database["public"]["Enums"]["requirement_urgency"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          notified_count?: number | null;
          requirement_id: string;
          urgency: Database["public"]["Enums"]["requirement_urgency"];
        };
        Update: {
          created_at?: string;
          notified_count?: number | null;
          requirement_id?: string;
          urgency?: Database["public"]["Enums"]["requirement_urgency"];
        };
        Relationships: [
          {
            foreignKeyName: "outreach_distributions_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: true;
            referencedRelation: "work_requirements";
            referencedColumns: ["id"];
          },
        ];
      };
      professional_documents: {
        Row: {
          archived_at: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["document_kind"];
          mime_type: string;
          owner_id: string;
          qualification_id: string | null;
          scan_status: Database["public"]["Enums"]["document_scan_status"];
          sha256: string;
          size_bytes: number;
          storage_path: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["document_kind"];
          mime_type: string;
          owner_id: string;
          qualification_id?: string | null;
          scan_status?: Database["public"]["Enums"]["document_scan_status"];
          sha256: string;
          size_bytes: number;
          storage_path: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["document_kind"];
          mime_type?: string;
          owner_id?: string;
          qualification_id?: string | null;
          scan_status?: Database["public"]["Enums"]["document_scan_status"];
          sha256?: string;
          size_bytes?: number;
          storage_path?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_documents_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
          {
            foreignKeyName: "professional_documents_qualification_id_fkey";
            columns: ["qualification_id"];
            isOneToOne: false;
            referencedRelation: "technician_qualifications";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"];
          created_at: string;
          display_name: string;
          id: string;
          platform_role: Database["public"]["Enums"]["platform_role"];
          preferred_locale: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          display_name: string;
          id: string;
          platform_role?: Database["public"]["Enums"]["platform_role"];
          preferred_locale?: string | null;
          updated_at?: string;
        };
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          display_name?: string;
          id?: string;
          platform_role?: Database["public"]["Enums"]["platform_role"];
          preferred_locale?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      qualification_reviews: {
        Row: {
          created_at: string;
          decision: Database["public"]["Enums"]["verification_status"];
          id: string;
          note: string;
          qualification_id: string;
          qualification_version: string;
          reviewed_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decision: Database["public"]["Enums"]["verification_status"];
          id?: string;
          note: string;
          qualification_id: string;
          qualification_version: string;
          reviewed_by?: string | null;
        };
        Update: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["verification_status"];
          id?: string;
          note?: string;
          qualification_id?: string;
          qualification_version?: string;
          reviewed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "qualification_reviews_qualification_id_fkey";
            columns: ["qualification_id"];
            isOneToOne: false;
            referencedRelation: "technician_qualifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qualification_reviews_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        ComputedFields: never;
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
      represented_client_reviews: {
        Row: {
          client_id: string;
          created_at: string;
          id: string;
          note: string;
          reviewed_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          id?: string;
          note: string;
          reviewed_by?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          id?: string;
          note?: string;
          reviewed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "represented_client_reviews_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "represented_clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "represented_client_reviews_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      represented_clients: {
        Row: {
          activated_at: string | null;
          agency_id: string;
          contact_email: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          revoked_at: string | null;
          status: Database["public"]["Enums"]["representation_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          activated_at?: string | null;
          agency_id: string;
          contact_email?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["representation_status"];
          updated_at?: string;
        };
        Update: {
          activated_at?: string | null;
          agency_id?: string;
          contact_email?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["representation_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "represented_clients_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "represented_clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      technician_notice_preferences: {
        Row: {
          aog_opt_in: boolean;
          created_at: string;
          mobilization_hours: number | null;
          profile_id: string;
          quiet_end: string | null;
          quiet_start: string | null;
          time_zone: string;
          updated_at: string;
          urgent_opt_in: boolean;
        };
        ComputedFields: never;
        Insert: {
          aog_opt_in?: boolean;
          created_at?: string;
          mobilization_hours?: number | null;
          profile_id: string;
          quiet_end?: string | null;
          quiet_start?: string | null;
          time_zone?: string;
          updated_at?: string;
          urgent_opt_in?: boolean;
        };
        Update: {
          aog_opt_in?: boolean;
          created_at?: string;
          mobilization_hours?: number | null;
          profile_id?: string;
          quiet_end?: string | null;
          quiet_start?: string | null;
          time_zone?: string;
          updated_at?: string;
          urgent_opt_in?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "technician_notice_preferences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      technician_organization_blocks: {
        Row: {
          created_at: string;
          organization_id: string;
          technician_profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          organization_id: string;
          technician_profile_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          technician_profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "technician_organization_blocks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "technician_organization_blocks_technician_profile_id_fkey";
            columns: ["technician_profile_id"];
            isOneToOne: false;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      technician_private_details: {
        Row: {
          created_at: string;
          current_employer_id: string | null;
          min_rate: number | null;
          phone: string | null;
          profile_id: string;
          rate_unit: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_employer_id?: string | null;
          min_rate?: number | null;
          phone?: string | null;
          profile_id: string;
          rate_unit?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_employer_id?: string | null;
          min_rate?: number | null;
          phone?: string | null;
          profile_id?: string;
          rate_unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "technician_private_details_current_employer_id_fkey";
            columns: ["current_employer_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "technician_private_details_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "technician_profiles";
            referencedColumns: ["profile_id"];
          },
        ];
      };
      technician_profiles: {
        Row: {
          aircraft: string[];
          base_country: string | null;
          base_location: string | null;
          categories: string[];
          created_at: string;
          current_status: Database["public"]["Enums"]["technician_status"];
          engines: string[];
          english_level: string | null;
          general_restrictions: string | null;
          mobility: Database["public"]["Enums"]["mobility"];
          own_tools: boolean;
          primary_category: string | null;
          profile_id: string;
          skills: string[];
          updated_at: string;
          visibility: Database["public"]["Enums"]["profile_visibility"];
          work_permits: string[];
          years_experience: number | null;
        };
        ComputedFields: never;
        Insert: {
          aircraft?: string[];
          base_country?: string | null;
          base_location?: string | null;
          categories?: string[];
          created_at?: string;
          current_status?: Database["public"]["Enums"]["technician_status"];
          engines?: string[];
          english_level?: string | null;
          general_restrictions?: string | null;
          mobility?: Database["public"]["Enums"]["mobility"];
          own_tools?: boolean;
          primary_category?: string | null;
          profile_id: string;
          skills?: string[];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
          work_permits?: string[];
          years_experience?: number | null;
        };
        Update: {
          aircraft?: string[];
          base_country?: string | null;
          base_location?: string | null;
          categories?: string[];
          created_at?: string;
          current_status?: Database["public"]["Enums"]["technician_status"];
          engines?: string[];
          english_level?: string | null;
          general_restrictions?: string | null;
          mobility?: Database["public"]["Enums"]["mobility"];
          own_tools?: boolean;
          primary_category?: string | null;
          profile_id?: string;
          skills?: string[];
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["profile_visibility"];
          work_permits?: string[];
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
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["qualification_status"];
          technician_profile_id: string;
          updated_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          issued_at?: string | null;
          qualification_type_id: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
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
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
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
            foreignKeyName: "technician_qualifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      technician_type_ratings: {
        Row: {
          aircraft: string;
          category: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          restrictions: string | null;
          technician_profile_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          aircraft: string;
          category: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          restrictions?: string | null;
          technician_profile_id: string;
          updated_at?: string;
        };
        Update: {
          aircraft?: string;
          category?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          restrictions?: string | null;
          technician_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "technician_type_ratings_technician_profile_id_fkey";
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
        ComputedFields: never;
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
          aircraft: string[];
          archived_at: string | null;
          category: string | null;
          conditions: Json | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string;
          engines: string[];
          headcount: number;
          id: string;
          location: string;
          min_years: number | null;
          on_behalf_of_client_id: string | null;
          organization_id: string;
          required_skills: string[];
          requires_type_rating: boolean;
          shift: Database["public"]["Enums"]["shift_type"];
          shifts: Json | null;
          starts_at: string;
          status: Database["public"]["Enums"]["requirement_status"];
          timezone: string | null;
          title: string;
          updated_at: string;
          urgency: Database["public"]["Enums"]["requirement_urgency"];
        };
        ComputedFields: never;
        Insert: {
          aircraft?: string[];
          archived_at?: string | null;
          category?: string | null;
          conditions?: Json | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at: string;
          engines?: string[];
          headcount: number;
          id?: string;
          location: string;
          min_years?: number | null;
          on_behalf_of_client_id?: string | null;
          organization_id: string;
          required_skills?: string[];
          requires_type_rating?: boolean;
          shift?: Database["public"]["Enums"]["shift_type"];
          shifts?: Json | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["requirement_status"];
          timezone?: string | null;
          title: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["requirement_urgency"];
        };
        Update: {
          aircraft?: string[];
          archived_at?: string | null;
          category?: string | null;
          conditions?: Json | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string;
          engines?: string[];
          headcount?: number;
          id?: string;
          location?: string;
          min_years?: number | null;
          on_behalf_of_client_id?: string | null;
          organization_id?: string;
          required_skills?: string[];
          requires_type_rating?: boolean;
          shift?: Database["public"]["Enums"]["shift_type"];
          shifts?: Json | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["requirement_status"];
          timezone?: string | null;
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
            foreignKeyName: "work_requirements_on_behalf_of_client_id_fkey";
            columns: ["on_behalf_of_client_id"];
            isOneToOne: false;
            referencedRelation: "represented_clients";
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
      activate_represented_client: {
        Args: { p_client_id: string; p_note: string; p_request_id?: string };
        Returns: {
          activated_at: string;
          id: string;
          status: Database["public"]["Enums"]["representation_status"];
        }[];
      };
      add_represented_client: {
        Args: {
          p_contact_email?: string;
          p_name: string;
          p_organization_id: string;
          p_request_id?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["representation_status"];
        }[];
      };
      apply_to_requirement: {
        Args: {
          p_idempotency_key: string;
          p_request_id?: string;
          p_requirement_id: string;
          p_share_consent: boolean;
        };
        Returns: {
          id: string;
          replayed: boolean;
        }[];
      };
      archive_work_requirement: {
        Args: { p_id: string };
        Returns: {
          archived_at: string;
          id: string;
          status: Database["public"]["Enums"]["requirement_status"];
        }[];
      };
      availability_version: { Args: Record<PropertyKey, never>; Returns: string };
      can_view_member: { Args: { p_profile_id: string }; Returns: boolean };
      close_my_account: {
        Args: { p_request_id?: string };
        Returns: {
          storage_path: string;
        }[];
      };
      count_my_unread_notifications: { Args: Record<PropertyKey, never>; Returns: number };
      count_viable_candidates: {
        Args: {
          p_country?: string;
          p_ends_at: string;
          p_hard_type_ids: string[];
          p_organization_id: string;
          p_starts_at: string;
          p_urgency: Database["public"]["Enums"]["requirement_urgency"];
        };
        Returns: number;
      };
      count_visible_network: { Args: { p_organization_id: string }; Returns: number };
      create_availability_window: {
        Args: {
          p_ends_at: string;
          p_idempotency_key: string;
          p_starts_at: string;
          p_status: Database["public"]["Enums"]["availability_status"];
        };
        Returns: {
          id: string;
          replayed: boolean;
        }[];
      };
      create_invitation: {
        Args: {
          p_account_type: Database["public"]["Enums"]["account_type"];
          p_email: string;
          p_request_id?: string;
        };
        Returns: {
          code: string;
          expires_at: string;
          invitation_id: string;
        }[];
      };
      create_logbook_entry: {
        Args: {
          p_aircraft: string;
          p_ata: string;
          p_category: Database["public"]["Enums"]["logbook_category"];
          p_cv_relevant: boolean;
          p_description: string;
          p_entry_date: string;
          p_environment: Database["public"]["Enums"]["logbook_environment"];
          p_hours: number;
          p_idempotency_key: string;
        };
        Returns: {
          id: string;
          replayed: boolean;
        }[];
      };
      create_professional_document: {
        Args: {
          p_expires_at: string;
          p_idempotency_key: string;
          p_kind: Database["public"]["Enums"]["document_kind"];
          p_mime_type: string;
          p_qualification_id: string;
          p_sha256: string;
          p_size_bytes: number;
          p_storage_path: string;
          p_title: string;
        };
        Returns: {
          id: string;
          replayed: boolean;
        }[];
      };
      create_work_requirement:
        | {
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
          }
        | {
            Args: {
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_headcount: number;
              p_location: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: string;
          }
        | {
            Args: {
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_headcount: number;
              p_location: string;
              p_on_behalf_of_client_id: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: string;
          }
        | {
            Args: {
              p_aircraft: string[];
              p_category: string;
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_engines: string[];
              p_headcount: number;
              p_location: string;
              p_min_years: number;
              p_on_behalf_of_client_id: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_required_skills: string[];
              p_requires_type_rating: boolean;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: string;
          };
      create_work_requirement_idempotent:
        | {
            Args: {
              p_ends_at: string;
              p_headcount: number;
              p_idempotency_key: string;
              p_location: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_starts_at: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              id: string;
              replayed: boolean;
            }[];
          }
        | {
            Args: {
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_headcount: number;
              p_idempotency_key: string;
              p_location: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              id: string;
              replayed: boolean;
            }[];
          }
        | {
            Args: {
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_headcount: number;
              p_idempotency_key: string;
              p_location: string;
              p_on_behalf_of_client_id: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              id: string;
              replayed: boolean;
            }[];
          }
        | {
            Args: {
              p_aircraft: string[];
              p_category: string;
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_engines: string[];
              p_headcount: number;
              p_idempotency_key: string;
              p_location: string;
              p_min_years: number;
              p_on_behalf_of_client_id: string;
              p_organization_id: string;
              p_qualifications: Json;
              p_required_skills: string[];
              p_requires_type_rating: boolean;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              id: string;
              replayed: boolean;
            }[];
          };
      declare_qualification: {
        Args: {
          p_expires_at: string;
          p_idempotency_key: string;
          p_issued_at: string;
          p_qualification_type_id: string;
        };
        Returns: {
          id: string;
          replayed: boolean;
        }[];
      };
      document_maintenance_batch: {
        Args: { p_apply: boolean; p_limit: number };
        Returns: {
          action: string;
          reason: string;
          storage_path: string;
          tombstone_id: string;
        }[];
      };
      document_purge_recheck: {
        Args: { p_tombstone_id: string };
        Returns: {
          allowed: boolean;
          storage_path: string;
          why: string;
        }[];
      };
      document_purge_record: {
        Args: { p_error: string; p_outcome: string; p_tombstone_id: string };
        Returns: undefined;
      };
      document_trash_retention_days: { Args: Record<PropertyKey, never>; Returns: number };
      finish_invitation_delivery: {
        Args: { p_invitation_id: string; p_request_id?: string; p_sent: boolean };
        Returns: number;
      };
      get_application_counts: {
        Args: { p_organization_id: string };
        Returns: {
          status: Database["public"]["Enums"]["application_status"];
          total: number;
        }[];
      };
      get_application_pack: {
        Args: { p_application_id: string };
        Returns: {
          aircraft: string[];
          application_id: string;
          base_country: string;
          base_location: string;
          categories: string[];
          copied_at: string;
          engines: string[];
          english_level: string;
          experience: Json;
          general_restrictions: string;
          min_rate: number;
          primary_category: string;
          qualifications: Json;
          rate_unit: string;
          skills: string[];
          type_ratings: Json;
          work_permits: string[];
          years_experience: number;
        }[];
      };
      get_my_application_packs: {
        Args: Record<PropertyKey, never>;
        Returns: {
          aircraft: string[];
          application_id: string;
          base_country: string;
          base_location: string;
          categories: string[];
          copied_at: string;
          engines: string[];
          english_level: string;
          experience: Json;
          general_restrictions: string;
          min_rate: number;
          primary_category: string;
          qualifications: Json;
          rate_unit: string;
          skills: string[];
          type_ratings: Json;
          work_permits: string[];
          years_experience: number;
        }[];
      };
      get_my_applications: {
        Args: Record<PropertyKey, never>;
        Returns: {
          accepted_proposal_id: string;
          application_id: string;
          created_at: string;
          current_proposal: Json;
          history: Json;
          reason: string;
          requirement: Json;
          requirement_id: string;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        }[];
      };
      get_my_candidate_pack_preview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          aircraft: string[];
          base_country: string;
          base_location: string;
          categories: string[];
          copied_at: string;
          engines: string[];
          english_level: string;
          experience: Json;
          general_restrictions: string;
          min_rate: number;
          primary_category: string;
          qualifications: Json;
          rate_unit: string;
          skills: string[];
          type_ratings: Json;
          work_permits: string[];
          years_experience: number;
        }[];
      };
      get_my_notifications: {
        Args: { p_id?: string; p_limit?: number; p_offset?: number };
        Returns: {
          application_id: string;
          application_status: Database["public"]["Enums"]["application_status"];
          audience: string;
          candidate_name: string;
          candidate_ref: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          organization_name: string;
          outreach_urgency: Database["public"]["Enums"]["requirement_urgency"];
          read_at: string;
          requirement_id: string;
          requirement_status: Database["public"]["Enums"]["requirement_status"];
          requirement_title: string;
          total: number;
        }[];
      };
      get_organization_applications: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_organization_id: string;
          p_requirement_id?: string;
          p_status?: Database["public"]["Enums"]["application_status"];
        };
        Returns: {
          accepted_proposal_id: string;
          aircraft: string[];
          application_id: string;
          candidate_availability: Json;
          candidate_base_location: string;
          candidate_declarations: Json;
          candidate_display_name: string;
          candidate_pool: string;
          candidate_qualifications: Json;
          candidate_ref: string;
          candidate_years_experience: number;
          category: string;
          created_at: string;
          current_proposal: Json;
          engines: string[];
          history: Json;
          min_years: number;
          reason: string;
          required_skills: string[];
          requirement: Json;
          requirement_id: string;
          requires_type_rating: boolean;
          status: Database["public"]["Enums"]["application_status"];
          total: number;
          updated_at: string;
        }[];
      };
      get_platform_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active_requirements: number;
          aog_with_vacancies: number;
          demand: Json;
          organizations: number;
          technicians: number;
          working_now: number;
        }[];
      };
      get_requirement_application_counts: {
        Args: { p_organization_id: string };
        Returns: {
          counts: Json;
          ends_at: string;
          headcount: number;
          requirement_id: string;
          shift_count: number;
          starts_at: string;
        }[];
      };
      get_requirement_applications: {
        Args: { p_requirement_id: string };
        Returns: {
          accepted_proposal_id: string;
          application_id: string;
          candidate_availability: Json;
          candidate_base_location: string;
          candidate_declarations: Json;
          candidate_display_name: string;
          candidate_pool: string;
          candidate_qualifications: Json;
          candidate_ref: string;
          candidate_years_experience: number;
          created_at: string;
          current_proposal: Json;
          history: Json;
          reason: string;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        }[];
      };
      get_requirement_candidate_passports: {
        Args: { p_requirement_id: string };
        Returns: {
          aircraft: string[];
          candidate_ref: string;
          categories: string[];
          english_level: string;
          has_restrictions: boolean;
          primary_category: string;
          work_permits: string[];
        }[];
      };
      get_requirement_candidate_pool: {
        Args: { p_requirement_id: string };
        Returns: {
          candidate_availability: Json;
          candidate_base_location: string;
          candidate_declarations: Json;
          candidate_display_name: string;
          candidate_pool: string;
          candidate_qualifications: Json;
          candidate_ref: string;
          candidate_years_experience: number;
        }[];
      };
      get_requirement_external_pool_summary: {
        Args: { p_requirement_id: string };
        Returns: {
          cap: number;
          hard_eligible: number;
          prefiltered: number;
        }[];
      };
      get_requirement_profile_rules: {
        Args: { p_requirement_ids: string[] };
        Returns: {
          aircraft: string[];
          category: string;
          engines: string[];
          min_years: number;
          required_skills: string[];
          requirement_id: string;
          requires_type_rating: boolean;
        }[];
      };
      has_org_role: {
        Args: {
          p_organization_id: string;
          p_roles: Database["public"]["Enums"]["organization_role"][];
        };
        Returns: boolean;
      };
      invitation_signup_required: { Args: Record<PropertyKey, never>; Returns: boolean };
      invitation_status: {
        Args: { p_code: string; p_email?: string };
        Returns: {
          account_type: Database["public"]["Enums"]["account_type"];
          status: string;
        }[];
      };
      is_feature_enabled: { Args: { p_name: string }; Returns: boolean };
      is_org_member: { Args: { p_organization_id: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      list_blockable_organizations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
        }[];
      };
      list_opportunities: {
        Args: {
          p_id?: string;
          p_limit?: number;
          p_q?: string;
          p_urgency?: Database["public"]["Enums"]["requirement_urgency"];
        };
        Returns: {
          client_name: string;
          conditions: Json;
          country: string;
          created_at: string;
          description: string;
          ends_at: string;
          headcount: number;
          id: string;
          location: string;
          organization_name: string;
          qualifications: Json;
          shift: Database["public"]["Enums"]["shift_type"];
          shifts: Json;
          starts_at: string;
          time_zone: string;
          title: string;
          total: number;
          urgency: Database["public"]["Enums"]["requirement_urgency"];
        }[];
      };
      list_representation_reviews: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activated_at: string;
          agency_id: string;
          agency_name: string;
          contact_email: string;
          created_at: string;
          id: string;
          name: string;
          revoked_at: string;
          status: Database["public"]["Enums"]["representation_status"];
        }[];
      };
      list_represented_clients: {
        Args: { p_organization_id: string };
        Returns: {
          activated_at: string;
          agency_id: string;
          contact_email: string;
          created_at: string;
          id: string;
          name: string;
          revoked_at: string;
          status: Database["public"]["Enums"]["representation_status"];
        }[];
      };
      mark_notifications_read: { Args: { p_id?: string }; Returns: number };
      own_candidate_profile: {
        Args: { p_from?: string; p_to?: string };
        Returns: {
          candidate_availability: Json;
          candidate_base_location: string;
          candidate_declarations: Json;
          candidate_display_name: string;
          candidate_pool: string;
          candidate_qualifications: Json;
          candidate_ref: string;
          candidate_years_experience: number;
        }[];
      };
      own_qualification_reviews: {
        Args: Record<PropertyKey, never>;
        Returns: {
          qualification_id: string;
          review_note: string;
          reviewed_at: string;
        }[];
      };
      replace_availability_days: {
        Args: {
          p_days: Json;
          p_expected_version?: string;
          p_idempotency_key: string;
          p_rotation?: Json;
        };
        Returns: {
          id: string;
          replayed: boolean;
          windows_created: number;
        }[];
      };
      requirement_outreach: {
        Args: { p_request_id?: string; p_requirement_id: string };
        Returns: {
          distributed_at: string;
          notified: number;
          urgency: Database["public"]["Enums"]["requirement_urgency"];
        }[];
      };
      review_organization: {
        Args: {
          p_expected_updated_at: string;
          p_note: string;
          p_organization_id: string;
          p_request_id?: string;
        };
        Returns: {
          id: string;
          review_status: Database["public"]["Enums"]["organization_review_status"];
          reviewed_at: string;
        }[];
      };
      review_qualification: {
        Args: {
          p_decision: Database["public"]["Enums"]["verification_status"];
          p_expected_updated_at: string;
          p_note?: string;
          p_qualification_id: string;
          p_request_id?: string;
        };
        Returns: {
          id: string;
          reviewed_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
        }[];
      };
      revoke_represented_client: {
        Args: { p_client_id: string; p_request_id?: string };
        Returns: {
          id: string;
          revoked_at: string;
          status: Database["public"]["Enums"]["representation_status"];
        }[];
      };
      save_notice_preferences: {
        Args: {
          p_aog_opt_in: boolean;
          p_mobilization_hours: number;
          p_quiet_end: string;
          p_quiet_start: string;
          p_time_zone: string;
          p_urgent_opt_in: boolean;
        };
        Returns: {
          aog_opt_in: boolean;
          created_at: string;
          mobilization_hours: number | null;
          profile_id: string;
          quiet_end: string | null;
          quiet_start: string | null;
          time_zone: string;
          updated_at: string;
          urgent_opt_in: boolean;
        }[];
        SetofOptions: {
          from: "*";
          to: "technician_notice_preferences";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      save_professional_passport: {
        Args: { p_expected_updated_at?: string; p_passport: Json };
        Returns: string;
      };
      search_candidate_directory: {
        Args: {
          p_aircraft?: string;
          p_base?: string;
          p_category?: string;
          p_country?: string;
          p_english_level?: string;
          p_from?: string;
          p_limit?: number;
          p_min_years?: number;
          p_offset?: number;
          p_organization_id: string;
          p_to?: string;
        };
        Returns: {
          candidate_base_location: string;
          candidate_declarations: Json;
          candidate_display_name: string;
          candidate_ref: string;
          candidate_years_experience: number;
          total: number;
        }[];
      };
      transition_application: {
        Args: {
          p_application_id: string;
          p_expected_updated_at: string;
          p_idempotency_key: string;
          p_proposal_id?: string;
          p_reason?: string;
          p_request_id?: string;
          p_to: Database["public"]["Enums"]["application_status"];
        };
        Returns: {
          application_id: string;
          event_id: string;
          proposal_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
        }[];
      };
      update_organization_profile: {
        Args: {
          p_country: string;
          p_expected_updated_at: string;
          p_name: string;
          p_organization_id: string;
          p_tax_address: string;
          p_tax_id: string;
          p_type: Database["public"]["Enums"]["organization_type"];
        };
        Returns: string;
      };
      update_professional_profile: {
        Args: {
          p_base_location: string;
          p_current_status: Database["public"]["Enums"]["technician_status"];
          p_display_name: string;
          p_expected_updated_at?: string;
          p_mobility: Database["public"]["Enums"]["mobility"];
          p_visibility: Database["public"]["Enums"]["profile_visibility"];
          p_years_experience: number;
        };
        Returns: string;
      };
      update_work_requirement:
        | {
            Args: {
              p_ends_at: string;
              p_expected_updated_at: string;
              p_headcount: number;
              p_id: string;
              p_location: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_starts_at: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              changed: string[];
              id: string;
              updated_at: string;
            }[];
          }
        | {
            Args: {
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_expected_updated_at: string;
              p_headcount: number;
              p_id: string;
              p_location: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              changed: string[];
              id: string;
              updated_at: string;
            }[];
          }
        | {
            Args: {
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_expected_updated_at: string;
              p_headcount: number;
              p_id: string;
              p_location: string;
              p_on_behalf_of_client_id: string;
              p_qualifications: Json;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              changed: string[];
              id: string;
              updated_at: string;
            }[];
          }
        | {
            Args: {
              p_aircraft: string[];
              p_category: string;
              p_conditions: Json;
              p_country: string;
              p_description: string;
              p_ends_at: string;
              p_engines: string[];
              p_expected_updated_at: string;
              p_headcount: number;
              p_id: string;
              p_location: string;
              p_min_years: number;
              p_on_behalf_of_client_id: string;
              p_qualifications: Json;
              p_required_skills: string[];
              p_requires_type_rating: boolean;
              p_shift: Database["public"]["Enums"]["shift_type"];
              p_shifts: Json;
              p_starts_at: string;
              p_status: Database["public"]["Enums"]["requirement_status"];
              p_time_zone: string;
              p_title: string;
              p_urgency: Database["public"]["Enums"]["requirement_urgency"];
            };
            Returns: {
              changed: string[];
              id: string;
              updated_at: string;
            }[];
          };
    };
    Enums: {
      account_type: "professional" | "organization";
      application_status:
        | "received"
        | "shortlisted"
        | "proposed"
        | "accepted"
        | "confirmed"
        | "finished"
        | "rejected"
        | "withdrawn"
        | "cancelled";
      availability_status: "available" | "unavailable" | "aog_only";
      document_kind: "license" | "course" | "other";
      document_scan_status: "not_scanned" | "clean" | "infected";
      logbook_category:
        | "defect_rectification"
        | "inspection"
        | "component_replacement"
        | "troubleshooting"
        | "sheet_metal_structures"
        | "cabin_interiors";
      logbook_environment:
        | "line_maintenance"
        | "base_maintenance"
        | "engine_bay_check"
        | "aog_intervention"
        | "workshop";
      mobility: "local" | "national" | "international";
      notification_kind: "application" | "requirement" | "outreach";
      organization_review_status: "pending" | "reviewed";
      organization_role: "member" | "manager" | "admin";
      organization_type: "mro" | "airline" | "operator" | "staffing_agency" | "other";
      platform_role: "user" | "platform_admin";
      profile_visibility: "private" | "anonymous" | "verified_orgs" | "open";
      qualification_category: "LICENSE" | "TYPE_RATING" | "TRAINING" | "APPROVAL" | "SKILL";
      qualification_status: "active" | "withdrawn";
      representation_status: "pending" | "active" | "revoked";
      requirement_level: "hard" | "soft";
      requirement_status: "draft" | "open" | "paused" | "covered" | "cancelled" | "closed";
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_type: ["professional", "organization"],
      application_status: [
        "received",
        "shortlisted",
        "proposed",
        "accepted",
        "confirmed",
        "finished",
        "rejected",
        "withdrawn",
        "cancelled",
      ],
      availability_status: ["available", "unavailable", "aog_only"],
      document_kind: ["license", "course", "other"],
      document_scan_status: ["not_scanned", "clean", "infected"],
      logbook_category: [
        "defect_rectification",
        "inspection",
        "component_replacement",
        "troubleshooting",
        "sheet_metal_structures",
        "cabin_interiors",
      ],
      logbook_environment: [
        "line_maintenance",
        "base_maintenance",
        "engine_bay_check",
        "aog_intervention",
        "workshop",
      ],
      mobility: ["local", "national", "international"],
      notification_kind: ["application", "requirement", "outreach"],
      organization_review_status: ["pending", "reviewed"],
      organization_role: ["member", "manager", "admin"],
      organization_type: ["mro", "airline", "operator", "staffing_agency", "other"],
      platform_role: ["user", "platform_admin"],
      profile_visibility: ["private", "anonymous", "verified_orgs", "open"],
      qualification_category: ["LICENSE", "TYPE_RATING", "TRAINING", "APPROVAL", "SKILL"],
      qualification_status: ["active", "withdrawn"],
      representation_status: ["pending", "active", "revoked"],
      requirement_level: ["hard", "soft"],
      requirement_status: ["draft", "open", "paused", "covered", "cancelled", "closed"],
      requirement_urgency: ["planned", "urgent", "aog"],
      shift_type: ["day", "night", "split", "flexible"],
      technician_status: ["employed", "contractor", "between_contracts"],
      verification_status: ["pending", "verified", "rejected", "expired"],
    },
  },
} as const;
