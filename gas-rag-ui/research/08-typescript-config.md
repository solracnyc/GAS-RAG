# TypeScript 5.x with Next.js 15.5.4 Configuration Guide

TypeScript 5.x with Next.js 15.5.4 requires **specific configuration patterns** for optimal performance and strict type safety. The combination demands TypeScript 5.1.3+ and @types/react 18.2.8+ for async server components, uses "bundler" module resolution, and implements Promise-based params and searchParams. Critical changes include async dynamic APIs (cookies, headers), enhanced type generation in `.next/types/`, and stricter null checking throughout. This guide provides production-ready configurations with complete type definitions for September 2025 development.

## 1. TSCONFIG_OPTIMAL

### COMPLETE_TSCONFIG
```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,

    "noEmit": true,
    "incremental": true,
    "skipLibCheck": true,

    "jsx": "preserve",

    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "alwaysStrict": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true,

    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/utils/*": ["./src/utils/*"],
      "@/styles/*": ["./src/styles/*"],
      "@/types/*": ["./src/types/*"],
      "@/api/*": ["./src/app/api/*"],
      "@/server/*": ["./src/server/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/ui/*": ["./src/components/ui/*"]
    },

    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    ".next",
    "out"
  ]
}
```

### STRICT_MODE_FLAGS
```typescript
[
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "noImplicitThis",
  "alwaysStrict",
  "useUnknownInCatchVariables",
  "exactOptionalPropertyTypes",
  "noUncheckedIndexedAccess",
  "noPropertyAccessFromIndexSignature",
  "noImplicitReturns",
  "noImplicitOverride",
  "noUnusedLocals",
  "noUnusedParameters",
  "noFallthroughCasesInSwitch",
  "allowUnreachableCode",
  "allowUnusedLabels"
]
```

### MODULE_RESOLUTION
**Use "bundler"** - This is the optimal choice for Next.js 15.5.4 because it handles module bundling internally, doesn't require `.js` extensions for TypeScript imports, supports modern package.json "imports" and "exports" fields, and is officially recommended by Next.js.

### PATHS_ALIAS_PATTERN
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/ui/*": ["./src/components/ui/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/utils/*": ["./src/utils/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/styles/*": ["./src/styles/*"],
      "@/types/*": ["./src/types/*"],
      "@/api/*": ["./src/app/api/*"],
      "@/server/*": ["./src/server/*"],
      "@/assets/*": ["./public/assets/*"],
      "@/images/*": ["./public/images/*"]
    }
  }
}
```

## 2. NEXTJS15_TYPES

### APP_ROUTER_TYPES
```typescript
// Page Component Types (app/[slug]/page.tsx)
import { Metadata } from 'next'

// Global PageProps type (auto-generated in Next.js 15.5+)
export default function Page(props: PageProps<'/[slug]'>) {
  return <div>Page content</div>
}

// Manual typing for Page components
type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function Page({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams

  return (
    <div>
      <h1>Slug: {resolvedParams.slug}</h1>
      <p>Query: {JSON.stringify(resolvedSearchParams)}</p>
    </div>
  )
}

// Layout Component Types (app/[slug]/layout.tsx)
import { ReactNode } from 'react'

// Global LayoutProps type (auto-generated in Next.js 15.5+)
export default function Layout(props: LayoutProps<'/[slug]'>) {
  return (
    <div>
      {props.children}
      {props.analytics}
      {props.team}
    </div>
  )
}

// Manual typing for Layout components
type LayoutProps = {
  children: ReactNode
  params: Promise<{ slug: string }>
  // Parallel route slots
  analytics?: ReactNode
  team?: ReactNode
}

export default async function Layout({
  children,
  params,
  analytics,
  team
}: LayoutProps) {
  const resolvedParams = await params

  return (
    <div>
      <nav>Navigation for {resolvedParams.slug}</nav>
      {children}
      <aside>{analytics}</aside>
      <aside>{team}</aside>
    </div>
  )
}

// Route Segment Config Types
export const runtime = 'nodejs' // 'edge' | 'nodejs'
export const preferredRegion = 'auto'
export const dynamic = 'force-dynamic' // 'auto' | 'force-dynamic' | 'error' | 'force-static'
export const dynamicParams = true
export const revalidate = false
export const fetchCache = 'auto'
export const maxDuration = 5
```

### ROUTE_HANDLER_TYPES
```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Request body validation schema
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
})

type CreateUserBody = z.infer<typeof CreateUserSchema>

// GET handler
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '10'

  return NextResponse.json({
    users: [],
    pagination: { page: parseInt(page), limit: parseInt(limit) }
  })
}

// POST handler with body validation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CreateUserSchema.parse(body)

    const newUser = {
      id: Math.random().toString(36),
      ...validatedData,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT handler
export async function PUT(request: NextRequest) {
  const body: Partial<CreateUserBody> = await request.json()
  return NextResponse.json({ message: 'User updated', data: body })
}

// DELETE handler
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'ID is required' },
      { status: 400 }
    )
  }

  return NextResponse.json({ message: `User ${id} deleted` })
}

// Dynamic Route Handler Types (app/api/users/[id]/route.ts)
type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  return NextResponse.json({
    id,
    user: { name: 'John', email: 'john@example.com' }
  })
}

// Using global RouteContext helper (Next.js 15.5+)
export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<'/api/posts/[slug]/comments/[commentId]'>
) {
  const { slug, commentId } = await ctx.params

  return NextResponse.json({
    post: slug,
    comment: commentId,
    data: `Comment ${commentId} for post ${slug}`
  })
}
```

### METADATA_TYPES
```typescript
import { Metadata, Viewport, ResolvingMetadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'My App',
    template: '%s | My App',
  },
  description: 'This is my app built with Next.js',
  keywords: ['Next.js', 'React', 'TypeScript'],
  authors: [
    { name: 'John Doe', url: 'https://johndoe.com' },
    { name: 'Jane Smith', url: 'https://janesmith.com' },
  ],
  creator: 'John Doe',
  publisher: 'My Company',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://example.com'),
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/en-US',
      'es-ES': '/es-ES',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://example.com',
    title: 'My App',
    description: 'This is my app built with Next.js',
    siteName: 'My App',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'My App',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My App',
    description: 'This is my app built with Next.js',
    creator: '@johndoe',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    nocache: true,
    googleBot: {
      index: true,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

// generateMetadata function type
type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params, searchParams }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = (await params).id
  const search = await searchParams

  const product = await fetch(`https://api.example.com/products/${id}`)
    .then((res) => res.json())

  const previousImages = (await parent).openGraph?.images || []

  return {
    title: product.title,
    description: product.description,
    openGraph: {
      images: [`/products/${id}/og-image.jpg`, ...previousImages],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}
```

### SEARCHPARAMS_TYPES
```typescript
// Dynamic Route Params (app/blog/[...slug]/page.tsx)
type BlogPageProps = {
  params: Promise<{
    slug: string[] // Catch-all routes return string[]
  }>
  searchParams: Promise<{
    tag?: string
    sort?: 'date' | 'popularity'
    page?: string
  }>
}

export default async function BlogPage({ params, searchParams }: BlogPageProps) {
  const { slug } = await params
  const { tag, sort = 'date', page = '1' } = await searchParams

  return (
    <div>
      <h1>Blog: {slug.join('/')}</h1>
      <p>Tag: {tag}</p>
      <p>Sort: {sort}</p>
      <p>Page: {page}</p>
    </div>
  )
}

// Optional Catch-all Routes (app/shop/[[...slug]]/page.tsx)
type ShopPageProps = {
  params: Promise<{
    slug?: string[] // Optional catch-all can be undefined
  }>
  searchParams: Promise<{
    category?: string
    minPrice?: string
    maxPrice?: string
    inStock?: 'true' | 'false'
  }>
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { slug = [] } = await params
  const { category, minPrice, maxPrice, inStock } = await searchParams

  const filters = {
    category,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    inStock: inStock === 'true',
  }

  return (
    <div>
      <h1>Shop{slug.length > 0 ? `: ${slug.join('/')}` : ''}</h1>
      <p>Filters: {JSON.stringify(filters)}</p>
    </div>
  )
}

// Search Params Validation with Zod
import { z } from 'zod'

export const ProductSearchParamsSchema = z.object({
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['price-asc', 'price-desc', 'name', 'rating']).default('name'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  inStock: z.coerce.boolean().optional(),
})

export type ProductSearchParams = z.infer<typeof ProductSearchParamsSchema>

// Usage with validation
type ProductsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const rawSearchParams = await searchParams
  const validatedParams = ProductSearchParamsSchema.parse(rawSearchParams)

  return (
    <div>
      <h1>Products</h1>
      <p>Category: {validatedParams.category}</p>
      <p>Price Range: ${validatedParams.minPrice} - ${validatedParams.maxPrice}</p>
      <p>Sort: {validatedParams.sort}</p>
      <p>Page: {validatedParams.page}</p>
    </div>
  )
}
```

## 3. REACT19_TYPES

### SERVER_COMPONENT_PROPS
```typescript
// components/ServerComponent.tsx (No 'use client' directive)
import { ReactNode } from 'react'

type ServerComponentProps = {
  title: string
  description?: string
  children: ReactNode
  metadata?: {
    author: string
    publishedAt: Date
  }
}

export default async function ServerComponent({
  title,
  description,
  children,
  metadata
}: ServerComponentProps) {
  // Server-side data fetching
  const data = await fetch('https://api.example.com/data')
  const result = await data.json()

  return (
    <article>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {metadata && (
        <div>
          <p>By {metadata.author}</p>
          <time>{metadata.publishedAt.toISOString()}</time>
        </div>
      )}
      <div>{children}</div>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </article>
  )
}

// Async Server Component with proper return type
import { ReactElement } from 'react'

async function getData(id: string): Promise<{ title: string; content: string }> {
  const res = await fetch(`https://api.example.com/posts/${id}`)
  if (!res.ok) {
    throw new Error('Failed to fetch data')
  }
  return res.json()
}

export default async function PostPage({
  params
}: {
  params: Promise<{ id: string }>
}): Promise<ReactElement> {
  const { id } = await params
  const post = await getData(id)

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

### CLIENT_COMPONENT_PROPS
```typescript
// components/ClientComponent.tsx
'use client'

import { useState, useCallback } from 'react'

type ClientComponentProps = {
  initialCount?: number
  onCountChange?: (count: number) => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
}

export default function ClientComponent({
  initialCount = 0,
  onCountChange,
  disabled = false,
  variant = 'primary'
}: ClientComponentProps) {
  const [count, setCount] = useState<number>(initialCount)

  const handleIncrement = useCallback(() => {
    const newCount = count + 1
    setCount(newCount)
    onCountChange?.(newCount)
  }, [count, onCountChange])

  const handleDecrement = useCallback(() => {
    const newCount = count - 1
    setCount(newCount)
    onCountChange?.(newCount)
  }, [count, onCountChange])

  return (
    <div className={`counter counter--${variant}`}>
      <button
        onClick={handleDecrement}
        disabled={disabled}
        type="button"
      >
        -
      </button>
      <span>{count}</span>
      <button
        onClick={handleIncrement}
        disabled={disabled}
        type="button"
      >
        +
      </button>
    </div>
  )
}

// Client Component with data fetching
'use client'
import { useState, useEffect } from 'react'

interface User {
  id: string
  name: string
  email: string
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/users')
        const data: User[] = await res.json()
        setUsers(data)
      } catch (error) {
        console.error('Failed to fetch users:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  if (loading) return <div>Loading...</div>

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {user.name} ({user.email})
        </li>
      ))}
    </ul>
  )
}
```

### USE_HOOKS_TYPES
```typescript
// useActionState Hook
'use client'
import { useActionState } from 'react'

type FormState = {
  message: string
  errors?: Record<string, string[]>
  success?: boolean
}

type FormData = {
  name: string
  email: string
}

async function submitForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  await new Promise(resolve => setTimeout(resolve, 1000))

  const errors: Record<string, string[]> = {}

  if (!formData.name.trim()) {
    errors.name = ['Name is required']
  }

  if (!formData.email.includes('@')) {
    errors.email = ['Invalid email']
  }

  if (Object.keys(errors).length > 0) {
    return {
      message: 'Validation failed',
      errors,
      success: false
    }
  }

  return {
    message: 'Form submitted successfully!',
    success: true
  }
}

export default function FormWithActionState() {
  const [state, formAction, isPending] = useActionState(submitForm, {
    message: ''
  })

  return (
    <form action={formAction}>
      <input
        type="text"
        name="name"
        required
        disabled={isPending}
      />
      {state.errors?.name && (
        <span className="error">{state.errors.name[0]}</span>
      )}

      <input
        type="email"
        name="email"
        required
        disabled={isPending}
      />
      {state.errors?.email && (
        <span className="error">{state.errors.email[0]}</span>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>

      {state.message && (
        <p className={state.success ? 'success' : 'error'}>
          {state.message}
        </p>
      )}
    </form>
  )
}

// useOptimistic Hook
'use client'
import { useOptimistic, useState, useTransition } from 'react'

type Todo = {
  id: string
  text: string
  completed: boolean
}

type OptimisticAction =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: string }
  | { type: 'delete'; id: string }

function optimisticReducer(
  state: Todo[],
  action: OptimisticAction
): Todo[] {
  switch (action.type) {
    case 'add':
      return [
        ...state,
        {
          id: `temp-${Date.now()}`,
          text: action.text,
          completed: false,
        },
      ]
    case 'toggle':
      return state.map(todo =>
        todo.id === action.id
          ? { ...todo, completed: !todo.completed }
          : todo
      )
    case 'delete':
      return state.filter(todo => todo.id !== action.id)
    default:
      return state
  }
}

export default function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    optimisticReducer
  )
  const [isPending, startTransition] = useTransition()

  const addTodo = (text: string) => {
    startTransition(async () => {
      addOptimisticTodo({ type: 'add', text })

      await new Promise(resolve => setTimeout(resolve, 1000))

      const newTodo: Todo = {
        id: Math.random().toString(36),
        text,
        completed: false,
      }

      setTodos(prev => [...prev, newTodo])
    })
  }

  return (
    <div>
      <h2>Todos {isPending && '(Updating...)'}</h2>
      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id}>
            <span
              style={{
                textDecoration: todo.completed ? 'line-through' : 'none',
                opacity: todo.id.startsWith('temp-') ? 0.7 : 1
              }}
            >
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// use() Hook for Data Fetching
'use client'
import { use, Suspense } from 'react'

async function fetchUserData(userId: string): Promise<{
  id: string
  name: string
  email: string
}> {
  const response = await fetch(`/api/users/${userId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch user')
  }
  return response.json()
}

function UserProfile({ userId }: { userId: string }) {
  const user = use(fetchUserData(userId))

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  )
}

export default function UserApp({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<div>Loading user...</div>}>
      <UserProfile userId={userId} />
    </Suspense>
  )
}

// useFormStatus Hook
'use client'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending, data } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Submitting...' : 'Submit'}
      {pending && data && (
        <span> ({data.get('email') as string})</span>
      )}
    </button>
  )
}
```

## 4. COMMON_ERRORS

### TYPE_INSTANTIATION_DEEP

**Cause**: Complex recursive types, deeply nested conditional types, or infinite type recursion in libraries like styled-components or complex utility types.

**Fix Code Block**:
```typescript
// Problem: Complex recursive type causing infinite instantiation
type Module<P, C> = {
  payloads: P;
  children: C;
};

type Children = Record<string, Module<any, any>>;

// ❌ This causes the error
const action: Module<SomePayload, Children> = {
  payloads: payload,
  children: nestedChildren
};

// ✅ Fix 1: Use Distributive Conditional Types
type SafeModule<T> = T extends any ? Module<T['payloads'], T['children']> : never;

const generic = <M extends Module<any, any>>(
  action: M extends any ? SafeModule<M> : never
) => {
  // Your logic here
};

// ✅ Fix 2: Add any Type Guards
type IsAny<T> = unknown extends T & string ? true : false;

type AllModuleActions<T extends object, K = keyof T> =
  IsAny<T> extends true
    ? never
    : K extends keyof T
      ? T[K] extends object
        ? AllModuleActions<T[K]>
        : T[K]
      : never;

// ✅ Fix 3: Use Type Assertions for Complex Libraries
import styled from 'styled-components'

const InputContainer = styled(Container)`
  && {
    width: ${props => props.width || 500}px;
  }
` as typeof Container;

// Alternative approach
const InputContainer = styled(Container)<typeof Container>`
  /* styles */
`;
```

### ASYNC_COMPONENT_TYPE

**Requirements**: TypeScript 5.1.3+ and @types/react 18.2.8+ for proper async component support.

**Fix Code Block**:
```typescript
// ❌ Wrong - FunctionComponent doesn't support async
import { FunctionComponent } from 'react'
export const MyPage: FunctionComponent = async () => {
  // This will cause TypeScript errors
  const data = await fetch('/api/data')
  return <div>{data}</div>
};

// ✅ Correct - Don't use FunctionComponent for async components
interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  // Await the params in Next.js 15+
  const { slug } = await params;
  const search = await searchParams;

  const data = await fetch(`https://api.example.com/${slug}`);
  const result = await data.json();

  return (
    <div>
      <h1>{result.title}</h1>
      <p>Search: {search.query}</p>
    </div>
  );
}

// ✅ Correct - With proper return type annotation
import { ReactElement } from 'react';

export default async function PostPage({
  params
}: {
  params: Promise<{ id: string }>
}): Promise<ReactElement> {
  const { id } = await params;
  const post = await getData(id);

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  );
}

// ❌ Wrong - Client components cannot be async
'use client'
export default async function ClientComponent() {
  const data = await fetch('/api/data');
  return <div>{data}</div>;
}

// ✅ Correct - Use useEffect for client-side data fetching
'use client'
import { useState, useEffect } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const res = await fetch('/api/data');
      const result = await res.json();
      setData(result);
    }
    fetchData();
  }, []);

  return <div>{data?.title}</div>;
}

// ✅ Correct - Handling Dynamic APIs (Next.js 15 Breaking Change)
import { cookies, headers } from 'next/headers';

export async function ServerComponent() {
  // Next.js 15+ requires async access
  const cookieStore = await cookies();
  const headersList = await headers();
  const token = cookieStore.get('token');

  return <div>Token: {token?.value}</div>;
}
```

## 5. AUTO_GENERATED_TYPES_LOCATION

```typescript
[
  ".next/types/app/",                    // App Router route types
  ".next/types/app/[dynamic]/page.ts",   // Dynamic route type definitions
  ".next/types/app/layout.ts",           // Layout prop types
  ".next/types/app/page.ts",             // Page prop types
  ".next/types/link.d.ts",               // Typed routes for next/link
  ".next/types/app.d.ts",                // Global app types
  "next-env.d.ts"                        // Next.js TypeScript integration (project root)
]
```

Each location serves specific purposes:
- **`.next/types/app/`**: Contains `PageProps`, `LayoutProps`, and `RouteContext` for App Router
- **`.next/types/link.d.ts`**: Generated when `typedRoutes: true` is enabled, provides union types of all valid routes
- **`next-env.d.ts`**: References Next.js types and includes `.next/types` in TypeScript compilation

To manually generate types without running dev/build:
```bash
npx next typegen
```

## Conclusion

TypeScript 5.x with Next.js 15.5.4 introduces **stricter requirements but enhanced type safety**. Key implementation points include using "bundler" module resolution, awaiting all dynamic APIs (params, searchParams, cookies, headers), enabling all strict mode flags for maximum safety, and properly typing async server components. The configuration ensures production-ready code with comprehensive type checking while leveraging new features like typed routes, optimistic UI hooks, and server component streaming. Following these patterns prevents common errors and maximizes the benefits of TypeScript's static analysis in modern Next.js applications.