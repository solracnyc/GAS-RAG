# Next.js 14 Implementation Guide

## Version Compatibility
- **Next.js**: 14.2.x (Latest stable in 14.x line)
- **React**: 18.3.x (Required by Next.js 14)
- **Node.js**: 18.17+ (Minimum required)

## Key Differences from Next.js 15

### 1. Synchronous APIs (Next.js 14)
```typescript
// Next.js 14 - cookies, headers, params are SYNCHRONOUS
import { cookies, headers } from 'next/headers';

// Layout.tsx (Next.js 14)
export default function RootLayout({ children }) {
  const cookieStore = cookies(); // No await needed
  const headersList = headers(); // No await needed

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}

// page.tsx with params (Next.js 14)
export default function Page({ params, searchParams }) {
  // Both params and searchParams are directly available, no await
  const id = params.id;
  const query = searchParams.query;

  return <div>ID: {id}, Query: {query}</div>;
}
```

### 2. Default Caching Behavior (Next.js 14)
```typescript
// Next.js 14 - fetch() requests ARE cached by default
export async function getData() {
  // This request is cached by default in Next.js 14
  const res = await fetch('https://api.example.com/data');

  // To opt out of caching in Next.js 14:
  // const res = await fetch('https://api.example.com/data', { cache: 'no-store' });

  return res.json();
}

// Route Handler (Next.js 14) - GET requests ARE cached by default
export async function GET() {
  const data = await getData();
  return Response.json(data); // Cached by default
}

// To make dynamic in Next.js 14:
export const dynamic = 'force-dynamic';
```

### 3. Installation Commands for Next.js 14
```bash
# Create new Next.js 14 project
npx create-next-app@14 my-app --typescript --tailwind --app

# Or install specific version in existing project
npm install next@14 react@18 react-dom@18

# Install compatible versions of other packages
npm install @tanstack/react-query@4 # v4 for React 18
npm install zustand@4 # v4 is stable with React 18
npm install @radix-ui/react-* # React 18 compatible
```

## Project Structure (Next.js 14)

```typescript
// package.json dependencies for Next.js 14
{
  "dependencies": {
    "next": "14.2.13",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@tanstack/react-query": "^4.36.1",
    "zustand": "^4.5.2",
    "@supabase/supabase-js": "^2.39.0",
    "@radix-ui/themes": "^3.0.0",
    "ai": "^3.0.0", // Vercel AI SDK v3 for Next.js 14
    "@google/generative-ai": "^0.21.0",
    "tailwindcss": "^3.4.0" // v3 for Next.js 14
  }
}
```

## Component Examples (Next.js 14)

### Server Component (Default in App Router)
```tsx
// app/search/page.tsx - Server Component by default
import { performVectorSearch } from '@/lib/supabase-client';

export default async function SearchPage() {
  // Server Component can be async
  const initialData = await performVectorSearch();

  return (
    <div>
      <h1>Search Results</h1>
      <SearchResults initialData={initialData} />
    </div>
  );
}
```

### Client Component
```tsx
// components/SearchInterface.tsx
'use client'; // Required for client component

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function SearchInterface() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSearch = () => {
    startTransition(() => {
      router.push(`/search?q=${query}`);
    });
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={isPending}
      />
      <button onClick={handleSearch}>
        {isPending ? 'Searching...' : 'Search'}
      </button>
    </div>
  );
}
```

### Layout with Providers (Next.js 14)
```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { cookies } from 'next/headers'; // Synchronous in Next.js 14

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies(); // No await needed
  const theme = cookieStore.get('theme')?.value || 'light';

  return (
    <html lang="en" data-theme={theme}>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

### Providers Component (Client-side)
```tsx
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          cacheTime: 10 * 60 * 1000, // v4 uses cacheTime, not gcTime
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Data Fetching Patterns (Next.js 14)

### Server-side Data Fetching
```tsx
// app/documents/[id]/page.tsx
import { notFound } from 'next/navigation';

interface PageProps {
  params: { id: string }; // Synchronous in Next.js 14
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function DocumentPage({ params, searchParams }: PageProps) {
  const id = params.id; // Direct access, no await

  const document = await fetchDocument(id);

  if (!document) {
    notFound();
  }

  return <DocumentView document={document} />;
}

// Generating static params (Next.js 14)
export async function generateStaticParams() {
  const documents = await getDocuments();

  return documents.map((doc) => ({
    id: doc.id,
  }));
}
```

### Client-side Data Fetching with React Query v4
```tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function useVectorSearch(query: string) {
  return useQuery(
    ['vector-search', query], // v4 uses array keys
    async () => {
      const response = await fetch(`/api/search?q=${query}`);
      return response.json();
    },
    {
      enabled: !!query,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000, // v4 uses cacheTime
    }
  );
}

// Using the hook
export function SearchResults() {
  const { data, isLoading, error } = useVectorSearch('query'); // v4 uses isLoading

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error occurred</div>;

  return <div>{/* Render results */}</div>;
}
```

## API Routes (Next.js 14)

### Route Handler with Caching
```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

// GET is cached by default in Next.js 14
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  const results = await performSearch(query);

  return NextResponse.json(results);
}

// To disable default caching in Next.js 14
export const dynamic = 'force-dynamic';
// or
export const revalidate = 0;
```

### Streaming Response (Next.js 14)
```typescript
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        const data = `data: Message ${i}\n\n`;
        controller.enqueue(encoder.encode(data));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Middleware (Next.js 14)

```typescript
// middleware.ts (in root, not in app/)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Middleware runs on Edge Runtime
  const response = NextResponse.next();

  // Add custom headers
  response.headers.set('x-custom-header', 'value');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

## Environment Variables (Next.js 14)

```typescript
// .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url # Client-side
SUPABASE_SERVICE_KEY=your_key # Server-side only

// Usage in Next.js 14
// Client Component
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Server Component or API Route
const serviceKey = process.env.SUPABASE_SERVICE_KEY; // Only available server-side
```

## Tailwind CSS v3 Configuration (Next.js 14)

```javascript
// tailwind.config.js (Next.js 14 uses v3)
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Custom theme extensions
    },
  },
  plugins: [],
};
```

## Common Patterns and Solutions

### 1. Loading States with Suspense
```tsx
// app/search/page.tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SearchResults />
    </Suspense>
  );
}
```

### 2. Error Boundaries
```tsx
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### 3. Parallel Data Fetching
```tsx
export default async function Page() {
  // Parallel fetching in Next.js 14
  const [userData, postsData] = await Promise.all([
    fetchUser(),
    fetchPosts(),
  ]);

  return <div>{/* Render data */}</div>;
}
```

## Migration Notes

If you need to upgrade from Next.js 14 to 15 later:

1. **Async APIs**: Add `await` to cookies(), headers(), params
2. **Caching**: Add explicit caching configuration
3. **React Query**: Update to v5 (cacheTime → gcTime, isLoading → isPending)
4. **Tailwind**: Upgrade to v4 with new configuration format
5. **Dependencies**: Update all peer dependencies

## Testing Setup (Next.js 14)

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom

# jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
};

module.exports = createJestConfig(customJestConfig);
```

This configuration ensures compatibility with Next.js 14's specific requirements and React 18's features.