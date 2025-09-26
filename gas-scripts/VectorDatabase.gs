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
  console.log(`Starting import of ${chunks.length} chunks at ${new Date()}`);

  try {
    const vectorDbId = PropertiesService.getScriptProperties().getProperty('VECTOR_DB_ID');
    if (!vectorDbId) {
      throw new Error('VECTOR_DB_ID not found in Script Properties');
    }

    const ss = SpreadsheetApp.openById(vectorDbId);
    console.log(`Spreadsheet opened: ${ss.getName()}`);

    const sheet = ss.getSheetByName('Vectors');
    if (!sheet) {
      throw new Error('Vectors sheet not found');
    }

    const initialRowCount = sheet.getLastRow();
    console.log(`Sheet accessed: ${sheet.getName()}, current rows: ${initialRowCount}`);

    const rows = [];
    const timestamp = new Date();
    let processedCount = 0;
    let errorCount = 0;

    chunks.forEach((chunk, index) => {
      try {
        // Log every 10th chunk for visibility
        if (index % 10 === 0) {
          console.log(`Processing chunk ${index}/${chunks.length}: ${chunk.id}`);
        }

        // Handle embedding whether it's already an array or needs parsing
        let embedding;
        try {
          embedding = Array.isArray(chunk.embedding)
            ? chunk.embedding
            : JSON.parse(chunk.embedding);
        } catch (parseError) {
          console.error(`Failed to parse embedding for chunk ${chunk.id}:`, parseError.toString());
          errorCount++;
          return; // Skip this chunk
        }

        // Validate embedding dimensions
        if (!embedding || embedding.length !== CONFIG.EMBEDDING_DIMENSIONS) {
          console.error(`Invalid embedding dimensions for chunk ${chunk.id}: ${embedding ? embedding.length : 'null'}`);
          errorCount++;
          return;
        }

        // Use pre-calculated norm if available, otherwise calculate
        const vectorNorm = chunk.vector_norm || Math.sqrt(
          embedding.reduce((sum, val) => sum + val * val, 0)
        );

        rows.push([
          chunk.id,
          chunk.content.substring(0, 200) + '...',
          chunk.content,
          JSON.stringify(embedding),
          chunk.metadata?.source_url || chunk.source_url || '',
          chunk.metadata?.component_type || chunk.component_type || '',
          chunk.metadata?.chunk_type || chunk.chunk_type || '',
          chunk.metadata?.method_signature || '',
          chunk.metadata?.has_code ? 'TRUE' : 'FALSE',
          chunk.metadata?.has_example ? 'TRUE' : 'FALSE',
          chunk.embedding_dimensions || CONFIG.EMBEDDING_DIMENSIONS,
          vectorNorm,
          0,
          timestamp
        ]);

        processedCount++;
      } catch (chunkError) {
        console.error(`Failed to process chunk ${index}:`, chunkError.toString());
        errorCount++;
      }
    });

    console.log(`Processed ${processedCount} chunks successfully, ${errorCount} errors`);

    // Append in batches
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, 14).setValues(rows);

      // CRITICAL: Force data commit to prevent phantom data loss
      SpreadsheetApp.flush();
      console.log(`Flushed ${rows.length} rows to sheet`);

      // Verify write by reading back the last row
      const finalRowCount = sheet.getLastRow();
      const expectedFinalCount = initialRowCount + rows.length;

      if (finalRowCount === expectedFinalCount) {
        console.log(`✓ Write verification successful: ${finalRowCount} total rows`);

        // Read back last written chunk for additional verification
        const lastWrittenRow = sheet.getRange(finalRowCount, 1, 1, 14).getValues()[0];
        console.log(`✓ Last chunk ID verified: ${lastWrittenRow[0]}`);
      } else {
        console.error(`✗ Write verification FAILED: Expected ${expectedFinalCount} rows, got ${finalRowCount}`);
      }

      // Update metadata
      updateMetadata(ss, rows.length);
    } else {
      console.log('No valid rows to append');
    }

    return {
      success: true,
      imported: rows.length,
      processed: processedCount,
      errors: errorCount,
      total: sheet.getLastRow() - 1
    };

  } catch (error) {
    console.error('Import failed:', error.toString());
    console.error('Stack trace:', error.stack);

    return {
      success: false,
      error: error.toString(),
      imported: 0,
      total: 0
    };
  }
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

  // CRITICAL: Force metadata commit
  SpreadsheetApp.flush();
  console.log(`Metadata updated: Total chunks now ${currentTotal + addedChunks}`);
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