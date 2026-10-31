import type { Product } from './product';
export type Role = 'BUYER' | 'SELLER' | 'ADMIN';
export type RequestStatus = 'NEW' | 'IN_PROGRESS' | 'QUOTED' | 'COMPLETED' | 'CANCELLED';
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  active: boolean;
};
export type DoorVariant = {
  id: string;
  productId: string;
  width: number;
  height: number;
  price: number;
  stock: 'DEMO_AVAILABLE' | 'DEMO_ORDER' | 'DEMO_UNAVAILABLE';
  active: boolean;
};
export type LineInput = {
  variantId: string;
  quantity: number;
  frame: boolean;
  hardware: boolean;
  installation: boolean;
};
export type QuoteLine = LineInput & {
  name: string;
  sku: string;
  width: number;
  height: number;
  basePrice: number;
  framePrice: number;
  hardwarePrice: number;
  installationPrice: number;
  unitPrice: number;
  total: number;
};
export type Quote = {
  id: string;
  version: number;
  total: number;
  lines: QuoteLine[];
  createdAt: string;
  authorName: string;
};
export type RequestSummary = {
  id: string;
  number: number;
  buyerId: string;
  sellerId: string | null;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  revision: number;
  buyerName: string;
  sellerName: string | null;
};
export type RequestDetail = RequestSummary & {
  demoPaymentsEnabled: boolean;
  payments: {id: string; quoteId: string; amount: number; createdAt: string}[];
  note: string;
  buyer: { name: string; email: string; phone: string };
  items: LineInput[];
  quotes: Quote[];
  events: {
    id: string;
    kind: string;
    status: RequestStatus;
    authorName: string;
    createdAt: string;
  }[];
  comments?: { id: string; text: string; authorName: string; createdAt: string }[];
};
export type StoreSettings = {
  phone: string;
  email: string;
  addressRu: string;
  addressKk: string;
  hoursRu: string;
  hoursKk: string;
  framePrice: number;
  hardwarePrice: number;
  installationPrice: number;
};
export type AdminProduct = Product & { archived: boolean; variants: DoorVariant[] };
