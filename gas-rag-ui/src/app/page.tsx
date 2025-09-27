'use client';

import { SearchInterface } from '@/components/SearchInterface';
import { VirtualizedResults } from '@/components/VirtualizedResults';
import { useDebouncedSearch, usePrefetchCommonQueries } from '@/hooks/useVectorSearch';
import { useLayoutPreferences, usePerformanceMetrics } from '@/lib/stores/ui-store';
import { Grid3x3, List, PanelLeftClose, Settings, BarChart3, Zap } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const { data, isLoading } = useDebouncedSearch('', 300);
  const { layout, setLayout, compactMode, toggleCompactMode } = useLayoutPreferences();
  const { showPerformanceMetrics, togglePerformanceMetrics, lastSearchLatency, cacheHitRate } = usePerformanceMetrics();
  const [showSettings, setShowSettings] = useState(false);

  // Prefetch common queries for better UX
  usePrefetchCommonQueries();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">
            GAS-RAG Assistant
          </h1>
          <p className="text-xl mb-2">
            Search Google Apps Script documentation with lightning speed
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              <span>&lt;15ms vector search</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span>1,482 documentation chunks</span>
            </div>
          </div>
        </div>

        {/* Settings Button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition-colors"
          aria-label="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
          >
            <div className="container mx-auto p-4">
              <div className="flex flex-wrap items-center gap-6">
                {/* Layout Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Layout:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setLayout('grid')}
                      className={`p-2 rounded ${layout === 'grid' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      aria-label="Grid layout"
                    >
                      <Grid3x3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setLayout('list')}
                      className={`p-2 rounded ${layout === 'list' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      aria-label="List layout"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setLayout('split')}
                      className={`p-2 rounded ${layout === 'split' ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                      aria-label="Split layout"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Compact Mode Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compactMode}
                    onChange={toggleCompactMode}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">Compact Mode</span>
                </label>

                {/* Performance Metrics Toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPerformanceMetrics}
                    onChange={togglePerformanceMetrics}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm">Show Performance</span>
                </label>
              </div>

              {/* Performance Stats */}
              {showPerformanceMetrics && lastSearchLatency !== null && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Last Search</p>
                      <p className={`text-lg font-bold ${lastSearchLatency < 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {lastSearchLatency.toFixed(2)}ms
                      </p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Cache Hit Rate</p>
                      <p className="text-lg font-bold text-blue-600">
                        {cacheHitRate.toFixed(0)}%
                      </p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-700 rounded p-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Documents</p>
                      <p className="text-lg font-bold text-purple-600">
                        {data?.documents?.length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search Section */}
        <div className="mb-8">
          <SearchInterface />
        </div>

        {/* Results Section */}
        {data && data.documents && data.documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VirtualizedResults
              chunks={data.documents}
              searchQuery=""
              isLoading={isLoading}
            />
          </motion.div>
        )}

        {/* Empty State */}
        {!data || !data.documents || data.documents.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-24 h-24 mb-6 bg-gray-100 dark:bg-gray-800 rounded-full">
              <Search className="h-12 w-12 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Start Searching
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Type in the search box above to find Google Apps Script documentation,
              code examples, and method signatures.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['SpreadsheetApp', 'DriveApp', 'GmailApp', 'CalendarApp'].map((service) => (
                <button
                  key={service}
                  className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                >
                  {service}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Missing import
import { Search } from 'lucide-react';