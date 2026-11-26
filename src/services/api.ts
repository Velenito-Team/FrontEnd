/// <reference types="vite/client" />

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type BackendProduct = {
  id: string
  nombre: string
  categoria: string
  precioVenta: number
  precioCompra: number
  unidad: 'kg' | 'g' | 'l' | 'unidad'
  stock: number
  umbralMinimo?: number
  activo: boolean
  fraccionable: boolean
}

export type BackendInvoice = {
  lineas: Array<{ productoId: string; cantidad: number }>
  metodo: 'efectivo' | 'nequi' | 'daviplata' | 'fiado'
  recibido?: number
  clienteId?: string
}

export type BackendReceipt = {
  id: string
  fecha: string
  tienda: string
  metodo: string
  estado: string
  total: number
  cambio: number | null
  lineas: Array<{
    productoId: string
    nombre: string
    unidad: BackendProduct['unidad']
    cantidad: number
    precioUnitario: number
    subtotal: number
  }>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw Object.assign(new Error(body?.message || `Error ${response.status} del backend.`), { status: response.status })
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export type ProductInput = Omit<BackendProduct, 'id'>
export type Filters = { desde: string; hasta: string; metodo?: string; estado?: string; productoId?: string }
export type Report = {
  ventas: number; anuladas: number; total: number; promedio: number
  porMedio: Record<string, number>; porDia: Record<string, number>
  productos: Array<{ productoId: string; nombre: string; cantidad: number; total: number }>
}
export type Settings = { tienda: string; caja: string; operador: string; usuario: string; rol: string; replicaSet: string; primario: boolean }
export type Customer = { id: string; nombre: string; telefono?: string; saldo: number }
export type CustomerCredit = {
  id: string; fecha: string; total: number; saldo: number; estado: string
  lineas: BackendReceipt['lineas']
}
export type FixedExpenseInput = { concepto: string; monto: number; periodo: string; diaRecordatorio: number }
export type FixedExpense = FixedExpenseInput & { id: string }
export type MonthlyAccounting = {
  gastosFijos: FixedExpense[]
  balance?: { resultadoOperativo: number; gastosFijos: number; resultadoNeto: number }
}
export type DailyAccounting =
  | { estadoCaja: 'abierta' | 'sin_cierre' }
  | {
      estadoCaja: 'cerrada'
      cobrosVentas: number
      abonosRecibidos: number
      egresosMercancia: number
      otrosEgresosOperativos: number
      diferenciaArqueo: number
    }
const json = (value: unknown): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
})
export const getMonthlyAccounting = (period: string) =>
  request<MonthlyAccounting>(`/api/accounting/monthly?periodo=${encodeURIComponent(period)}`)
export const getDailyAccounting = (date: string) =>
  request<DailyAccounting>(`/api/accounting/daily?fecha=${encodeURIComponent(date)}`)

export function createFixedExpense(expense: FixedExpenseInput, key: string) {
  const init = json(expense)
  return request<FixedExpense>('/api/accounting/fixed-expenses', {
    ...init, headers: { ...init.headers, 'Idempotency-Key': key },
  })
}
const query = (filters: Filters) => new URLSearchParams(
  Object.entries(filters).filter(([, value]) => !!value) as [string, string][],
).toString()
export function saveProduct(product: ProductInput, id?: string) {
  return request<BackendProduct>(id ? `/api/products/${id}` : '/api/products',
    { ...json(product), method: id ? 'PUT' : 'POST' })
}
export function deactivateProduct(id: string) {
  return request<void>(`/api/products/${id}`, { method: 'DELETE' })
}
export function receiveStock(entry: { productoId: string; cantidad: number; costoUnitario: number }, key: string) {
  const init = json(entry)
  return request<{ id: string }>('/api/inventory/receipts', {
    ...init, headers: { ...init.headers, 'Idempotency-Key': key },
  })
}
export const getSales = (filters: Filters) => request<BackendReceipt[]>(`/api/sales?${query(filters)}`)
export const getReport = (filters: Filters) => request<Report>(`/api/reports?${query(filters)}`)
export const getSettings = () => request<Settings>('/api/settings')
export const reopenReceipt = (id: string) => request<{ comprobante: BackendReceipt; token: string }>(`/api/sales/${id}/receipt`, { method: 'POST' })
export const cancelSale = (id: string, motivo: string) => request<BackendReceipt>(`/api/sales/${id}/cancel`, json({ motivo }))
export const getCustomers = () => request<Customer[]>('/api/customers')
export const getCustomerCredits = (customerId: string) =>
  request<CustomerCredit[]>(`/api/customers/${encodeURIComponent(customerId)}/credits`)
export async function registerCreditPayment(customerId: string, amount: number, key: string) {
  const init = json({ monto: amount })
  try {
    return await request<{ saldo: number }>(`/api/customers/${encodeURIComponent(customerId)}/payments`, {
      ...init, headers: { ...init.headers, 'Idempotency-Key': key },
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 404 || status === 405 || status === 501) {
      throw new Error('El servidor todavía no permite registrar abonos.')
    }
    throw error
  }
}
export const createCustomer = (customer: { nombre: string; telefono: string; autorizacion: boolean; evidencia: string }) =>
  request<Customer>('/api/customers', json(customer))

export function getProducts() {
  return request<BackendProduct[]>('/api/products')
}

export function createInvoice(invoice: BackendInvoice, key: string) {
  return request<{ comprobante: BackendReceipt; token: string }>('/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(invoice),
  })
}

export function readReceipt(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return Promise.reject(new Error('Comprobante no disponible.'))
  return request<BackendReceipt>(`/api/invoices/receipt/${token}`)
}
