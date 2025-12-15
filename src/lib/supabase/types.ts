export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          name?: string | null;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string | null;
          name: string | null;
          form_data: Json | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          form_data?: Json | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          form_data?: Json | null;
          status?: string;
          created_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          project_id: string | null;
          type: string | null;
          content: Json | null;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string | null;
          type?: string | null;
          content?: Json | null;
          pdf_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string | null;
          type?: string | null;
          content?: Json | null;
          pdf_url?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
