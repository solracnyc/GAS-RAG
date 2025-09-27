import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create a singleton instance
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
);

// Types for our vector search
export interface DocumentChunk {
  id: string;
  content: string;
  content_preview: string;
  source_url: string;
  chunk_type: string;
  method_signature?: string;
  component_type?: string;
  has_code: boolean;
  has_example: boolean;
  similarity?: number;
  embedding?: number[];
}

export interface SearchResult {
  documents: DocumentChunk[];
  latency: number;
  fromCache?: boolean;
}

// Direct vector search function preserving <15ms performance
export async function performVectorSearch(
  queryEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<SearchResult> {
  const startTime = performance.now();

  try {
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: options.matchThreshold || parseFloat(process.env.NEXT_PUBLIC_MATCH_THRESHOLD || '0.78'),
      match_count: options.matchCount || parseInt(process.env.NEXT_PUBLIC_MATCH_COUNT || '10'),
    });

    if (error) {
      console.error('Vector search error:', error);
      throw error;
    }

    const latency = performance.now() - startTime;

    // Log performance for monitoring
    if (latency > 15) {
      console.warn(`Vector search exceeded 15ms target: ${latency.toFixed(2)}ms`);
    } else {
      console.log(`Vector search completed in ${latency.toFixed(2)}ms`);
    }

    return {
      documents: data || [],
      latency,
      fromCache: false,
    };
  } catch (error) {
    const latency = performance.now() - startTime;
    console.error('Vector search failed:', error);

    // Return empty result on error
    return {
      documents: [],
      latency,
      fromCache: false,
    };
  }
}

// Hybrid search combining vector and text search
export async function performHybridSearch(
  query: string,
  queryEmbedding: number[],
  options: {
    matchThreshold?: number;
    matchCount?: number;
  } = {}
): Promise<SearchResult> {
  const startTime = performance.now();

  try {
    const { data, error } = await supabase.rpc('hybrid_search', {
      search_query: query,
      query_embedding: queryEmbedding,
      match_threshold: options.matchThreshold || 0.78,
      match_count: options.matchCount || 10,
    });

    if (error) {
      console.error('Hybrid search error:', error);
      throw error;
    }

    const latency = performance.now() - startTime;
    console.log(`Hybrid search completed in ${latency.toFixed(2)}ms`);

    return {
      documents: data || [],
      latency,
      fromCache: false,
    };
  } catch (error) {
    const latency = performance.now() - startTime;
    console.error('Hybrid search failed:', error);

    return {
      documents: [],
      latency,
      fromCache: false,
    };
  }
}

// Get database statistics
export async function getDatabaseStats() {
  try {
    const { data, error } = await supabase.rpc('get_database_stats');

    if (error) {
      console.error('Failed to get database stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Database stats error:', error);
    return null;
  }
}