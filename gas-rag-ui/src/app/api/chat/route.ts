import { google } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { generateEmbedding, EmbeddingTaskType } from '@/lib/embeddings';

export const runtime = 'nodejs'; // Force Node.js runtime for Supabase

export async function POST(request: Request) {
  try {
    const { messages, systemPrompt } = await request.json();

    // Get the last user message for context retrieval
    const lastUserMessage = messages
      .filter((msg: any) => msg.role === 'user')
      .pop();

    if (!lastUserMessage) {
      return new Response('No user message found', { status: 400 });
    }

    // Generate embedding for the query
    const embedding = await generateEmbedding(
      lastUserMessage.content,
      EmbeddingTaskType.RETRIEVAL_QUERY
    );

    // Perform vector search using Supabase
    const supabase = await createClient();
    const { data: documents, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: 0.78,
      match_count: 5,
    });

    if (error) {
      console.error('Vector search error:', error);
      throw error;
    }

    // Prepare context from retrieved documents
    const context = documents
      ?.map((doc: any) => `[${doc.source_url}]\n${doc.content}`)
      .join('\n\n---\n\n') || '';

    // Convert UI messages to model messages
    const modelMessages = convertToModelMessages(messages);

    // Stream the response using Gemini 2.5 Flash
    const result = await streamText({
      model: google('gemini-2-5-flash'),
      messages: modelMessages,
      system: systemPrompt || `You are a helpful AI assistant with access to relevant documentation.

Context from documentation:
${context}

Use this context to provide accurate and helpful responses. If the context doesn't contain relevant information, you can still provide general assistance based on your knowledge.`,
      temperature: 0.7,
    });

    // Return the stream response
    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}