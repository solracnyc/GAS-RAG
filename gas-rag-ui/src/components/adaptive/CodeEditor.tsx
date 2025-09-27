'use client';

import { useState, useCallback } from 'react';
import { DocumentChunk } from '@/lib/supabase-client';
import { Code2, Copy, Check, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUIStore } from '@/lib/stores/ui-store';

interface CodeEditorProps {
  chunk: DocumentChunk;
  searchQuery: string;
  compact?: boolean;
  layout?: 'grid' | 'list' | 'split';
}

export function CodeEditor({
  chunk,
  searchQuery,
  compact = false,
  layout = 'list'
}: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { syntaxHighlight } = useUIStore();

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(chunk.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [chunk.content]);

  const highlightQuery = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
  };

  // Extract GAS-specific features
  const detectedServices = chunk.content.match(/\b(SpreadsheetApp|DriveApp|GmailApp|CalendarApp|DocumentApp|FormApp|ScriptApp|UrlFetchApp)\b/g);
  const uniqueServices = detectedServices ? [...new Set(detectedServices)] : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        relative group bg-white dark:bg-gray-800 rounded-lg border-2 border-green-500 shadow-lg
        ${expanded ? 'fixed inset-8 z-50' : ''}
        ${compact ? 'p-3' : 'p-4'}
        ${layout === 'grid' ? 'h-full' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-semibold text-green-700 dark:text-green-300">
            High Confidence Match ({(chunk.similarity! * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyToClipboard}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label={expanded ? "Minimize" : "Maximize"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <Maximize2 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            )}
          </button>
          {chunk.source_url && (
            <a
              href={chunk.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label="View source"
            >
              <ExternalLink className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </a>
          )}
        </div>
      </div>

      {/* GAS Services Badges */}
      {uniqueServices.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {uniqueServices.map((service) => (
            <span
              key={service}
              className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full"
            >
              {service}
            </span>
          ))}
        </div>
      )}

      {/* Method Signature if present */}
      {chunk.method_signature && (
        <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 rounded">
          <code className="text-sm font-mono text-purple-700 dark:text-purple-300">
            {chunk.method_signature}
          </code>
        </div>
      )}

      {/* Code Content */}
      <div className={`relative ${expanded ? 'h-full overflow-auto' : ''}`}>
        <pre
          className={`
            ${syntaxHighlight ? 'language-javascript' : ''}
            ${compact ? 'text-xs' : 'text-sm'}
            ${expanded ? '' : 'max-h-64'}
            overflow-auto p-3 bg-gray-900 text-gray-100 rounded
          `}
        >
          <code
            dangerouslySetInnerHTML={{
              __html: highlightQuery(chunk.content)
            }}
          />
        </pre>
      </div>

      {/* Metadata Footer */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>{chunk.chunk_type}</span>
          {chunk.has_example && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              Has Example
            </span>
          )}
        </div>
      </div>

      {/* Confidence Indicator */}
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-green-500 to-green-300 rounded-r-lg" />
    </motion.div>
  );
}