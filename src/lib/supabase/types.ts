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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
