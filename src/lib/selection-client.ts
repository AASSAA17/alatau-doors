import { workspaceRequest } from './workspace-client';
import type { Actor, LineInput } from '@/types/workspace';
export const guestDraftKey = 'alatau-guest-draft-v1';

export function appendSelection(lines: LineInput[], incoming: LineInput[]): LineInput[] {
  const result = [...lines];
  for (const line of incoming) {
    const index = result.findIndex(l => l.variantId === line.variantId && l.frame === line.frame && l.hardware === line.hardware && l.installation === line.installation);
    if (index < 0) result.push(line);
    else {
      const quantity = result[index].quantity + line.quantity;
      if (quantity > 20) throw new Error('INVALID_INPUT');
      result[index] = { ...result[index], quantity };
    }
  }
  if (result.length > 30) throw new Error('INVALID_INPUT');
  return result;
}

export async function addToSelection(actor: Actor | null, line: LineInput) {
  let lines: LineInput[];
  if (actor) {
    const response = await fetch('/api/workspace?resource=draft', { cache: 'no-store' });
    if (!response.ok) throw new Error('UNAUTHORIZED');
    lines = (await response.json()).lines;
  } else {
    lines = JSON.parse(localStorage.getItem(guestDraftKey) || '[]');
  }
  if (!Array.isArray(lines)) throw new Error('INVALID_INPUT');
  const next = appendSelection(lines, [line]);
  if (actor) await workspaceRequest({ action: 'draft', lines: next });
  else localStorage.setItem(guestDraftKey, JSON.stringify(next));
}
