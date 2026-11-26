// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import ProductsPage from './pages/ProductsPage'
import SalesPage from './pages/SalesPage'
import * as api from './services/api'

vi.mock('./services/api', () => ({
  getProducts: vi.fn(), getSettings: vi.fn(), getReport: vi.fn(), getSales: vi.fn(),
  getCustomers: vi.fn(), getCustomerCredits: vi.fn(), registerCreditPayment: vi.fn(), createCustomer: vi.fn(), saveProduct: vi.fn(),
  deactivateProduct: vi.fn(), receiveStock: vi.fn(), createInvoice: vi.fn(),
  readReceipt: vi.fn(), reopenReceipt: vi.fn(), cancelSale: vi.fn(),
}))
vi.mock('html5-qrcode', () => ({ Html5Qrcode: class { start() { return Promise.reject() } clear() {} stop() { return Promise.resolve() } } }))
vi.mock('qrcode.react', async () => {
  const { forwardRef } = await import('react')
  return { QRCodeCanvas: forwardRef<HTMLCanvasElement>((_, ref) => <canvas ref={ref} aria-label="QR" />) }
})

const product: api.BackendProduct = { id: '507f1f77bcf86cd799439011', nombre: 'Arroz', categoria: 'Granos',
  precioCompra: 8000, precioVenta: 12500, stock: 3, umbralMinimo: 5, unidad: 'kg', fraccionable: true, activo: true }
const receipt: api.BackendReceipt = { id: '507f1f77bcf86cd799439012', fecha: new Date().toISOString(),
  tienda: 'Tienda El Veleñito', metodo: 'efectivo', estado: 'confirmada', total: 1563, cambio: 437,
  lineas: [{ productoId: product.id, nombre: product.nombre, unidad: 'kg', cantidad: .125, precioUnitario: 12500, subtotal: 1563 }] }
const report: api.Report = { ventas: 1, anuladas: 0, total: 1563, promedio: 1563, porMedio: { efectivo: 1563 }, porDia: {}, productos: [] }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); window.location.hash = ''
  vi.mocked(api.getProducts).mockResolvedValue([product])
  vi.mocked(api.getSettings).mockResolvedValue({ tienda: 'Tienda El Veleñito', caja: '01', usuario: 'caja01', operador: 'Caja 01', rol: 'cajero', replicaSet: 'rs0', primario: true })
  vi.mocked(api.getReport).mockResolvedValue(report)
  vi.mocked(api.getSales).mockResolvedValue([receipt])
  vi.mocked(api.getCustomers).mockResolvedValue([])
  vi.mocked(api.getCustomerCredits).mockResolvedValue([])
  vi.mocked(api.createInvoice).mockResolvedValue({ comprobante: receipt, token: 'a'.repeat(64) })
})
afterEach(cleanup)

function enterDemo() {
  fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'demo' } })
  fireEvent.change(screen.getByLabelText('Contraseña', { exact: true }), { target: { value: 'prueba' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a la caja' }))
}

it('valida los campos de muestra y permite ver u ocultar la contraseña', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a la caja' }))
  expect(api.getSettings).not.toHaveBeenCalled()
  const password = screen.getByLabelText('Contraseña', { exact: true })
  expect(password).toHaveProperty('type', 'password')
  fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))
  expect(password).toHaveProperty('type', 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }))
  expect(password).toHaveProperty('type', 'password')
})

describe('Punto de venta', () => {
  it('carga el catálogo, registra la cantidad y el pago, y muestra el QR del comprobante guardado', async () => {
    render(<App />)
    enterDemo()
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir Arroz' }))
    const quantity = screen.getByRole('spinbutton', { name: 'Cantidad de Arroz' })
    expect((quantity as HTMLInputElement).value).toBe('0.125')
    fireEvent.change(screen.getByLabelText(/Efectivo recibido/), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/ }))
    expect(await screen.findByRole('link', { name: 'Abrir comprobante' })).toBeTruthy()
    expect(api.createInvoice).toHaveBeenCalledWith({
      lineas: [{ productoId: product.id, cantidad: .125 }], metodo: 'efectivo', recibido: 2000,
    }, expect.any(String))
    expect(screen.getByText('Tu venta está vacía')).toBeTruthy()
  })

  it('mantiene el carrito y la misma clave de idempotencia al reintentar una respuesta fallida', async () => {
    vi.mocked(api.createInvoice).mockRejectedValueOnce(new Error('Conexión interrumpida'))
      .mockResolvedValueOnce({ comprobante: receipt, token: 'a'.repeat(64) })
    render(<App />)
    enterDemo()
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir Arroz' }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/ }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Conexión interrumpida'))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/ }))
    await screen.findByRole('link', { name: 'Abrir comprobante' })
    expect(vi.mocked(api.createInvoice).mock.calls[0][1]).toBe(vi.mocked(api.createInvoice).mock.calls[1][1])
  })

  it('navega por las secciones de administración y conserva preferencias', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({ tienda: 'El Veleñito', caja: '01', operador: 'Tendero', usuario: 'tendero', rol: 'administrador', replicaSet: 'rs0', primario: true })
    render(<App />)
    enterDemo()
    await screen.findByRole('button', { name: 'Añadir Arroz' })
    fireEvent.click(screen.getByRole('button', { name: /^Resumen$/ }))
    expect(await screen.findByRole('heading', { name: 'Actividad de hoy' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Productos$/ }))
    expect(await screen.findByRole('button', { name: 'Editar Arroz' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Inventario$/ }))
    expect(await screen.findByRole('button', { name: 'Entrada de Arroz' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Reportes$/ }))
    expect(await screen.findByRole('button', { name: 'Exportar CSV' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Configuración$/ }))
    fireEvent.change(await screen.findByLabelText('Medio de pago predeterminado'), { target: { value: 'nequi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar preferencias' }))
    expect(localStorage.getItem('velenito-preferences')).toContain('nequi')
    fireEvent.click(screen.getByRole('button', { name: /^Ventas$/ }))
    expect((screen.getByLabelText('Medio de pago') as HTMLSelectElement).value).toBe('nequi')
  })

  it('selecciona el cliente autorizado y envía el fiado al servidor', async () => {
    vi.mocked(api.getCustomers).mockResolvedValue([{ id: '507f1f77bcf86cd799439013', nombre: 'Cliente autorizado', saldo: 0 }])
    render(<App />)
    enterDemo()
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir Arroz' }))
    fireEvent.click(screen.getByRole('button', { name: /Cambiar/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Cliente autorizado/ }))
    expect((screen.getByLabelText('Medio de pago') as HTMLSelectElement).value).toBe('fiado')
    fireEvent.click(screen.getByRole('button', { name: /Confirmar venta/ }))
    await screen.findByRole('link', { name: 'Abrir comprobante' })
    expect(api.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      metodo: 'fiado', clienteId: '507f1f77bcf86cd799439013',
    }), expect.any(String))
  })

  it('impide confirmar efectivo insuficiente y muestra el stock insuficiente', async () => {
    render(<App />)
    enterDemo()
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir Arroz' }))
    fireEvent.change(screen.getByLabelText(/Efectivo recibido/), { target: { value: '1' } })
    expect((screen.getByRole('button', { name: /Confirmar venta/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Cantidad de Arroz'), { target: { value: '4' } })
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Stock insuficiente'))
    expect(api.createInvoice).not.toHaveBeenCalled()
  })
})

describe('Formularios de gestión', () => {
  it('edita el precio sin modificar las existencias y persiste la entrada de mercancía', async () => {
    vi.mocked(api.saveProduct).mockResolvedValue({ ...product, precioVenta: 13000 })
    vi.mocked(api.receiveStock).mockResolvedValue({ id: 'recepcion' })
    render(<ProductsPage inventory onChange={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Arroz' }))
    fireEvent.change(screen.getByLabelText('Precio de venta'), { target: { value: '13000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await waitFor(() => expect(api.saveProduct).toHaveBeenCalledWith(expect.objectContaining({ stock: 3, precioVenta: 13000 }), product.id))
    await screen.findByText('Producto guardado.')
    fireEvent.click(screen.getByRole('button', { name: 'Entrada de Arroz' }))
    fireEvent.change(screen.getByLabelText('Cantidad recibida (kg)'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrada' }))
    await waitFor(() => expect(api.receiveStock).toHaveBeenCalledWith({ productoId: product.id, cantidad: 2.5, costoUnitario: 8000 }, expect.any(String)))
  })

  it('solicita un motivo para anular y vuelve a consultar las ventas', async () => {
    vi.mocked(api.cancelSale).mockResolvedValue({ ...receipt, estado: 'anulada' })
    render(<SalesPage canManage reportOnly={false} onReceipt={vi.fn()} onChange={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Anular' }))
    fireEvent.change(screen.getByLabelText('Motivo obligatorio'), { target: { value: 'Error de digitación' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    await waitFor(() => expect(api.cancelSale).toHaveBeenCalledWith(receipt.id, 'Error de digitación'))
    await waitFor(() => expect(api.getSales).toHaveBeenCalledTimes(2))
  })

  it('crea un producto desde el formulario y exige confirmación para desactivarlo', async () => {
    vi.mocked(api.saveProduct).mockResolvedValue(product)
    vi.mocked(api.deactivateProduct).mockResolvedValue(undefined)
    render(<ProductsPage inventory={false} onChange={vi.fn()} />)
    await screen.findByRole('button', { name: 'Editar Arroz' })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Galletas' } })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Snacks' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))
    await waitFor(() => expect(api.saveProduct).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Galletas', stock: 0 }), undefined))
    await screen.findByText('Producto guardado.')
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Arroz' }))
    expect(api.deactivateProduct).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
    await waitFor(() => expect(api.deactivateProduct).toHaveBeenCalledWith(product.id))
  })

  it('consulta ventas por medio y producto, y abre el comprobante guardado', async () => {
    const open = vi.fn()
    vi.mocked(api.reopenReceipt).mockResolvedValue({ comprobante: receipt, token: 'a'.repeat(64) })
    render(<SalesPage canManage reportOnly onReceipt={open} onChange={vi.fn()} />)
    await screen.findByRole('button', { name: 'Ver comprobante' })
    fireEvent.change(screen.getByLabelText('Medio'), { target: { value: 'nequi' } })
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: product.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }))
    await waitFor(() => expect(api.getSales).toHaveBeenLastCalledWith(expect.objectContaining({ metodo: 'nequi', productoId: product.id })))
    await screen.findByRole('button', { name: 'Ver comprobante' })
    fireEvent.click(screen.getByRole('button', { name: 'Ver comprobante' }))
    await waitFor(() => expect(open).toHaveBeenCalledWith(receipt, 'a'.repeat(64)))
  })
})

it('mantiene la caja cerrada ante un error y limita la navegación del cajero al entrar', async () => {
  vi.mocked(api.getSettings).mockRejectedValueOnce(new Error('Sin conexión'))
  render(<App />)
  enterDemo()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(api.getProducts).not.toHaveBeenCalled()
  enterDemo()
  await screen.findByRole('button', { name: 'Añadir Arroz' })
  expect(screen.getByRole('button', { name: 'Reportes' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Productos' }))
  await screen.findByText('Arroz')
  expect(screen.queryByRole('button', { name: 'Nuevo producto' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
  expect(screen.getByRole('button', { name: 'Entrar a la caja' })).toBeTruthy()
})

it('permite al administrador iniciar una venta desde el cuaderno de fiados', async () => {
  vi.mocked(api.getSettings).mockResolvedValue({ tienda: 'El Veleñito', caja: '01', usuario: 'admin', operador: 'Tienda', rol: 'administrador', replicaSet: 'rs0', primario: true })
  vi.mocked(api.getCustomers).mockResolvedValue([{ id: 'a', nombre: 'Cliente de ejemplo', saldo: 5000 }])
  render(<App />)
  enterDemo()
  fireEvent.click(await screen.findByRole('button', { name: 'Fiados' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Venta fiada' }))
  expect((screen.getByLabelText('Medio de pago') as HTMLSelectElement).value).toBe('fiado')
  expect(screen.getByText(/Saldo después de la venta/)).toBeTruthy()
})

it('registra clientes desde Fiados y muestra deuda y productos por compra', async () => {
  vi.mocked(api.getSettings).mockResolvedValue({ tienda: 'El Veleñito', caja: '01', usuario: 'admin', operador: 'Tienda', rol: 'administrador', replicaSet: 'rs0', primario: true })
  const client = { id: 'a', nombre: 'María Pérez', saldo: 12000 }
  vi.mocked(api.getCustomers).mockResolvedValue([])
  vi.mocked(api.createCustomer).mockResolvedValue(client)
  vi.mocked(api.getCustomerCredits).mockResolvedValue([{
    id: 'venta-1', fecha: new Date().toISOString(), total: 12000, saldo: 12000,
    estado: 'confirmada', lineas: [{ productoId: 'p', nombre: 'Arroz', unidad: 'kg', cantidad: 2, precioUnitario: 6000, subtotal: 12000 }],
  }])
  render(<App />)
  enterDemo()
  fireEvent.click(await screen.findByRole('button', { name: 'Fiados' }))
  fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }))
  fireEvent.change(screen.getByLabelText('Nombre del cliente'), { target: { value: client.nombre } })
  fireEvent.change(screen.getByLabelText('Referencia de la constancia'), { target: { value: 'formulario firmado' } })
  fireEvent.click(screen.getByLabelText('El cliente otorgó autorización previa e informada'))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
  expect(await screen.findByRole('heading', { name: client.nombre })).toBeTruthy()
  expect(api.createCustomer).toHaveBeenCalledWith(expect.objectContaining({ nombre: client.nombre, autorizacion: true }))
  expect(await screen.findByText(/Arroz · 2 kg/)).toBeTruthy()
  expect(api.getCustomerCredits).toHaveBeenCalledWith(client.id)
})

it('valida los abonos y actualiza el saldo solo con la confirmación del servidor', async () => {
  vi.mocked(api.getSettings).mockResolvedValue({ tienda: 'El Veleñito', caja: '01', usuario: 'admin', operador: 'Tienda', rol: 'administrador', replicaSet: 'rs0', primario: true })
  vi.mocked(api.getCustomers).mockResolvedValue([{ id: 'a', nombre: 'María Pérez', saldo: 12000 }])
  const savePayment = vi.mocked(api.registerCreditPayment)
  savePayment.mockRejectedValueOnce(new Error('Conexión interrumpida')).mockResolvedValueOnce({ saldo: 9000 })
    .mockResolvedValueOnce({ saldo: 0 })

  render(<App />)
  enterDemo()
  fireEvent.click(await screen.findByRole('button', { name: 'Fiados' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Ver detalle' }))
  fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }))
  const amount = screen.getByLabelText('Monto del abono (COP)')
  const confirm = screen.getByRole('button', { name: 'Confirmar abono' })
  fireEvent.change(amount, { target: { value: '12001' } })
  expect(confirm).toHaveProperty('disabled', true)
  fireEvent.change(amount, { target: { value: '3000' } })
  fireEvent.click(confirm)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Conexión interrumpida')
  fireEvent.click(confirm)
  await screen.findByText(/Abono registrado para María Pérez/)
  expect(savePayment.mock.calls[0]).toEqual(['a', 3000, expect.any(String)])
  expect(savePayment.mock.calls[1]).toEqual(savePayment.mock.calls[0])

  fireEvent.click(screen.getByRole('button', { name: 'Registrar abono' }))
  fireEvent.click(screen.getByRole('button', { name: 'Pagar todo el saldo' }))
  expect(screen.getByLabelText('Monto del abono (COP)')).toHaveProperty('value', '9000')
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar abono' }))
  await screen.findByText(/Abono registrado para María Pérez/)
  expect(savePayment).toHaveBeenLastCalledWith('a', 9000, expect.any(String))
  expect(screen.queryByRole('button', { name: 'Registrar abono' })).toBeNull()
  expect(screen.getByText('No hay clientes con deuda activa.')).toBeTruthy()
})

it('lista primero las deudas mayores y permite buscar y consultar a todos los clientes', async () => {
  vi.mocked(api.getSettings).mockResolvedValue({ tienda: 'El Veleñito', caja: '01', usuario: 'admin', operador: 'Tienda', rol: 'administrador', replicaSet: 'rs0', primario: true })
  vi.mocked(api.getCustomers).mockResolvedValue([
    { id: 'a', nombre: 'Ana', saldo: 1000 },
    { id: 'b', nombre: 'Bruno', saldo: 0 },
    { id: 'c', nombre: 'Carmen', saldo: 9000 },
  ])
  render(<App />)
  enterDemo()
  fireEvent.click(await screen.findByRole('button', { name: 'Fiados' }))
  await screen.findByText('Carmen')
  const rows = screen.getAllByRole('listitem')
  expect(rows.map(row => row.querySelector('strong')?.textContent)).toEqual(['Carmen', 'Ana'])
  expect(rows[0].textContent).toContain((9000).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar cliente' }), { target: { value: 'bruno' } })
  expect(screen.getByText('No hay coincidencias para esa búsqueda.')).toBeTruthy()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Solo clientes con deuda activa' }))
  expect(screen.getByText('Bruno')).toBeTruthy()
  expect(screen.queryByText('Carmen')).toBeNull()
})
