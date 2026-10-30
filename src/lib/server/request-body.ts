export class BodyTooLarge extends Error {}
export async function boundedText(request: Request, limit: number) {
  return (await boundedBytes(request, limit)).toString('utf8');
}
export async function boundedBytes(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
