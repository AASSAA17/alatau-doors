export type Locale = 'ru' | 'kk';
export type Localized = Record<Locale, string>;
export type Category = 'interior' | 'entrance';
export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  category: Category;
  price: number;
  image: string;
  finish: Localized;
  material: Localized;
  coating?: Localized;
  description: Localized;
  widths: number[];
  height: number;
  collection: string;
  color: string;
  demo: true;
  variants?: import('./workspace').DoorVariant[];
};
export type CatalogQuery = { q?: string; category?: Category; maxPrice?: number; sort?: string };
export interface ProductRepository {
  list(query?: CatalogQuery): Promise<Product[]>;
  getBySlug(slug: string): Promise<Product | undefined>;
}
