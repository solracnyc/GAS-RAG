# Migration Guide: Google Sheets → Supabase pgvector

## 🚀 Quick Start

This guide will help you migrate from the Google Sheets vector storage to Supabase pgvector for dramatically improved performance (from ~30s to <15ms queries).

## Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Node.js**: Version 18+ installed
3. **Existing embeddings**: JSON file with your document embeddings

## Step 1: Set Up Supabase Project

### 1.1 Create New Project
1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose project name and database password
4. Select region closest to your users
5. Wait for project to be provisioned (~2 minutes)

### 1.2 Get API Credentials
1. Go to Settings → API
2. Copy:
   - **Project URL**: `https://[project-id].supabase.co`
   - **Anon/Public Key**: Long JWT token starting with `eyJ...`

### 1.3 Enable pgvector Extension
1. Go to SQL Editor
2. Run the initialization script:
```bash
# Run this command to initialize your database:
psql -f sql/init-database.sql
```

Or manually paste and run the SQL from `sql/init-database.sql` in the SQL Editor.

## Step 2: Configure Environment

### 2.1 Update .env file
```bash
# Add your Supabase credentials
SUPABASE_URL=https://[your-project-id].supabase.co
SUPABASE_ANON_KEY=eyJ[your-anon-key]...
```

### 2.2 Install Dependencies
```bash
npm install @supabase/supabase-js
```

## Step 3: Migrate Your Data

### 3.1 Using the Migration Script
```bash
# Basic migration
node src/storage/supabase-migrator.js ./data/processed/embeddings_*.json

# With options
node src/storage/supabase-migrator.js ./data/processed/embeddings_*.json --batch-size 25 --verify

# Resume from checkpoint (if migration was interrupted)
node src/storage/supabase-migrator.js ./data/processed/embeddings_*.json
```

### 3.2 Direct Upload (Alternative)
```bash
# Use the updated upload script
node upload-embeddings.js ./data/processed/embeddings_*.json
```

## Step 4: Verify Migration

### 4.1 Run Test Suite
```bash
node test-supabase-pipeline.js
```

Expected output:
```
✅ Database Connection: healthy
✅ Database Statistics: 1500+ chunks
✅ Vector Search: <15ms latency
✅ All tests passed!
```

### 4.2 Check Supabase Dashboard
1. Go to Table Editor → `document_chunks`
2. Verify row count matches your chunks
3. Check a few rows to ensure embeddings are stored correctly

## Step 5: Create HNSW Index (After Data Load)

**IMPORTANT**: Only create the index AFTER loading your data for optimal performance.

```sql
-- Run this in SQL Editor after migration
CREATE INDEX documents_embedding_hnsw_idx ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Set runtime parameters
SET hnsw.ef_search = 40;
```

## Step 6: Update Google Apps Script

### 6.1 Add Supabase Credentials to Script Properties
1. Open your Google Apps Script project
2. Go to Project Settings → Script Properties
3. Add:
   - `SUPABASE_URL`: Your project URL
   - `SUPABASE_ANON_KEY`: Your anon key

### 6.2 Deploy New GAS Files
1. Copy `gas-scripts/SupabaseConnector.gs` to your GAS project
2. Copy `gas-scripts/SearchRAG_Supabase.gs` to your GAS project
3. Update `WebApp.gs` to use Supabase instead of Sheets

### 6.3 Test GAS Integration
```javascript
// Run this in GAS Script Editor
function testSupabaseIntegration() {
  const result = testSupabaseConnection();
  console.log(result);
}
```

## Step 7: Update Your Application

### 7.1 Node.js/JavaScript Applications
```javascript
const SupabaseVectorClient = require('./src/storage/supabase-client');

// Initialize client
const client = new SupabaseVectorClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Search vectors
const results = await client.similaritySearch(queryEmbedding, {
  matchThreshold: 0.8,
  matchCount: 10
});
```

### 7.2 With Semantic Caching
```javascript
const { SemanticCache } = require('./src/storage/semantic-cache');

// Initialize cache
const cache = new SemanticCache({
  similarityThreshold: 0.95,
  maxCacheSize: 100
});

// Use with searches
const cached = await cache.get(queryEmbedding);
if (!cached) {
  const results = await client.similaritySearch(queryEmbedding);
  cache.set(queryEmbedding, results);
}
```

## Performance Comparison

| Metric | Google Sheets | Supabase pgvector | Improvement |
|--------|---------------|-------------------|-------------|
| Query Latency | 21-46s | 5-15ms | **2000x faster** |
| Max Vectors | 5,000 | 1,000,000+ | **200x more** |
| Concurrent Queries | 1-2 | 50+ | **25x better** |
| Storage Cost | Free (limited) | Free tier: 500MB | Scalable |
| Query Cost | Free (slow) | Free tier: 50K/month | Efficient |

## Troubleshooting

### Common Issues

#### 1. "pgvector extension not found"
```sql
-- Enable extension as superuser
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2. "Dimension mismatch error"
- Ensure all embeddings are exactly 768 dimensions
- Check your embedding generation uses `outputDimensionality: 768`

#### 3. "Connection timeout"
- Check firewall/network settings
- Verify Supabase URL and key are correct
- Try increasing timeout in client options

#### 4. "Slow queries after migration"
- Create HNSW index if not done
- Adjust `ef_search` parameter:
```sql
SET hnsw.ef_search = 40; -- Balance speed/accuracy
```

#### 5. "Out of memory during migration"
- Reduce batch size: `--batch-size 10`
- Use checkpoint feature to resume

### Performance Tuning

#### Index Optimization
```sql
-- For highest accuracy (slower)
SET hnsw.ef_search = 100;

-- For fastest speed (lower accuracy)
SET hnsw.ef_search = 20;

-- Recommended balance
SET hnsw.ef_search = 40;
```

#### Query Optimization
```javascript
// Pre-filter to reduce search space
const results = await client.similaritySearch(embedding, {
  matchThreshold: 0.8,  // Higher = fewer, better results
  matchCount: 10,        // Limit results
  filter: {
    'metadata.component_type': 'documentation'
  }
});
```

## Monitoring & Maintenance

### Database Statistics
```bash
# Check database health
node test-supabase-pipeline.js

# Get detailed stats
const stats = await client.getDatabaseStats();
console.log(stats);
```

### Regular Maintenance
```sql
-- Update statistics weekly
ANALYZE document_chunks;

-- Check index bloat monthly
SELECT pg_size_pretty(pg_relation_size('documents_embedding_hnsw_idx'));

-- Rebuild index if needed (>2x expected size)
REINDEX INDEX documents_embedding_hnsw_idx;
```

## Rollback Plan

If you need to rollback to Google Sheets:

1. Keep Google Sheets Web App deployed
2. Update `.env` to use old `SHEETS_WEBAPP_URL`
3. Switch imports back to sheets version:
```javascript
// Replace
const client = new SupabaseVectorClient(...);
// With
const uploadToSheets = require('./upload-embeddings-sheets');
```

## Next Steps

1. **Monitor Performance**: Use the test suite to track query latencies
2. **Optimize Queries**: Adjust similarity thresholds based on your data
3. **Scale as Needed**: Upgrade Supabase plan when you exceed free tier
4. **Add Features**:
   - Implement hybrid search (vector + text)
   - Add user-specific vector spaces
   - Build real-time updates with Supabase subscriptions

## Support & Resources

- **Supabase Documentation**: [docs.supabase.com](https://docs.supabase.com)
- **pgvector Guide**: [github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- **Project Issues**: Report bugs in this repository's Issues section

## Success Checklist

- [ ] Supabase project created
- [ ] pgvector extension enabled
- [ ] Database schema created
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Data migrated successfully
- [ ] HNSW index created
- [ ] Tests passing (<15ms queries)
- [ ] GAS integration working
- [ ] Application updated

Congratulations! Your RAG system is now powered by Supabase pgvector! 🎉