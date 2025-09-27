'use client';

import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DocumentChunk } from '@/lib/supabase-client';
import { useLayoutPreferences } from '@/lib/stores/ui-store';
import { AdaptiveChunkCard } from './AdaptiveChunkCard';
import { motion, AnimatePresence } from 'framer-motion';

interface VirtualizedResultsProps {
  chunks: DocumentChunk[];
  searchQuery: string;
  isLoading?: boolean;
}

export function VirtualizedResults({
  chunks,
  searchQuery,
  isLoading = false
}: VirtualizedResultsProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { layout, compactMode } = useLayoutPreferences();

  // Calculate item height based on layout and compact mode
  const estimateSize = useCallback(() => {
    if (layout === 'list') return compactMode ? 80 : 120;
    if (layout === 'grid') return compactMode ? 150 : 200;
    return 150; // split view
  }, [layout, compactMode]);

  const virtualizer = useVirtualizer({
    count: chunks.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    gap: layout === 'grid' ? 16 : 8,
  });

  const items = virtualizer.getVirtualItems();

  // Grid layout calculations
  const columnsCount = layout === 'grid' ? (compactMode ? 3 : 2) : 1;
  const gridItems = layout === 'grid'
    ? items.reduce<typeof items[]>((rows, item, index) => {
        const rowIndex = Math.floor(index / columnsCount);
        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex].push(item);
        return rows;
      }, [])
    : items.map(item => [item]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse space-y-4 w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">No results to display</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Performance indicator */}
      <div className="absolute top-0 right-0 z-10 bg-white dark:bg-gray-800 px-2 py-1 rounded-bl-lg shadow-sm">
        <span className="text-xs text-gray-500">
          Rendering {items.length} of {chunks.length} items
        </span>
      </div>

      {/* Virtualized container */}
      <div
        ref={parentRef}
        className="h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <AnimatePresence mode="popLayout">
            {layout === 'grid' ? (
              // Grid layout
              gridItems.map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="flex gap-4"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${row[0].start}px)`,
                  }}
                >
                  {row.map((virtualItem) => {
                    const chunk = chunks[virtualItem.index];
                    return (
                      <motion.div
                        key={virtualItem.key}
                        className={`flex-1`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <AdaptiveChunkCard
                          chunk={chunk}
                          searchQuery={searchQuery}
                          compact={compactMode}
                          layout={layout}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ))
            ) : (
              // List or Split layout
              items.map((virtualItem) => {
                const chunk = chunks[virtualItem.index];
                return (
                  <motion.div
                    key={virtualItem.key}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AdaptiveChunkCard
                      chunk={chunk}
                      searchQuery={searchQuery}
                      compact={compactMode}
                      layout={layout}
                    />
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scroll to top button */}
      {virtualizer.scrollOffset > 200 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => virtualizer.scrollToIndex(0, { behavior: 'smooth' })}
          className="fixed bottom-8 right-8 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          aria-label="Scroll to top"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </motion.button>
      )}
    </div>
  );
}