# GAS-RAG - Google Apps Script RAG System with Supabase pgvector

A high-performance RAG (Retrieval-Augmented Generation) system for Google Apps Script documentation using Firecrawl, Gemini APIs, and Supabase pgvector for ultra-fast vector search.

## 🚀 Key Features

- **2000x Faster Search**: Migrated from Google Sheets (30s) to Supabase pgvector (<15ms)
- **Scalable Vector Storage**: Support for 1M+ vectors with 768-dimensional embeddings
- **Smart Caching**: Semantic cache layer for frequent queries
- **Production Ready**: Comprehensive error handling, retry logic, and monitoring
- **Hybrid Architecture**: Works with both Google Apps Script and Node.js

## 📊 Performance Metrics

| Feature | Performance | Improvement |
|---------|------------|-------------|
| Query Latency | <15ms | 2000x faster |
| Vector Capacity | 1M+ | 200x more |
| Concurrent Queries | 50+ | 25x better |
| Storage Efficiency | 18MB/1500 chunks | Optimized |

## 🛠️ Technology Stack

- **Vector Database**: Supabase pgvector with HNSW indexing
- **Embeddings**: Google Gemini embedding-001 (768-dimensional)
- **Web Scraping**: Firecrawl v2 API
- **RAG Synthesis**: Gemini 2.5 Flash (gemini-2.5-flash-preview-09-2025)
- **Runtime**: Node.js 18+ / Google Apps Script

## 📁 Project Structure

```
GAS-RAG/
├── src/
│   ├── scraper/           # Firecrawl web scraper
│   ├── embeddings/        # Gemini embedding generator
│   ├── storage/           # Supabase vector storage
│   │   ├── supabase-client.js      # Production client with retry logic
│   │   ├── supabase-migrator.js    # Migration tool
│   │   └── semantic-cache.js       # Query caching
│   └── utils/             # Shared utilities
├── gas-scripts/           # Google Apps Script files
│   ├── SupabaseConnector.gs        # Supabase bridge
│   └── SearchRAG_Supabase.gs       # RAG search
├── scripts/
│   ├── migration/         # Data migration scripts
│   └── testing/           # Test suites
├── sql/                   # Database schemas
├── docs/                  # Documentation
└── data/                  # Processed embeddings
```

## 🚀 Quick Start

### Prerequisites

1. **Node.js 18+** installed
2. **Supabase account** (free tier works)
3. **API Keys**:
   - Firecrawl API key (for scraping)
   - Google AI Studio key (for embeddings)
   - Supabase project credentials

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/GAS-RAG.git
cd GAS-RAG

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the database initialization:
```bash
# In Supabase SQL Editor, run:
sql/init-database.sql
```

### Data Pipeline

```bash
# 1. Crawl documentation
npm run crawl

# 2. Generate embeddings
npm run embed

# 3. Upload to Supabase
node scripts/migration/upload-to-supabase.js

# 4. Test the system
node scripts/testing/test-supabase-pipeline.js
```

## 📝 Configuration

### Environment Variables

```env
# Firecrawl API
FIRECRAWL_API_KEY=fc-your-api-key

# Google AI (for embedding-001 and gemini-2.5-flash-preview-09-2025)
GOOGLE_AI_KEY=AIza-your-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ-your-anon-key

# Processing
CHUNK_SIZE=450
EMBEDDING_DIMENSIONS=768
BATCH_SIZE=50
```

### Package Scripts

```json
{
  "scripts": {
    "pipeline": "node src/index.js",
    "crawl": "node src/scraper/crawler.js",
    "embed": "node src/embeddings/generator.js",
    "migrate": "node src/storage/supabase-migrator.js",
    "upload": "node scripts/migration/upload-to-supabase.js",
    "test": "node scripts/testing/test-supabase-pipeline.js"
  }
}
```

## 🔍 Usage Examples

### JavaScript/Node.js

```javascript
const SupabaseVectorClient = require('./src/storage/supabase-client');

// Initialize client
const client = new SupabaseVectorClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Search for similar documents
const results = await client.similaritySearch(queryEmbedding, {
  matchThreshold: 0.8,
  matchCount: 10
});

// Hybrid search (vector + text)
const hybridResults = await client.hybridSearch(
  "How to create spreadsheets",
  queryEmbedding
);
```

### Google Apps Script

```javascript
// Initialize connector
const connector = getSupabaseConnector();

// Search vectors
const results = connector.searchVectors(queryEmbedding, {
  matchThreshold: 0.75,
  matchCount: 5
});

// RAG search with synthesis
const answer = searchWithSupabaseRAG("How to send emails?");
```

## 🎯 Migration from Google Sheets

If you're migrating from the old Google Sheets storage:

```bash
# 1. Export existing data (if needed)
node scripts/migration/export-sheets-data.js

# 2. Run migration
node src/storage/supabase-migrator.js ./data/processed/embeddings_*.json

# 3. Verify migration
node scripts/testing/test-supabase-pipeline.js
```

See [docs/MIGRATION_GUIDE.md](docs/MIGRATION_GUIDE.md) for detailed instructions.

## 📊 Performance Optimization

### Index Configuration

```sql
-- HNSW index for optimal performance
CREATE INDEX documents_embedding_hnsw_idx ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Runtime tuning
SET hnsw.ef_search = 40; -- Balance speed/accuracy
```

### Caching Strategy

```javascript
const { SemanticCache } = require('./src/storage/semantic-cache');

const cache = new SemanticCache({
  similarityThreshold: 0.95,
  maxCacheSize: 100,
  ttl: 300000 // 5 minutes
});
```

## 🧪 Testing

```bash
# Run comprehensive test suite
npm test

# Test specific components
node scripts/testing/test-supabase-pipeline.js
node scripts/testing/test-vector-search.js
node scripts/testing/test-rag-synthesis.js
```

## 📈 Monitoring

### Health Check

```javascript
const health = await client.healthCheck();
console.log(health);
// { status: 'healthy', latency: '12ms', documentCount: 1500 }
```

### Database Statistics

```javascript
const stats = await client.getDatabaseStats();
console.log(stats);
// { total_documents: 500, total_chunks: 1500, storage_mb: 18 }
```

## 🔒 Security

- API keys stored in environment variables
- Row Level Security (RLS) ready
- Secure connection to Supabase
- No credentials in code

## 📚 Documentation

- [Supabase Setup Guide](docs/SUPABASE_SETUP.md)
- [Migration Guide](docs/MIGRATION_GUIDE.md)
- [API Reference](docs/API.md)
- [Performance Tuning](docs/PERFORMANCE.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for the vector database
- [Google AI](https://ai.google) for Gemini embeddings
- [Firecrawl](https://firecrawl.dev) for web scraping
- [pgvector](https://github.com/pgvector/pgvector) for vector similarity search

## 📞 Support

- Create an issue in this repository
- Check [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- Review the [FAQ](docs/FAQ.md)

---

Built with ❤️ for the Google Apps Script community. Now with blazing-fast vector search! 🚀