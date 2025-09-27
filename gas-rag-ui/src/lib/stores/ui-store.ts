'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { devtools, persist } from 'zustand/middleware';

// Layout types
export type LayoutMode = 'grid' | 'list' | 'split';
export type QueryType = 'how-to' | 'what-is' | 'debug' | 'method' | 'general';

// UI State interface
interface UIState {
  // Layout preferences
  layout: LayoutMode;
  setLayout: (layout: LayoutMode) => void;

  // Display preferences
  syntaxHighlight: boolean;
  toggleSyntaxHighlight: () => void;

  // Expanded documentation tracking
  expandedDocs: Set<string>;
  toggleDoc: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  queryType: QueryType;
  setQueryType: (type: QueryType) => void;

  // Performance monitoring
  lastSearchLatency: number | null;
  setLastSearchLatency: (latency: number) => void;

  // UI preferences
  showPerformanceMetrics: boolean;
  togglePerformanceMetrics: () => void;
  compactMode: boolean;
  toggleCompactMode: () => void;

  // Cache statistics
  cacheHitRate: number;
  updateCacheHitRate: (rate: number) => void;
}

// Create the store with middleware
export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        // Layout preferences
        layout: 'grid',
        setLayout: (layout) => set({ layout }),

        // Display preferences
        syntaxHighlight: true,
        toggleSyntaxHighlight: () =>
          set((state) => ({ syntaxHighlight: !state.syntaxHighlight })),

        // Expanded documentation tracking
        expandedDocs: new Set(),
        toggleDoc: (id) =>
          set((state) => {
            const newSet = new Set(state.expandedDocs);
            if (newSet.has(id)) {
              newSet.delete(id);
            } else {
              newSet.add(id);
            }
            return { expandedDocs: newSet };
          }),
        expandAll: () =>
          set((state) => ({
            expandedDocs: new Set(Array.from(state.expandedDocs)),
          })),
        collapseAll: () => set({ expandedDocs: new Set() }),

        // Search state
        searchQuery: '',
        setSearchQuery: (query) => set({ searchQuery: query }),
        queryType: 'general',
        setQueryType: (type) => set({ queryType: type }),

        // Performance monitoring
        lastSearchLatency: null,
        setLastSearchLatency: (latency) => set({ lastSearchLatency: latency }),

        // UI preferences
        showPerformanceMetrics: true,
        togglePerformanceMetrics: () =>
          set((state) => ({
            showPerformanceMetrics: !state.showPerformanceMetrics,
          })),
        compactMode: false,
        toggleCompactMode: () =>
          set((state) => ({ compactMode: !state.compactMode })),

        // Cache statistics
        cacheHitRate: 0,
        updateCacheHitRate: (rate) => set({ cacheHitRate: rate }),
      }),
      {
        name: 'gas-rag-ui-store',
        partialize: (state) => ({
          layout: state.layout,
          syntaxHighlight: state.syntaxHighlight,
          showPerformanceMetrics: state.showPerformanceMetrics,
          compactMode: state.compactMode,
        }),
      }
    )
  )
);

// Custom hook for performance metrics
export const usePerformanceMetrics = () => {
  return useUIStore(
    useShallow((state) => ({
      lastSearchLatency: state.lastSearchLatency,
      showPerformanceMetrics: state.showPerformanceMetrics,
      cacheHitRate: state.cacheHitRate,
    }))
  );
};

// Custom hook for layout preferences
export const useLayoutPreferences = () => {
  return useUIStore(
    useShallow((state) => ({
      layout: state.layout,
      setLayout: state.setLayout,
      compactMode: state.compactMode,
      toggleCompactMode: state.toggleCompactMode,
    }))
  );
};

// Custom hook for search state
export const useSearchState = () => {
  return useUIStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      queryType: state.queryType,
      setQueryType: state.setQueryType,
    }))
  );
};