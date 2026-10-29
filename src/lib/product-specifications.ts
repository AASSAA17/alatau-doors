import type { Product } from '@/types/product';
export const unspecifiedMaterial = {ru:'Не указан',kk:'Көрсетілмеген'};
// Compatibility for the exact legacy demo values, never rewrite arbitrary user data.
export function normalizeSpecifications<T extends Product>(product:T):T {
  const known = [ ['Эмаль','Эмаль'], ['Шпон дуба','Емен шпоны'], ['Шпон ореха','Жаңғақ шпоны'] ];
  if (!product.coating && known.some(([ru,kk])=>product.material.ru===ru && product.material.kk===kk))
    return {...product, coating:product.material, material:unspecifiedMaterial};
  return product;
}
