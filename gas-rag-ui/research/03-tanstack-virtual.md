# TanStack Virtual v3.13.12 implementation guide for React 19.1.0

## VIRTUALIZER_SETUP

### BASIC_LIST_IMPLEMENTATION
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Virtualizer, VirtualItem } from '@tanstack/react-virtual';
import * as React from 'react';

interface Item {
  id: number;
  name: string;
}

interface FixedVirtualListProps {
  items: Item[];
}

const FixedVirtualList: React.FC<FixedVirtualListProps> = ({ items }) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35, // Fixed height in pixels
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      style={{
        height: '400px',
        width: '100%',
        overflow: 'auto',
        contain: 'strict', // Critical for performance
      }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <div style={{ padding: '8px' }}>
              {items[virtualItem.index]?.name || `Item ${virtualItem.index}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### GRID_IMPLEMENTATION
```typescript
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

interface Column {
  key: string;
  name: string;
  width: number;
}

interface GridVirtualizerProps {
  data: Array<Array<string>>;
  columns: Array<Column>;
}

const GridVirtualizer: React.FC<GridVirtualizerProps> = ({ data, columns }) => {
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const parentOffsetRef = React.useRef(0);

  React.useLayoutEffect(() => {
    parentOffsetRef.current = parentRef.current?.offsetTop ?? 0;
  }, []);

  const getColumnWidth = (index: number): number => columns[index].width;

  const rowVirtualizer = useWindowVirtualizer({
    count: data.length,
    estimateSize: () => 50,
    overscan: 5,
    scrollMargin: parentOffsetRef.current,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getColumnWidth,
    overscan: 5,
  });

  const columnItems = columnVirtualizer.getVirtualItems();
  const [before, after] = columnItems.length > 0
    ? [
        columnItems[0].start,
        columnVirtualizer.getTotalSize() - columnItems[columnItems.length - 1].end,
      ]
    : [0, 0];

  return (
    <div
      ref={parentRef}
      style={{
        overflowX: 'auto',
        border: '1px solid #e2e8f0',
        maxHeight: '600px',
      }}
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={rowVirtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translateY(${row.start - rowVirtualizer.options.scrollMargin}px)`,
              display: 'flex',
            }}
          >
            <div style={{ width: `${before}px` }} />
            {columnItems.map((column) => (
              <div
                key={column.key}
                style={{
                  minHeight: row.index === 0 ? 50 : row.size,
                  width: getColumnWidth(column.index),
                  borderBottom: '1px solid #e2e8f0',
                  borderRight: '1px solid #e2e8f0',
                  padding: '8px 12px',
                  backgroundColor: row.index === 0 ? '#f7fafc' : 'white',
                }}
              >
                {row.index === 0 ? (
                  <strong>{columns[column.index].name}</strong>
                ) : (
                  data[row.index]?.[column.index] || ''
                )}
              </div>
            ))}
            <div style={{ width: `${after}px` }} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### DYNAMIC_HEIGHT_PATTERN
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

interface DynamicItem {
  id: number;
  content: string;
}

interface DynamicVirtualListProps {
  items: DynamicItem[];
}

const DynamicVirtualList: React.FC<DynamicVirtualListProps> = ({ items }) => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // Initial estimate - will be measured dynamically
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      style={{
        height: '400px',
        width: '100%',
        overflow: 'auto',
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement} // Critical for dynamic sizing
            >
              <div style={{ padding: '10px 0' }}>
                <div>Item {virtualItem.index}</div>
                <div>{items[virtualItem.index]?.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### HORIZONTAL_SCROLL
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import * as React from 'react';

interface HorizontalItem {
  id: number;
  width: number;
  content: string;
}

interface HorizontalVirtualizerProps {
  items: HorizontalItem[];
}

const HorizontalVirtualizer: React.FC<HorizontalVirtualizerProps> = ({ items }) => {
  const parentRef = React.useRef<HTMLDivElement | null>(null);

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index: number) => items[index]?.width ?? 100,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      style={{
        width: '100%',
        height: '200px',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: `${columnVirtualizer.getTotalSize()}px`,
          height: '100%',
          position: 'relative',
        }}
      >
        {columnVirtualizer.getVirtualItems().map((virtualColumn) => (
          <div
            key={virtualColumn.key}
            data-index={virtualColumn.index}
            ref={columnVirtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${items[virtualColumn.index]?.width ?? 100}px`,
              transform: `translateX(${virtualColumn.start}px)`,
              padding: '16px',
              borderRight: '1px solid #e2e8f0',
            }}
          >
            {items[virtualColumn.index]?.content || `Column ${virtualColumn.index}`}
          </div>
        ))}
      </div>
    </div>
  );
};
```

## NEXTJS15_SSR

### SSR_SAFE
```typescript
false
```

### HYDRATION_WRAPPER_NEEDED
```typescript
'use client'

import { useEffect, useState, ReactNode } from 'react';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// SSR-safe virtualizer wrapper
export function SSRVirtualList({ data, itemHeight = 50 }: Props) {
  const [isSSR, setIsSSR] = useState(typeof window === 'undefined');
  const parentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setIsSSR(false);
  }, []);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    initialRect: isSSR ? { width: 1000, height: 400 } : undefined,
    initialOffset: 0,
    overscan: isSSR ? 0 : 5,
    enabled: !isSSR,
  });

  if (isSSR) {
    const estimatedVisibleCount = Math.ceil(400 / itemHeight);
    return (
      <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
        <div style={{ height: data.length * itemHeight, position: 'relative' }}>
          {data.slice(0, estimatedVisibleCount).map((item, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                top: index * itemHeight,
                height: itemHeight,
                width: '100%',
              }}
            >
              {/* Render item */}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    // Client-side virtualized rendering
  );
}
```

### USE_CLIENT_REQUIRED
```typescript
true
```

## PERFORMANCE_CONFIG

### OVERSCAN_OPTIMAL
```typescript
5 // For standard lists (1k-5k items)
// 2-3 for large datasets (10k+ items)
// 1-2 for complex components or mobile
```

### MEASURE_ELEMENT_PATTERN
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

interface DynamicListItem {
  id: string;
  content: string;
  height?: number;
}

const DynamicVirtualizedList: React.FC<{ items: DynamicListItem[] }> = ({ items }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    measureElement: (element, entry, instance) => {
      return instance.options.horizontal
        ? element.getBoundingClientRect().width
        : element.getBoundingClientRect().height;
    },
    overscan: 3,
  });

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto', contain: 'strict' }}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement} // Critical for dynamic measurement
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div style={{ padding: '10px' }}>
              {items[virtualRow.index].content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### SCROLL_TO_INDEX_METHOD
```typescript
const ScrollableVirtualList: React.FC = () => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  const scrollToIndex = (index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') => {
    virtualizer.scrollToIndex(index, {
      align: alignment,
      behavior: 'smooth', // Use 'auto' for immediate scroll
    });
  };

  const scrollToTop = () => scrollToIndex(0, 'start');
  const scrollToMiddle = () => scrollToIndex(Math.floor(10000 / 2), 'center');
  const scrollToEnd = () => scrollToIndex(9999, 'end');

  return (
    <div>
      <div className="controls">
        <button onClick={scrollToTop}>Top</button>
        <button onClick={scrollToMiddle}>Middle</button>
        <button onClick={scrollToEnd}>End</button>
      </div>
      <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
        {/* Virtual items rendering */}
      </div>
    </div>
  );
};
```

### INFINITE_SCROLL_PATTERN
```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';

interface InfiniteVirtualListProps {
  fetchPageData: (pageParam: number) => Promise<{ items: any[]; nextCursor: number | null }>;
}

const InfiniteVirtualList: React.FC<InfiniteVirtualListProps> = ({ fetchPageData }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const {
    status,
    data,
    error,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ['infinite-list'],
    queryFn: ({ pageParam = 0 }) => fetchPageData(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    staleTime: 1000 * 60 * 5,
  });

  const allItems = data ? data.pages.flatMap((page) => page.items) : [];
  const itemCount = hasNextPage ? allItems.length + 1 : allItems.length;

  const virtualizer = useVirtualizer({
    count: itemCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 2,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!lastItem || !hasNextPage || isFetchingNextPage) return;

    if (lastItem.index >= allItems.length - 5) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, allItems.length, isFetchingNextPage, virtualItems]);

  if (status === 'pending') return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error.message}</div>;

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto', contain: 'strict' }}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allItems.length - 1;
          const item = allItems[virtualRow.index];

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                hasNextPage ? <div>Loading more...</div> : <div>No more items</div>
              ) : (
                <div>{item.content}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

## MIGRATION_FROM_REACT_WINDOW

### FIXEDSIZE_LIST_REPLACEMENT
```typescript
// BEFORE (react-window)
import { FixedSizeList } from 'react-window';

const Row: React.FC<ItemProps> = ({ index, style }) => (
  <div style={style}>Row {index}</div>
);

const MyFixedList: React.FC = () => {
  return (
    <FixedSizeList
      height={600}
      width={400}
      itemCount={10000}
      itemSize={35}
      overscanCount={5}
    >
      {Row}
    </FixedSizeList>
  );
};

// AFTER (TanStack Virtual)
import { useVirtualizer } from '@tanstack/react-virtual';

const MyFixedList: React.FC = () => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', width: '400px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            Row {virtualRow.index}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### VARIABLESIZE_LIST_REPLACEMENT
```typescript
// BEFORE (react-window)
import { VariableSizeList } from 'react-window';

const itemSizes = new Array(10000).fill(0).map(() => 25 + Math.round(Math.random() * 100));
const getItemSize = (index: number) => itemSizes[index];

const MyVariableList: React.FC = () => {
  return (
    <VariableSizeList
      height={600}
      width={400}
      itemCount={itemSizes.length}
      itemSize={getItemSize}
      overscanCount={5}
    >
      {VariableRow}
    </VariableSizeList>
  );
};

// AFTER (TanStack Virtual)
import { useVirtualizer } from '@tanstack/react-virtual';

const MyVariableList: React.FC = () => {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const itemSizes = new Array(10000).fill(0).map(() => 25 + Math.round(Math.random() * 100));

  const rowVirtualizer = useVirtualizer({
    count: itemSizes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => itemSizes[index],
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', width: '400px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${itemSizes[virtualRow.index]}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            Variable Row {virtualRow.index}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### REF_HANDLING_CHANGE
```typescript
// OLD API (TanStack Virtual v2.x/beta) - NO LONGER WORKS
{virtualRows.map((virtualRow) => (
  <div
    key={virtualRow.index}
    ref={virtualRow.measureElement} // ❌ Old API
  >
    Content
  </div>
))}

// NEW API (TanStack Virtual v3.13.12)
import { useVirtualizer } from '@tanstack/react-virtual';

const MyDynamicList: React.FC = () => {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement} // ✅ New API - on virtualizer instance
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div style={{ padding: '10px 0' }}>
              <div>Row {virtualRow.index}</div>
              <div>Dynamic content here...</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```