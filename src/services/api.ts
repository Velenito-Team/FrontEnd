/// <reference types="vite/client" />

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type UserRole = 'administrador' | 'tendero' | 'cajero'

export type AuthUser = {
  id: string
  nombre: string
  usuario: string
  rol: UserRole
  activo: boolean
}

export type CreateUserInput = {
  nombre: string
  usuario: string
  contrasena: string
  rol: UserRole
}

export type Provider = {
  id: string
  nombre: string
  telefono?: string | null
}

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

export type ProductInput = Omit<BackendProduct, 'id'>
export type Filters = { desde: string; hasta: string; metodo?: string; estado?: string; productoId?: string }
export type Report = {
  ventas: number
  anuladas: number
  total: number
  promedio: number
  porMedio: Record<string, number>
  porDia: Record<string, number>
  productos: Array<{ productoId: string; nombre: string; cantidad: number; total: number }>
}

export type Settings = {
  tienda: string
  caja: string
  operador: string
  usuario: string
  rol: UserRole
  replicaSet: string
  primario: boolean
}

export type Customer = { id: string; nombre: string; telefono?: string; saldo: number }
export type CustomerCredit = {
  id: string
  fecha: string
  total: number
  saldo: number
  estado: string
  lineas: BackendReceipt['lineas']
}

export type CreditPaymentInput = {
  deudaId: string
  monto: number
  medio: 'efectivo' | 'nequi' | 'daviplata'
}

export type CreditPaymentReceipt = {
  comprobanteId: string
  clienteId: string
  deudaId: string
  monto: number
  medio: 'efectivo' | 'nequi' | 'daviplata'
  saldoRestante: number
  emitidoEn: string
}

export type PaymentTotals = {
  efectivo: number
  nequi: number
  daviplata: number
}

export type CashClosingSummary = {
  base: number
  ventasCobradas: PaymentTotals
  abonos: PaymentTotals
  egresos: PaymentTotals
  totalVentasFiadas: number
  efectivoEsperado: number
  efectivoContado: number
  diferencia: number
  balanceOperativo: number
}

export type CashClosing = {
  id: string
  cajaDiaId: string
  dia: string
  revision: number
  estado: string
  resultado: 'sobrante' | 'faltante' | 'cuadrada'
  resumen: CashClosingSummary
  anteriorId: string | null
  motivo: string | null
}

export type OpenedCashDay = {
  id: string
  caja: string
  dia: string
  base: number
}

export type DailyBalance = {
  dia: string
  caja: string
  cierreId: string
  ventasCobradas: PaymentTotals
  abonos: PaymentTotals
  egresos: PaymentTotals
  flujoOperativoNeto: number
  diferenciaCaja: number
}

export type DailyExpenseInput = {
  dia: string
  medio: 'efectivo' | 'nequi' | 'daviplata'
  monto: number
  descripcion: string
  proveedorId?: string
}

export type DailyExpense = {
  id: string
  cajaDiaId: string
  dia: string
  medio: 'efectivo' | 'nequi' | 'daviplata'
  monto: number
  descripcion: string
  proveedorId?: string | null
}

export type FixedExpenseInput = {
  concepto: string
  monto: number
  mes: string
  diaRecordatorio: number
}

export type FixedExpense = FixedExpenseInput & { id: string }

export type FixedExpenseReminder = {
  id: string
  concepto: string
  diaRecordatorio: number
  pendiente: boolean
}

export type FixedExpenseSummary = {
  mes: string
  total: number
  gastos: FixedExpense[]
  recordatorios: FixedExpenseReminder[]
}

export type MonthlyBalance = {
  mes: string
  diasCerrados: number
  ventas: number
  abonos: number
  egresos: number
  gastosFijos: number
  diferenciaCaja: number
  balance: number
  datosIncompletos: boolean
  gastosFijosFaltantes: string[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const defaultStatusMessage: Record<number, string> = {
  401: 'Tu sesión expiró o no has iniciado sesión.',
  403: 'Tu rol no tiene permiso para realizar esta acción.',
  409: 'Conflicto de estado en el servidor. Verifica los datos e inténtalo de nuevo.',
  422: 'Los datos enviados no cumplen las reglas de validación.',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : null
    const message =
      body?.message ||
      body?.detail ||
      body?.title ||
      defaultStatusMessage[response.status] ||
      `Error ${response.status} del backend.`

    if (response.status === 401 && path !== '/api/auth/login') {
      window.dispatchEvent(new CustomEvent('velenito:unauthorized', { detail: message }))
    } else if (response.status === 403) {
      window.dispatchEvent(new CustomEvent('velenito:forbidden', { detail: message }))
    }

    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('text/csv')) {
    return (await response.text()) as unknown as T
  }
  return response.json() as Promise<T>
}

const json = (value: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(value),
})

const query = (filters: Filters) =>
  new URLSearchParams(
    Object.entries(filters).filter(([, value]) => !!value) as [string, string][],
  ).toString()

// --- Autenticación ---
export const loginUser = (usuario: string, contrasena: string) =>
  request<AuthUser>('/api/auth/login', json({ usuario, contrasena }))

export const logoutUser = () =>
  request<void>('/api/auth/logout', { method: 'POST' })

// --- Usuarios (Solo administrador) ---
export const getUsers = () => request<AuthUser[]>('/api/users')

export const createUser = (user: CreateUserInput) =>
  request<AuthUser>('/api/users', json(user))

export const updateUserStatus = (id: string, activo: boolean) =>
  request<AuthUser>(`/api/users/${encodeURIComponent(id)}/status`, json({ activo }, 'PATCH'))

export const updateUserRole = (id: string, rol: UserRole) =>
  request<AuthUser>(`/api/users/${encodeURIComponent(id)}/role`, json({ rol }, 'PATCH'))

// --- Proveedores ---
export const getProviders = () => request<Provider[]>('/api/providers')

export const createProvider = (provider: { nombre: string; telefono?: string }) =>
  request<Provider>('/api/providers', json(provider))

// --- Caja y Cierres ---
export const openCashRegister = (payload: { dia: string; caja?: string; base: number }) =>
  request<OpenedCashDay>('/api/cash-closings/open', json(payload))

export const closeCashRegister = (payload: { dia: string; caja?: string; efectivoContado: number }) =>
  request<CashClosing>('/api/cash-closings', json(payload))

export const rectifyCashClosing = (id: string, payload: { efectivoContado: number; motivo: string }) =>
  request<CashClosing>(`/api/cash-closings/${encodeURIComponent(id)}/rectifications`, json(payload))

export const getDailyBalance = (dia: string, caja = '01') =>
  request<DailyBalance>(
    `/api/cash-closings/balance?dia=${encodeURIComponent(dia)}&caja=${encodeURIComponent(caja)}`,
  )

// --- Gastos operativos y fijos ---
export const createDailyExpense = (expense: DailyExpenseInput, key: string) =>
  request<DailyExpense>('/api/expenses', {
    ...json(expense),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  })

export const getFixedExpensesSummary = (mes: string) =>
  request<FixedExpenseSummary>(`/api/fixed-expenses/summary?mes=${encodeURIComponent(mes)}`)

export const createFixedExpense = (expense: FixedExpenseInput, key: string) =>
  request<FixedExpense>('/api/fixed-expenses', {
    ...json(expense),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  })

// --- Balance mensual ---
export const getMonthlyBalance = (mes: string) =>
  request<MonthlyBalance>(`/api/balance/monthly?mes=${encodeURIComponent(mes)}`)

export const exportMonthlyBalanceCsv = (mes: string) =>
  request<string>(`/api/balance/monthly/export?mes=${encodeURIComponent(mes)}`)

// --- Productos e Inventario ---
export function getProducts(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return request<BackendProduct[]>(`/api/products${qs}`)
}

export function saveProduct(product: ProductInput, id?: string) {
  return request<BackendProduct>(
    id ? `/api/products/${encodeURIComponent(id)}` : '/api/products',
    json(product, id ? 'PUT' : 'POST'),
  )
}

export function deactivateProduct(id: string) {
  return request<void>(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function receiveStock(
  entry: { productoId: string; cantidad: number; costoUnitario: number; proveedorId?: string },
  key: string,
) {
  return request<{ id: string }>('/api/inventory/receipts', {
    ...json(entry),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  })
}

// --- Ventas, Reportes y Comprobantes ---
export const getSales = (filters: Filters) => request<BackendReceipt[]>(`/api/sales?${query(filters)}`)
export const getReport = (filters: Filters) => request<Report>(`/api/reports?${query(filters)}`)
export const getSettings = () => request<Settings>('/api/settings')
export const reopenReceipt = (id: string) =>
  request<{ comprobante: BackendReceipt; token: string }>(`/api/sales/${encodeURIComponent(id)}/receipt`, {
    method: 'POST',
  })
export const cancelSale = (id: string, motivo: string) =>
  request<BackendReceipt>(`/api/sales/${encodeURIComponent(id)}/cancel`, json({ motivo }))

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

// --- Clientes y Fiados ---
export const getCustomers = () => request<Customer[]>('/api/customers')

export const getCustomerCredits = (customerId: string) =>
  request<CustomerCredit[]>(`/api/customers/${encodeURIComponent(customerId)}/credits`)

export function registerCreditPayment(customerId: string, payment: CreditPaymentInput, key: string) {
  return request<CreditPaymentReceipt>(`/api/customers/${encodeURIComponent(customerId)}/abonos`, {
    ...json(payment),
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
  })
}

export const createCustomer = (customer: {
  nombre: string
  telefono: string
  autorizacion: boolean
  evidencia: string
}) => request<Customer>('/api/customers', json(customer))