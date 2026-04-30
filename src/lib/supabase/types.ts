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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["published_pages"]["Insert"]>;
        Relationships: [];
      };
      generation_history: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          platform: Platform;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          platform?: Platform;
          code?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          platform?: Platform;
          code?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
