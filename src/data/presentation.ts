import type { LineInput, Role } from '@/types/workspace';

// Fictional, stable presentation content. Never used to reset the user's database.
export const presentationVersion = 'visual-v1';
export const presentationUsers: [string, Role, string][] = [
  ['admin', 'ADMIN', 'Администратор Alatau · демо'],
  ['seller-a', 'SELLER', 'Айгерим · консультант'],
  ['seller-b', 'SELLER', 'Данияр · консультант'],
  ['buyer-a', 'BUYER', 'Алия · демо-покупатель'],
  ['buyer-b', 'BUYER', 'Тимур · демо-покупатель'],
];
export const presentationRequests: { line: LineInput; note: string; comment: string }[] = [
  { line: { variantId: 'd01-800', quantity: 2, frame: true, hardware: true, installation: false }, note: 'Две двери для спальни и гостиной. Нравится натуральная отделка дуба. Демонстрационная заявка.', comment: '' },
  { line: { variantId: 'd02-800', quantity: 3, frame: true, hardware: true, installation: false }, note: 'Светлые двери для квартиры. Прошу включить короб и фурнитуру. Демонстрационная заявка.', comment: 'Уточнить направление открывания и размеры проёмов перед подготовкой следующей версии расчёта. Демонстрационный сценарий.' },
  { line: { variantId: 'd03-900', quantity: 1, frame: true, hardware: true, installation: true }, note: 'Выбрана входная дверь Terra 03, размер 900 × 2100 мм. Нужен предварительный расчёт с установкой. Демонстрационная заявка.', comment: 'В расчёт включены выбранная дверь, короб, фурнитура и установка по демопрайсу. Это пример расчёта, сроки и наличие не подтверждены.' },
  { line: { variantId: 'd04-800', quantity: 2, frame: true, hardware: true, installation: true }, note: 'Две двери Studio 04 для рабочего пространства. Сценарий обработки завершён; оплаты и доставки не было.', comment: '' },
  { line: { variantId: 'd02-700', quantity: 1, frame: false, hardware: false, installation: false }, note: 'Предварительный выбор одной двери. Демонстрационный сценарий отменён до согласования комплектации.', comment: '' },
];
