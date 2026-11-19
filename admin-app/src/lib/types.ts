export type Site = "destock" | "market"

export interface Product {
  id: string; sku: string; name: string; cat: string; sub: string; desc: string; cond: string; unitLabel: string
  images: string[]; stock: number; cost: number | null; publicValue: number | null; alertThreshold: number | null
  location?: string; createdAt: string
  destock: { active: boolean; ref?: string; title?: string; lotQty?: number | null; lotPrice?: number | null; status?: string; tag?: string; note?: string }
  market: { active: boolean; title?: string; price?: number | null; compareAt?: number | null; featured?: boolean }
}
export interface HistoryEntry { at: string; status: string; by: string }
export interface RequestItem { productId: string; ref: string; name: string; lots: number; lotQty: number; lotPrice: number | null }
export interface QuoteRequest {
  id: string; customerId: string; customerName: string; email: string; phone?: string; items: RequestItem[]; message: string
  status: string; quoteAmount: number | null; notes: string; orderId: string | null; history: HistoryEntry[]; createdAt: string
}
export interface OrderItem {
  productId: string; sku?: string; name: string; qty: number; units: number
  unitPriceHT?: number; unitPriceTTC?: number; lineHT: number; lineTTC?: number
}
export interface Order {
  id: string; site: Site; customerId: string; customerName: string; email: string; items: OrderItem[]; shipping: number
  totalHT: number; totalTTC: number; status: string; payment: string; paymentStatus: string; requestId: string | null
  tracking: string; notes: string; shippingAddress: string; history: HistoryEntry[]; createdAt: string
}
export interface Customer {
  id: string; type: "pro" | "particulier"; sites: Site[]; name: string; company: string; email: string; phone: string
  siret: string; address: string; city: string; zip: string; notes: string; createdAt: string
}
export interface Message {
  id: string; site: Site; type: "contact" | "sell"; name: string; company: string; email: string; phone: string
  subject: string; body: string; fields: Record<string, string>; status: string; createdAt: string
}
export interface Movement { id: string; productId: string; sku: string; name: string; delta: number; stockAfter: number; reason: string; ref: string; at: string }
export interface Stats {
  revenue30: Record<Site, number>; ordersToProcess: number; newRequests: number; openRequests: number; newMessages: number
  lowStock: number; stockValue: number; stockUnits: number; customers: { pro: number; particulier: number }
  series: { d: string; destock: number; market: number }[]; top: { id: string; units: number; name: string }[]
}
export interface Settings {
  shippingFee: number; freeShippingFrom: number; vatRate: number; lowStockDefault: number
  company: { name?: string; email?: string; phone?: string; address?: string; siret?: string }
  categories: Record<string, { name: string; icon: string; destock?: boolean; market?: boolean }>
}
export interface Category { key: string; name: string; icon: string; destock: boolean; market: boolean; products: number }
