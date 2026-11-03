/**
 * Reads a Server-Sent Events response body, dispatching each parsed `data:` frame to the handler.
 * Shared by every driver that streams from an SSE endpoint; `[DONE]` and malformed frames are skipped.
 *
 * @param response - The streaming HTTP response.
 * @param onEvent - Receives each JSON event in wire order.
 * @returns Once the body is fully read.
 */
export async function readSSE(response: Response, onEvent: (event: Record<string, unknown>) => void): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            onEvent(JSON.parse(data) as Record<string, unknown>);
          } catch {
            // Skip malformed SSE frames
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
