'use client';

import { useState, useCallback, useTransition } from 'react';
import { useDebouncedSearch, useSearchSuggestions } from '@/hooks/useVectorSearch';
import { usePerformanceMetrics, useSearchState } from '@/lib/stores/ui-store';
import { Search, Loader2, Sparkles, Zap, X } from 'lucide-react';

export function SearchInterface() {
  const { query, setQuery, debouncedQuery, data, isLoading, error } = useDebouncedSearch('', 300);
  const { data: suggestions } = useSearchSuggestions(query);
  const { lastSearchLatency, showPerformanceMetrics, cacheHitRate } = usePerformanceMetrics();
  const { queryType } = useSearchState();
  const [isPending, startTransition] = useTransition();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = useCallback((searchQuery: string) => {
    startTransition(() => {
      setQuery(searchQuery);
      setShowSuggestions(false);
    });
  }, [setQuery]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSearch(suggestion);
  }, [handleSearch]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setShowSuggestions(false);
  }, [setQuery]);

  const getQueryTypeColor = (type: string) => {
    const colors = {
      'how-to': 'text-blue-600 bg-blue-50',
      'what-is': 'text-green-600 bg-green-50',
      'debug': 'text-red-600 bg-red-50',
      'method': 'text-purple-600 bg-purple-50',
      'general': 'text-gray-600 bg-gray-50',
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Search Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-3 flex items-center pointer-events-none">
            {isLoading || isPending ? (
              <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(e.target.value.length > 1);
            }}
            onFocus={() => setShowSuggestions(query.length > 1)}
            placeholder="Search Google Apps Script documentation..."
            className="w-full pl-10 pr-10 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            aria-label="Search documentation"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              aria-label="Clear search"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{suggestion}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search Metadata */}
      {debouncedQuery && (
        <div className="flex items-center gap-4 text-sm">
          {/* Query Type Badge */}
          <span className={`px-2 py-1 rounded-full font-medium ${getQueryTypeColor(queryType)}`}>
            {queryType.replace('-', ' ')}
          </span>

          {/* Performance Metrics */}
          {showPerformanceMetrics && lastSearchLatency !== null && (
            <>
              <div className="flex items-center gap-1">
                <Zap className={`h-3 w-3 ${lastSearchLatency < 15 ? 'text-green-500' : 'text-yellow-500'}`} />
                <span className={`${lastSearchLatency < 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {lastSearchLatency.toFixed(2)}ms
                </span>
              </div>

              {data?.fromCache && (
                <span className="text-blue-600 dark:text-blue-400">
                  Cached ({cacheHitRate.toFixed(0)}% hit rate)
                </span>
              )}

              {data?.documents && (
                <span className="text-gray-600 dark:text-gray-400">
                  {data.documents.length} results
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">
            Error performing search. Please try again.
          </p>
        </div>
      )}

      {/* Results Count */}
      {data && data.documents.length === 0 && debouncedQuery && !isLoading && (
        <div className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No results found for "{debouncedQuery}"
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Try different keywords or browse the documentation
          </p>
        </div>
      )}
    </div>
  );
}