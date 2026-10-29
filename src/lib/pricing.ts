import type { AdminProduct, LineInput, StoreSettings } from '@/types/workspace';

// Shared arithmetic. Server callers resolve prices and validate availability from SQLite.
export function priceLine(line: LineInput, basePrice: number, settings: StoreSettings) {
  const framePrice = line.frame ? settings.framePrice : 0;
  const hardwarePrice = line.hardware ? settings.hardwarePrice : 0;
  const installationPrice = line.installation ? settings.installationPrice : 0;
  const unitPrice = basePrice + framePrice + hardwarePrice + installationPrice;
  return { basePrice, framePrice, hardwarePrice, installationPrice, unitPrice, total: unitPrice * line.quantity };
}

export function previewSelection(lines: LineInput[], products: AdminProduct[], settings: StoreSettings) {
  const items = lines.map(line => {
    const product = products.find(p => !p.archived && p.variants.some(v => v.id === line.variantId));
    const variant = product?.variants.find(v => v.id === line.variantId && v.active && v.stock !== 'DEMO_UNAVAILABLE');
    if (!product || !variant) return null;
    return { ...line, name: product.name, width: variant.width, height: variant.height, ...priceLine(line, variant.price, settings) };
  });
  return { items, total: items.every(Boolean) ? items.reduce((sum, item) => sum + item!.total, 0) : null };
}
