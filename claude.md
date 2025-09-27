# GAS-RAG Quick Reference

## Project Overview
Google Apps Script RAG system using Firecrawl v2 + Gemini APIs to create searchable documentation.

## Architecture
```
Firecrawl v2 → Chunking → Gemini Embeddings → Google Sheets → RAG Search
                                                      ↓
                                              Supabase (at scale)
```

## Key APIs & Costs
- **Firecrawl v2**: $19-83/month (3000 credits)
- **Gemini Embeddings**: FREE (gemini-embedding-001)
- **Gemini 2.5 Flash**: Optimized for speed and cost-effectiveness
- **Total**: ~$29-113/month

## Project Structure
```
src/
├── scraper/      # Firecrawl crawling
├── embeddings/   # Vector generation
├── storage/      # Database operations
├── search/       # RAG synthesis
└── utils/        # Shared utilities
```

## Core Commands
```bash
# Install dependencies
npm install

# Run full pipeline
npm run pipeline

# Individual phases
npm run crawl        # Scrape docs
npm run embed        # Generate vectors
npm run import       # Import to Sheets
npm run search       # Test search
```

## API Keys Required
1. **Firecrawl**: `fc-5943273419d64489856281e51838a24e`
2. **Google AI Studio**: Get from https://aistudio.google.com/

## Key Technical Specs
- **Chunk Size**: 450 tokens (15% overlap)
- **Embeddings**: 768 dimensions
- **Storage Limit**: 5000 vectors in Sheets
- **Context Window**: 1M tokens (Gemini 2.5 Flash)

## Development Phases
1. **Setup**: API keys, project structure
2. **Crawl**: Scrape 500 pages with structured extraction
3. **Chunk**: Smart splitting with metadata
4. **Embed**: Generate vectors (rate limited)
5. **Store**: Google Sheets initially
6. **Search**: RAG with Gemini 2.5 Flash

## Performance Thresholds
- Migrate to Supabase when:
  - Vectors > 5000
  - File size > 8MB
  - Query time > 10s

## Error Handling
- Rate limiting: Exponential backoff
- Timeout: 5-minute search continuation
- Memory: Process in 100-item batches

## Testing Endpoints
```javascript
// Test crawl status
GET https://api.firecrawl.dev/v2/crawl/{crawlId}

// Test embeddings
POST https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent

// Test RAG synthesis
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent
```

## Quick Troubleshooting
1. **401 Error**: Check Bearer prefix in auth header
2. **429 Error**: Implement backoff (5s * 2^attempt)
3. **Timeout**: Use continuation for long searches
4. **Memory**: Reduce batch size to 50

## Cost Optimization
- Use context caching (75% reduction)
- Batch API for 50% discount
- Disable thinking mode for simple queries
- Cache frequent embeddings (6hr TTL)