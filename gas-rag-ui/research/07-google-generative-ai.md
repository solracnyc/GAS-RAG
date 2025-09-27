# Google Generative AI SDK v0.24.1 Research Report for Gemini 2.5 Flash Implementation

## Critical Deprecation Notice

**The @google/generative-ai v0.24.1 package is now DEPRECATED**. Google has announced an end-of-life date of **August 31, 2025**, with only critical bug fixes being provided until then. The recommended migration path is to the new unified **@google/genai** SDK, which provides full support for Gemini 2.5 Flash and modern features.

---

## 1. MODEL_INITIALIZATION

### GEMINI_2_5_FLASH_CONFIG

**Note**: Direct Gemini 2.5 Flash support is NOT available in the deprecated v0.24.1. The following shows configuration for the new @google/genai SDK:

```javascript
import { GoogleGenAI } from '@google/genai';

// Initialize with Gemini 2.5 Flash
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function initializeGemini25Flash() {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Your prompt here',
        config: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1024,
            candidateCount: 1,
            stopSequences: ['STOP', 'END'],
            presencePenalty: 0.0,
            frequencyPenalty: 0.0,
            seed: 42,
            responseMimeType: 'text/plain',

            // Gemini 2.5 specific features
            thinkingConfig: {
                thinkingBudget: 1000,
                includeThoughts: false
            }
        }
    });

    return response.text;
}
```

### API_KEY_HANDLING

```javascript
// Best practices for API key management
import { GoogleGenAI } from '@google/genai';

// Environment variable method (recommended)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Alternative: Vertex AI initialization for production
const aiVertex = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID,
    location: 'us-central1'
});
```

### SAFETY_SETTINGS

```javascript
const safetySettings = [
    {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE' // Options: BLOCK_NONE, BLOCK_ONLY_HIGH, BLOCK_MEDIUM_AND_ABOVE, BLOCK_LOW_AND_ABOVE
    },
    {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    },
    {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_LOW_AND_ABOVE'
    },
    {
        category: 'HARM_CATEGORY_CIVIC_INTEGRITY', // Additional category in new SDK
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
    }
];

// Apply safety settings
const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Your prompt',
    config: {
        safetySettings: safetySettings
    }
});
```

### GENERATION_CONFIG

```javascript
const fullGenerationConfig = {
    // Core generation parameters
    temperature: 0.7,              // 0.0-1.0, controls randomness
    topP: 0.95,                    // 0.0-1.0, nucleus sampling
    topK: 40,                      // 1-100, top-k sampling
    maxOutputTokens: 1024,         // Maximum response length
    candidateCount: 1,             // Number of response candidates
    stopSequences: ['STOP'],       // Sequences that end generation
    presencePenalty: 0.0,          // -2.0 to 2.0, penalize new topics
    frequencyPenalty: 0.0,         // -2.0 to 2.0, penalize repetition
    seed: 42,                      // For reproducible outputs
    responseMimeType: 'text/plain', // Response format (or 'application/json')
    responseSchema: null,          // JSON schema for structured output

    // Gemini 2.5 specific features
    thinkingConfig: {
        thinkingBudget: 1000,      // Tokens for internal reasoning
        includeThoughts: false      // Include reasoning in response
    },

    // System instructions
    systemInstruction: 'You are a helpful AI assistant.',

    // Caching for cost optimization
    cachedContent: null
};
```

---

## 2. EMBEDDING_GENERATION

### MODEL_NAME

Available embedding models in the SDK:
- **text-embedding-004** (768 dimensions) - Recommended for general use
- **text-embedding-005** (768 dimensions)
- **gemini-embedding-001** (3072 dimensions with MRL support)
- **embedding-001** (768 dimensions)
- **text-multilingual-embedding-002** (768 dimensions)

### BATCH_EMBED_PATTERN

```javascript
import { GoogleGenAI, TaskType } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function batchEmbedTexts(texts) {
    const embeddings = [];

    // Process in batches of 100 (below the 250 max limit for safety)
    const batchSize = 100;

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, Math.min(i + batchSize, texts.length));

        // Create embeddings for each text in parallel within batch
        const batchPromises = batch.map(async (text) => {
            const response = await ai.models.embedContent({
                model: 'text-embedding-004',
                contents: text,
                taskType: TaskType.RETRIEVAL_DOCUMENT
            });
            return response.values;
        });

        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);
    }

    return embeddings;
}

// Alternative with gemini-embedding-001 and dimension reduction
async function batchEmbedWithMRL(texts) {
    const embeddings = [];

    for (const text of texts) {
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-001',
            contents: text,
            outputDimensionality: 768 // Reduce from 3072 to 768
        });
        embeddings.push(response.values);
    }

    return embeddings;
}
```

### MAX_BATCH_SIZE

- **Maximum batch size**: 250 input texts per request
- **Maximum tokens per request**: 20,000 tokens
- **Individual text limit**: 2,048 tokens (excess silently truncated)
- **gemini-embedding-001**: Single input only per request (no batching)

### TASK_TYPES

```javascript
import { TaskType } from '@google/genai';

// Supported task types
const taskTypes = {
    SEMANTIC_SIMILARITY: 'SEMANTIC_SIMILARITY',
    CLASSIFICATION: 'CLASSIFICATION',
    CLUSTERING: 'CLUSTERING',
    RETRIEVAL_DOCUMENT: 'RETRIEVAL_DOCUMENT',
    RETRIEVAL_QUERY: 'RETRIEVAL_QUERY',
    QUESTION_ANSWERING: 'QUESTION_ANSWERING',
    FACT_VERIFICATION: 'FACT_VERIFICATION',
    CODE_RETRIEVAL_QUERY: 'CODE_RETRIEVAL_QUERY'
};

// Usage example with different task types
async function embedWithTaskType(text, taskType) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: text,
        taskType: taskType,
        title: 'Optional title for RETRIEVAL_DOCUMENT'
    });

    return response.values;
}
```

---

## 3. RATE_LIMITING

### FREE_TIER_LIMITS

```javascript
const rateLimits = {
    'gemini-2.5-flash': {
        free: {
            rpm: 10,        // Requests per minute
            tpm: 250000,    // Tokens per minute
            rpd: 250        // Requests per day
        },
        paidTier1: {
            rpm: 1000,
            tpm: 1000000,
            rpd: 10000
        },
        paidTier2: {
            rpm: 2000,
            tpm: 3000000,
            rpd: 100000
        }
    },
    'gemini-2.0-flash': {
        free: {
            rpm: 15,
            tpm: 1000000,
            rpd: 200
        }
    }
};
```

### RETRY_STRATEGY

```javascript
class RetryableGeminiClient {
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        this.maxRetries = 5;
        this.baseDelay = 1000; // 1 second
        this.maxDelay = 60000; // 60 seconds
    }

    async generateContentWithRetry(config, retryCount = 0) {
        try {
            const response = await this.ai.models.generateContent(config);
            return response;
        } catch (error) {
            if (retryCount < this.maxRetries && this.isRetryableError(error)) {
                const delay = this.calculateBackoffDelay(retryCount);
                console.log(`Rate limited. Retrying in ${delay}ms...`);
                await this.sleep(delay);
                return this.generateContentWithRetry(config, retryCount + 1);
            }
            throw error;
        }
    }

    isRetryableError(error) {
        const retryableStatuses = [429, 500, 502, 503, 504];
        return retryableStatuses.includes(error.status) ||
               error.message?.includes('rate limit') ||
               error.message?.includes('quota exceeded');
    }

    calculateBackoffDelay(attempt) {
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
        const jitteredDelay = exponentialDelay + Math.random() * 1000;
        return Math.min(jitteredDelay, this.maxDelay);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### EXPONENTIAL_BACKOFF

```javascript
class ExponentialBackoffHandler {
    constructor() {
        this.baseDelay = 1000;
        this.maxDelay = 60000;
        this.multiplier = 2;
        this.jitterRange = 1000;
    }

    async executeWithBackoff(operation, maxAttempts = 5) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxAttempts - 1) throw error;

                if (this.isRateLimitError(error)) {
                    const delay = this.getBackoffDelay(attempt, error);
                    console.log(`Attempt ${attempt + 1} failed. Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    getBackoffDelay(attemptNumber, error) {
        // Check if server provided retry-after header
        const retryAfter = this.extractRetryAfter(error);
        if (retryAfter) return retryAfter;

        // Calculate exponential backoff with jitter
        const exponentialDelay = this.baseDelay * Math.pow(this.multiplier, attemptNumber);
        const jitter = Math.random() * this.jitterRange;
        const totalDelay = exponentialDelay + jitter;

        return Math.min(totalDelay, this.maxDelay);
    }

    extractRetryAfter(error) {
        if (error.response?.headers?.['retry-after']) {
            const retryAfter = parseInt(error.response.headers['retry-after']);
            return isNaN(retryAfter) ? null : retryAfter * 1000;
        }
        return null;
    }

    isRateLimitError(error) {
        return error.status === 429 ||
               error.message?.toLowerCase().includes('rate limit');
    }
}
```

---

## 4. ERROR_CODES

### COMMON_ERRORS

```javascript
class GeminiErrorHandler {
    static handleError(error) {
        const errorHandlers = {
            429: this.handleRateLimitError,
            403: this.handleForbiddenError,
            400: this.handleBadRequestError,
            500: this.handleServerError,
            503: this.handleServiceUnavailableError
        };

        const handler = errorHandlers[error.status] || this.handleUnknownError;
        return handler(error);
    }

    static handleRateLimitError(error) {
        console.error('Rate limit exceeded (429):', error.message);
        return {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please retry with exponential backoff.',
            retryable: true,
            retryAfter: this.extractRetryAfter(error) || 60000
        };
    }

    static handleForbiddenError(error) {
        console.error('Permission denied (403):', error.message);
        return {
            code: 'PERMISSION_DENIED',
            message: 'Check API key permissions or resource access.',
            retryable: false
        };
    }

    static handleBadRequestError(error) {
        console.error('Bad request (400):', error.message);
        return {
            code: 'INVALID_REQUEST',
            message: 'Invalid request parameters. Check prompt and configuration.',
            retryable: false
        };
    }

    static handleServerError(error) {
        console.error('Server error (500):', error.message);
        return {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Temporary server issue. Retry with backoff.',
            retryable: true,
            retryAfter: 5000
        };
    }

    static handleServiceUnavailableError(error) {
        console.error('Service unavailable (503):', error.message);
        return {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Service temporarily down. Retry later.',
            retryable: true,
            retryAfter: 30000
        };
    }

    static handleUnknownError(error) {
        console.error('Unknown error:', error);
        return {
            code: 'UNKNOWN_ERROR',
            message: error.message || 'An unexpected error occurred',
            retryable: false
        };
    }

    static extractRetryAfter(error) {
        const headers = error.response?.headers;
        if (headers && headers['retry-after']) {
            const retryAfter = parseInt(headers['retry-after']);
            return isNaN(retryAfter) ? null : retryAfter * 1000;
        }
        return null;
    }
}
```

### QUOTA_EXCEEDED_HANDLING

```javascript
class QuotaManager {
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        this.quotaResetTime = null;
        this.requestCount = 0;
        this.tokenCount = 0;
    }

    async handleQuotaExceeded(error) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            errorMessage: error.message,
            status: error.status
        };

        // Log quota exceeded event
        console.error('Quota exceeded:', errorInfo);

        // Parse quota reset time if available
        const resetTime = this.parseQuotaResetTime(error);
        if (resetTime) {
            this.quotaResetTime = resetTime;
            const waitTime = resetTime.getTime() - Date.now();

            if (waitTime > 0) {
                console.log(`Quota will reset at ${resetTime.toISOString()}`);
                console.log(`Waiting ${Math.ceil(waitTime / 1000)} seconds...`);

                // Option 1: Wait until quota resets
                await new Promise(resolve => setTimeout(resolve, waitTime));

                // Option 2: Switch to backup API key or model
                // return this.switchToBackup();

                // Option 3: Queue requests for later processing
                // return this.queueRequest(request);
            }
        }

        // Implement fallback strategy
        return this.implementFallback();
    }

    parseQuotaResetTime(error) {
        // Try to extract reset time from error message
        const match = error.message?.match(/reset[s]? (?:at|in) ([\d\-T:.Z]+)/i);
        if (match) {
            return new Date(match[1]);
        }

        // Default: assume quota resets at midnight UTC
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        return tomorrow;
    }

    implementFallback() {
        // Fallback strategies
        return {
            strategy: 'QUEUE_FOR_LATER',
            message: 'Request queued due to quota limits',
            estimatedProcessingTime: this.quotaResetTime
        };
    }

    async checkQuotaBeforeRequest(estimatedTokens) {
        // Preemptive quota checking
        const limits = {
            tokensPerMinute: 250000,  // Free tier
            requestsPerMinute: 10,
            requestsPerDay: 250
        };

        if (this.tokenCount + estimatedTokens > limits.tokensPerMinute) {
            throw new Error('Would exceed token quota');
        }

        if (this.requestCount >= limits.requestsPerMinute) {
            throw new Error('Would exceed request quota');
        }
    }
}
```

---

## 5. STREAMING_SUPPORT

### GENERATE_STREAM_PATTERN

```javascript
import { GoogleGenAI } from '@google/genai';

async function streamContent() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: 'Write a detailed explanation of machine learning.',
            config: {
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        });

        let fullText = '';

        for await (const chunk of response) {
            if (chunk.text) {
                process.stdout.write(chunk.text);
                fullText += chunk.text;
            }

            // Access metadata if available
            if (chunk.usageMetadata) {
                console.log('\nTokens used:', chunk.usageMetadata.totalTokenCount);
            }
        }

        return fullText;
    } catch (error) {
        console.error('Streaming error:', error);
        throw error;
    }
}
```

### CHUNK_PROCESSING

```javascript
class StreamProcessor {
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
        this.chunkHandlers = [];
    }

    addChunkHandler(handler) {
        this.chunkHandlers.push(handler);
    }

    async processStream(config) {
        const response = await this.ai.models.generateContentStream(config);

        const processedChunks = [];
        let chunkIndex = 0;
        let accumulatedText = '';

        for await (const chunk of response) {
            // Create chunk metadata
            const chunkData = {
                index: chunkIndex++,
                text: chunk.text || '',
                timestamp: Date.now(),
                accumulated: accumulatedText
            };

            if (chunk.text) {
                accumulatedText += chunk.text;

                // Process chunk through handlers
                for (const handler of this.chunkHandlers) {
                    await handler(chunkData);
                }

                // Store processed chunk
                processedChunks.push(chunkData);
            }

            // Handle function calls in chunks
            if (chunk.functionCalls) {
                for (const funcCall of chunk.functionCalls) {
                    console.log('Function call in chunk:', funcCall.name, funcCall.args);
                }
            }

            // Check for completion
            if (chunk.candidates?.[0]?.finishReason) {
                console.log('\nStream finished:', chunk.candidates[0].finishReason);
            }
        }

        return {
            fullText: accumulatedText,
            chunks: processedChunks,
            chunkCount: chunkIndex
        };
    }
}

// Usage with custom chunk handlers
async function advancedChunkProcessing() {
    const processor = new StreamProcessor(process.env.GEMINI_API_KEY);

    // Add custom handlers
    processor.addChunkHandler(async (chunk) => {
        // Save to database
        console.log(`Chunk ${chunk.index}: ${chunk.text.length} chars`);
    });

    processor.addChunkHandler(async (chunk) => {
        // Send to WebSocket clients
        // ws.send(JSON.stringify(chunk));
    });

    const result = await processor.processStream({
        model: 'gemini-2.5-flash',
        contents: 'Generate a comprehensive guide on APIs.'
    });

    console.log(`Processed ${result.chunkCount} chunks`);
    return result;
}
```

---

## 6. TOKEN_COUNTING_METHOD

```javascript
import { GoogleGenAI } from '@google/genai';

class TokenCounter {
    constructor(apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    // Count tokens before sending request
    async countTokens(model, content) {
        try {
            const countResponse = await this.ai.models.countTokens({
                model: model,
                contents: content
            });

            return {
                totalTokens: countResponse.totalTokens,
                cachedTokens: countResponse.cachedContentTokenCount || 0
            };
        } catch (error) {
            console.error('Token counting failed:', error);
            // Fallback to estimation
            return this.estimateTokens(content);
        }
    }

    // Get token usage after generation
    async generateWithTokenTracking(config) {
        const response = await this.ai.models.generateContent(config);

        const usage = response.usageMetadata;

        return {
            text: response.text,
            tokenUsage: {
                promptTokens: usage.promptTokenCount,
                responseTokens: usage.candidatesTokenCount,
                totalTokens: usage.totalTokenCount,
                cachedTokens: usage.cachedContentTokenCount || 0
            }
        };
    }

    // Estimate tokens (fallback method)
    estimateTokens(text) {
        // Rough estimation: ~4 characters per token for English
        const estimatedTokens = Math.ceil(text.length / 4);
        return {
            totalTokens: estimatedTokens,
            isEstimate: true
        };
    }

    // Pre-flight check for large requests
    async validateTokenLimit(model, content, maxTokens = 20000) {
        const tokenCount = await this.countTokens(model, content);

        if (tokenCount.totalTokens > maxTokens) {
            throw new Error(
                `Content exceeds token limit: ${tokenCount.totalTokens} > ${maxTokens}`
            );
        }

        return tokenCount;
    }
}

// Complete usage example
async function completeTokenCountingExample() {
    const counter = new TokenCounter(process.env.GEMINI_API_KEY);

    const prompt = 'Explain quantum computing in detail.';

    // Count tokens before sending
    const inputTokens = await counter.countTokens('gemini-2.5-flash', prompt);
    console.log('Input tokens:', inputTokens.totalTokens);

    // Generate with token tracking
    const result = await counter.generateWithTokenTracking({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            maxOutputTokens: 500
        }
    });

    console.log('Response:', result.text);
    console.log('Token usage:', result.tokenUsage);

    // Calculate costs (example rates)
    const costs = {
        inputCost: (result.tokenUsage.promptTokens / 1000) * 0.001,
        outputCost: (result.tokenUsage.responseTokens / 1000) * 0.002,
        totalCost: 0
    };
    costs.totalCost = costs.inputCost + costs.outputCost;

    console.log('Estimated costs:', costs);

    return {
        response: result.text,
        tokens: result.tokenUsage,
        costs: costs
    };
}
```

---

## Migration Recommendations

Given the deprecation of @google/generative-ai v0.24.1, immediate migration to @google/genai is strongly recommended. The new SDK provides:

1. **Full Gemini 2.5 Flash support** with thinking configuration
2. **Built-in token counting** methods
3. **Enhanced streaming** capabilities
4. **Better error handling** and retry mechanisms
5. **Unified API** for both Gemini Developer and Vertex AI
6. **Active development** and feature updates

The code blocks provided above use the new @google/genai SDK syntax, which is the recommended approach for any new development or migration from the deprecated v0.24.1 version.