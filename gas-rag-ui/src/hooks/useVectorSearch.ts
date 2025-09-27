'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import {
  performVectorSearch,
  performHybridSearch,
  type SearchResult,
  type DocumentChunk
} from '@/lib/supabase-client';
import { generateEmbedding, EmbeddingTaskType } from '@/lib/embeddings';
import { getSemanticCache } from '@/lib/semantic-cache';
import { useUIStore } from '@/lib/stores/ui-store';

// Query type detection
export function detectQueryType(query: string): 'how-to' | 'what-is' | 'debug' | 'method' | 'general' {
  const patterns = {
    'how-to': /^(how|what steps|guide|tutorial|create|build|make|implement)/i,
    'what-is': /^(what is|define|explain|describe|meaning of)/i,
    'debug': /(error|debug|fix|issue|problem|troubleshoot|not working)/i,
    'method': /(function|method|signature|parameters|\.[\w]+\()/i,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(query)) {
      return type as any;
    }
  }

  return 'general';
}

// Main vector search hook
export function useVectorSearch(query: string, options?: {
  enabled?: boolean;
  matchThreshold?: number;
  matchCount?: number;
  useHybridSearch?: boolean;
}) {
  const queryClient = useQueryClient();
  const setLastSearchLatency = useUIStore((state) => state.setLastSearchLatency);
  const setQueryType = useUIStore((state) => state.setQueryType);
  const updateCacheHitRate = useUIStore((state) => state.updateCacheHitRate);

  return useQuery({
    queryKey: ['vector-search', query, options],
    queryFn: async (): Promise<SearchResult> => {
      // Detect and store query type
      const queryType = detectQueryType(query);
      setQueryType(queryType);

      // Check semantic cache first
      const cache = getSemanticCache();
      const queryEmbedding = await generateEmbedding(query, EmbeddingTaskType.RETRIEVAL_QUERY);

      const cachedResult = await cache.check(query, queryEmbedding);
      if (cachedResult) {
        setLastSearchLatency(0); // Instant from cache

        // Update cache hit rate
        const stats = cache.getStats();
        const hitRate = stats.totalHits / (stats.size || 1) * 100;
        updateCacheHitRate(hitRate);

        return cachedResult;
      }

      // Perform actual search
      const result = options?.useHybridSearch
        ? await performHybridSearch(query, queryEmbedding, {
            matchThreshold: options.matchThreshold,
            matchCount: options.matchCount,
          })
        : await performVectorSearch(queryEmbedding, {
            matchThreshold: options?.matchThreshold,
            matchCount: options?.matchCount,
          });

      // Update latency in UI store
      setLastSearchLatency(result.latency);

      // Cache the result
      await cache.set(query, queryEmbedding, result);

      return result;
    },
    enabled: (options?.enabled !== false) && !!query && query.length > 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook for debounced search
export function useDebouncedSearch(initialQuery: string = '', delay: number = 300) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  const searchResult = useVectorSearch(debouncedQuery);

  return {
    query,
    setQuery,
    debouncedQuery,
    ...searchResult,
  };
}

// Hook for search suggestions
export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: async () => {
      // Get common GAS services and methods based on query
      const suggestions = [
        'SpreadsheetApp.getActiveSpreadsheet()',
        'DriveApp.getFiles()',
        'GmailApp.sendEmail()',
        'CalendarApp.getEvents()',
        'DocumentApp.create()',
        'FormApp.openById()',
        'ScriptApp.newTrigger()',
        'UrlFetchApp.fetch()',
      ];

      // Filter based on query
      return suggestions.filter(s =>
        s.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
    },
    enabled: query.length > 1,
  });
}

// Hook for prefetching common queries
export function usePrefetchCommonQueries() {
  const queryClient = useQueryClient();

  const prefetchQuery = useCallback(async (query: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['vector-search', query],
      queryFn: async () => {
        const embedding = await generateEmbedding(query);
        return performVectorSearch(embedding);
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  }, [queryClient]);

  useEffect(() => {
    // Prefetch common queries
    const commonQueries = [
      'how to create a spreadsheet',
      'send email with Gmail',
      'create custom menu',
      'use triggers',
      'read from sheet',
    ];

    commonQueries.forEach(query => {
      prefetchQuery(query);
    });
  }, [prefetchQuery]);
}

// Hook for similar documents
export function useSimilarDocuments(documentId: string) {
  return useQuery({
    queryKey: ['similar-documents', documentId],
    queryFn: async () => {
      // This would fetch similar documents based on the current document
      // For now, returning empty array as placeholder
      return [] as DocumentChunk[];
    },
    enabled: !!documentId,
  });
}

// Hook for batch search
export function useBatchSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (queries: string[]) => {
      const results = await Promise.all(
        queries.map(async (query) => {
          const embedding = await generateEmbedding(query);
          const result = await performVectorSearch(embedding);
          return { query, result };
        })
      );
      return results;
    },
    onSuccess: (data) => {
      // Update cache with all results
      data.forEach(({ query, result }) => {
        queryClient.setQueryData(['vector-search', query], result);
      });
    },
  });
}