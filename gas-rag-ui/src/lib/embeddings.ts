const { GoogleGenerativeAI } = require('@google/genai');

// Initialize the Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

// Model configuration
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'models/embedding-001';
const EMBEDDING_DIMENSIONS = parseInt(process.env.NEXT_PUBLIC_EMBEDDING_DIMENSIONS || '768');

// Task types for embeddings
export enum EmbeddingTaskType {
  RETRIEVAL_QUERY = 'RETRIEVAL_QUERY',
  RETRIEVAL_DOCUMENT = 'RETRIEVAL_DOCUMENT',
  SEMANTIC_SIMILARITY = 'SEMANTIC_SIMILARITY',
  CLASSIFICATION = 'CLASSIFICATION',
  CLUSTERING = 'CLUSTERING',
}

// Generate embedding for a query
export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = EmbeddingTaskType.RETRIEVAL_QUERY
): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    });

    return result.embedding.values;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw new Error('Embedding generation failed');
  }
}

// Batch embedding generation with rate limiting
export async function generateBatchEmbeddings(
  texts: string[],
  taskType: EmbeddingTaskType = EmbeddingTaskType.RETRIEVAL_DOCUMENT,
  batchSize: number = 10
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const batchEmbeddings = await Promise.all(
      batch.map(async (text) => {
        try {
          const result = await model.embedContent({
            content: { parts: [{ text }] },
            taskType,
            outputDimensionality: EMBEDDING_DIMENSIONS,
          });
          return result.embedding.values;
        } catch (error) {
          console.error(`Failed to embed text at index ${i}:`, error);
          return new Array(EMBEDDING_DIMENSIONS).fill(0); // Return zero vector on error
        }
      })
    );

    embeddings.push(...batchEmbeddings);

    // Rate limiting: 100 RPM for free tier
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  return embeddings;
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}