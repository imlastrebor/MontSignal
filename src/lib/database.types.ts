// Types modelled after Supabase generated types. Replace with generated file when schema is live.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      avalanche_bulletins: {
        Row: {
          id: string;
          source: string;
          massif: string;
          valid_date: string; // date
          issued_at: string; // timestamptz
          danger_level_min: number | null;
          danger_level_max: number | null;
          danger_level_by_altitude: Json | null;
          danger_aspects: Json | null;
          french_text: string | null;
          english_text: string | null;
          raw_json: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          massif: string;
          valid_date: string;
          issued_at: string;
          danger_level_min?: number | null;
          danger_level_max?: number | null;
          danger_level_by_altitude?: Json | null;
          danger_aspects?: Json | null;
          french_text?: string | null;
          english_text?: string | null;
          raw_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["avalanche_bulletins"]["Insert"]>;
        Relationships: [];
      };
      weather_snapshots: {
        Row: {
          id: string;
          source: string;
          timestamp: string; // timestamptz
          valid_date: string; // date
          location: string;
          data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          timestamp: string;
          valid_date: string;
          location: string;
          data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weather_snapshots"]["Insert"]>;
        Relationships: [];
      };
      text_sources: {
        Row: {
          id: string;
          source: string;
          valid_date: string; // date
          french_text: string | null;
          english_text: string | null;
          raw_html: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          valid_date: string;
          french_text?: string | null;
          english_text?: string | null;
          raw_html?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["text_sources"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
