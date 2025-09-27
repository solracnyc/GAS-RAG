export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string
          content: string
          content_preview: string
          source_url: string
          chunk_type: string
          method_signature: string | null
          component_type: string | null
          has_code: boolean
          has_example: boolean
          embedding: number[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          content: string
          content_preview: string
          source_url: string
          chunk_type: string
          method_signature?: string | null
          component_type?: string | null
          has_code: boolean
          has_example: boolean
          embedding: number[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          content?: string
          content_preview?: string
          source_url?: string
          chunk_type?: string
          method_signature?: string | null
          component_type?: string | null
          has_code?: boolean
          has_example?: boolean
          embedding?: number[]
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_documents: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          content: string
          content_preview: string
          source_url: string
          chunk_type: string
          method_signature: string | null
          component_type: string | null
          has_code: boolean
          has_example: boolean
          similarity: number
        }[]
      }
      hybrid_search: {
        Args: {
          search_query: string
          query_embedding: number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          content: string
          content_preview: string
          source_url: string
          chunk_type: string
          method_signature: string | null
          component_type: string | null
          has_code: boolean
          has_example: boolean
          similarity: number
        }[]
      }
      get_database_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_documents: number
          unique_sources: number
          avg_embedding_similarity: number
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}