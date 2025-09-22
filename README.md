# GAS-RAG - Google Apps Script RAG System

A clean, modular RAG (Retrieval-Augmented Generation) system for Google Apps Script documentation using Firecrawl v2 and Google's Gemini APIs.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Test configuration:**
   ```bash
   npm test
   ```

4. **Run pipeline:**
   ```bash
   npm run pipeline  # Full pipeline
   # OR run individual phases:
   npm run crawl     # Scrape documentation
   npm run embed     # Generate embeddings
   ```

## 📁 Project Structure

```
GAS-RAG/
├── src/
│   ├── scraper/       # Firecrawl v2 crawler
│   ├── embeddings/    # Gemini embedding generator
│   ├── storage/       # Database operations (coming soon)
│   ├── search/        # RAG search (coming soon)
│   └── utils/         # Shared utilities
├── gas-scripts/       # Google Apps Script files
├── data/              # Processed data
├── docs/              # Documentation
└── claude.md          # Quick development reference
```

## 🔑 API Keys Required

1. **Firecrawl API Key**: Already included in .env.example
2. **Google AI Studio Key**: Get free at https://aistudio.google.com/

## 💰 Costs

- **Firecrawl**: $19-83/month (3000 credits)
- **Embeddings**: FREE (Google's gemini-embedding-001)
- **RAG Search**: ~$10-30/month (Gemini 2.5 Pro)
- **Total**: ~$29-113/month

## 🛠️ Key Features

- **Clean Architecture**: Modular, no bloat, easy to maintain
- **Smart Chunking**: Optimized 450-token chunks with metadata
- **Rate Limiting**: Respects API limits with exponential backoff
- **Error Handling**: Robust retry logic and graceful failures
- **Progress Tracking**: Real-time status updates during processing

## 📊 Performance

- Crawls 500 pages in ~10 minutes
- Generates embeddings at 100 chunks/minute (free tier)
- Storage: Google Sheets (up to 5000 vectors), then Supabase

## 🔧 Configuration

Edit `.env` file for customization:

```env
CRAWL_LIMIT=500           # Max pages to crawl
CHUNK_SIZE=450            # Tokens per chunk
EMBEDDING_DIMENSIONS=768   # Vector dimensions
BATCH_SIZE=100            # Processing batch size
```

## 📈 Next Steps

After running the pipeline:

1. **Import to Google Sheets**: Use the Google Apps Script files
2. **Set up RAG search**: Implement Gemini 2.5 Pro synthesis
3. **Create UI**: Build search interface for users

## 🐛 Troubleshooting

- **401 Error**: Check Bearer prefix in Firecrawl auth header
- **429 Error**: Rate limited - wait and retry with backoff
- **No data found**: Run `npm run crawl` first
- **Memory issues**: Reduce BATCH_SIZE in .env

## 📝 License

MIT