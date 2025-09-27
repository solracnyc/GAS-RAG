# Vercel AI SDK v5.0.56 Integration Guide for Claude Code

## 1. STREAMING_IMPLEMENTATION

### Core Import Statements

```typescript
// Essential imports for streaming
import { streamText, convertToModelMessages, UIMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { useChat } from '@ai-sdk/react'
```

### Stream Response Implementation for Next.js 15

#### Basic App Router API Route (app/api/chat/route.ts)

```typescript
import { google } from '@ai-sdk/google'
import { streamText, UIMessage, convertToModelMessages } from 'ai'

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToModelMessages(messages),
    system: 'You are a helpful assistant.'
  })

  return result.toUIMessageStreamResponse()
}
```

#### Advanced Route with Tools

```typescript
import { google } from '@ai-sdk/google'
import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai'
import { z } from 'zod'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5), // Enable multi-step tool execution
    tools: {
      weather: tool({
        description: 'Get weather information',
        inputSchema: z.object({
          location: z.string().describe('Location to get weather for')
        }),
        execute: async ({ location }) => ({
          location,
          temperature: 72,
          condition: 'sunny'
        })
      })
    },
    onFinish: ({ usage, text }) => {
      console.log('Usage:', usage)
      console.log('Final text:', text)
    }
  })

  return result.toUIMessageStreamResponse()
}
```

### Text Stream Pattern Client Component

```typescript
'use client'

import { useChat } from '@ai-sdk/react'
import { useState } from 'react'

export default function Chat() {
  const [input, setInput] = useState('')
  const { messages, sendMessage, status } = useChat({
    api: '/api/chat'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto">
      {messages.map(message => (
        <div key={message.id} className="mb-4">
          <strong>{message.role === 'user' ? 'User: ' : 'AI: '}</strong>
          {message.parts.map((part, i) => {
            if (part.type === 'text') {
              return <div key={i}>{part.text}</div>
            }
            return null
          })}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          disabled={status === 'loading'}
          className="w-full p-2 border rounded"
        />
        <button type="submit" disabled={status === 'loading'}>
          Send
        </button>
      </form>
    </div>
  )
}
```

### SSE vs WebSocket Recommendation

**Recommendation: Use SSE (Server-Sent Events)** - This is the default in v5.0.56

**Why SSE is recommended:**
- Native browser support without additional libraries
- Simpler implementation with automatic reconnection
- HTTP-compatible, works through existing infrastructure
- Serverless-friendly for Vercel deployment
- Unidirectional streaming perfect for AI text generation

**When to use WebSocket instead:**
- Bidirectional communication needed (voice chat, real-time collaboration)
- Custom binary protocols required
- Sub-second latency critical

### App Router Integration Code

```typescript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['ai']
  }
}

module.exports = nextConfig
```

## 2. GOOGLE_PROVIDER_CONFIG

### Gemini 2.5 Flash Initialization

```typescript
import { google, createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, streamText } from 'ai'

// Basic initialization (uses env var: GOOGLE_GENERATIVE_AI_API_KEY)
const model = google('gemini-2.5-flash')

// Custom initialization
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta'
})

const customModel = googleProvider('gemini-2.5-flash')
```

### Model String Options

```typescript
// Production-recommended models
const stableModel = google('gemini-2.5-flash')         // Stable release
const liteModel = google('gemini-2.5-flash-lite')      // Cost-efficient

// Latest/preview models
const latestModel = google('gemini-2.5-flash-latest')  // Points to latest stable
const previewModel = google('gemini-2.5-flash-preview-09-2025') // Latest preview
```

### Embedding Models

```typescript
// Recommended embedding model
const embeddingModel = google.textEmbedding('text-embedding-004') // 768 dimensions

// Alternative with higher dimensions
const altEmbedding = google.textEmbedding('gemini-embedding-001') // 3072 dimensions

// Usage with truncation
import { embed } from 'ai'

const { embedding } = await embed({
  model: google.textEmbedding('text-embedding-004'),
  value: 'text to embed',
  providerOptions: {
    google: {
      outputDimensionality: 512, // Optional truncation
      taskType: 'SEMANTIC_SIMILARITY' // Optimization hint
    }
  }
})
```

### Rate Limits

**Paid Tier 1 (Standard):**
- **Requests:** 300 per minute
- **Tokens:** 1,000,000 per minute

**Paid Tier 2 (After $250+ spend):**
- **Requests:** 1,000+ per minute
- **Tokens:** 2,000,000+ per minute

### Error Handling Implementation

```typescript
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

async function handleGeminiRequest(messages: UIMessage[]) {
  try {
    const result = await streamText({
      model: google('gemini-2.5-flash'),
      messages: convertToModelMessages(messages),
      providerOptions: {
        google: {
          safetySettings: [
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ],
          thinkingConfig: {
            thinkingBudget: 4096,
            includeThoughts: true
          }
        }
      }
    })

    return result.toUIMessageStreamResponse()

  } catch (error: any) {
    if (error.code === 429) {
      // Rate limit - implement exponential backoff
      await new Promise(resolve => setTimeout(resolve, 5000))
      return handleGeminiRequest(messages) // Retry
    } else if (error.code === 403) {
      throw new Error('Invalid API key or permissions')
    } else if (error.code === 400) {
      throw new Error('Invalid request parameters')
    } else {
      throw new Error(`Unexpected error: ${error.message}`)
    }
  }
}
```

## 3. EDGE_RUNTIME_COMPATIBILITY

### Supported: **YES** - Edge Runtime is fully supported

### Route Configuration

```typescript
// app/api/chat/route.ts with Edge Runtime
export const runtime = 'edge' // Enable Edge Runtime
export const maxDuration = 30

import { google } from '@ai-sdk/google'
import { streamText, convertToModelMessages } from 'ai'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToModelMessages(messages)
  })

  return result.toUIMessageStreamResponse()
}
```

### Limitations

- **No filesystem access** - Cannot read/write files
- **Web APIs only** - No Node.js-specific APIs
- **Memory constraints** - 2MB Pro, 4MB Enterprise
- **25-second initial response** - Must begin streaming within this time
- **No dynamic code execution** - No eval() or new Function()
- **ES modules only** - Use import, not require()

### Edge-Compatible Providers

```typescript
// These providers work with Edge Runtime
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

// Special Edge import for Vertex AI
import { vertex } from '@ai-sdk/google-vertex/edge'
```

## 4. BREAKING_FROM_V3_V4

### Function Renames

```typescript
// OLD (v3/v4)
convertToCoreMessages(messages)
maxTokens: 1024
providerMetadata: { openai: { store: false } }
parameters: z.object({ city: z.string() })

// NEW (v5.0.56)
convertToModelMessages(messages)       // Renamed function
maxOutputTokens: 1024                  // Renamed parameter
providerOptions: { openai: { store: false } }  // Renamed option
inputSchema: z.object({ city: z.string() })    // Renamed field
```

### Import Path Changes

```typescript
// OLD (v3/v4)
import { useChat } from 'ai/react'
import { createStreamableValue } from 'ai/rsc'

// NEW (v5.0.56)
import { useChat } from '@ai-sdk/react'
import { createStreamableValue } from '@ai-sdk/rsc'
```

### Message Structure Migration

```typescript
// OLD (v3/v4) - Simple content string
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// NEW (v5.0.56) - Parts array
interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  parts: Array<{
    type: 'text' | 'file' | 'tool-call' | 'tool-result'
    text?: string
    // ... other part-specific properties
  }>
}
```

### useChat Hook Migration

```typescript
// OLD (v3/v4)
const { messages, input, handleInputChange, handleSubmit, append } = useChat({
  api: '/api/chat',
  initialMessages: []
})

// NEW (v5.0.56)
import { useState } from 'react'
import { DefaultChatTransport } from 'ai'

const [input, setInput] = useState('')
const { messages, sendMessage } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
  messages: [] // renamed from initialMessages
})

const handleSubmit = (e) => {
  e.preventDefault()
  sendMessage({ text: input }) // replaces append
  setInput('')
}
```

### Removed Features

- `maxSteps` in client - use server-side `stopWhen: stepCountIs(5)`
- `OpenAIStream` helper - use `streamText().toUIMessageStreamResponse()`
- `StreamingTextResponse` class - use built-in response methods
- Direct `OpenAIApi` usage - use provider abstractions

### Migration Replacement Code

```typescript
// Complete migration example - OLD Route (v3/v4)
import { OpenAIStream, StreamingTextResponse } from 'ai'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const response = await openai.createChatCompletion({
    model: 'gpt-4',
    stream: true,
    messages
  })

  const stream = OpenAIStream(response)
  return new StreamingTextResponse(stream)
}

// NEW Route (v5.0.56)
import { streamText, convertToModelMessages } from 'ai'
import { google } from '@ai-sdk/google'

export const runtime = 'edge'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToModelMessages(messages)
  })

  return result.toUIMessageStreamResponse()
}
```

## Environment Setup

```bash
# .env.local
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# Installation
npm install ai@5.0.56 @ai-sdk/google@2.0.17 @ai-sdk/react@latest zod@^4.1.8
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "module": "esnext",
    "lib": ["esnext", "dom"],
    "jsx": "react-jsx"
  }
}
```

This configuration provides Claude Code with production-ready, working code examples for implementing Vercel AI SDK v5.0.56 with Gemini 2.5 Flash in a Next.js 15 App Router project.