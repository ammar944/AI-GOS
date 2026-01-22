export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Onboarding data structure
export interface OnboardingData {
  businessBasics?: Record<string, Json>;
  icpData?: Record<string, Json>;
  productOffer?: Record<string, Json>;
  marketCompetition?: Record<string, Json>;
  customerJourney?: Record<string, Json>;
  brandPositioning?: Record<string, Json>;
  assetsProof?: Record<string, Json>;
  budgetTargets?: Record<string, Json>;
  compliance?: Record<string, Json>;
}

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          onboarding_completed: boolean;
          onboarding_completed_at: string | null;
          onboarding_data: OnboardingData | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          onboarding_data?: OnboardingData | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          onboarding_data?: OnboardingData | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
      };
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
