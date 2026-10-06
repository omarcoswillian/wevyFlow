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
          domain: string;
          description: string;
          favicon: string;
          seo_title: string;
          seo_description: string;
          seo_og_image: string;
          seo_no_index: boolean;
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
          domain?: string;
          description?: string;
          favicon?: string;
          seo_title?: string;
          seo_description?: string;
          seo_og_image?: string;
          seo_no_index?: boolean;
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
          domain?: string;
          description?: string;
          favicon?: string;
          seo_title?: string;
          seo_description?: string;
          seo_og_image?: string;
          seo_no_index?: boolean;
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
          project_id: string | null;
          status: string;
          copy_headline: string | null;
          copy_cta: string | null;
          text_layer: boolean;
          source_ad_external_id: string | null;
          hypothesis: string | null;
          analysis_id: string | null;
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
          project_id?: string | null;
          status?: string;
          copy_headline?: string | null;
          copy_cta?: string | null;
          text_layer?: boolean;
          source_ad_external_id?: string | null;
          hypothesis?: string | null;
          analysis_id?: string | null;
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
          project_id?: string | null;
          status?: string;
          copy_headline?: string | null;
          copy_cta?: string | null;
          text_layer?: boolean;
          source_ad_external_id?: string | null;
          hypothesis?: string | null;
          analysis_id?: string | null;
        };
        Relationships: [];
      };
      page_monitors: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          label: string | null;
          last_checked_at: string | null;
          http_status: number | null;
          is_up: boolean | null;
          response_time_ms: number | null;
          check_error: string | null;
          page_status: "ONLINE" | "LENTO" | "OFFLINE" | "BLOQUEADO" | "TIMEOUT" | null;
          is_soft_404: boolean | null;
          blocked: boolean | null;
          block_reason: string | null;
          ssl_status: "valid" | "expiring_soon" | "critical" | "expired" | "error" | "no_ssl" | null;
          ssl_expires_at: string | null;
          ssl_days_remaining: number | null;
          ssl_issuer: string | null;
          pagespeed_checked_at: string | null;
          pagespeed_performance: number | null;
          pagespeed_seo: number | null;
          pagespeed_accessibility: number | null;
          pagespeed_best_practices: number | null;
          pagespeed_fcp: number | null;
          pagespeed_lcp: number | null;
          pagespeed_tbt: number | null;
          pagespeed_cls: number | null;
          pagespeed_speed_index: number | null;
          pagespeed_error: string | null;
          consecutive_failures: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          label?: string | null;
          last_checked_at?: string | null;
          http_status?: number | null;
          is_up?: boolean | null;
          response_time_ms?: number | null;
          check_error?: string | null;
          consecutive_failures?: number;
          page_status?: "ONLINE" | "LENTO" | "OFFLINE" | "BLOQUEADO" | "TIMEOUT" | null;
          is_soft_404?: boolean | null;
          blocked?: boolean | null;
          block_reason?: string | null;
          ssl_status?: "valid" | "expiring_soon" | "critical" | "expired" | "error" | "no_ssl" | null;
          ssl_expires_at?: string | null;
          ssl_days_remaining?: number | null;
          ssl_issuer?: string | null;
          pagespeed_checked_at?: string | null;
          pagespeed_performance?: number | null;
          pagespeed_seo?: number | null;
          pagespeed_accessibility?: number | null;
          pagespeed_best_practices?: number | null;
          pagespeed_fcp?: number | null;
          pagespeed_lcp?: number | null;
          pagespeed_tbt?: number | null;
          pagespeed_cls?: number | null;
          pagespeed_speed_index?: number | null;
          pagespeed_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_monitors"]["Insert"]>;
        Relationships: [];
      };
      page_monitor_history: {
        Row: {
          id: string;
          page_monitor_id: string;
          user_id: string;
          page_status: string;
          http_status: number | null;
          response_time_ms: number | null;
          error: string | null;
          checked_at: string;
        };
        Insert: {
          id?: string;
          page_monitor_id: string;
          user_id: string;
          page_status: string;
          http_status?: number | null;
          response_time_ms?: number | null;
          error?: string | null;
          checked_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["page_monitor_history"]["Insert"]>;
        Relationships: [];
      };
      page_monitor_incidents: {
        Row: {
          id: string;
          page_monitor_id: string;
          user_id: string;
          type: string;
          message: string;
          probable_cause: string | null;
          consecutive_failures_at_open: number | null;
          final_status: string | null;
          started_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          page_monitor_id: string;
          user_id: string;
          type: string;
          message: string;
          probable_cause?: string | null;
          consecutive_failures_at_open?: number | null;
          final_status?: string | null;
          started_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["page_monitor_incidents"]["Insert"]>;
        Relationships: [];
      };
      meta_ads_connections: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          token_expires_at: string | null;
          meta_user_id: string;
          meta_user_name: string | null;
          meta_user_picture_url: string | null;
          available_ad_accounts: { id: string; name: string }[];
          ad_account_id: string | null;
          ad_account_name: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          access_token: string;
          token_expires_at?: string | null;
          meta_user_id: string;
          meta_user_name?: string | null;
          meta_user_picture_url?: string | null;
          available_ad_accounts?: { id: string; name: string }[];
          ad_account_id?: string | null;
          ad_account_name?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meta_ads_connections"]["Insert"]>;
        Relationships: [];
      };
      meta_data_deletion_requests: {
        Row: {
          confirmation_code: string;
          kind: "deletion" | "deauthorize";
          status: "completed" | "failed";
          connections_deleted: number;
          created_at: string;
        };
        Insert: {
          confirmation_code: string;
          kind: "deletion" | "deauthorize";
          status?: "completed" | "failed";
          connections_deleted?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["meta_data_deletion_requests"]["Insert"]>;
        Relationships: [];
      };
      ad_watch_creatives: {
        Row: {
          id: string;
          user_id: string;
          source: "mock" | "meta_ad_library" | "foreplay" | "meta_ads_api";
          advertiser_name: string;
          headline: string | null;
          body: string | null;
          thumbnail_url: string | null;
          platforms: string[];
          status: "active" | "inactive";
          started_at: string;
          stopped_at: string | null;
          is_favorite: boolean;
          external_id: string | null;
          meta_ad_account_id: string | null;
          media_type: "image" | "video" | "unknown";
          creative_id: string | null;
          video_id: string | null;
          image_hash: string | null;
          image_url: string | null;
          media_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source?: "mock" | "meta_ad_library" | "foreplay" | "meta_ads_api";
          advertiser_name: string;
          headline?: string | null;
          body?: string | null;
          thumbnail_url?: string | null;
          platforms?: string[];
          status?: "active" | "inactive";
          started_at: string;
          stopped_at?: string | null;
          is_favorite?: boolean;
          external_id?: string | null;
          meta_ad_account_id?: string | null;
          media_type?: "image" | "video" | "unknown";
          creative_id?: string | null;
          video_id?: string | null;
          image_hash?: string | null;
          image_url?: string | null;
          media_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_watch_creatives"]["Insert"]>;
        Relationships: [];
      };
      meta_ads_daily_insights: {
        Row: {
          user_id: string;
          ad_external_id: string;
          meta_ad_account_id: string;
          date: string;
          spend: number;
          impressions: number;
          clicks: number;
          purchases: number;
          purchase_value: number;
          video_plays: number;
          video_thruplays: number;
          video_p25: number;
          video_p50: number;
          video_p75: number;
          video_p100: number;
          currency: string | null;
        };
        Insert: Database["public"]["Tables"]["meta_ads_daily_insights"]["Row"];
        Update: Partial<Database["public"]["Tables"]["meta_ads_daily_insights"]["Row"]>;
        Relationships: [];
      };
      youtube_connections: {
        Row: {
          user_id: string;
          refresh_token: string;
          channel_id: string;
          channel_title: string | null;
          channel_picture_url: string | null;
          uploads_playlist_id: string | null;
          last_synced_at: string | null;
          ctr_available: boolean | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          refresh_token: string;
          channel_id: string;
          channel_title?: string | null;
          channel_picture_url?: string | null;
          uploads_playlist_id?: string | null;
          last_synced_at?: string | null;
          ctr_available?: boolean | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["youtube_connections"]["Insert"]>;
        Relationships: [];
      };
      youtube_videos: {
        Row: {
          user_id: string;
          video_id: string;
          title: string;
          published_at: string;
          thumbnail_url: string | null;
          thumbnail_path: string | null;
          duration_seconds: number;
          view_count: number;
          like_count: number;
          comment_count: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          video_id: string;
          title: string;
          published_at: string;
          thumbnail_url?: string | null;
          thumbnail_path?: string | null;
          duration_seconds?: number;
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["youtube_videos"]["Insert"]>;
        Relationships: [];
      };
      youtube_video_metrics: {
        Row: {
          user_id: string;
          video_id: string;
          period_days: number;
          views: number;
          minutes_watched: number;
          avg_view_duration_seconds: number;
          avg_view_percentage: number;
          likes: number;
          comments: number;
          subscribers_gained: number;
          thumb_impressions: number | null;
          thumb_ctr: number | null;
          fetched_at: string;
        };
        Insert: {
          user_id: string;
          video_id: string;
          period_days: number;
          views?: number;
          minutes_watched?: number;
          avg_view_duration_seconds?: number;
          avg_view_percentage?: number;
          likes?: number;
          comments?: number;
          subscribers_gained?: number;
          thumb_impressions?: number | null;
          thumb_ctr?: number | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["youtube_video_metrics"]["Insert"]>;
        Relationships: [];
      };
      youtube_thumbnail_tests: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          hypothesis: string;
          analysis_id: string | null;
          variants: { label: string; criativo_id: string | null; url: string | null; watch_share: number | null }[];
          status: "running" | "finished";
          winner_label: string | null;
          note: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          hypothesis: string;
          analysis_id?: string | null;
          variants?: { label: string; criativo_id: string | null; url: string | null; watch_share: number | null }[];
          status?: "running" | "finished";
          winner_label?: string | null;
          note?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["youtube_thumbnail_tests"]["Insert"]>;
        Relationships: [];
      };
      youtube_studio_ctr: {
        Row: {
          user_id: string;
          video_id: string;
          period_start: string;
          period_end: string;
          impressions: number;
          ctr: number;
          imported_at: string;
        };
        Insert: {
          user_id: string;
          video_id: string;
          period_start: string;
          period_end: string;
          impressions?: number;
          ctr?: number;
          imported_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["youtube_studio_ctr"]["Insert"]>;
        Relationships: [];
      };
      ad_creative_analyses: {
        Row: {
          id: string;
          user_id: string;
          ad_external_id: string;
          media_type: string;
          coverage: "full" | "partial";
          analysis: Record<string, unknown>;
          model: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ad_external_id: string;
          media_type: string;
          coverage: "full" | "partial";
          analysis: Record<string, unknown>;
          model?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_creative_analyses"]["Insert"]>;
        Relationships: [];
      };
      saved_components: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          html: string;
          tag: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          html: string;
          tag: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_components"]["Insert"]>;
        Relationships: [];
      };
      copy_documents: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          type: string;
          title: string;
          status: string;
          context: Record<string, unknown>;
          options: Record<string, unknown>[];
          selected: Record<string, unknown> | null;
          model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          type?: string;
          title: string;
          status?: string;
          context?: Record<string, unknown>;
          options?: Record<string, unknown>[];
          selected?: Record<string, unknown> | null;
          model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["copy_documents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "copy_documents_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_drafts: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          code: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_drafts"]["Insert"]>;
        Relationships: [];
      };
      ensaios: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          style_id: string;
          style_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          style_id: string;
          style_name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ensaios"]["Insert"]>;
        Relationships: [];
      };
      carousels: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          format: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          format?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carousels"]["Insert"]>;
        Relationships: [];
      };
      carousel_slides: {
        Row: {
          id: string;
          carousel_id: string;
          position: number;
          fabric_json: Record<string, unknown> | null;
          thumbnail_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          carousel_id: string;
          position?: number;
          fabric_json?: Record<string, unknown> | null;
          thumbnail_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carousel_slides"]["Insert"]>;
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
          cost: number;
          credit_locked: boolean;
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
          cost?: number;
          credit_locked?: boolean;
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
          cost?: number;
          credit_locked?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          color_swatches: string[];
          webhook_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: string;
          color_swatches?: string[];
          webhook_url?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: string;
          color_swatches?: string[];
          webhook_url?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      launch_kits: {
        Row: {
          id: string;
          user_id: string;
          brand_kit_id: string | null;
          strategy_id: string | null;
          brand_info: Record<string, unknown>;
          brand_identity: Record<string, unknown> | null;
          assets: unknown[];
          briefing: Record<string, unknown>;
          email_sequences: Record<string, unknown>;
          status: "draft" | "active" | "archived";
          project_id: string;
          client_token: string | null;
          selected_kv_asset_id: string | null;
          selected_kv_candidate_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          brand_kit_id?: string | null;
          strategy_id?: string | null;
          brand_info?: Record<string, unknown>;
          brand_identity?: Record<string, unknown> | null;
          assets?: unknown[];
          briefing?: Record<string, unknown>;
          email_sequences?: Record<string, unknown>;
          status?: "draft" | "active" | "archived";
          project_id: string;
          client_token?: string | null;
          selected_kv_asset_id?: string | null;
          selected_kv_candidate_id?: string | null;
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
          {
            foreignKeyName: "launch_kits_selected_kv_asset_id_fkey";
            columns: ["selected_kv_asset_id"];
            referencedRelation: "launch_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "launch_kits_selected_kv_candidate_id_fkey";
            columns: ["selected_kv_candidate_id"];
            referencedRelation: "kv_candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      launch_assets: {
        Row: {
          id: string;
          user_id: string;
          launch_kit_id: string;
          asset_type: "kv";
          batch_id: string;
          position: number;
          status: "pending" | "generating" | "done" | "error";
          storage_bucket: string | null;
          storage_path: string | null;
          mime_type: string | null;
          width: number | null;
          height: number | null;
          variant: "dark" | "light" | null;
          variation_key: string | null;
          prompt_snapshot: string | null;
          generation_config: Record<string, unknown>;
          generation_history_id: string | null;
          attempt_id: string;
          client_attempt_id: string | null;
          candidate_id: string | null;
          piece_key: string | null;
          asset_role: string | null;
          producer: "image_ai" | "renderer" | null;
          error_code: string | null;
          error_message: string | null;
          selected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          launch_kit_id: string;
          asset_type: "kv";
          batch_id: string;
          position: number;
          status?: "pending" | "generating" | "done" | "error";
          storage_bucket?: string | null;
          storage_path?: string | null;
          mime_type?: string | null;
          width?: number | null;
          height?: number | null;
          variant?: "dark" | "light" | null;
          variation_key?: string | null;
          prompt_snapshot?: string | null;
          generation_config?: Record<string, unknown>;
          generation_history_id?: string | null;
          attempt_id?: string;
          client_attempt_id?: string | null;
          candidate_id?: string | null;
          piece_key?: string | null;
          asset_role?: string | null;
          producer?: "image_ai" | "renderer" | null;
          error_code?: string | null;
          error_message?: string | null;
          selected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["launch_assets"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "launch_assets_launch_kit_id_fkey";
            columns: ["launch_kit_id"];
            referencedRelation: "launch_kits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "launch_assets_candidate_id_fkey";
            columns: ["candidate_id"];
            referencedRelation: "kv_candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      kv_candidates: {
        Row: {
          id: string;
          user_id: string;
          launch_kit_id: string;
          batch_id: string;
          position: number;
          direction: string | null;
          schema_version: number;
          manifest: Record<string, unknown>;
          identity_spec: Record<string, unknown>;
          context_snapshot: Record<string, unknown>;
          selected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          launch_kit_id: string;
          batch_id: string;
          position: number;
          direction?: string | null;
          schema_version?: number;
          manifest?: Record<string, unknown>;
          identity_spec?: Record<string, unknown>;
          context_snapshot?: Record<string, unknown>;
          selected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["kv_candidates"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "kv_candidates_launch_kit_id_fkey";
            columns: ["launch_kit_id"];
            referencedRelation: "launch_kits";
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
      ad_metrics_summary: {
        Args: { p_from: string; p_to: string };
        Returns: {
          ad_external_id: string;
          spend: number;
          impressions: number;
          clicks: number;
          purchases: number;
          purchase_value: number;
          video_plays: number;
          video_thruplays: number;
          video_p25: number;
          video_p100: number;
          currency: string | null;
        }[];
      };
      delete_meta_user_data: {
        Args: { p_meta_user_id: string; p_kind: string; p_confirmation_code: string };
        Returns: number;
      };
      claim_generation_credit: {
        Args: {
          p_user_id: string;
          p_gen_type: string;
          p_prompt: string;
          p_limit: number;
          p_cost?: number;
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
      save_launch: {
        Args: {
          p_project_id: string | null;
          p_client_token: string | null;
          p_briefing: Record<string, unknown>;
          p_brand_info: Record<string, unknown>;
          p_strategy_id: string | null;
          p_status: "draft" | "active" | "archived" | null;
          p_brand_kit_id?: string | null;
          p_assets?: unknown[] | null;
          p_brand_identity?: Record<string, unknown> | null;
          p_email_sequences?: Record<string, unknown> | null;
          p_clear_strategy?: boolean;
          p_clear_brand_identity?: boolean;
          p_clear_brand_kit_id?: boolean;
        };
        Returns: { out_project_id: string; out_launch_kit_id: string; out_status: string }[];
      };
      select_launch_kv: {
        Args: { p_project_id: string; p_asset_id: string };
        Returns: {
          out_launch_kit_id: string;
          out_project_id: string;
          out_selected_kv_asset_id: string;
          out_selected_kv_candidate_id: string | null;
        }[];
      };
      claim_kv_batch: {
        Args: {
          p_user_id: string;
          p_launch_kit_id: string;
          p_client_batch_id: string;
          p_asset_type: string;
          p_gen_type: string;
          p_directions: string[];
          p_prompts: string[];
          p_generation_config: Record<string, unknown>;
          p_cost_per_item: number;
          p_limit: number;
          p_skip_credit_check?: boolean;
        };
        Returns: {
          created: boolean;
          allowed?: boolean;
          launch_kit_id?: string;
          batch_id?: string;
          asset_ids?: string[];
          candidate_ids?: string[];
          used?: number;
          limit?: number;
          required?: number;
        };
      };
      claim_kv_candidate_retry: {
        Args: {
          p_user_id: string;
          p_launch_kit_id: string;
          p_asset_id: string;
          p_client_attempt_id: string;
          p_gen_type: string;
          p_cost: number;
          p_limit: number;
          p_prompt: string;
          p_skip_credit_check?: boolean;
        };
        Returns: {
          allowed: boolean;
          replay?: boolean;
          attempt_id?: string | null;
          generation_history_id?: string | null;
          used?: number;
          limit?: number;
          required?: number;
        };
      };
      acquire_kv_attempt: {
        Args: { p_user_id: string; p_launch_kit_id: string; p_asset_id: string };
        Returns: { attempt_id: string; generation_history_id: string | null };
      };
      claim_kv_piece: {
        Args: {
          p_user_id: string;
          p_launch_kit_id: string;
          p_candidate_id: string;
          p_piece_key: string;
          p_asset_role: string;
          p_producer: "image_ai" | "renderer";
          p_position: number;
          p_gen_type: string;
          p_prompt: string;
          p_generation_config: Record<string, unknown>;
          p_cost: number;
          p_limit: number;
          p_skip_credit_check?: boolean;
        };
        Returns: {
          allowed: boolean;
          created?: boolean;
          asset_id?: string;
          used?: number;
          limit?: number;
          required?: number;
        };
      };
      finalize_kv_candidate: {
        Args: {
          p_user_id: string;
          p_asset_id: string;
          p_attempt_id: string;
          p_generation_history_id: string | null;
          p_success: boolean;
          p_storage_bucket?: string | null;
          p_storage_path?: string | null;
          p_mime_type?: string | null;
          p_width?: number | null;
          p_height?: number | null;
          p_error_code?: string | null;
          p_error_message?: string | null;
        };
        Returns: { status: "applied" | "already_applied" | "stale" | "conflict" };
      };
      reap_stale_kv_generations: {
        Args: { p_user_id: string; p_timeout?: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
};
