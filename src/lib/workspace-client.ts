export async function workspaceRequest<T = Record<string, unknown>>(body: unknown): Promise<T> {
  const response = await fetch('/api/workspace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.code || 'SERVER_ERROR');
  return data as T;
}
