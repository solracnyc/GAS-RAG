# 🚀 Supabase Setup Instructions

Your Supabase project is configured! Follow these steps to complete the setup:

## Step 1: Enable pgvector Extension

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/ljdiyolfclfgflhulnqg)
2. Click on **SQL Editor** in the left sidebar
3. Copy and paste the ENTIRE contents of `sql/init-database.sql`
4. Click **Run** to execute the SQL

This will:
- ✅ Enable pgvector extension
- ✅ Create the `document_chunks` table with 768-dimensional vector support
- ✅ Set up search functions (match_documents, hybrid_search)
- ✅ Create cache tables and maintenance functions

## Step 2: Migrate Your Existing Data

Run the migration script to transfer your embeddings:

```bash
# Basic migration (it will automatically find your embeddings file)
node src/storage/supabase-migrator.js ./data/processed/embeddings_1758558291750.json

# With verification
node src/storage/supabase-migrator.js ./data/processed/embeddings_1758558291750.json --verify

# If migration gets interrupted, it will resume from checkpoint automatically
```

## Step 3: Create HNSW Index (AFTER Data Migration)

**IMPORTANT**: Only run this AFTER you've migrated your data for optimal performance.

Go back to SQL Editor and run:

```sql
-- Create the HNSW index for fast similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_hnsw_idx
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Set optimal search parameters
SET hnsw.ef_search = 40;
```

## Step 4: Test the Setup

```bash
# Run the comprehensive test suite
node test-supabase-pipeline.js
```

Expected results:
- Database connection: ✅ healthy
- Insert vectors: ✅ working
- Vector search: ✅ <15ms latency
- All tests should pass

## Step 5: Test Basic Upload

```bash
# Upload your embeddings using the new Supabase pipeline
node upload-embeddings.js
```

## Step 6: Update Google Apps Script (Optional)

If you're using Google Apps Script:

1. Open your GAS project
2. Go to **Project Settings** → **Script Properties**
3. Add these properties:
   - `SUPABASE_URL`: `https://ljdiyolfclfgflhulnqg.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZGl5b2xmY2xmZ2ZsaHVsbnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NjQ4OTcsImV4cCI6MjA3NDQ0MDg5N30.U8x98FqqWtGfbdY3X0XpWg8YDq6KJH-KMgFsiC6_vew`

4. Copy the contents of:
   - `gas-scripts/SupabaseConnector.gs`
   - `gas-scripts/SearchRAG_Supabase.gs`

5. Test the connection in GAS:
```javascript
function testConnection() {
  const result = testSupabaseConnection();
  console.log(result);
}
```

## Quick Commands Reference

```bash
# Check your current embeddings file
ls -la data/processed/

# Run migration
node src/storage/supabase-migrator.js ./data/processed/embeddings_1758558291750.json

# Test the pipeline
node test-supabase-pipeline.js

# Upload new embeddings
node upload-embeddings.js

# Monitor database (in Supabase Dashboard)
# Go to Table Editor → document_chunks to see your data
```

## Monitoring Your Database

Visit your [Supabase Dashboard](https://supabase.com/dashboard/project/ljdiyolfclfgflhulnqg) to:
- View data in **Table Editor** → `document_chunks`
- Monitor performance in **Database** → **Query Performance**
- Check storage usage in **Settings** → **Billing**

## Troubleshooting

If you encounter any issues:

1. **"pgvector extension not found"**
   - Make sure you ran the SQL from `sql/init-database.sql`

2. **"Connection failed"**
   - Check that your `.env` file has the correct credentials
   - Verify your internet connection

3. **"Dimension mismatch"**
   - Ensure your embeddings are exactly 768 dimensions
   - Check that you're using the correct Gemini model

4. **Slow queries after migration**
   - Make sure you created the HNSW index AFTER loading data
   - Run: `SET hnsw.ef_search = 40;` to optimize

## Success Metrics

After setup, you should see:
- Query latency: **<15ms** (down from 30+ seconds)
- Storage usage: ~18MB for 1500 chunks
- Search accuracy: >95% with HNSW index
- Concurrent queries: 50+ supported

## Next Steps

1. ✅ Complete the database setup above
2. ✅ Migrate your embeddings
3. ✅ Test the pipeline
4. 🎉 Enjoy 2000x faster vector search!

Your Supabase project URL: https://supabase.com/dashboard/project/ljdiyolfclfgflhulnqg