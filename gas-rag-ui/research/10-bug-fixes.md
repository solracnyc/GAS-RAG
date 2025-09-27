# Critical Bug Fixes and Known Issues for Production Next.js 15.5.4 Applications

## 1. NEXTJS15_KNOWN_ISSUES

### HYDRATION_ERRORS

```javascript
[
  {
    "pattern": "Browser extensions inject attributes causing 'Hydration failed' errors (Colorzilla, Grammarly, VPN extensions)",
    "severity_level": "blocking",
    "fix": `// Option 1: Suppress hydration warnings in root layout
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

// Option 2: Client-side cleanup component
'use client';
import { useEffect } from 'react';

export default function HydrationFix() {
  useEffect(() => {
    const body = document.body;
    ['cz-shortcut-listen', 'fdprocessedid'].forEach(attr => {
      if (body.hasAttribute(attr)) {
        body.removeAttribute(attr);
      }
    });
  }, []);
  return null;
}`
  },
  {
    "pattern": "TSS-React nested class selectors break hydration with Material-UI components",
    "severity_level": "high",
    "fix": `// ❌ BROKEN: Nested selectors fail in Next.js 15
const useStyles = tss.create({
  sideViewContent: {
    height: 'auto',
    position: 'relative',
    padding: '6.4rem',
    [\`& .\${classes.appIcon}\`]: {  // This breaks
      height: '70px',
      width: '70px'
    }
  }
});

// ✅ FIXED: Separate class definitions
const useStyles = tss.create({
  sideViewContent: {
    height: 'auto',
    position: 'relative',
    padding: '6.4rem',
  },
  appIcon: {
    height: '70px',
    width: '70px'
  }
});`
  },
  {
    "pattern": "Redux state causing server/client mismatch in App Router",
    "severity_level": "high",
    "fix": `'use client';
import { useSelector } from 'react-redux';
import { useState, useEffect } from 'react';

export default function Header() {
  const [isClient, setIsClient] = useState(false);
  const { isAuthenticated, user } = useSelector(state => state.auth);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent hydration mismatch
  if (!isClient) {
    return <header>Loading...</header>;
  }

  return (
    <header>
      {isAuthenticated ? \`Welcome \${user.name}\` : 'Please login'}
    </header>
  );
}`
  },
  {
    "pattern": "Time/random value differences between server and client",
    "severity_level": "medium",
    "fix": `import { useState, useEffect } from 'react';

export default function TimeComponent() {
  const [time, setTime] = useState('');

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
  }, []);

  // Render empty until client-side
  return <h1>{time}</h1>;
}`
  }
]
```

### BUILD_FAILURES

```javascript
[
  {
    "error": "TypeScript error: Property 'id' is missing in type 'Promise<{ id: string }>' in route handlers",
    "severity_level": "blocking",
    "solution": `// Next.js 15.5.4 requires awaiting params
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Must await params

  // Rest of handler
  return Response.json({ id });
}

// For page components
export default async function Page({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  // Component logic
}`
  },
  {
    "error": "Turbopack fails with 'Module not found: Can't resolve 'fs'' when using Tailwind CSS v3",
    "severity_level": "high",
    "solution": `// Option 1: Upgrade Tailwind CSS
npm uninstall tailwindcss
npm install tailwindcss@^4.0.0 @tailwindcss/postcss

// Option 2: Disable Turbopack temporarily
// package.json
{
  "scripts": {
    "build": "next build",  // Remove --turbopack flag
    "dev": "next dev"       // Remove --turbopack flag
  }
}`
  },
  {
    "error": "Deprecated experimental.serverComponentsExternalPackages config warning",
    "severity_level": "medium",
    "solution": `// next.config.js
module.exports = {
  // ❌ OLD - Deprecated
  experimental: {
    serverComponentsExternalPackages: ['some-package']
  }

  // ✅ NEW - Correct config
  serverExternalPackages: ['some-package']
}`
  },
  {
    "error": "Custom webpack configs disable build worker causing slower builds",
    "severity_level": "medium",
    "solution": `// next.config.js
module.exports = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Your customizations
    return config;
  },
  experimental: {
    webpackBuildWorker: true, // Force enable build worker
    webpackMemoryOptimizations: true // Reduce memory usage
  }
}`
  }
]
```

### MEMORY_LEAKS

```javascript
[
  {
    "cause": "Next.js 15.1+ unpredictable memory spikes on Azure (regression from 14.2)",
    "severity_level": "blocking",
    "fix": `// Temporary workaround: Downgrade to Next.js 14.2
npm install next@14.2.0

// Memory monitoring utility
export function logMemoryUsage() {
  if (process.env.NODE_ENV === 'development') {
    const memUsage = process.memoryUsage();
    console.log({
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
    });
  }
}`
  },
  {
    "cause": "Global fetch API retains performance metrics causing heap growth",
    "severity_level": "high",
    "fix": `// Use Node.js http module for server-side requests
import http from 'http';

export async function fetchDataServer(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(JSON.parse(data)));
    });
    request.on('error', reject);
    request.end();
  });
}`
  },
  {
    "cause": "Creating new Contentful/CMS client instances per request",
    "severity_level": "high",
    "fix": `// Singleton pattern for external clients
let contentfulClient;

const getContentfulClient = () => {
  if (!contentfulClient) {
    contentfulClient = createClient({
      space: process.env.CONTENTFUL_SPACE,
      accessToken: process.env.CONTENTFUL_TOKEN,
      environment: 'master',
    });
  }
  return contentfulClient;
};

export async function getContentfulEntries(contentType) {
  const client = getContentfulClient();
  return await client.getEntries({ content_type: contentType });
}`
  },
  {
    "cause": "Global arrays/objects accumulating data without cleanup",
    "severity_level": "medium",
    "fix": `// Implement size limits and cleanup
const globalCache = new Map();
const MAX_CACHE_SIZE = 1000;

export async function processRequest(data) {
  // Prevent unbounded growth
  if (globalCache.size >= MAX_CACHE_SIZE) {
    const firstKey = globalCache.keys().next().value;
    globalCache.delete(firstKey);
  }

  globalCache.set(data.id, data);
  // Process data
}`
  }
]
```

## 2. REACT19_ISSUES

### STRICT_MODE_DOUBLE_RENDER

```javascript
{
  "affected_apis": [
    "useEffect",
    "useMemo",
    "useCallback",
    "External API calls within effects",
    "Component lifecycle hooks"
  ],
  "severity_level": "high",
  "workaround": `// Solution 1: Manual double-execution detection
function MyComponent() {
  const initialized = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (!initialized.current) {
        initialized.current = true;
        console.log('First execution');
      }
    }

    // Actual effect logic with proper cleanup
    const controller = new AbortController();
    fetch('/api/data', { signal: controller.signal })
      .then(response => response.json())
      .then(data => {
        // Handle data
      });

    return () => {
      controller.abort(); // Proper cleanup
    };
  }, []);

  return <div>Component</div>;
}

// Solution 2: Custom hook for mount effects
function useOnMountUnsafe(effect) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return effect();
    }
  }, []);
}

// Solution 3: Proper API call handling
function DataComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const abortController = new AbortController();
    let isMounted = true;

    fetchData({ signal: abortController.signal })
      .then(result => {
        if (isMounted) {
          setData(result);
        }
      })
      .catch(error => {
        if (error.name !== 'AbortError' && isMounted) {
          console.error('Fetch error:', error);
        }
      });

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>;
}`
}
```

### SUSPENSE_ISSUES

```javascript
[
  {
    "pattern": "Suspense boundary received an update before it finished hydrating",
    "severity_level": "high",
    "fix": `'use client';
import { useSearchParams } from 'next/navigation';
import { useTransition, startTransition, Suspense } from 'react';
import dynamic from 'next/dynamic';

const DynamicComponent = dynamic(() => import('./DataList'), {
  suspense: true,
});

// Wrap useSearchParams in Suspense
function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  return <SearchDisplay params={searchParams} />;
}

function FixedComponent() {
  const [data, setData] = useState([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(json => {
        // Use startTransition for state updates
        startTransition(() => {
          setData(json);
        });
      });
  }, []);

  return (
    <div>
      <Suspense fallback={<div>Loading search...</div>}>
        <SearchParamsWrapper />
      </Suspense>

      <Suspense fallback={<div>Loading data...</div>}>
        {isPending ? <div>Updating...</div> : <DynamicComponent data={data} />}
      </Suspense>
    </div>
  );
}`
  },
  {
    "pattern": "useSearchParams missing Suspense boundary causes build/runtime errors",
    "severity_level": "medium",
    "fix": `import { Suspense } from 'react';

function SearchComponent() {
  return (
    <Suspense fallback={<div>Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');

  return <div>Query: {query}</div>;
}`
  },
  {
    "pattern": "Server Component streaming interferes with React 19 prerendering",
    "severity_level": "high",
    "fix": `// Use Next.js 15 loading.js instead of manual Suspense
// app/dashboard/loading.js
export default function Loading() {
  return <div className="animate-spin">Loading dashboard...</div>;
}

// app/dashboard/page.js
async function DashboardPage() {
  // Next.js 15 handles streaming automatically
  const data = await fetch('https://api.example.com/dashboard');
  return <DashboardContent data={data} />;
}`
  }
]
```

## 3. TAILWIND4_ISSUES

### POSTCSS_CONFLICTS

```javascript
[
  {
    "error": "PostCSS plugin has moved to separate package error",
    "severity_level": "blocking",
    "fix": `// 1. Install the new PostCSS plugin
npm install tailwindcss@4 @tailwindcss/postcss postcss

// 2. Update postcss.config.mjs (use .mjs extension!)
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}

// 3. Update CSS imports in globals.css
/* Remove old Tailwind directives */
/* @tailwind base; */
/* @tailwind components; */
/* @tailwind utilities; */

/* Use new import syntax */
@import "tailwindcss";`
  },
  {
    "error": "Create-next-app installs incompatible Tailwind v3 by default",
    "severity_level": "high",
    "fix": `# Create project WITHOUT Tailwind
npx create-next-app@latest my-project --typescript --eslint --app
# Answer "No" to Tailwind CSS question

cd my-project

# Manually install Tailwind v4
npm install tailwindcss@4 @tailwindcss/postcss postcss

# Create postcss.config.mjs (NOT .js)
echo 'export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}' > postcss.config.mjs`
  },
  {
    "error": "PostCSS configuration file extension causes module loading issues",
    "severity_level": "medium",
    "fix": `# Rename config file to use .mjs extension
mv postcss.config.js postcss.config.mjs

# Update content to ES module syntax
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}`
  }
]
```

### CLASS_DETECTION_MISS

```javascript
{
  "pattern": "Dynamic class construction not detected by Tailwind v4 scanner",
  "severity_level": "high",
  "solution": `// ❌ BROKEN: Dynamic string interpolation
function Button({ color }) {
  return <button className={\`bg-\${color}-500 hover:bg-\${color}-600\`}>
    Click me
  </button>
}

// ✅ FIXED: Static class mapping
function Button({ color }) {
  const colorVariants = {
    blue: "bg-blue-500 hover:bg-blue-600 text-white",
    red: "bg-red-500 hover:bg-red-600 text-white",
    green: "bg-green-500 hover:bg-green-600 text-white"
  };

  return <button className={colorVariants[color]}>
    Click me
  </button>
}

// For server components, ensure proper source scanning
/* In globals.css */
@import "tailwindcss";
@source "../app/**/*.{js,ts,jsx,tsx}";
@source "../components/**/*.{js,ts,jsx,tsx}";

// For unavoidable dynamic classes, use inline safelist
@import "tailwindcss";
@source inline("text-red-600 text-green-600 bg-blue-500");`
}
```

## 4. DEPLOYMENT_ISSUES

### VERCEL_SPECIFIC

```javascript
[
  {
    "issue": "Edge Runtime incompatible with Node.js dependencies (Prisma, process.version)",
    "severity_level": "high",
    "fix": `// middleware.ts - Detect and handle runtime
export function middleware(request: NextRequest) {
  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge-compatible code only
    return NextResponse.next();
  } else {
    // Node.js APIs available
    // Can use Prisma, fs, etc.
  }
}

// Force Node.js runtime for specific routes
// app/api/route/route.ts
export const runtime = 'nodejs'; // Force Node.js instead of Edge`
  },
  {
    "issue": "ISR (Incremental Static Regeneration) cache misses and revalidation failures",
    "severity_level": "blocking",
    "fix": `// app/blog/[id]/page.tsx
export const revalidate = 60; // Time-based ISR
export const dynamicParams = true;
export const dynamic = 'force-static';

export async function generateStaticParams() {
  return [] // Configure static params properly
}

// API route for on-demand revalidation
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.MY_SECRET_TOKEN) {
    return Response.json({ message: 'Invalid token' }, { status: 401 })
  }

  try {
    await revalidatePath('/blog/[id]', 'page')
    return Response.json({ revalidated: true })
  } catch (err) {
    return Response.json({ message: 'Error revalidating' }, { status: 500 })
  }
}`
  },
  {
    "issue": "Build timeouts due to TypeScript checking and function size limits",
    "severity_level": "medium",
    "fix": `// next.config.js
const nextConfig = {
  experimental: {
    webpackMemoryOptimizations: true,
    typedRoutes: false, // Disable if causing issues
  },
  typescript: {
    ignoreBuildErrors: false, // Move to CI
  },
  eslint: {
    ignoreDuringBuilds: true, // Move to CI
  }
}

// vercel.json
{
  "buildCommand": "next build",
  "functions": {
    "app/**": {
      "maxDuration": 30
    }
  },
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  }
}`
  }
]
```

### DOCKER_ISSUES

```javascript
[
  {
    "issue": "Sharp 0.34.0+ fails to compile with missing libvips-cpp.so.42",
    "severity_level": "blocking",
    "fix": `FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat libvips-dev
WORKDIR /app

# Install dependencies with platform-specific sharp
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --include=optional
# Force install compatible sharp version
RUN npm install --platform=linux --arch=x64 sharp@0.33.5

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_SHARP_PATH=/app/node_modules/sharp
RUN npm run build

# Production runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_SHARP_PATH=/app/node_modules/sharp

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# CRITICAL: Copy sharp module to runtime
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]`
  },
  {
    "issue": "Memory leaks causing OOM kills (1GB+ usage) with fetch API",
    "severity_level": "high",
    "fix": `FROM node:20.15.1-alpine AS runner  # Use 20.15.1 to avoid fetch leak
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=512 --gc-interval=100"
ENV NODE_ENV=production

# Add memory monitoring
COPY --from=builder /app/.next/standalone ./
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "process.memoryUsage().heapUsed < 400000000 || process.exit(1)"

CMD ["node", "server.js"]

// Application-level memory-safe fetch
export async function fetchWithCleanup(url: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}\`)
    }

    const data = await response.json() // Always consume response
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}`
  },
  {
    "issue": "Build performance regression (5-7x slower in 15.2.4+ vs 15.1.7)",
    "severity_level": "high",
    "fix": `FROM node:22-alpine AS builder
WORKDIR /app

# Optimize build environment
ENV NODE_OPTIONS="--max-old-space-size=4096 --heap-prof"
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

COPY . .
# Try Turbopack first, fallback to regular build
RUN npx next build --turbopack || npm run build`
  }
]
```