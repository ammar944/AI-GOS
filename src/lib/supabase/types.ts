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
      conversations: {
        Row: {
          id: string;
          blueprint_id: string | null;
          user_id: string | null;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          blueprint_id?: string | null;
          user_id?: string | null;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          blueprint_id?: string | null;
          user_id?: string | null;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          confidence: 'high' | 'medium' | 'low' | null;
          confidence_explanation: string | null;
          intent: string | null;
          sources: Json | null;
          source_quality: Json | null;
          pending_edits: Json | null;
          created_at: string;
          tokens_used: number | null;
          cost: number | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant';
          content: string;
          confidence?: 'high' | 'medium' | 'low' | null;
          confidence_explanation?: string | null;
          intent?: string | null;
          sources?: Json | null;
          source_quality?: Json | null;
          pending_edits?: Json | null;
          created_at?: string;
          tokens_used?: number | null;
          cost?: number | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          confidence?: 'high' | 'medium' | 'low' | null;
          confidence_explanation?: string | null;
          intent?: string | null;
          sources?: Json | null;
          source_quality?: Json | null;
          pending_edits?: Json | null;
          created_at?: string;
          tokens_used?: number | null;
          cost?: number | null;
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
