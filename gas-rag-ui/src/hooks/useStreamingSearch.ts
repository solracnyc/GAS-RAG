'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DocumentChunk } from '@/lib/supabase-client';
import { useUIStore } from '@/lib/stores/ui-store';

interface StreamingState {
  isStreaming: boolean;
  documents: DocumentChunk[];
  progress: {
    embeddingGenerated: boolean;
    batchesReceived: number;
    totalBatches: number;
  };
  metrics: {
    embeddingLatency?: number;
    searchLatency?: number;
    totalLatency?: number;
    fromCache?: boolean;
  };
  error?: string;
}

export function useStreamingSearch(query: string, enabled: boolean = true) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    documents: [],
    progress: {
      embeddingGenerated: false,
      batchesReceived: 0,
      totalBatches: 0,
    },
    metrics: {},
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const setLastSearchLatency = useUIStore((state) => state.setLastSearchLatency);
  const updateCacheHitRate = useUIStore((state) => state.updateCacheHitRate);

  const startStreaming = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    setState({
      isStreaming: true,
      documents: [],
      progress: {
        embeddingGenerated: false,
        batchesReceived: 0,
        totalBatches: 0,
      },
      metrics: {},
    });

    // Create new EventSource
    const eventSource = new EventSource(`/api/stream?q=${encodeURIComponent(query)}`);
    eventSourceRef.current = eventSource;

    // Handle start event
    eventSource.addEventListener('start', (event) => {
      const data = JSON.parse(event.data);
      console.log('Search started:', data);
    });

    // Handle progress events
    eventSource.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'EMBEDDING_GENERATED') {
        setState(prev => ({
          ...prev,
          progress: { ...prev.progress, embeddingGenerated: true },
          metrics: { ...prev.metrics, embeddingLatency: data.duration },
        }));
      }
    });

    // Handle results events
    eventSource.addEventListener('results', (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'RESULTS_BATCH') {
        setState(prev => ({
          ...prev,
          documents: [...prev.documents, ...data.documents],
          progress: {
            ...prev.progress,
            batchesReceived: data.batchIndex + 1,
            totalBatches: data.totalBatches,
          },
        }));
      }
    });

    // Handle completion
    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse(event.data);

      setState(prev => ({
        ...prev,
        isStreaming: false,
        metrics: {
          ...prev.metrics,
          searchLatency: data.searchLatency,
          totalLatency: data.totalLatency,
          fromCache: data.fromCache,
        },
      }));

      // Update global metrics
      setLastSearchLatency(data.searchLatency);

      if (data.fromCache) {
        // Update cache hit rate (simplified calculation)
        updateCacheHitRate(100);
      }

      eventSource.close();
      eventSourceRef.current = null;
    });

    // Handle errors
    eventSource.addEventListener('error', (event) => {
      if (event.type === 'error') {
        const errorEvent = event as MessageEvent;
        const data = errorEvent.data ? JSON.parse(errorEvent.data) : {};

        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: data.message || 'Connection error occurred',
        }));

        eventSource.close();
        eventSourceRef.current = null;
      }
    });

    // Browser-level error handling
    eventSource.onerror = () => {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: 'Failed to establish connection',
      }));

      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [query, setLastSearchLatency, updateCacheHitRate]);

  // Start streaming when query changes
  useEffect(() => {
    if (query && enabled && query.length > 2) {
      const debounceTimer = setTimeout(() => {
        startStreaming();
      }, 300);

      return () => clearTimeout(debounceTimer);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [query, enabled, startStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const cancelStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setState(prev => ({ ...prev, isStreaming: false }));
    }
  }, []);

  return {
    ...state,
    cancelStreaming,
    retry: startStreaming,
  };
}