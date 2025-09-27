# Next.js 15.5.4 Technical Specifications for AI Agent

## 1. ASYNC_APIS

### EXACT_SYNTAX
```javascript
// cookies()
import { cookies } from 'next/headers'
const cookieStore = await cookies()
const token = cookieStore.get('token')

// headers()
import { headers } from 'next/headers'
const headersList = await headers()
const userAgent = headersList.get('user-agent')

// params
export default async function Page({ params }) {
  const { slug } = await params
  return <h1>Post: {slug}</h1>
}

// searchParams
export default async function Page({ searchParams }) {
  const { query, page } = await searchParams
  return <div>Search: {query}, Page: {page}</div>
}
```

### IS_AWAIT_REQUIRED
```json
true
```

### ERROR_IF_NOT_AWAITED
```typescript
"Type '{ slug: string }' is missing the following properties from type 'Promise<any>': then, catch, finally"
"Warning: cookies should be awaited before using its value"
"Build errors when cacheComponents flag is enabled"
```

### CORRECT_PATTERN
```typescript
// Server Component
export default async function Page({ params, searchParams }) {
  const { slug } = await params
  const { query } = await searchParams
  const cookieStore = await cookies()
  const headersList = await headers()

  return <div>{slug} - {query}</div>
}

// Client Component
'use client'
import { use } from 'react'

function ClientComponent({ params, searchParams }) {
  const { slug } = use(params)
  const { query } = use(searchParams)
  return <div>{slug} - {query}</div>
}
```

### MIGRATION_FROM_14
```bash
# Automatic migration
npx @next/codemod@canary next-async-request-api .
```
```typescript
// Before (Next.js 14)
function Page({ params, searchParams }) {
  const { slug } = params
  const { query } = searchParams
  const cookieStore = cookies()
  const headersList = headers()
}

// After (Next.js 15.5.4)
export default async function Page({ params, searchParams }) {
  const { slug } = await params
  const { query } = await searchParams
  const cookieStore = await cookies()
  const headersList = await headers()
}
```

## 2. TAILWIND_CSS_4_CONFIG

### CONFIG_FILE_NEEDED
```json
false
```

### IF_FALSE_WHERE_CONFIG
```css
"Configuration goes directly in main CSS file using @theme directive"
```

### POSTCSS_CONFIG_CORRECT
```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### GLOBALS_CSS_CONTENT
```css
@import 'tailwindcss';

/* Optional: Custom theme configuration */
@theme {
  --font-display: "Satoshi", "sans-serif";
  --breakpoint-3xl: 120rem;
  --color-brand-100: oklch(0.99 0 0);
  --color-brand-500: oklch(0.84 0.18 117.33);
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
}
```

### OXIDE_ENGINE_ACTIVATION
```typescript
"Automatically activated - built into Tailwind CSS v4 core"
```

### CSS_IMPORTS_LOCATION
```typescript
// app/layout.tsx
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## 3. TURBOPACK_STATUS

### PRODUCTION_READY
```json
false
```

### CONFIG_REQUIRED_IN
```typescript
"next.config.ts"
```
```typescript
// next.config.ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  turbopack: {
    // Configuration options here
  },
};
export default nextConfig;
```

### KNOWN_INCOMPATIBILITIES
```json
[
  "webpack plugins - complete incompatibility",
  "CSS Module :local and :global pseudo-classes",
  "@value rule in CSS modules",
  "AMP support",
  "Yarn PnP",
  "experimental.urlImports",
  "nextScriptWorkers",
  "sri.algorithm",
  "fallbackNodePolyfills",
  "webpack() configuration in next.config.js",
  "Inner Graph Optimization",
  "Persistent disk caching equivalent"
]
```

### PERFORMANCE_METRICS
```json
{
  "build_speed_multiplier": 2.5,
  "hmr_speed_multiplier": 700.0
}
```

## 4. TANSTACK_QUERY_V5_NEXTJS15

### PROPERTY_NAMES
```json
{
  "cacheTime": "gcTime",
  "cacheTime_deprecated": true
}
```

### APP_ROUTER_STREAMING_PATTERN
```typescript
// app/posts/page.tsx
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query'
import Posts from './posts'

export default async function PostsPage() {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: getPosts,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts />
    </HydrationBoundary>
  )
}

// app/posts/posts.tsx
'use client'
import { useQuery } from '@tanstack/react-query'

export default function Posts() {
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: getPosts,
  })

  return <div>{/* render posts */}</div>
}
```

### HYDRATION_BOUNDARY_REQUIRED
```json
true
```

### QUERYCLIENT_INITIALIZATION
```typescript
// app/providers.tsx
'use client'
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    return makeQueryClient()
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// app/layout.tsx
import Providers from './providers'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

## 5. ZUSTAND_V5_SSR

### USE_CLIENT_SUFFICIENT
```json
false
```

### ADDITIONAL_HYDRATION_SAFETY
```typescript
// Context Provider Pattern
'use client'
import { type ReactNode, createContext, useRef, useContext } from 'react'
import { useStore } from 'zustand'
import { type CounterStore, createCounterStore } from '@/stores/counter-store'

export type CounterStoreApi = ReturnType<typeof createCounterStore>

export const CounterStoreContext = createContext<CounterStoreApi | undefined>(
  undefined,
)

export const CounterStoreProvider = ({ children }: { children: ReactNode }) => {
  const storeRef = useRef<CounterStoreApi | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createCounterStore()
  }

  return (
    <CounterStoreContext.Provider value={storeRef.current}>
      {children}
    </CounterStoreContext.Provider>
  )
}

// Hydration Boundary Component
'use client'
import { useState, useEffect } from 'react'

export default function HydrationZustand({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return hydrated ? <>{children}</> : <div>Loading...</div>
}
```

### PERSIST_MIDDLEWARE_PATTERN
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: async (email, password) => {
        // Login logic
      },
      logout: () => {
        set({ isAuthenticated: false, user: null, token: null })
      },
    }),
    {
      name: 'auth-store',
      skipHydration: true, // Important for SSR
    }
  )
)

// Component usage
'use client'
import { useState, useEffect } from 'react'

export default function AuthComponent() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    useAuthStore.persist.rehydrate()
  }, [])

  if (!hydrated) return <div>Loading...</div>

  return <div>{/* content */}</div>
}
```

### KNOWN_HYDRATION_ERRORS
```json
[
  "Hydration failed because the initial UI does not match what was rendered on the server",
  "Text content does not match server-rendered HTML",
  "There was an error while hydrating. Because the error happened outside of a Suspense boundary, the entire root will switch to client rendering",
  "Warning: Expected server HTML to contain a matching <div> in <div>"
]
```

## 6. BREAKING_CHANGES

### LIST_ALL_BREAKING_FROM_NEXTJS14
```json
[
  "cookies(), headers(), draftMode(), params, searchParams now async",
  "fetch() requests no longer cached by default",
  "GET Route Handlers no longer cached by default",
  "Client-side Router Cache pages no longer reused by default",
  "experimental-edge runtime removed - use edge",
  "experimental.bundlePagesExternals → bundlePagesRouterDependencies",
  "experimental.serverComponentsExternalPackages → serverExternalPackages",
  "@next/font package removed - use next/font",
  "geo and ip properties removed from NextRequest",
  "Speed Insights auto instrumentation removed",
  "useFormState deprecated - use useActionState",
  "next lint deprecated in 15.5",
  "legacyBehavior prop for next/link deprecated",
  "AMP support deprecated"
]
```

### LIST_ALL_BREAKING_FROM_REACT18
```json
[
  "PropTypes and defaultProps removed",
  "contextTypes and getChildContext removed",
  "String refs removed",
  "ReactDOM.render() → ReactDOM.createRoot()",
  "ReactDOM.hydrate() → ReactDOM.hydrateRoot()",
  "ReactDOM.unmountComponentAtNode() → root.unmount()",
  "ReactDOM.findDOMNode() removed",
  "react-test-renderer/shallow removed",
  "react-dom/test-utils removed",
  "React.createFactory() removed",
  "Module pattern factories removed",
  "UMD builds removed",
  "forwardRef no longer needed for function components",
  "useRef requires argument",
  "ReactElement props default to unknown",
  "Errors in render no longer re-thrown"
]
```

### TYPESCRIPT_CONFIG_CHANGES
```typescript
{
  "next_config_ts_support": true,
  "typed_routes": "stable",
  "jsx_namespace": "module_scoped",
  "useRef_requires_argument": true,
  "ReactElement_props": "unknown",
  "type_installation": "@types/react@^19.0.0 @types/react-dom@^19.0.0",
  "migration_codemod": "npx types-react-codemod@latest preset-19",
  "next_typegen_command": true
}
```

## OUTPUT_CODEBLOCKS_WITH_MARKERS
```json
true
```

## INCLUDE_ERROR_PATTERNS
```json
true
```

## SKIP_EXPLANATIONS
```json
true
```