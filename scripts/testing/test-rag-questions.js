#!/usr/bin/env node

/**
 * Test RAG System with Real Google Apps Script Questions
 */

require('dotenv').config();
const SupabaseVectorClient = require('../../src/storage/supabase-client');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function askQuestion(question) {
  console.log('\n' + '='.repeat(60));
  console.log(`📝 Question: "${question}"`);
  console.log('='.repeat(60));

  try {
    // Initialize clients
    const supabase = new SupabaseVectorClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: 'models/embedding-001' });
    const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' });

    // Step 1: Generate embedding for the question
    console.log('\n🔄 Generating question embedding...');
    const embeddingResult = await embeddingModel.embedContent({
      content: { parts: [{ text: question }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768
    });
    const queryEmbedding = embeddingResult.embedding.values;

    // Step 2: Search for similar documents
    console.log('🔍 Searching knowledge base...');
    const startTime = Date.now();
    const searchResults = await supabase.similaritySearch(queryEmbedding, {
      matchThreshold: 0.7,
      matchCount: 5
    });
    const searchTime = Date.now() - startTime;

    console.log(`⚡ Found ${searchResults.length} relevant documents in ${searchTime}ms`);

    if (searchResults.length === 0) {
      console.log('❌ No relevant documentation found.');
      return;
    }

    // Step 3: Display search results
    console.log('\n📚 Top Relevant Documents:');
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   URL: ${result.document_url || 'N/A'}`);
      console.log(`   Preview: ${result.chunk_content.substring(0, 150)}...`);
    });

    // Step 4: Synthesize answer using Gemini
    console.log('\n🤖 Generating comprehensive answer...\n');

    const context = searchResults
      .map(doc => doc.chunk_content)
      .join('\n\n---\n\n');

    const prompt = `Based on the following Google Apps Script documentation, provide a clear and helpful answer to this question:

Question: ${question}

Documentation context:
${context}

Please provide:
1. A direct answer to the question
2. Code example if applicable
3. Any important notes or best practices
4. Keep the response concise but complete`;

    const result = await chatModel.generateContent(prompt);
    const answer = result.response.text();

    console.log('💡 ANSWER:');
    console.log('-'.repeat(60));
    console.log(answer);
    console.log('-'.repeat(60));

    // Step 5: Performance summary
    console.log('\n📊 Performance Metrics:');
    console.log(`  • Search time: ${searchTime}ms`);
    console.log(`  • Documents retrieved: ${searchResults.length}`);
    console.log(`  • Top match similarity: ${(searchResults[0].similarity * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  console.log('🚀 Google Apps Script RAG System - Real Question Test');
  console.log('=' .repeat(60));

  // Test questions about Google Apps Script
  const questions = [
    "How do I create a custom menu in Google Sheets using Apps Script?",
    "What's the difference between getRange() and getRangeList() in Google Sheets?",
    "How can I send an email with an attachment using Gmail service in Apps Script?",
    "How do I trigger a function to run automatically every day at a specific time?",
    "What's the best way to read and write data to Google Sheets from Apps Script?"
  ];

  // Ask the first question in detail
  await askQuestion(questions[0]);

  // Ask if user wants to test more questions
  console.log('\n\n🎯 Other questions we can test:');
  questions.slice(1).forEach((q, i) => {
    console.log(`${i + 2}. ${q}`);
  });

  console.log('\n✨ The RAG system can answer any Google Apps Script question using your 1,482 documentation chunks!');
}

// Run the test
main().catch(console.error);