/**
 * Test script for VectorDatabase.gs functionality
 */

// Test data for vector database operations
const testChunks = [
  {
    id: "test_chunk_1",
    content: "Google Apps Script is a cloud-based JavaScript platform that makes it easy to integrate with and automate tasks across Google products.",
    embedding: generateMockEmbedding(768),
    source_url: "https://developers.google.com/apps-script",
    component_type: "documentation",
    chunk_type: "overview",
    embedding_dimensions: 768,
    vector_norm: null, // Will be calculated
    metadata: {
      has_code: false,
      has_example: false,
      method_signature: null
    }
  },
  {
    id: "test_chunk_2",
    content: "SpreadsheetApp.create() creates a new spreadsheet and returns a Spreadsheet object.",
    embedding: generateMockEmbedding(768),
    source_url: "https://developers.google.com/apps-script/reference/spreadsheet",
    component_type: "api_reference",
    chunk_type: "method",
    embedding_dimensions: 768,
    vector_norm: null,
    metadata: {
      has_code: true,
      has_example: true,
      method_signature: "SpreadsheetApp.create(name)"
    }
  },
  {
    id: "test_chunk_3",
    content: "The PropertiesService lets you store simple data in key-value pairs scoped to one script, one user of a script, or one document in which an add-on is used.",
    embedding: generateMockEmbedding(768),
    source_url: "https://developers.google.com/apps-script/reference/properties",
    component_type: "service",
    chunk_type: "description",
    embedding_dimensions: 768,
    vector_norm: null,
    metadata: {
      has_code: false,
      has_example: true,
      method_signature: null
    }
  }
];

// Helper function to generate mock embeddings
function generateMockEmbedding(dimensions) {
  const embedding = [];
  for (let i = 0; i < dimensions; i++) {
    // Generate normalized random values
    embedding.push((Math.random() - 0.5) * 0.1);
  }
  return embedding;
}

// Test cosine similarity calculation
function testCosineSimilarity() {
  console.log("Testing cosine similarity calculation...");

  // Test with identical vectors (should return 1)
  const vec1 = [1, 0, 0];
  const vec2 = [1, 0, 0];
  const similarity1 = cosineSimilarity(vec1, vec2);
  console.log(`Identical vectors similarity: ${similarity1} (expected: 1)`);

  // Test with orthogonal vectors (should return 0)
  const vec3 = [1, 0, 0];
  const vec4 = [0, 1, 0];
  const similarity2 = cosineSimilarity(vec3, vec4);
  console.log(`Orthogonal vectors similarity: ${similarity2} (expected: 0)`);

  // Test with opposite vectors (should return -1)
  const vec5 = [1, 0, 0];
  const vec6 = [-1, 0, 0];
  const similarity3 = cosineSimilarity(vec5, vec6);
  console.log(`Opposite vectors similarity: ${similarity3} (expected: -1)`);
}

// Cosine similarity function (copy from VectorDatabase.gs for testing)
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Test data formatting for import
function testChunkFormatting() {
  console.log("\nTesting chunk data formatting...");

  testChunks.forEach((chunk, index) => {
    console.log(`\nChunk ${index + 1}:`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Content preview: ${chunk.content.substring(0, 50)}...`);
    console.log(`  Embedding length: ${chunk.embedding.length}`);
    console.log(`  Has metadata: ${chunk.metadata ? 'Yes' : 'No'}`);

    // Calculate vector norm
    const norm = Math.sqrt(
      chunk.embedding.reduce((sum, val) => sum + val * val, 0)
    );
    console.log(`  Calculated norm: ${norm.toFixed(4)}`);
  });
}

// Test search functionality
function testSearchFunctionality() {
  console.log("\nTesting search functionality...");

  // Create a query embedding
  const queryEmbedding = generateMockEmbedding(768);

  // Simulate search by calculating similarities
  const results = testChunks.map(chunk => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      id: chunk.id,
      content: chunk.content.substring(0, 100),
      similarity: similarity
    };
  });

  // Sort by similarity
  results.sort((a, b) => b.similarity - a.similarity);

  console.log("\nSearch results (sorted by similarity):");
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.id}: ${result.similarity.toFixed(4)}`);
  });
}

// Run all tests
console.log("=== Vector Database Test Suite ===\n");
testCosineSimilarity();
testChunkFormatting();
testSearchFunctionality();

// Export test data for use in Google Apps Script
console.log("\n=== Test Data for Import ===");
console.log(JSON.stringify(testChunks, null, 2));