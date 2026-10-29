import { readProducts } from '@/lib/server/products';
import type { CatalogQuery, Product, ProductRepository } from '@/types/product';
export function filterProducts(items: Product[], query: CatalogQuery = {}) {
  const q = query.q?.trim().toLocaleLowerCase() ?? '';
  const result = items.filter(
    (p) =>
      (!query.category || p.category === query.category) &&
      (!query.maxPrice || p.price <= query.maxPrice) &&
      (!q ||
        [
          p.name,
          p.sku,
          p.finish.ru,
          p.finish.kk,
          p.material.ru,
          p.material.kk,
          p.coating?.ru,
          p.coating?.kk,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(q)),
  );
  if (query.sort === 'price-asc') result.sort((a, b) => a.price - b.price);
  if (query.sort === 'price-desc') result.sort((a, b) => b.price - a.price);
  if (query.sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}
export const productRepository: ProductRepository = {
  async list(query) {
    return filterProducts(await readProducts(), query);
  },
  async getBySlug(slug) {
    return (await readProducts()).find((p) => p.slug === slug);
  },
};
