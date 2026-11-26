import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'
import { QRCodeCanvas } from 'qrcode.react'
import { createInvoice as createBackendInvoice, getProducts, getReport, readReceipt, type BackendProduct, type BackendReceipt, type BackendInvoice, type Customer, type Settings as OperatorSettings } from './services/api'
import AccessPage from './pages/AccessPage'
import CreditPage from './pages/CreditPage'
import { Store, BookOpen } from 'lucide-react'
import ProductsPage from './pages/ProductsPage'
import SalesPage, { today } from './pages/SalesPage'
import OverviewPage from './pages/OverviewPage'
import SettingsPage, { readPreferences } from './pages/SettingsPage'
import CustomerPicker from './components/CustomerPicker'
import Modal from './components/Modal'
import './workspace.css'
import {
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Copy,
  FileDown,
  FilePlus2,
  FileScan,
  LayoutDashboard,
  Maximize2,
  Monitor,
  Minus,
  Minimize2,
  Package,
  Plus,
  QrCode,
  Search,
  Settings,
  ShoppingCart,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'

const DeviceViewer = lazy(() => import('./DeviceViewer'))

type Category = string

type Product = {
  id: string
  name: string
  category: Exclude<Category, 'Todos'>
  price: number
  stock: number
  color: string
  icon: string
  tag?: string
  unit: BackendProduct['unidad']
  fractionable: boolean
  lowStock: boolean
}

type CartItem = Product & { quantity: number }

type Invoice = {
  schemaVersion: string
  invoiceNumber: string
  issuedAt: string
  currency: string
  paymentMethod: string
  seller: { name: string; terminal: string }
  items: Array<{
    productId: string
    name: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
  totals: { subtotal: number; tax: number; total: number }
}

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

function receiptUrl(token: string) {
  const url = new URL(import.meta.env.VITE_PUBLIC_RECEIPT_URL || window.location.pathname, window.location.origin)
  url.hash = `comprobante/${token}`
  return url.href
}

function linkToken(value: string) {
  return value.trim().match(/#comprobante\/([a-f0-9]{64})$/)?.[1]
}

function lineTotal(item: CartItem) {
  // Los precios y cantidades del catálogo se convierten a decimal antes de redondear la línea.
  const decimal = (value: number) => {
    const [whole, fraction = ''] = value.toLocaleString('en-US', {
      useGrouping: false, maximumFractionDigits: 12,
    }).split('.')
    return { value: BigInt(whole + fraction), scale: 10n ** BigInt(fraction.length) }
  }
  const price = decimal(item.price)
  const quantity = decimal(item.quantity)
  const numerator = price.value * quantity.value
  const denominator = price.scale * quantity.scale
  return Number((numerator * 2n + denominator) / (denominator * 2n))
}

function decodeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)

    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })

      if (!context) {
        cleanup()
        reject(new Error('No se pudo preparar la imagen para lectura.'))
        return
      }

      context.drawImage(image, 0, 0)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' })
      cleanup()

      if (result) resolve(result.data)
      else reject(new Error('No se encontró un QR en la imagen.'))
    }

    image.onerror = () => {
      cleanup()
      reject(new Error('No se pudo abrir la imagen.'))
    }
    image.src = objectUrl
  })
}

function money(value: number) {
  return currency.format(value).replace('COP', '$')
}

function displayReceipt(receipt: BackendReceipt): Invoice {
  return {
    schemaVersion: '1.0',
    invoiceNumber: `FAC-${receipt.id}`,
    issuedAt: receipt.fecha,
    currency: 'COP',
    paymentMethod: receipt.metodo,
    seller: { name: receipt.tienda, terminal: 'Caja 01' },
    items: receipt.lineas.map((line) => ({
      productId: line.productoId, name: line.nombre, quantity: line.cantidad,
      unitPrice: line.precioUnitario, lineTotal: line.subtotal,
    })),
    totals: { subtotal: receipt.total, tax: 0, total: receipt.total },
  }
}

function PublicReceipt({ token }: { token: string }) {
  const [receipt, setReceipt] = useState<BackendReceipt>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    setReceipt(undefined)
    setFailed(false)
    readReceipt(token).then((result) => { if (active) setReceipt(result) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [token])
  return <main className="main-content">
    <section className="invoice-panel panel">
      {failed ? <p role="alert">Comprobante no disponible.</p> : !receipt ? <p>Cargando comprobante…</p> : <>
        <h1>{receipt.tienda}</h1><h2>Comprobante de venta</h2>
        <p>{new Date(receipt.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })} · {receipt.metodo}</p>
        {receipt.estado === 'anulada' && <p role="status">Anulada</p>}
        <ul>{receipt.lineas.map((line) => <li key={line.productoId}>
          {line.nombre} · {line.cantidad} {line.unidad} · {money(line.subtotal)}
        </li>)}</ul>
        <p><strong>Total {money(receipt.total)}</strong></p>
        {receipt.cambio !== null && <p>Cambio {money(receipt.cambio)}</p>}
        <button className="button button-secondary" onClick={() => window.print()}>Imprimir</button>
      </>}
    </section>
  </main>
}

function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const changed = () => setHash(window.location.hash)
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  const [operator, setOperator] = useState<OperatorSettings>()
  const token = linkToken(hash)
  return hash.startsWith('#comprobante/') ? <PublicReceipt token={token ?? ''} /> : operator ? <PointOfSale operator={operator} onExit={() => setOperator(undefined)} /> : <AccessPage onEnter={setOperator} />
}

function PointOfSale({ operator, onExit }: { operator: OperatorSettings; onExit: () => void }) {
  const admin = operator.rol === 'administrador'
  const [page, setPage] = useState('Ventas')
  const [history, setHistory] = useState(false)
  const [preferences, setPreferences] = useState(readPreferences)
  const [method, setMethod] = useState<BackendInvoice['metodo']>(preferences.method)
  const [received, setReceived] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [actions, setActions] = useState(false)
  const [lowOnly, setLowOnly] = useState(preferences.lowOnly)
  const [bestSelling, setBestSelling] = useState(false)
  const [ranking, setRanking] = useState<Record<string, number>>({})
  const searchInput = useRef<HTMLInputElement>(null)
  const navigate = (next: string) => { if (!saving && (next !== 'Fiados' || admin)) { setPage(next); setHistory(false) } }
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('Todos')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const requestKey = useRef<{ fingerprint: string; key: string }>()
  const [readerOpen, setReaderOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanSuccess, setScanSuccess] = useState<Invoice | null>(null)
  const [copied, setCopied] = useState(false)
  const [capacityError, setCapacityError] = useState('')
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const refreshProducts = useCallback(() => {
    getProducts().then((items) => {
      setCatalogProducts(items.filter((item) => item.activo).map(mapBackendProduct))
      setCatalogError('')
    }).catch(() => setCatalogError('No se pudo cargar el catálogo. Revisa tu conexión y pulsa Reintentar.'))
    const start = new Date(); start.setDate(start.getDate() - 30)
    getReport({ desde: start.toISOString().slice(0, 10), hasta: today() }).then(report =>
      setRanking(Object.fromEntries(report.productos.map(p => [p.productoId, p.cantidad])))).catch(() => undefined)
  }, [])

  useEffect(refreshProducts, [refreshProducts])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const showReceipt = (receipt: BackendReceipt, token: string) => {
    setCopied(false)
    setGeneratedInvoice(displayReceipt(receipt)); setGeneratedUrl(receiptUrl(token)); setQrModalOpen(true)
  }
  const categories = ['Todos', ...new Set(catalogProducts.map((product) => product.category))]
  const filteredProducts = useMemo(() => catalogProducts.filter((product) => {
    const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory
    const query = search.trim().toLowerCase()
    return matchesCategory && (!lowOnly || product.lowStock) && (!query || `${product.name} ${product.id}`.toLowerCase().includes(query))
  }).sort((a,b) => bestSelling ? (ranking[b.id] ?? 0) - (ranking[a.id] ?? 0) : a.name.localeCompare(b.name, 'es')),
  [activeCategory, search, catalogProducts, lowOnly, bestSelling, ranking])

  const total = cart.reduce((sum, item) => sum + lineTotal(item), 0)
  const itemCount = cart.length

  const updateQuantity = (id: string, delta: number) => {
    if (saving) return
    const product = catalogProducts.find((candidate) => candidate.id === id)
    if (!product) return
    const current = cart.find((item) => item.id === id)?.quantity ?? 0
    const quantity = Math.round((current + delta * (product.fractionable ? 0.125 : 1)) * 1000) / 1000
    if (quantity > product.stock) {
      setCapacityError(`Stock insuficiente para ${product.name}.`)
      return
    }
    const remaining = cart.filter((item) => item.id !== id)
    setCart(quantity > 0 ? [...remaining, { ...product, quantity }] : remaining)
    setCapacityError('')
  }

  const openQrModal = async () => {
    if (!cart.length || saving) return
    const lineas = cart.map(({ id, quantity }) => ({ productoId: id, cantidad: quantity }))
    if (method === 'fiado' && !customer) { setCapacityError('Selecciona un cliente autorizado.'); return }
    const body: BackendInvoice = { lineas, metodo: method,
      ...(method === 'efectivo' && received !== '' ? { recibido: +received } : {}),
      ...(method === 'fiado' && customer ? { clienteId: customer.id } : {}) }
    const fingerprint = JSON.stringify(body)
    if (requestKey.current?.fingerprint !== fingerprint) {
      requestKey.current = { fingerprint, key: crypto.randomUUID() }
    }
    setSaving(true)
    setCapacityError('')
    try {
      const { comprobante, token } = await createBackendInvoice(
        body, requestKey.current.key,
      )
      setGeneratedInvoice(displayReceipt(comprobante))
      setGeneratedUrl(receiptUrl(token))
      setCart([])
      setReceived('')
      requestKey.current = undefined
      setQrModalOpen(true)
      refreshProducts()
    } catch (error) {
      setCapacityError(error instanceof Error ? error.message : 'No se pudo guardar la venta.')
    } finally {
      setSaving(false)
    }
  }

  const handleScan = useCallback(async (rawValue: string) => {
    try {
      const token = linkToken(rawValue)
      const parsed = token ? displayReceipt(await readReceipt(token)) : JSON.parse(rawValue) as Invoice
      if (!parsed.invoiceNumber || !Array.isArray(parsed.items) || typeof parsed.totals?.total !== 'number') {
        throw new Error('El código no contiene un comprobante válido.')
      }
      setScanSuccess(parsed)
      setScanError('')
    } catch (error) {
      setScanSuccess(null)
      setScanError(error instanceof Error ? error.message : 'No se pudo leer el comprobante.')
    }
  }, [])

  const loadScannedInvoice = () => {
    if (!scanSuccess || saving) return
    const imported = new Map<string, CartItem>()
    for (const line of scanSuccess.items) {
      const product = catalogProducts.find((candidate) => candidate.id === line.productId)
      const quantity = (imported.get(line.productId)?.quantity ?? 0) + line.quantity
      if (!product || !Number.isFinite(quantity) || line.quantity <= 0 || quantity > product.stock
          || (!product.fractionable && !Number.isInteger(quantity))) {
        setScanError('El comprobante contiene productos no disponibles o cantidades inválidas.')
        return
      }
      imported.set(product.id, { ...product, quantity })
    }
    setCart([...imported.values()])
    setCapacityError('')
    setReaderOpen(false)
    setScanSuccess(null)
  }

  const copyJson = async () => {
    if (!generatedInvoice) return
    try { await navigator.clipboard.writeText(generatedUrl) }
    catch { setCapacityError('No se pudo copiar el enlace. Abre el comprobante para consultar su dirección.'); return }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const downloadQr = () => {
    const canvas = qrCanvasRef.current
    if (!canvas || !generatedInvoice) return
    const link = document.createElement('a')
    link.download = `${generatedInvoice.invoiceNumber}-qr.png`
    link.href = canvas.toDataURL('image/png', 1)
    link.click()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Store size={24} /></div>
          <div><span className="brand-name">El <span>Veleñito</span></span><small>Punto de venta de barrio</small></div>
        </div>

        <div className="sede"><strong>{operator.tienda}</strong><span>Sede principal · {operator.caja}</span></div>
        <nav className="main-nav" aria-label="Navegación principal">
          <p className="nav-label">Menú principal</p>
          <button className={page === 'Resumen' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Resumen')}><LayoutDashboard size={18} /> Resumen</button>
          <button className={page === 'Ventas' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Ventas')}><ShoppingCart size={18} /> Ventas</button>
          <button className={page === 'Productos' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Productos')}><Package size={18} /> Productos</button>
          <button className={page === 'Reportes' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Reportes')}><BarChart3 size={18} /> Reportes</button>
          {admin && <button className={page === 'Fiados' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Fiados')}><BookOpen size={18} /> Fiados</button>}
          <p className="nav-label nav-label-spaced">Administración</p>
          <button className={page === 'Inventario' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Inventario')}><Archive size={18} /> Inventario</button>
          <button className={page === 'Configuración' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('Configuración')}><Settings size={18} /> Configuración</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card" role="button" tabIndex={0} onClick={() => setHelp(true)} onKeyDown={e => { if (e.key === 'Enter') setHelp(true) }}><div className="help-icon"><CircleHelp size={17} /></div><div><strong>¿Necesitas ayuda?</strong><span>Consulta el centro de soporte</span></div><ArrowRight size={15} /></div>
          <div className="user-profile"><div className="user-avatar">C1</div><div><strong>{operator?.operador ?? 'Caja 01'}</strong><span>{operator?.rol ?? 'Operador'}</span></div><button className="profile-settings" aria-label="Configuración del operador" onClick={() => navigate('Configuración')}><MoreDots /></button></div>
          <p className="license-note">Software libre bajo GPLv3 · Sin garantía</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>{page}</span><ChevronDown size={14} /><strong>{page === 'Ventas' ? history ? 'Historial' : 'Nueva venta' : 'Tienda El Veleñito'}</strong></div>
          <div className="topbar-actions"><div className="live-status"><span></span> Punto de venta local</div><button className="icon-button" aria-label="Ver alertas de stock" onClick={() => { navigate('Inventario') }}><Bell size={19} />{catalogProducts.some(p => p.lowStock) && <i />}</button><button className="button button-secondary" disabled={saving} onClick={() => { if (!cart.length || window.confirm('¿Salir y descartar la venta en curso?')) onExit() }}>Salir</button><div className="topbar-date">{new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</div></div>
        </header>

        <div className="page-heading">
          {page !== 'Ventas' ? <div><h1>{page}</h1><p className="heading-copy">Tienda El Veleñito · Caja 01</p></div> : <>
          <div><p className="eyebrow">Punto de venta <span></span> Caja 01</p><h1>{history ? 'Historial de ventas' : 'Nueva venta'}</h1><p className="heading-copy">Selecciona los productos y confirma el cobro.</p></div>
          <div className="heading-actions"><button className="button button-secondary" onClick={() => setReaderOpen(true)}><FileScan size={17} /> Leer comprobante QR</button><button className="button button-secondary" onClick={() => setHistory(current => !current)}>{history ? 'Volver a venta' : 'Historial'}</button><button disabled={saving} className="button button-primary" onClick={() => { setCart([]); setReceived(''); setCustomer(null); setCapacityError(''); setHistory(false) }}><FilePlus2 size={17} /> Nueva venta</button></div>
          </>}
        </div>

        {page === 'Ventas' && !history && <>
        <div className="workspace-grid">
          <section className="catalog-panel panel">
            <div className="panel-heading"><div><h2>Catálogo de productos</h2><p>{catalogProducts.length} productos activos · {catalogProducts.filter(p => p.lowStock).length} por reponer</p></div><button className="text-button" onClick={() => navigate('Productos')}>Ver catálogo <ArrowRight size={15} /></button></div>
            <div className="catalog-toolbar"><label className="search-box"><Search size={18} /><input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o SKU..." /><kbd>Ctrl K</kbd></label><button className="filter-button" aria-pressed={bestSelling} onClick={() => setBestSelling(value => !value)}><span className="filter-dot"></span> {bestSelling ? 'Orden: más vendidos' : 'Más vendidos'}</button><label className="check-label"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Stock bajo</label></div>
            <div className="category-tabs">{categories.map((category) => <button key={category} className={activeCategory === category ? 'category-tab active' : 'category-tab'} onClick={() => setActiveCategory(category)}>{category}<span>{category === 'Todos' ? catalogProducts.length : catalogProducts.filter((p) => p.category === category).length}</span></button>)}</div>
            <div className="product-grid">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={(item) => updateQuantity(item.id, 1)} />)}</div>
            {catalogError && <div className="capacity-error" role="alert">{catalogError} <button onClick={refreshProducts}>Reintentar</button></div>}
            {!catalogError && !filteredProducts.length && <div className="empty-products"><Search size={25} /><strong>No encontramos productos</strong><span>Prueba con otro nombre o categoría.</span></div>}
          </section>

          <section className="invoice-panel panel">
            <div className="invoice-heading"><div><div className="invoice-label"><span className="invoice-live-dot"></span> Venta en curso</div><h2>Venta nueva</h2><p>{new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} <span>·</span> {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}</p></div><button className="more-button" aria-label="Más opciones" onClick={() => setActions(true)}><MoreDots /></button></div>
            <div className="invoice-customer"><div className="customer-icon"><UserRound size={17} /></div><div><span>Cliente</span><strong>{customer?.nombre ?? 'Consumidor final'}</strong></div><button disabled={saving} className="change-customer" onClick={() => setCustomerOpen(true)}>Cambiar <ChevronDown size={14} /></button></div>
            <div className="cart-list">{cart.length ? cart.map((item) => <CartRow key={item.id} item={item} onChange={updateQuantity} onRemove={(id) => { if (saving) return; setCart((current) => current.filter((cartItem) => cartItem.id !== id)); setCapacityError('') }} />) : <div className="empty-cart"><ShoppingCart size={30} /><strong>Tu venta está vacía</strong><span>Selecciona productos del catálogo para comenzar.</span></div>}</div>
            <div className="invoice-summary"><div className="total-row"><span>Total a pagar</span><strong>{money(total)}</strong></div></div>
            {capacityError && <div className="capacity-error" role="alert"><X size={15} /> {capacityError}</div>}
            <div className="data-form payment-form">
              <label>Medio de pago<select disabled={saving} value={method} onChange={e => setMethod(e.target.value as BackendInvoice['metodo'])}>
                <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option><option value="daviplata">Daviplata</option>
                <option value="fiado">Fiado</option></select></label>
              {method === 'efectivo' && <label>Efectivo recibido (vacío para exacto)<input disabled={saving} type="number" min={total}
                step="1" value={received} onChange={e => setReceived(e.target.value)} /></label>}
              {method === 'efectivo' && received !== '' && <p role="status">{+received < total ? `Faltan ${money(total - +received)} para completar el pago.` : `Cambio ${money(+received - total)}`}</p>}
              {method === 'fiado' && <p>{customer ? customer.nombre + ' · Saldo después de la venta: ' + money(customer.saldo + total) : 'Selecciona un cliente autorizado con el botón Cambiar.'}</p>}
            </div>
            <button className="generate-button" disabled={!cart.length || saving || method === 'efectivo' && received !== '' && (!Number.isInteger(+received) || +received < total) || method === 'fiado' && !customer} onClick={openQrModal}><span><QrCode size={19} /> {saving ? 'Guardando…' : 'Confirmar venta'}</span><ArrowRight size={18} /></button>
            <p className="invoice-footnote"><Clipboard size={13} /> El comprobante se guarda al confirmar la venta.</p>
          </section>
        </div>
        </>}
        {page === 'Fiados' && admin && <CreditPage onSale={c => { setCustomer(c); setMethod('fiado'); navigate('Ventas') }} />}
        {page === 'Resumen' && <OverviewPage onNavigate={navigate} />}
        {(page === 'Productos' || page === 'Inventario') && <ProductsPage canManage={admin} key={page} inventory={page === 'Inventario'} onChange={refreshProducts} />}
        {(page === 'Reportes' || page === 'Ventas' && history) && <SalesPage canManage={admin} key={page} reportOnly={page === 'Reportes'} onReceipt={showReceipt} onChange={refreshProducts} />}
        {page === 'Configuración' && <SettingsPage onSaved={p => { setPreferences(p); setMethod(p.method); setLowOnly(p.lowOnly) }} />}
      </main>
      {customerOpen && <CustomerPicker onClose={() => setCustomerOpen(false)} onSelect={c => { setCustomer(c); setCustomerOpen(false); setMethod(c ? 'fiado' : preferences.method) }} />}
      {help && <Modal title="Ayuda del punto de venta" onClose={() => setHelp(false)}>
        <p>En Ventas, busca un producto y añádelo al carrito. Puedes indicar cantidades fraccionarias y elegir efectivo, Nequi, Daviplata o fiado.</p>
        <p>Registra productos y sus precios en Productos. Las entradas de mercancía se guardan desde Inventario.</p>
        <p>En Historial puedes consultar comprobantes y anular una venta del día antes del cierre. Reportes permite filtrar el período y exportar CSV o imprimir.</p>
        <p>Para consultar un QR desde otro dispositivo, el enlace necesita una dirección pública o de la red accesible desde ese dispositivo.</p>
      </Modal>}
      {actions && <Modal title="Opciones de venta" onClose={() => setActions(false)}>
        <div className="data-form"><button disabled={saving} className="button button-secondary" onClick={() => { setCart([]); setReceived(''); setActions(false) }}>Vaciar carrito</button>
        <button className="button button-secondary" onClick={() => { setHistory(true); setActions(false) }}>Consultar historial</button></div>
      </Modal>}

      {qrModalOpen && generatedInvoice && <QrModal url={generatedUrl} invoice={generatedInvoice} canvasRef={qrCanvasRef} copied={copied} onCopy={copyJson} onDownload={downloadQr} onClose={() => setQrModalOpen(false)} />}
      {readerOpen && <ReaderModal onClose={() => { setReaderOpen(false); setScanSuccess(null); setScanError('') }} onScan={handleScan} scanError={scanError} scanSuccess={scanSuccess} onLoad={loadScannedInvoice} />}
    </div>
  )
}

function mapBackendProduct(product: BackendProduct): Product {
  return {
    id: product.id,
    name: product.nombre,
    category: product.categoria,
    price: Number(product.precioVenta),
    stock: Number(product.stock),
    color: 'blue',
    icon: '📦',
    unit: product.unidad,
    fractionable: product.fraccionable,
    lowStock: product.umbralMinimo != null && product.stock <= product.umbralMinimo,
  }
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  return <button type="button" className="catalog-line" aria-label={`Añadir ${product.name}`} onClick={() => onAdd(product)}>
    <span className="line-description"><strong>{product.name}</strong><small>{product.category} · SKU {product.id}</small></span>
    <span className={product.lowStock ? 'line-stock low-stock' : 'line-stock'}>{product.stock} {product.unit}{product.lowStock && ' · Stock bajo'}</span>
    <strong className="line-price">{money(product.price)}</strong><Plus aria-hidden="true" size={19} />
  </button>
}

function CartRow({ item, onChange, onRemove }: { item: CartItem; onChange: (id: string, delta: number) => void; onRemove: (id: string) => void }) {
  return <div className="cart-row"><div className="cart-product"><strong>{item.name}</strong><span>{money(item.price)} / {item.unit}</span></div><div className="quantity-control"><button onClick={() => onChange(item.id, -1)} aria-label="Reducir cantidad"><Minus size={13} /></button><input aria-label={`Cantidad de ${item.name}`} type="number" min={item.fractionable ? '0.001' : '1'} step={item.fractionable ? '0.001' : '1'}
    value={item.quantity} onChange={event => {
      const quantity = +event.target.value
      if (Number.isFinite(quantity) && quantity > 0 && (!item.fractionable ? Number.isInteger(quantity) : Math.round(quantity * 1000) === quantity * 1000))
        onChange(item.id, (quantity - item.quantity) / (item.fractionable ? 0.125 : 1))
    }} /><button onClick={() => onChange(item.id, 1)} aria-label="Aumentar cantidad"><Plus size={13} /></button></div><strong className="cart-line-total">{money(lineTotal(item))}</strong><button className="remove-item" onClick={() => onRemove(item.id)} aria-label={`Eliminar ${item.name}`}><Trash2 size={15} /></button></div>
}

function MoreDots() { return <span className="more-dots"><i></i><i></i><i></i></span> }

function QrModal({ url, invoice, canvasRef, copied, onCopy, onDownload, onClose }: { url: string; invoice: Invoice; canvasRef: React.RefObject<HTMLCanvasElement>; copied: boolean; onCopy: () => void; onDownload: () => void; onClose: () => void }) {
  const [fullScreen, setFullScreen] = useState(false)
  const [deviceViewOpen, setDeviceViewOpen] = useState(false)
  return <>
    <div className={fullScreen ? 'modal-backdrop qr-backdrop-fullscreen' : 'modal-backdrop'} style={deviceViewOpen ? { visibility: 'hidden' } : undefined} aria-hidden={deviceViewOpen || undefined} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className={fullScreen ? 'modal qr-modal qr-modal-fullscreen' : 'modal qr-modal'} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        <button className="fullscreen-toggle" onClick={() => setFullScreen((current) => !current)} aria-label={fullScreen ? 'Salir de pantalla completa' : 'Poner QR en pantalla completa'}>{fullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{fullScreen ? 'Salir de pantalla completa' : 'QR a toda la pantalla'}</span></button>
        <div className="modal-kicker"><span><QrCode size={15} /></span> Venta confirmada</div>
        <h2 id="qr-modal-title">QR de {invoice.invoiceNumber}</h2>
        <p className="modal-subtitle">Escanea este código para abrir el comprobante.</p>
        <div className="qr-stage"><div className="qr-frame"><QRCodeCanvas ref={canvasRef} value={url} size={1024} level="H" boostLevel={false} includeMargin /></div><div className="qr-specs"><span><i></i> Versión automática</span><span><i></i> Corrección alta (H)</span></div></div>
        <div className="qr-total"><span>Total de la venta</span><strong>{money(invoice.totals.total)}</strong></div>
        <div className="modal-actions"><button className="button button-secondary" onClick={onCopy}>{copied ? <><Check size={17} /> Copiado</> : <><Copy size={17} /> Copiar enlace</>}</button><button className="button button-primary" onClick={onDownload}><FileDown size={17} /> Descargar QR</button></div>
        <a className="button button-secondary receipt-link" href={url} target="_blank" rel="noreferrer">Abrir comprobante</a>
        <button className="button device-preview-button" onClick={() => setDeviceViewOpen(true)}><Monitor size={17} /> Ver en dispositivo 3D</button>
        <p className="modal-note">El enlace estará disponible por 30 días.</p>
      </section>
    </div>
    {deviceViewOpen && <DeviceQrView url={url} invoice={invoice} onClose={() => setDeviceViewOpen(false)} />}
  </>
}

function DeviceQrView({ url, invoice, onClose }: { url: string; invoice: Invoice; onClose: () => void }) {
  return <Suspense fallback={<div className="device-view-backdrop"><div className="device-loading" role="status">Preparando el dispositivo 3D… <button className="button button-secondary" onClick={onClose}>Volver</button></div></div>}>
    <DeviceViewer json={url} invoiceNumber={invoice.invoiceNumber} total={money(invoice.totals.total)} onClose={onClose} />
  </Suspense>
}

function ReaderModal({ onClose, onScan, scanError, scanSuccess, onLoad }: { onClose: () => void; onScan: (value: string) => void; scanError: string; scanSuccess: Invoice | null; onLoad: () => void }) {
  const [cameraError, setCameraError] = useState('')
  const [manualJson, setManualJson] = useState('')

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    const stopScanner = () => {
      try { scanner.stop().catch(() => undefined) } catch { /* Puede estar en estado inicial. */ }
    }
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1 }, (value) => {
      setCameraError('')
      onScan(value)
      stopScanner()
    }, () => undefined).catch(() => setCameraError('No se pudo acceder a la cámara. Puedes subir una imagen o pegar el JSON.'))
    return () => {
      stopScanner()
      try { scanner.clear() } catch { /* La cámara puede no haber terminado de iniciar. */ }
    }
  }, [onScan])

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCameraError('')
    let fallbackScanner: Html5Qrcode | null = null

    try {
      let value: string
      try {
        value = await decodeImageFile(file)
      } catch {
        fallbackScanner = new Html5Qrcode('qr-file-reader')
        value = await fallbackScanner.scanFile(file, true)
      }
      setCameraError('')
      onScan(value)
    } catch {
      setCameraError('No encontramos un QR legible en esa imagen. Descarga nuevamente el QR en alta resolución e inténtalo otra vez.')
    } finally {
      try { fallbackScanner?.clear() } catch { /* El lector ya puede estar limpio. */ }
    }
  }

  const submitManual = (event: FormEvent) => { event.preventDefault(); if (manualJson.trim()) onScan(manualJson.trim()) }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className="modal reader-modal" role="dialog" aria-modal="true" aria-labelledby="reader-modal-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button><div className="modal-kicker reader-kicker"><span><Camera size={15} /></span> Importar venta</div><h2 id="reader-modal-title">Leer comprobante QR</h2><p className="modal-subtitle">Escanea con la cámara o carga una imagen del código del comprobante.</p><div className="reader-layout"><div className="scanner-column"><div className="scanner-shell"><div id="qr-reader"></div><div id="qr-file-reader" className="file-scanner"></div>{cameraError && <div className="scanner-message"><Camera size={22} /><span>{cameraError}</span></div>}</div><label className="upload-button"><Upload size={16} /> Subir imagen QR<input type="file" accept="image/*" onChange={handleFile} /></label></div><div className="reader-divider"><span>o</span></div><form className="manual-column" onSubmit={submitManual}><label htmlFor="manual-json">Pegar enlace o JSON del comprobante</label><textarea id="manual-json" value={manualJson} onChange={(event) => setManualJson(event.target.value)} placeholder={'{\n  "invoiceNumber": "FAC-..."\n}'}></textarea><button className="button button-secondary" type="submit"><Clipboard size={16} /> Consultar comprobante</button></form></div>{scanError && <div className="scan-feedback error"><X size={16} /> {scanError}</div>}{scanSuccess && <div className="scan-feedback success"><div className="success-icon"><Check size={16} /></div><div><strong>Comprobante {scanSuccess.invoiceNumber} encontrado</strong><span>{scanSuccess.items.length} productos · Total {money(scanSuccess.totals.total)}</span></div><button className="button button-primary" onClick={onLoad}>Cargar venta</button></div>}<p className="modal-note">La venta importada reemplazará los productos de la venta actual.</p></section></div>
}

export default App
