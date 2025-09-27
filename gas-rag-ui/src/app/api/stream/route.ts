import { NextRequest } from 'next/server';
import { performVectorSearch } from '@/lib/supabase-client';
import { generateEmbedding, EmbeddingTaskType } from '@/lib/embeddings';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return new Response('Query parameter is required', { status: 400 });
  }

  const encoder = new TextEncoder();

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial acknowledgment
        const startEvent = `event: start\ndata: ${JSON.stringify({
          type: 'SEARCH_STARTED',
          query,
          timestamp: Date.now()
        })}\n\n`;
        controller.enqueue(encoder.encode(startEvent));

        // Generate embedding with progress update
        const embeddingStartTime = performance.now();
        const embedding = await generateEmbedding(query, EmbeddingTaskType.RETRIEVAL_QUERY);
        const embeddingTime = performance.now() - embeddingStartTime;

        const embeddingEvent = `event: progress\ndata: ${JSON.stringify({
          type: 'EMBEDDING_GENERATED',
          duration: embeddingTime
        })}\n\n`;
        controller.enqueue(encoder.encode(embeddingEvent));

        // Perform vector search
        const searchStartTime = performance.now();
        const result = await performVectorSearch(embedding, {
          matchThreshold: 0.78,
          matchCount: 10
        });
        const searchTime = performance.now() - searchStartTime;

        // Stream results progressively
        if (result.documents && result.documents.length > 0) {
          // Send results in batches of 2 for streaming effect
          const batchSize = 2;
          for (let i = 0; i < result.documents.length; i += batchSize) {
            const batch = result.documents.slice(i, i + batchSize);

            const batchEvent = `event: results\ndata: ${JSON.stringify({
              type: 'RESULTS_BATCH',
              documents: batch,
              batchIndex: Math.floor(i / batchSize),
              totalBatches: Math.ceil(result.documents.length / batchSize)
            })}\n\n`;

            controller.enqueue(encoder.encode(batchEvent));

            // Small delay to create streaming effect
            if (i + batchSize < result.documents.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        }

        // Send completion event
        const completeEvent = `event: complete\ndata: ${JSON.stringify({
          type: 'SEARCH_COMPLETE',
          totalDocuments: result.documents.length,
          searchLatency: searchTime,
          embeddingLatency: embeddingTime,
          totalLatency: searchTime + embeddingTime,
          fromCache: result.fromCache
        })}\n\n`;
        controller.enqueue(encoder.encode(completeEvent));

      } catch (error) {
        // Send error event
        const errorEvent = `event: error\ndata: ${JSON.stringify({
          type: 'ERROR',
          message: error instanceof Error ? error.message : 'An error occurred',
          timestamp: Date.now()
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        // Close the stream
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}