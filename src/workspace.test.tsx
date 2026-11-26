// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import * as api from './services/api'

vi.mock('./services/api', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) { super(message); this.status = status }
  },
  loginUser: vi.fn(), logoutUser: vi.fn(), getSettings: vi.fn(),
  getUsers: vi.fn(), createUser: vi.fn(), updateUserStatus: vi.fn(), updateUserRole: vi.fn(),
  getProviders: vi.fn(), createProvider: vi.fn(),
  openCashRegister: vi.fn(), closeCashRegister: vi.fn(), rectifyCashClosing: vi.fn(), getDailyBalance: vi.fn(),
  createDailyExpense: vi.fn(), getFixedExpensesSummary: vi.fn(), createFixedExpense: vi.fn(),
  getMonthlyBalance: vi.fn(), exportMonthlyBalanceCsv: vi.fn(),
  getProducts: vi.fn(), saveProduct: vi.fn(), deactivateProduct: vi.fn(), receiveStock: vi.fn(),
  getSales: vi.fn(), getReport: vi.fn(), readReceipt: vi.fn(), reopenReceipt: vi.fn(), cancelSale: vi.fn(),
  createInvoice: vi.fn(), getCustomers: vi.fn(), getCustomerCredits: vi.fn(), registerCreditPayment: vi.fn(),
  createCustomer: vi.fn(),
}))
vi.mock('html5-qrcode', () => ({ Html5Qrcode: class { start() { return Promise.reject() } clear() {} stop() { return Promise.resolve() } } }))
vi.mock('qrcode.react', async () => {
  const { forwardRef } = await import('react')
  return { QRCodeCanvas: forwardRef<HTMLCanvasElement>((_, ref) => <canvas ref={ref} aria-label="QR" />) }
})

const user = (rol: api.UserRole = 'administrador'): api.AuthUser => ({
  id: '507f1f77bcf86cd799439001',
  nombre: 'Operadora',
  usuario: 'operadora',
  rol,
  activo: true,
})
const product: api.BackendProduct = {
  id: '507f1f77bcf86cd799439011', nombre: 'Arroz', categoria: 'Granos',
  precioCompra: 8000, precioVenta: 12500, stock: 3, umbralMinimo: 5, unidad: 'kg',
  fraccionable: true, activo: true,
}
const provider: api.Provider = { id: 'prov-1', nombre: 'Distribuidora', telefono: '3001234567' }
const balance: api.MonthlyBalance = {
  mes: '2026-10', diasCerrados: 3, ventas: 1000, abonos: 200, egresos: 100,
  gastosFijos: 100, diferenciaCaja: -10, balance: 900, datosIncompletos: false, gastosFijosFaltantes: [],
}
const summary: api.FixedExpenseSummary = { mes: '2026-10', total: 100, gastos: [], recordatorios: [] }
const closing: api.CashClosing = {
  id: 'closing-1', cajaDiaId: 'cash-day-1', dia: '2026-10-01', revision: 1, estado: 'cerrada',
  resultado: 'faltante', resumen: {
    base: 50000, ventasCobradas: { efectivo: 30000, nequi: 10000, daviplata: 0 },
    abonos: { efectivo: 5000, nequi: 0, daviplata: 0 }, egresos: { efectivo: 2000, nequi: 0, daviplata: 0 },
    totalVentasFiadas: 12000, efectivoEsperado: 83000, efectivoContado: 80000, diferencia: -3000, balanceOperativo: 43000,
  }, anteriorId: null, motivo: null,
}
const dailyBalance: api.DailyBalance = {
  dia: '2026-10-01', caja: '01', cierreId: 'closing-1',
  ventasCobradas: { efectivo: 30000, nequi: 10000, daviplata: 0 },
  abonos: { efectivo: 5000, nequi: 0, daviplata: 0 },
  egresos: { efectivo: 2000, nequi: 0, daviplata: 0 },
  flujoOperativoNeto: 43000, diferenciaCaja: -3000,
}
const customer: api.Customer = { id: '507f1f77bcf86cd799439013', nombre: 'María Pérez', saldo: 5000 }
const credit: api.CustomerCredit = {
  id: 'debt-1', fecha: '2026-10-01T10:00:00Z', total: 5000, saldo: 5000,
  estado: 'confirmada', lineas: [],
}
const paymentReceipt: api.CreditPaymentReceipt = {
  comprobanteId: 'receipt-payment-1', clienteId: customer.id, deudaId: credit.id,
  monto: 2000, medio: 'nequi', saldoRestante: 3000, emitidoEn: '2026-10-02T10:00:00Z',
}
const report: api.Report = { ventas: 0, anuladas: 0, total: 0, promedio: 0, porMedio: {}, porDia: {}, productos: [] }

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  sessionStorage.clear()
  localStorage.clear()
  window.location.hash = ''
  vi.mocked(api.loginUser).mockImplementation(async () => user())
  vi.mocked(api.logoutUser).mockResolvedValue(undefined)
  vi.mocked(api.getSettings).mockResolvedValue({
    tienda: 'El Veleñito', caja: '01', usuario: 'operadora', operador: 'Operadora',
    rol: 'administrador', replicaSet: 'rs0', primario: true,
  })
  vi.mocked(api.getUsers).mockResolvedValue([])
  vi.mocked(api.getProviders).mockResolvedValue([provider])
  vi.mocked(api.getProducts).mockResolvedValue([product])
  vi.mocked(api.getReport).mockResolvedValue(report)
  vi.mocked(api.getSales).mockResolvedValue([])
  vi.mocked(api.getCustomers).mockResolvedValue([])
  vi.mocked(api.getCustomerCredits).mockResolvedValue([])
  vi.mocked(api.getFixedExpensesSummary).mockResolvedValue(summary)
  vi.mocked(api.getMonthlyBalance).mockResolvedValue(balance)
  vi.mocked(api.exportMonthlyBalanceCsv).mockResolvedValue('mes,balance\n2026-10,1000')
  vi.mocked(api.getDailyBalance).mockRejectedValue(new api.ApiError('Primero debes cerrar la caja.', 409))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp() {
  return render(<AuthProvider><App /></AuthProvider>)
}

describe('Contratos HTTP', () => {
  it('envía login y abonos con JSON, credenciales incluidas y clave idempotente', async () => {
    const actual = await vi.importActual<typeof import('./services/api')>('./services/api')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200, headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => user(),
      })
      .mockResolvedValueOnce({
        ok: true, status: 201, headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => paymentReceipt,
      })
    vi.stubGlobal('fetch', fetchMock)

    await actual.loginUser('operadora', 'secreto123')
    await actual.registerCreditPayment(customer.id, {
      deudaId: credit.id, monto: 2000, medio: 'nequi',
    }, 'idempotency-key')

    const loginInit = fetchMock.mock.calls[0][1] as RequestInit
    const paymentInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login')
    expect(loginInit).toMatchObject({
      method: 'POST', credentials: 'include',
      body: JSON.stringify({ usuario: 'operadora', contrasena: 'secreto123' }),
    })
    expect(new Headers(loginInit.headers).get('Content-Type')).toBe('application/json')
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/customers/${customer.id}/abonos`)
    expect(paymentInit).toMatchObject({
      method: 'POST', credentials: 'include',
      body: JSON.stringify({ deudaId: credit.id, monto: 2000, medio: 'nequi' }),
    })
    expect(new Headers(paymentInit.headers).get('Content-Type')).toBe('application/json')
    expect(new Headers(paymentInit.headers).get('Idempotency-Key')).toBe('idempotency-key')
  })

  it('emite eventos globales para 401 y 403 con el mensaje del backend', async () => {
    const actual = await vi.importActual<typeof import('./services/api')>('./services/api')
    const unauthorized = vi.fn()
    const forbidden = vi.fn()
    window.addEventListener('velenito:unauthorized', unauthorized)
    window.addEventListener('velenito:forbidden', forbidden)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false, status: 401, headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ detail: 'Sesión vencida.' }),
      })
      .mockResolvedValueOnce({
        ok: false, status: 403, headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ detail: 'Acceso de administrador requerido.' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(actual.getUsers()).rejects.toMatchObject({ status: 401 })
      await expect(actual.getUsers()).rejects.toMatchObject({ status: 403 })
      expect(unauthorized).toHaveBeenCalledOnce()
      expect((unauthorized.mock.calls[0][0] as CustomEvent<string>).detail).toBe('Sesión vencida.')
      expect(forbidden).toHaveBeenCalledOnce()
      expect((forbidden.mock.calls[0][0] as CustomEvent<string>).detail).toBe('Acceso de administrador requerido.')
    } finally {
      window.removeEventListener('velenito:unauthorized', unauthorized)
      window.removeEventListener('velenito:forbidden', forbidden)
    }
  })
})

async function loginAs(rol: api.UserRole = 'administrador') {
  vi.mocked(api.loginUser).mockResolvedValue(user(rol))
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'operadora' } })
  fireEvent.change(screen.getByLabelText('Contraseña', { exact: true }), { target: { value: 'secreto123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a la caja' }))
  await screen.findByRole('button', { name: 'Salir' })
}

describe('Autenticación y permisos', () => {
  it('permite entrar sin credenciales a la vista local de administrador en desarrollo', async () => {
    if (!import.meta.env.DEV) return
    renderApp()
    fireEvent.click(screen.getByLabelText('Ver interfaz de administrador (demostración local)'))
    expect(screen.getByLabelText('Usuario')).toHaveProperty('required', false)
    expect(screen.getByLabelText('Contraseña', { exact: true })).toHaveProperty('required', false)
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a la caja' }))

    expect(await screen.findByRole('button', { name: 'Usuarios' })).toBeTruthy()
    expect(screen.getByText('Vista de administrador')).toBeTruthy()
    expect(api.loginUser).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('velenito-session-user') ?? 'null')).toEqual({
      id: 'dev-preview',
      nombre: 'Vista de administrador',
      usuario: 'admin-demo',
      rol: 'administrador',
      activo: true,
    })
  })

  it('permite seleccionar el rol al previsualizar en desarrollo', async () => {
    if (!import.meta.env.DEV) return
    renderApp()
    fireEvent.click(screen.getByLabelText('Ver interfaz de administrador (demostración local)'))
    fireEvent.change(screen.getByLabelText('Rol para previsualizar'), { target: { value: 'tendero' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a la caja' }))

    expect(await screen.findByRole('button', { name: 'Fiados' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Usuarios' })).toBeNull()
    expect(api.loginUser).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('velenito-session-user') ?? 'null').rol).toBe('tendero')
  })

  it('inicia sesión con credenciales reales y limita la navegación del cajero', async () => {
    renderApp()
    await loginAs('cajero')
    expect(api.loginUser).toHaveBeenCalledWith('operadora', 'secreto123')
    expect(api.getSettings).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Ventas' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Productos' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Inventario' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Proveedores' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Fiados' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Caja' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Usuarios' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Productos' }))
    await screen.findByText('Arroz')
    expect(screen.queryByRole('button', { name: 'Nuevo producto' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    await screen.findByRole('button', { name: 'Entrar a la caja' })
    expect(api.logoutUser).toHaveBeenCalledOnce()
  })

  it('habilita fiados, caja y contabilidad para tendero, sin dar permisos de administrador', async () => {
    renderApp()
    await loginAs('tendero')
    expect(screen.getByRole('button', { name: 'Fiados' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Caja' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contabilidad' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Usuarios' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Productos' }))
    expect(await screen.findByRole('button', { name: 'Nuevo producto' })).toBeTruthy()
  })
})

describe('Caja y balances', () => {
  it('registra apertura, cierre contado y rectificación administrativa', async () => {
    vi.mocked(api.openCashRegister).mockResolvedValue({ id: 'cash-day-1', caja: '01', dia: '2026-10-01', base: 50000 })
    vi.mocked(api.closeCashRegister).mockResolvedValue(closing)
    vi.mocked(api.rectifyCashClosing).mockResolvedValue({ ...closing, id: 'closing-2', revision: 2, motivo: 'Reconteo' })
    renderApp()
    await loginAs()
    fireEvent.click(screen.getByRole('button', { name: 'Caja' }))
    fireEvent.change(screen.getByLabelText('Día de caja'), { target: { value: '2026-10-01' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir caja' }))
    fireEvent.change(screen.getByLabelText('Base inicial (COP)'), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar apertura' }))
    await waitFor(() => expect(api.openCashRegister).toHaveBeenCalledWith({ dia: '2026-10-01', caja: '01', base: 50000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar caja' }))
    fireEvent.change(screen.getByLabelText('Efectivo contado (COP)'), { target: { value: '80000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
    await screen.findByText('Ventas fiadas (informativo)')
    expect(api.closeCashRegister).toHaveBeenCalledWith({ dia: '2026-10-01', caja: '01', efectivoContado: 80000 })
    expect(screen.getByText('faltante')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rectificar cierre' }))
    fireEvent.change(screen.getByLabelText('Efectivo contado (COP)'), { target: { value: '83000' } })
    fireEvent.change(screen.getByLabelText('Motivo de rectificación'), { target: { value: 'Reconteo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rectificación' }))
    await waitFor(() => expect(api.rectifyCashClosing).toHaveBeenCalledWith('closing-1', {
      efectivoContado: 83000, motivo: 'Reconteo',
    }))
  })

  it('consulta balance diario mostrando el 409 como requisito de cierre y separa diferencia de caja', async () => {
    vi.mocked(api.getDailyBalance).mockRejectedValueOnce(new api.ApiError('Cierra primero', 409))
      .mockResolvedValue(dailyBalance)
    renderApp()
    await loginAs()
    fireEvent.click(screen.getByRole('button', { name: 'Contabilidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Balance diario' }))
    expect(await screen.findByText(/Primero debes cerrar la caja/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
    expect(await screen.findByText(/Flujo operativo neto del día/)).toBeTruthy()
    expect(screen.getByText('Diferencia de caja').nextElementSibling?.textContent).toContain('-')
    expect(api.getDailyBalance).toHaveBeenLastCalledWith(expect.any(String))
  })

  it('muestra el balance mensual entregado y exporta el CSV del backend', async () => {
    renderApp()
    await loginAs()
    fireEvent.click(screen.getByRole('button', { name: 'Contabilidad' }))
    fireEvent.change(screen.getByLabelText('Mes del balance'), { target: { value: '2026-10' } })
    expect(await screen.findByText('Balance')).toBeTruthy()
    expect(screen.getByText('Balance', { exact: true }).closest('dt')?.nextElementSibling?.textContent).toContain('900')
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(api.exportMonthlyBalanceCsv).toHaveBeenCalledWith('2026-10'))
  })

  it('registra gastos diarios idempotentes e incluye proveedor opcional', async () => {
    vi.mocked(api.createDailyExpense).mockResolvedValue({
      id: 'expense-1', cajaDiaId: 'cash-day-1', dia: '2026-10-01', medio: 'nequi',
      monto: 2000, descripcion: 'Bolsas', proveedorId: provider.id,
    })
    renderApp()
    await loginAs()
    fireEvent.click(screen.getByRole('button', { name: 'Contabilidad' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto diario' }))
    await screen.findByRole('option', { name: provider.nombre })
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'nequi' } })
    fireEvent.change(screen.getByLabelText('Monto (COP)'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Bolsas' } })
    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: provider.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar gasto' }))
    await waitFor(() => expect(api.createDailyExpense).toHaveBeenCalledWith({
      dia: '2026-10-01', medio: 'nequi', monto: 2000, descripcion: 'Bolsas', proveedorId: provider.id,
    }, expect.any(String)))
  })
})

describe('Usuarios, proveedores e inventario', () => {
  it('crea usuarios y presenta conflictos al cambiar rol o estado', async () => {
    vi.mocked(api.getUsers).mockResolvedValue([user()])
    vi.mocked(api.createUser).mockResolvedValue({ ...user(), id: 'new-user', rol: 'cajero' })
    vi.mocked(api.updateUserRole).mockRejectedValue(new api.ApiError('Debe quedar un administrador activo.', 409))
    vi.mocked(api.updateUserStatus).mockResolvedValue({ ...user(), activo: false })
    renderApp()
    await loginAs()
    fireEvent.click(screen.getByRole('button', { name: 'Usuarios' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cajero' } })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'cajero' } })
    fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: 'password8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith({
      nombre: 'Cajero', usuario: 'cajero', contrasena: 'password8', rol: 'cajero',
    }))
    fireEvent.change(screen.getByLabelText('Rol de Operadora'), { target: { value: 'tendero' } })
    expect(await screen.findByText('Debe quedar un administrador activo.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Operadora' }))
    await waitFor(() => expect(api.updateUserStatus).toHaveBeenCalledWith(user().id, false))
  })

  it('permite al administrador registrar proveedores y enviar su ID en entrada de inventario', async () => {
    vi.mocked(api.createProvider).mockResolvedValue(provider)
    vi.mocked(api.receiveStock).mockResolvedValue({ id: 'receipt-stock-1' })
    renderApp()
    await loginAs()
    fireEvent.click(screen.getByRole('button', { name: 'Proveedores' }))
    fireEvent.change(screen.getByLabelText('Nombre del proveedor'), { target: { value: 'Distribuidora' } })
    fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: provider.telefono } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar proveedor' }))
    await waitFor(() => expect(api.createProvider).toHaveBeenCalledWith({
      nombre: 'Distribuidora', telefono: provider.telefono,
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Inventario' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Entrada de Arroz' }))
    fireEvent.change(await screen.findByLabelText('Proveedor (opcional)'), { target: { value: provider.id } })
    fireEvent.change(screen.getByLabelText('Cantidad recibida (kg)'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrada' }))
    await waitFor(() => expect(api.receiveStock).toHaveBeenCalledWith({
      productoId: product.id, cantidad: 2, costoUnitario: product.precioCompra, proveedorId: provider.id,
    }, expect.any(String)))
  })
})

it('registra un abono en una deuda específica y muestra el comprobante devuelto', async () => {
  vi.mocked(api.getCustomers).mockResolvedValue([customer])
  vi.mocked(api.getCustomerCredits).mockResolvedValue([credit])
  vi.mocked(api.registerCreditPayment).mockResolvedValue(paymentReceipt)
  renderApp()
  await loginAs('tendero')
  fireEvent.click(screen.getByRole('button', { name: 'Fiados' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }))
  await waitFor(() => expect(api.getCustomerCredits).toHaveBeenCalledWith(customer.id))
  await screen.findByText(/confirmada/)
  fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }))
  expect((screen.getByLabelText('Deuda pendiente') as HTMLSelectElement).value).toBe(credit.id)
  fireEvent.change(screen.getByLabelText('Monto del abono (COP)'), { target: { value: '2000' } })
  fireEvent.change(screen.getByLabelText('Medio de pago'), { target: { value: 'nequi' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar abono' }))
  await waitFor(() => expect(api.registerCreditPayment).toHaveBeenCalledWith(customer.id, {
    deudaId: credit.id, monto: 2000, medio: 'nequi',
  }, expect.any(String)))
  expect(await screen.findByText(/Comprobante de abono/)).toBeTruthy()
  expect(screen.getByText(/Saldo restante \$ 3\.000|Saldo restante.*3\.000/)).toBeTruthy()
})
