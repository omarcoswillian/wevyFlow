export type Platform = "html" | "elementor" | "webflow";

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          client: string;
          starred: boolean;
          thumbnail: string;
          cover_image: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          client?: string;
          starred?: boolean;
          thumbnail?: string;
          cover_image?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          client?: string;
          starred?: boolean;
          thumbnail?: string;
          cover_image?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_pages: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          code: string;
          platform: Platform;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          code?: string;
          platform?: Platform;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          code?: string;
          platform?: Platform;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_pages_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      creative_library: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          name: string | null;
          format: string | null;
          tags: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          name?: string | null;
          format?: string | null;
          tags?: string[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["creative_library"]["Insert"]>;
        Relationships: [];
      };
      criativos: {
        Row: {
          id: string;
          user_id: string;
          format: string;
          url: string;
          headline: string | null;
          produto: string | null;
          prompt: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          format: string;
          url: string;
          headline?: string | null;
          produto?: string | null;
          prompt?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          format?: string;
          url?: string;
          headline?: string | null;
          produto?: string | null;
          prompt?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_images: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          prompt: string | null;
          mode: "create" | "edit" | "upload";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          prompt?: string | null;
          mode?: "create" | "edit" | "upload";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          prompt?: string | null;
          mode?: "create" | "edit" | "upload";
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          user_id: string;
          page_slug: string | null;
          page_title: string | null;
          name: string | null;
          email: string | null;
          phone: string | null;
          extra: Record<string, string> | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          referrer: string | null;
          ip: string | null;
          source_token: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          page_slug?: string | null;
          page_title?: string | null;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          extra?: Record<string, string> | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          referrer?: string | null;
          ip?: string | null;
          source_token?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      published_pages: {
        Row: {
          id: string;
          user_id: string;
          slug: string;
          title: string;
          html: string;
          kit_id: string | null;
          page_type: string | null;
          views: number;
          public_token: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          slug: string;
          title: string;
          html: string;
          kit_id?: string | null;
          page_type?: string | null;
          views?: number;
          public_token?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["published_pages"]["Insert"]>;
        Relationships: [];
      };
      lead_sources: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          title: string;
          platform: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token?: string;
          title?: string;
          platform?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lead_sources"]["Insert"]>;
        Relationships: [];
      };
      brand_kits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          logo_url: string;
          colors: Record<string, string>;
          fonts: Record<string, string>;
          voice_tone: string;
          photos: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          logo_url?: string;
          colors?: Record<string, string>;
          fonts?: Record<string, string>;
          voice_tone?: string;
          photos?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brand_kits"]["Insert"]>;
        Relationships: [];
      };
      generation_history: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          platform: Platform;
          gen_type: string;
          code: string;
          status: "pending" | "success" | "failed_refunded";
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          platform?: Platform;
          gen_type?: string;
          code?: string;
          status?: "pending" | "success" | "failed_refunded";
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          platform?: Platform;
          gen_type?: string;
          code?: string;
          status?: "pending" | "success" | "failed_refunded";
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      launch_kits: {
        Row: {
          id: string;
          user_id: string;
          brand_kit_id: string | null;
          strategy_id: string;
          brand_info: Record<string, unknown>;
          brand_identity: Record<string, unknown> | null;
          assets: unknown[];
          briefing: Record<string, unknown>;
          status: "draft" | "active" | "archived";
          project_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          brand_kit_id?: string | null;
          strategy_id: string;
          brand_info?: Record<string, unknown>;
          brand_identity?: Record<string, unknown> | null;
          assets?: unknown[];
          briefing?: Record<string, unknown>;
          status?: "draft" | "active" | "archived";
          project_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["launch_kits"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "launch_kits_brand_kit_id_fkey";
            columns: ["brand_kit_id"];
            referencedRelation: "brand_kits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "launch_kits_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_log: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          tokens_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          tokens_used?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage_log"]["Insert"]>;
        Relationships: [];
      };
      user_credits: {
        Row: {
          id: string;
          user_id: string;
          credits_used: number;
          credits_limit: number;
          reset_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          credits_used?: number;
          credits_limit?: number;
          reset_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_credits"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_generation_credit: {
        Args: {
          p_user_id: string;
          p_gen_type: string;
          p_prompt: string;
          p_limit: number;
        };
        Returns: {
          allowed: boolean;
          generation_id?: string;
          used: number;
          limit: number;
        };
      };
      finalize_generation: {
        Args: { p_id: string; p_success: boolean; p_error?: string | null };
        Returns: void;
      };
      increment_page_views: {
        Args: { p_slug: string };
        Returns: void;
      };
      deduct_credit: {
        Args: { p_user_id: string; p_action: string; p_tokens?: number };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
};
