'use client';

import { DocumentChunk } from '@/lib/supabase-client';
import { CodeEditor } from './adaptive/CodeEditor';
import { DocumentationCard } from './adaptive/DocumentationCard';
import { SuggestionCard } from './adaptive/SuggestionCard';
import { memo } from 'react';

interface AdaptiveChunkCardProps {
  chunk: DocumentChunk;
  searchQuery: string;
  compact?: boolean;
  layout?: 'grid' | 'list' | 'split';
}

// Memoized for performance with large lists
export const AdaptiveChunkCard = memo(function AdaptiveChunkCard({
  chunk,
  searchQuery,
  compact = false,
  layout = 'list'
}: AdaptiveChunkCardProps) {
  const similarity = chunk.similarity || 0;

  // Select component based on similarity score
  // High confidence (≥0.7): Full code editor with GAS-specific features
  if (similarity >= 0.7) {
    return (
      <CodeEditor
        chunk={chunk}
        searchQuery={searchQuery}
        compact={compact}
        layout={layout}
      />
    );
  }

  // Medium confidence (≥0.5): Documentation view with collapsible examples
  if (similarity >= 0.5) {
    return (
      <DocumentationCard
        chunk={chunk}
        searchQuery={searchQuery}
        compact={compact}
        layout={layout}
      />
    );
  }

  // Low confidence (<0.5): Suggestion mode with guided prompts
  return (
    <SuggestionCard
      chunk={chunk}
      searchQuery={searchQuery}
      compact={compact}
      layout={layout}
    />
  );
});