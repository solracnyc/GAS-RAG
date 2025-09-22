/**
 * Google Apps Script Vector Database for GAS-RAG
 * Sets up Google Sheets as a vector storage system
 */

// Configuration
const CONFIG = {
  EMBEDDING_DIMENSIONS: 768,
  BATCH_SIZE: 100,
  MAX_VECTORS: 5000,
  CACHE_DURATION: 21600 // 6 hours
};

/**
 * Initialize a new vector database spreadsheet
 */
function setupVectorDatabase() {
  const ss = SpreadsheetApp.create('GAS Documentation Vectors');
  const sheet = ss.getActiveSheet();
  sheet.setName('Vectors');

  // Set up headers
  const headers = [
    'Chunk_ID',
    'Content_Preview',
    'Full_Content',
    'Embedding_JSON',
    'Source_URL',
    'Component_Type',
    'Chunk_Type',
    'Method_Signature',
    'Has_Code',
    'Has_Example',
    'Embedding_Dimensions',
    'Vector_Norm',
    'Processing_Time_MS',
    'Created_At'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format headers
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  sheet.setFrozenRows(1);

  // Create metadata sheet
  const metaSheet = ss.insertSheet('Metadata');
  metaSheet.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Updated']]);
  metaSheet.appendRow(['Total_Chunks', 0, new Date()]);
  metaSheet.appendRow(['Last_Update', new Date(), new Date()]);
  metaSheet.appendRow(['Embedding_Model', 'gemini-embedding-001', new Date()]);
  metaSheet.appendRow(['Vector_Dimensions', CONFIG.EMBEDDING_DIMENSIONS, new Date()]);

  // Create cache sheet
  const cacheSheet = ss.insertSheet('Cache');
  cacheSheet.getRange(1, 1, 1, 4).setValues([['Query', 'Result', 'Timestamp', 'Hit_Count']]);

  // Store the spreadsheet ID in script properties
  PropertiesService.getScriptProperties().setProperty('VECTOR_DB_ID', ss.getId());

  Logger.log(`Vector database created: ${ss.getUrl()}`);
  return ss.getUrl();
}

/**
 * Import chunks from external source (called via Web App)
 */
function importChunks(chunks) {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('VECTOR_DB_ID')
  );
  const sheet = ss.getSheetByName('Vectors');

  const rows = [];
  const timestamp = new Date();

  chunks.forEach(chunk => {
    // Calculate vector norm for optimization
    const embedding = JSON.parse(chunk.embedding);
    const vectorNorm = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    rows.push([
      chunk.id,
      chunk.content.substring(0, 200) + '...',
      chunk.content,
      JSON.stringify(embedding),
      chunk.metadata.source_url,
      chunk.metadata.component_type || '',
      chunk.metadata.chunk_type,
      chunk.metadata.method_signature || '',
      chunk.metadata.has_code ? 'TRUE' : 'FALSE',
      chunk.metadata.has_example ? 'TRUE' : 'FALSE',
      CONFIG.EMBEDDING_DIMENSIONS,
      vectorNorm,
      0,
      timestamp
    ]);
  });

  // Append in batches
  if (rows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, 14).setValues(rows);

    // Update metadata
    updateMetadata(ss, rows.length);
  }

  return {
    imported: rows.length,
    total: sheet.getLastRow() - 1
  };
}

/**
 * Search for similar vectors
 */
function searchVectors(queryEmbedding, topK = 10) {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('VECTOR_DB_ID')
  );
  const sheet = ss.getSheetByName('Vectors');

  // Check cache first
  const cachedResult = checkCache(ss, JSON.stringify(queryEmbedding));
  if (cachedResult) return cachedResult;

  const data = sheet.getDataRange().getValues();
  const results = [];

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[3]) { // Has embedding
      try {
        const docEmbedding = JSON.parse(row[3]);
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding);

        if (similarity > 0.5) {
          results.push({
            id: row[0],
            content: row[2],
            similarity: similarity,
            sourceUrl: row[4],
            componentType: row[5],
            methodSignature: row[7]
          });
        }
      } catch (e) {
        Logger.log(`Error processing row ${i}: ${e.message}`);
      }
    }
  }

  // Sort and get top K
  const topResults = results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  // Cache results
  cacheResults(ss, JSON.stringify(queryEmbedding), topResults);

  return topResults;
}

/**
 * Calculate cosine similarity between two vectors
 */
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

/**
 * Update metadata
 */
function updateMetadata(ss, addedChunks) {
  const metaSheet = ss.getSheetByName('Metadata');
  const currentTotal = metaSheet.getRange('B2').getValue();
  metaSheet.getRange('B2').setValue(currentTotal + addedChunks);
  metaSheet.getRange('B3').setValue(new Date());
  metaSheet.getRange('C2:C3').setValue(new Date());
}

/**
 * Cache functions
 */
function checkCache(ss, queryKey) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(queryKey);
  return cached ? JSON.parse(cached) : null;
}

function cacheResults(ss, queryKey, results) {
  const cache = CacheService.getScriptCache();
  cache.put(queryKey, JSON.stringify(results), CONFIG.CACHE_DURATION);
}

/**
 * Get database statistics
 */
function getDatabaseStats() {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('VECTOR_DB_ID')
  );
  const vectorSheet = ss.getSheetByName('Vectors');
  const metaSheet = ss.getSheetByName('Metadata');

  return {
    totalVectors: vectorSheet.getLastRow() - 1,
    lastUpdate: metaSheet.getRange('B3').getValue(),
    dimensions: CONFIG.EMBEDDING_DIMENSIONS,
    spreadsheetUrl: ss.getUrl()
  };
}