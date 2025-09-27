'use client';

import { useState, useCallback } from 'react';
import { DocumentChunk } from '@/lib/supabase-client';
import { HelpCircle, Search, RefreshCw, ArrowRight, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

interface SuggestionCardProps {
  chunk: DocumentChunk;
  searchQuery: string;
  compact?: boolean;
  layout?: 'grid' | 'list' | 'split';
}

export function SuggestionCard({
  chunk,
  searchQuery,
  compact = false,
  layout = 'list'
}: SuggestionCardProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Generate alternative search suggestions based on content
  const generateSuggestions = useCallback(() => {
    const suggestions: string[] = [];

    // Extract potential search terms from the chunk content
    const services = chunk.content.match(/\b(SpreadsheetApp|DriveApp|GmailApp|CalendarApp)\b/g);
    if (services) {
      suggestions.push(`How to use ${services[0]}`);
    }

    // Method-based suggestions
    if (chunk.method_signature) {
      const methodName = chunk.method_signature.split('(')[0];
      suggestions.push(`${methodName} examples`);
      suggestions.push(`${methodName} parameters`);
    }

    // General suggestions
    if (chunk.chunk_type === 'documentation') {
      suggestions.push('Show me code examples');
      suggestions.push('Explain this concept');
    }

    // Query refinement suggestions
    const words = searchQuery.split(' ');
    if (words.length > 1) {
      suggestions.push(`"${searchQuery}"` ); // Exact match
      suggestions.push(words.slice(0, 2).join(' ')); // Shorter query
    }

    return suggestions.slice(0, 4);
  }, [chunk, searchQuery]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setSelectedSuggestion(suggestion);
    // Trigger a new search with the suggestion
    queryClient.invalidateQueries({ queryKey: ['vector-search', suggestion] });
  }, [queryClient]);

  const suggestions = generateSuggestions();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-600
        ${compact ? 'p-3' : 'p-4'}
        ${layout === 'grid' ? 'h-full flex flex-col' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
            Low Confidence ({(chunk.similarity! * 100).toFixed(0)}%)
          </span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          aria-label="Refresh search"
        >
          <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Help Message */}
      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
              This result has low relevance to your search
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
              Try one of the suggestions below for better results:
            </p>
          </div>
        </div>
      </div>

      {/* Alternative Suggestions */}
      <div className="space-y-2 mb-4">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={index}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSuggestionClick(suggestion)}
            className={`
              w-full flex items-center justify-between p-2 rounded
              ${selectedSuggestion === suggestion
                ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }
              transition-colors
            `}
          >
            <div className="flex items-center gap-2">
              <Search className="h-3 w-3 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {suggestion}
              </span>
            </div>
            <ArrowRight className="h-3 w-3 text-gray-400" />
          </motion.button>
        ))}
      </div>

      {/* Content Preview */}
      <div className={`${layout === 'grid' ? 'flex-grow' : ''}`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Content preview:</p>
        <div className={`
          p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700
          ${compact ? 'text-xs' : 'text-sm'}
        `}>
          <p className="text-gray-600 dark:text-gray-400 line-clamp-3">
            {chunk.content_preview || chunk.content.substring(0, 150)}...
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{chunk.chunk_type}</span>
          {chunk.source_url && (
            <a
              href={chunk.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View source →
            </a>
          )}
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-gray-400 to-gray-300 rounded-r-lg" />
    </motion.div>
  );
}