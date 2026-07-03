import apiClient from '@/app/lib/axios'
import type {
  CatalogLookupResult,
  Product,
  ProductCreateRequest,
  ProductUpdateRequest,
  ProductVariant,
  PaginatedResponse,
} from '@/shared/types'

export interface ProductListParams {
  category_id?: string
  brand_id?: string
  is_active?: boolean
  search?: string
  page?: number
  page_size?: number
}

export interface VariantCreateRequest {
  sku: string
  name: string
  barcode?: string
  attributes: Record<string, string>
  price_override?: string
  cost_override?: string
}

export const productsService = {
  list: (params?: ProductListParams) =>
    apiClient.get<PaginatedResponse<Product>>('/products', { params }).then(r => r.data),

  get: (id: string) =>
    apiClient.get<Product>(`/products/${id}`).then(r => r.data),

  getByBarcode: (barcode: string) =>
    apiClient.get<Product>(`/products/barcode/${barcode}`).then(r => r.data),

  getBySku: (sku: string) =>
    apiClient.get<Product>(`/products/sku/${sku}`).then(r => r.data),

  lookupCatalog: (barcode: string) =>
    apiClient.get<CatalogLookupResult>(`/products/catalog/${barcode}`).then(r => r.data),

  create: (payload: ProductCreateRequest) =>
    apiClient.post<Product>('/products', payload).then(r => r.data),

  update: (id: string, payload: ProductUpdateRequest) =>
    apiClient.patch<Product>(`/products/${id}`, payload).then(r => r.data),

  delete: (id: string) =>
    apiClient.delete(`/products/${id}`).then(r => r.data),

  getPriceHistory: (id: string) =>
    apiClient.get(`/products/${id}/price-history`).then(r => r.data),

  createVariant: (productId: string, payload: VariantCreateRequest) =>
    apiClient.post<ProductVariant>(`/products/${productId}/variants`, payload).then(r => r.data),

  updateVariant: (productId: string, variantId: string, payload: Partial<VariantCreateRequest>) =>
    apiClient.patch<ProductVariant>(`/products/${productId}/variants/${variantId}`, payload).then(r => r.data),

  deleteVariant: (productId: string, variantId: string) =>
    apiClient.delete(`/products/${productId}/variants/${variantId}`).then(r => r.data),
}
