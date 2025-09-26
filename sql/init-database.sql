-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Main table for storing document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Document metadata
    document_id TEXT NOT NULL,
    document_title TEXT,
    document_url TEXT,

    -- Chunk data
    chunk_content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_tokens INTEGER,

    -- 768-dimensional vector for Gemini embeddings
    embedding vector(768) NOT NULL,

    -- Flexible metadata storage
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint on document_id and chunk_index
    CONSTRAINT unique_document_chunk UNIQUE(document_id, chunk_index)
);

-- Create index on document_id for faster lookups
CREATE INDEX idx_document_id ON document_chunks(document_id);

-- Create index on document_url for URL-based queries
CREATE INDEX idx_document_url ON document_chunks(document_url);

-- Create GIN index on metadata for JSON queries
CREATE INDEX idx_metadata ON document_chunks USING GIN (metadata);

-- Create index on created_at for time-based queries
CREATE INDEX idx_created_at ON document_chunks(created_at DESC);

-- HNSW index for vector similarity search (create AFTER data insertion)
-- Uncomment this after initial data load:
-- CREATE INDEX documents_embedding_hnsw_idx ON document_chunks
-- USING hnsw (embedding vector_cosine_ops)
-- WITH (m = 16, ef_construction = 64);

-- Function for similarity search with cosine distance
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.8,
    match_count int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    chunk_content TEXT,
    document_title TEXT,
    document_url TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE SQL
AS $$
    SELECT
        id,
        chunk_content,
        document_title,
        document_url,
        metadata,
        1 - (embedding <=> query_embedding) AS similarity
    FROM document_chunks
    WHERE 1 - (embedding <=> query_embedding) > match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Function for hybrid search combining vector and text search
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 10,
    vector_weight float DEFAULT 0.7,
    text_weight float DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    chunk_content TEXT,
    document_title TEXT,
    document_url TEXT,
    metadata JSONB,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            dc.id,
            dc.chunk_content,
            dc.document_title,
            dc.document_url,
            dc.metadata,
            (1 - (dc.embedding <=> query_embedding)) * vector_weight AS vector_score
        FROM document_chunks dc
        WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
        ORDER BY dc.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    text_results AS (
        SELECT
            dc.id,
            dc.chunk_content,
            dc.document_title,
            dc.document_url,
            dc.metadata,
            ts_rank(to_tsvector('english', dc.chunk_content), plainto_tsquery('english', query_text)) * text_weight AS text_score
        FROM document_chunks dc
        WHERE to_tsvector('english', dc.chunk_content) @@ plainto_tsquery('english', query_text)
        ORDER BY text_score DESC
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT
            COALESCE(v.id, t.id) AS id,
            COALESCE(v.chunk_content, t.chunk_content) AS chunk_content,
            COALESCE(v.document_title, t.document_title) AS document_title,
            COALESCE(v.document_url, t.document_url) AS document_url,
            COALESCE(v.metadata, t.metadata) AS metadata,
            COALESCE(v.vector_score, 0) + COALESCE(t.text_score, 0) AS combined_score
        FROM vector_results v
        FULL OUTER JOIN text_results t ON v.id = t.id
    )
    SELECT * FROM combined
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- Function to get database statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
    total_documents BIGINT,
    total_chunks BIGINT,
    avg_chunk_tokens FLOAT,
    total_storage_mb FLOAT,
    index_size_mb FLOAT,
    oldest_document TIMESTAMPTZ,
    newest_document TIMESTAMPTZ
)
LANGUAGE SQL
AS $$
    SELECT
        COUNT(DISTINCT document_id) AS total_documents,
        COUNT(*) AS total_chunks,
        AVG(chunk_tokens) AS avg_chunk_tokens,
        pg_size_pretty(pg_total_relation_size('document_chunks'))::text AS total_storage_mb,
        pg_size_pretty(pg_indexes_size('document_chunks'))::text AS index_size_mb,
        MIN(created_at) AS oldest_document,
        MAX(created_at) AS newest_document
    FROM document_chunks;
$$;

-- Function to clean up old chunks
CREATE OR REPLACE FUNCTION cleanup_old_chunks(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM document_chunks
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_document_chunks_updated_at
    BEFORE UPDATE ON document_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Table for caching frequently used queries
CREATE TABLE IF NOT EXISTS query_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_embedding vector(768) NOT NULL,
    query_text TEXT,
    result_ids UUID[] NOT NULL,
    result_scores FLOAT[] NOT NULL,
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '6 hours')
);

-- Index for cache lookups
CREATE INDEX idx_cache_embedding ON query_cache
USING hnsw (query_embedding vector_cosine_ops)
WITH (m = 8, ef_construction = 32);

-- Index for cache expiration
CREATE INDEX idx_cache_expires ON query_cache(expires_at);

-- Function to check and update cache
CREATE OR REPLACE FUNCTION check_query_cache(
    query_embedding vector(768),
    similarity_threshold float DEFAULT 0.95
)
RETURNS TABLE (
    result_ids UUID[],
    result_scores FLOAT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    cache_id UUID;
BEGIN
    -- Find similar cached query
    SELECT qc.id INTO cache_id
    FROM query_cache qc
    WHERE 1 - (qc.query_embedding <=> query_embedding) > similarity_threshold
    AND qc.expires_at > NOW()
    ORDER BY qc.query_embedding <=> query_embedding
    LIMIT 1;

    IF cache_id IS NOT NULL THEN
        -- Update hit count and last accessed
        UPDATE query_cache
        SET hit_count = hit_count + 1,
            last_accessed = NOW()
        WHERE id = cache_id;

        -- Return cached results
        RETURN QUERY
        SELECT qc.result_ids, qc.result_scores
        FROM query_cache qc
        WHERE qc.id = cache_id;
    END IF;

    RETURN;
END;
$$;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM query_cache
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Create policies for Row Level Security (optional, enable if needed)
-- ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;