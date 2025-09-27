'use client';

import { useState } from 'react';
import { DocumentChunk } from '@/lib/supabase-client';
import { FileText, ChevronDown, ChevronUp, ExternalLink, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/lib/stores/ui-store';

interface DocumentationCardProps {
  chunk: DocumentChunk;
  searchQuery: string;
  compact?: boolean;
  layout?: 'grid' | 'list' | 'split';
}

export function DocumentationCard({
  chunk,
  searchQuery,
  compact = false,
  layout = 'list'
}: DocumentationCardProps) {
  const { expandedDocs, toggleDoc } = useUIStore();
  const isExpanded = expandedDocs.has(chunk.id);

  const highlightQuery = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">$1</mark>');
  };

  // Parse content sections
  const sections = chunk.content.split(/\n(?=#{1,3} )/);
  const mainSection = sections[0];
  const additionalSections = sections.slice(1);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`
        bg-white dark:bg-gray-800 rounded-lg border border-blue-400 shadow-md
        hover:shadow-lg transition-shadow
        ${compact ? 'p-3' : 'p-4'}
        ${layout === 'grid' ? 'h-full flex flex-col' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            Documentation ({(chunk.similarity! * 100).toFixed(0)}% match)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {chunk.source_url && (
            <a
              href={chunk.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="View documentation"
            >
              <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </a>
          )}
          {additionalSections.length > 0 && (
            <button
              onClick={() => toggleDoc(chunk.id)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Component Type Badge */}
      {chunk.component_type && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
            <BookOpen className="h-3 w-3" />
            {chunk.component_type}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className={`prose prose-sm dark:prose-invert max-w-none ${layout === 'grid' ? 'flex-grow' : ''}`}>
        <div
          className={`
            ${compact ? 'text-sm' : ''}
            ${!isExpanded ? 'line-clamp-4' : ''}
          `}
          dangerouslySetInnerHTML={{
            __html: highlightQuery(mainSection)
          }}
        />
      </div>

      {/* Expandable Additional Sections */}
      <AnimatePresence>
        {isExpanded && additionalSections.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
          >
            <div className="space-y-4">
              {additionalSections.map((section, index) => (
                <div
                  key={index}
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: highlightQuery(section)
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code Example Indicator */}
      {chunk.has_code && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Code2 className="h-3 w-3" />
            <span>Contains code examples</span>
          </div>
        </div>
      )}

      {/* Related Methods */}
      {chunk.method_signature && (
        <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-700 rounded">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Related Method:</p>
          <code className="text-xs font-mono text-purple-700 dark:text-purple-300">
            {chunk.method_signature}
          </code>
        </div>
      )}

      {/* Confidence Indicator */}
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-300 rounded-r-lg" />
    </motion.div>
  );
}

// Fix missing import
import { Code2 } from 'lucide-react';