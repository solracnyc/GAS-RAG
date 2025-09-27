# Research Prompts for Technology Stack Verification

## Purpose
These prompts help gather accurate, current information about the technologies used in this project, accounting for version differences and recent updates.

## 1. Next.js Version Research

### Next.js 14 vs 15 Compatibility Check
```
Research the breaking changes between Next.js 14 and Next.js 15.5, focusing on:
1. Async API changes (cookies, headers, params, searchParams)
2. Default caching behavior changes
3. App Router differences
4. React version requirements (React 18 vs React 19)
5. Turbopack support and configuration
6. Server Components default behavior
7. Build and deployment differences
8. Environment variable handling
Provide specific code examples showing before/after for each breaking change.
```

### Next.js 14 Specific Implementation
```
For a Next.js 14 project (not 15), provide the exact implementation for:
1. App Router setup with TypeScript
2. Server Components vs Client Components patterns
3. Data fetching patterns (with default caching)
4. Streaming and Suspense implementation
5. Middleware configuration
6. API routes with Route Handlers
7. Static and dynamic rendering
Include working code examples tested with Next.js 14.x
```

## 2. React Version Compatibility

### React 18 vs React 19 Differences
```
Compare React 18 and React 19, specifically:
1. Concurrent features stability status
2. Server Components implementation differences
3. Suspense API changes
4. Hook changes or additions
5. TypeScript type definitions
6. Performance optimizations
7. Breaking changes in common patterns
Indicate which features work in both versions vs version-specific features.
```

## 3. State Management Libraries

### TanStack Query Version Matrix
```
Research TanStack Query (React Query) versions:
1. Latest stable version and its requirements
2. Breaking changes from v4 to v5
3. Compatibility with React 18 vs React 19
4. Compatibility with Next.js 14 vs Next.js 15
5. New features in v5 (gcTime, isPending, etc.)
6. Migration guide with code examples
7. Server-side rendering patterns
Provide a compatibility matrix for all combinations.
```

### Zustand with Server Components
```
Research Zustand usage with React Server Components:
1. Current version and compatibility
2. Client-only restrictions and workarounds
3. Hydration issues and solutions
4. TypeScript patterns for type safety
5. Store persistence options
6. Performance optimization techniques
7. Common pitfalls and solutions
Focus on Next.js App Router specific patterns.
```

## 4. UI Libraries

### Tailwind CSS Version Comparison
```
Compare Tailwind CSS v3 and v4:
1. Configuration differences (@theme directive vs config file)
2. Performance improvements (Oxide engine)
3. Browser compatibility requirements
4. Migration path and tools
5. PostCSS configuration changes
6. JIT mode differences
7. Dark mode implementation
Provide migration examples and compatibility notes.
```

### Radix UI Current State
```
Research Radix UI in September 2025:
1. Radix Primitives vs Radix Themes recommendation
2. React 18/19 compatibility
3. Server Component support
4. Tailwind CSS integration patterns
5. Accessibility features
6. Bundle size considerations
7. TypeScript support
Include implementation examples for common components.
```

## 5. AI/ML Integration

### Vercel AI SDK Versions
```
Research Vercel AI SDK versions and features:
1. Latest stable version (v5.x)
2. Breaking changes from v3/v4 to v5
3. Streaming implementation differences
4. Provider support (Google, OpenAI, Anthropic)
5. Edge runtime compatibility
6. Server Component integration
7. Multi-modal capabilities
8. Error handling patterns
Provide working examples for each major version.
```

### Google Generative AI
```
Research Google's Generative AI SDK:
1. Latest version and features
2. Gemini model variants and capabilities
3. Embedding models (embedding-001, etc.)
4. Rate limits and quotas
5. Pricing tiers and free tier limitations
6. TypeScript types and patterns
7. Error handling and retry strategies
Include production-ready code examples.
```

### CopilotKit Implementation
```
Research CopilotKit current state:
1. Latest version and stability
2. AG-UI protocol implementation
3. Bundle size impact
4. React version requirements
5. Next.js integration patterns
6. Performance characteristics
7. Alternative libraries comparison
Provide a decision matrix for when to use vs alternatives.
```

## 6. Database and Vector Search

### Supabase Vector Search
```
Research Supabase pgvector implementation:
1. Latest pgvector version and features
2. HNSW index configuration
3. Performance optimization techniques
4. JavaScript client best practices
5. Real-time subscriptions with vector data
6. Row Level Security patterns
7. Connection pooling strategies
Include benchmarks and optimization examples.
```

## 7. Performance and Optimization

### Virtualization Libraries
```
Compare virtualization libraries for React:
1. TanStack Virtual vs react-window vs react-virtualized
2. React 18/19 concurrent features support
3. Next.js SSR compatibility
4. TypeScript support
5. Performance benchmarks
6. Bundle size comparison
7. Maintenance status
Provide implementation examples for large lists.
```

### Bundle Analysis and Optimization
```
Research current best practices for bundle optimization:
1. Next.js 14 vs 15 bundle strategies
2. Tree shaking effectiveness
3. Code splitting patterns
4. Dynamic imports best practices
5. Third-party script optimization
6. Image optimization techniques
7. Font loading strategies
Include measurement tools and techniques.
```

## 8. Development Tools

### TypeScript Configuration
```
Research TypeScript configuration for Next.js projects:
1. Recommended tsconfig.json settings
2. Strict mode implications
3. Path aliasing patterns
4. Module resolution strategies
5. Type checking in build process
6. Integration with IDE features
7. Custom type definitions
Provide a production-ready configuration.
```

### Testing Setup
```
Research testing setup for Next.js + React:
1. Testing library recommendations
2. Component testing patterns
3. E2E testing tools
4. API testing strategies
5. Performance testing
6. Accessibility testing
7. CI/CD integration
Include configuration examples for each tool.
```

## 9. Deployment and Infrastructure

### Vercel Deployment
```
Research Vercel deployment for Next.js:
1. Next.js 14 vs 15 deployment differences
2. Environment variable configuration
3. Edge functions and middleware
4. ISR and on-demand revalidation
5. Analytics and monitoring
6. Custom domains and SSL
7. Cost optimization strategies
Provide deployment configuration examples.
```

### Alternative Deployment Options
```
Research non-Vercel deployment options:
1. Self-hosting with Node.js
2. Docker containerization
3. AWS/GCP/Azure deployment
4. Cloudflare Pages
5. Netlify configuration
6. Performance comparison
7. Cost analysis
Include deployment scripts and configurations.
```

## 10. Migration Strategies

### Incremental Adoption
```
Research incremental adoption strategies:
1. Gradual migration from Pages to App Router
2. Mixing Next.js versions in monorepo
3. Component library migration
4. State management migration
5. API migration patterns
6. Database migration strategies
7. Testing during migration
Provide step-by-step migration guides.
```

## Usage Instructions

When using these prompts:

1. **Version Specific**: Always specify the exact versions you're working with
2. **Date Context**: Mention the current date for latest information
3. **Production Focus**: Request production-ready, tested examples
4. **Compatibility Matrix**: Ask for compatibility tables when dealing with multiple libraries
5. **Performance Data**: Request benchmarks and performance metrics
6. **Error Handling**: Always include error handling patterns
7. **TypeScript**: Ensure TypeScript support is covered

## Example Combined Prompt

```
I'm building a production Next.js application in September 2025. Please provide:
1. A compatibility matrix for Next.js 14 vs 15 with React 18 vs 19
2. Working code examples for both versions
3. Performance implications of each choice
4. Migration path if starting with Next.js 14
5. Bundle size impacts
6. Deployment considerations
Focus on real-world production scenarios with proper error handling.
```

## Notes

- Always verify information with official documentation
- Test code examples in actual environment
- Consider maintenance and community support
- Plan for future migrations
- Document version-specific code clearly
- Keep this file updated with new research needs