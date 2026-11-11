import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Clipboard,
  Copy,
  FileDown,
  FilePlus2,
  FileScan,
  Focus,
  LayoutDashboard,
  Maximize2,
  Monitor,
  Minus,
  Minimize2,
  Package,
  Plus,
  QrCode,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'

type Category = 'Todos' | 'Abarrotes' | 'Bebidas' | 'Lácteos' | 'Snacks' | 'Aseo'

type Product = {
  id: string
  name: string
  category: Exclude<Category, 'Todos'>
  price: number
  stock: number
  color: string
  icon: string
  tag?: string
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

const products: Product[] = [
  { id: 'ARR-001', name: 'Arroz Diana 1 kg', category: 'Abarrotes', price: 4500, stock: 28, color: 'yellow', icon: '🍚', tag: 'Más vendido' },
  { id: 'ACE-014', name: 'Aceite vegetal 900 ml', category: 'Abarrotes', price: 7900, stock: 16, color: 'gold', icon: '🫗' },
  { id: 'LEC-009', name: 'Leche entera 1 L', category: 'Lácteos', price: 4200, stock: 14, color: 'blue', icon: '🥛', tag: 'Nuevo' },
  { id: 'HUE-004', name: 'Huevos AA x12', category: 'Lácteos', price: 8900, stock: 8, color: 'orange', icon: '🥚' },
  { id: 'GAS-021', name: 'Gaseosa Postobón 1.5 L', category: 'Bebidas', price: 6500, stock: 22, color: 'red', icon: '🥤' },
  { id: 'AGU-017', name: 'Agua Cristal 600 ml', category: 'Bebidas', price: 2500, stock: 31, color: 'blue', icon: '💧' },
  { id: 'PAP-006', name: 'Papas Margarita', category: 'Snacks', price: 3800, stock: 18, color: 'green', icon: '🥔' },
  { id: 'ASE-003', name: 'Jabón Rey', category: 'Aseo', price: 2900, stock: 10, color: 'purple', icon: '🧼' },
]

const categories: Array<{ label: Category; count: string }> = [
  { label: 'Todos', count: '24' },
  { label: 'Abarrotes', count: '08' },
  { label: 'Bebidas', count: '05' },
  { label: 'Lácteos', count: '04' },
  { label: 'Snacks', count: '04' },
  { label: 'Aseo', count: '03' },
]

const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
// QR v40/L admite hasta 2.953 bytes en modo byte; dejamos margen para que el
// lector no trabaje al límite y para mantener el JSON estable en UTF-8.
const QR_SAFE_LIMIT_BYTES = 2800

function getInvoicePayloadBytes(items: CartItem[], invoiceNumber: string) {
  return new TextEncoder().encode(JSON.stringify(createInvoice(items, invoiceNumber))).length
}

function formatBytes(value: number) {
  return value.toLocaleString('es-CO')
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

function createInvoice(items: CartItem[], invoiceNumber: string): Invoice {
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0)
  const tax = Math.round(subtotal * 0.19)

  return {
    schemaVersion: '1.0',
    invoiceNumber,
    issuedAt: new Date().toISOString(),
    currency: 'COP',
    paymentMethod: 'Pendiente',
    seller: { name: 'Tienda El Veleñito', terminal: 'Caja 01' },
    items: items.map((item) => ({
      productId: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: item.price * item.quantity,
    })),
    totals: { subtotal, tax, total: subtotal + tax },
  }
}

function App() {
  const [activeCategory, setActiveCategory] = useState<Category>('Todos')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([products[0], products[2]].map((product, index) => ({ ...product, quantity: index + 1 })))
  const [invoiceNumber, setInvoiceNumber] = useState('FAC-2026-0018')
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanSuccess, setScanSuccess] = useState<Invoice | null>(null)
  const [copied, setCopied] = useState(false)
  const [capacityError, setCapacityError] = useState('')
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory
    const query = search.trim().toLowerCase()
    return matchesCategory && (!query || `${product.name} ${product.id}`.toLowerCase().includes(query))
  }), [activeCategory, search])

  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)
  const tax = Math.round(subtotal * 0.19)
  const total = subtotal + tax
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0)
  const qrBytes = getInvoicePayloadBytes(cart, invoiceNumber)
  const qrUsage = Math.min((qrBytes / QR_SAFE_LIMIT_BYTES) * 100, 100)

  const rejectIfQrIsTooLarge = (nextCart: CartItem[]) => {
    const nextBytes = getInvoicePayloadBytes(nextCart, invoiceNumber)
    if (nextBytes > QR_SAFE_LIMIT_BYTES) {
      setCapacityError(`La factura ocuparía ${formatBytes(nextBytes)} bytes y el límite seguro es ${formatBytes(QR_SAFE_LIMIT_BYTES)} bytes. Reduce productos o cantidades.`)
      return true
    }
    setCapacityError('')
    return false
  }

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.id === product.id)
    const nextCart = existing
      ? cart.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...cart, { ...product, quantity: 1 }]
    if (!rejectIfQrIsTooLarge(nextCart)) setCart(nextCart)
  }

  const updateQuantity = (id: string, delta: number) => {
    const nextCart = cart.flatMap((item) => {
      if (item.id !== id) return [item]
      const quantity = item.quantity + delta
      return quantity > 0 ? [{ ...item, quantity }] : []
    })
    if (!rejectIfQrIsTooLarge(nextCart)) setCart(nextCart)
  }

  const openQrModal = () => {
    if (!cart.length) return
    const invoice = createInvoice(cart, invoiceNumber)
    const payloadBytes = new TextEncoder().encode(JSON.stringify(invoice)).length
    if (payloadBytes > QR_SAFE_LIMIT_BYTES) {
      setCapacityError(`No se puede generar el QR: la factura ocupa ${formatBytes(payloadBytes)} bytes y supera el límite seguro.`)
      return
    }
    setGeneratedInvoice(invoice)
    setQrModalOpen(true)
  }

  const handleScan = useCallback((rawValue: string) => {
    try {
      const parsed = JSON.parse(rawValue) as Invoice
      if (!parsed.invoiceNumber || !Array.isArray(parsed.items) || !parsed.totals?.total) throw new Error('El código no contiene una factura válida.')
      setScanSuccess(parsed)
      setScanError('')
    } catch (error) {
      setScanSuccess(null)
      setScanError(error instanceof Error ? error.message : 'No se pudo leer el JSON de la factura.')
    }
  }, [])

  const loadScannedInvoice = () => {
    if (!scanSuccess) return
    const newCart: CartItem[] = scanSuccess.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId) ?? {
        id: item.productId,
        name: item.name,
        category: 'Abarrotes' as const,
        price: item.unitPrice,
        stock: 99,
        color: 'blue',
        icon: '📦',
      }
      return { ...product, price: item.unitPrice, quantity: item.quantity }
    })
    setCart(newCart)
    setInvoiceNumber(scanSuccess.invoiceNumber)
    setCapacityError('')
    setReaderOpen(false)
    setScanSuccess(null)
  }

  const copyJson = async () => {
    if (!generatedInvoice) return
    await navigator.clipboard.writeText(JSON.stringify(generatedInvoice, null, 2))
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
          <div className="brand-mark"><QrCode size={22} strokeWidth={2.5} /></div>
          <div><span className="brand-name">El <span>Veleñito</span></span><small>Punto de venta de barrio</small></div>
        </div>

        <div className="store-switcher">
          <div className="store-avatar">N</div>
          <div><strong>Tienda El Veleñito</strong><span>Sede principal</span></div>
          <ChevronDown size={16} />
        </div>

        <nav className="main-nav" aria-label="Navegación principal">
          <p className="nav-label">Menú principal</p>
          <button className="nav-item active"><LayoutDashboard size={18} /> Resumen <span className="nav-pill">01</span></button>
          <button className="nav-item"><ShoppingCart size={18} /> Ventas <span className="nav-pill nav-pill-highlight">{itemCount}</span></button>
          <button className="nav-item"><Package size={18} /> Productos</button>
          <button className="nav-item"><BarChart3 size={18} /> Reportes</button>
          <p className="nav-label nav-label-spaced">Administración</p>
          <button className="nav-item"><Archive size={18} /> Inventario</button>
          <button className="nav-item"><Settings size={18} /> Configuración</button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>¿Necesitas ayuda?</strong><span>Consulta el centro de soporte</span></div><ArrowRight size={15} /></div>
          <div className="user-profile"><div className="user-avatar">JR</div><div><strong>Juliana Rojas</strong><span>Administradora</span></div><MoreDots /></div>
          <p className="license-note">Software libre bajo GPLv3 · Sin garantía</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Ventas</span><ChevronDown size={14} /><strong>Nueva factura</strong></div>
          <div className="topbar-actions"><div className="live-status"><span></span> Operación local</div><button className="icon-button"><Bell size={19} /><i></i></button><div className="topbar-date">Martes, 10 nov 2026</div></div>
        </header>

        <div className="page-heading">
          <div><p className="eyebrow">Punto de venta <span></span> Caja 01</p><h1>Nueva factura</h1><p className="heading-copy">Crea una venta, genera su QR y mantén todo bajo control.</p></div>
          <div className="heading-actions"><button className="button button-secondary" onClick={() => setReaderOpen(true)}><FileScan size={17} /> Leer factura QR</button><button className="button button-primary" onClick={() => { setCart([]); setCapacityError('') }}><FilePlus2 size={17} /> Nueva venta</button></div>
        </div>

        <section className="metric-row" aria-label="Resumen del negocio">
          <MetricCard icon={<ShoppingBag size={18} />} label="Ventas de hoy" value="$ 2.480.000" delta="+12,8%" positive color="blue" />
          <MetricCard icon={<Boxes size={18} />} label="Productos activos" value="24" delta="2 por reponer" color="gold" />
          <MetricCard icon={<BarChart3 size={18} />} label="Ticket promedio" value="$ 86.900" delta="+4,2%" positive color="purple" />
        </section>

        <div className="workspace-grid">
          <section className="catalog-panel panel">
            <div className="panel-heading"><div><h2>Catálogo de productos</h2><p>Selecciona un producto para añadirlo a la factura.</p></div><button className="text-button">Ver catálogo <ArrowRight size={15} /></button></div>
            <div className="catalog-toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto o SKU..." /><kbd>⌘ K</kbd></label><button className="filter-button"><span className="filter-dot"></span> Más vendidos</button></div>
            <div className="category-tabs">{categories.map((category) => <button key={category.label} className={activeCategory === category.label ? 'category-tab active' : 'category-tab'} onClick={() => setActiveCategory(category.label)}>{category.label}<span>{category.count}</span></button>)}</div>
            <div className="product-grid">{filteredProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}</div>
            {!filteredProducts.length && <div className="empty-products"><Search size={25} /><strong>No encontramos productos</strong><span>Prueba con otro nombre o categoría.</span></div>}
          </section>

          <section className="invoice-panel panel">
            <div className="invoice-heading"><div><div className="invoice-label"><span className="invoice-live-dot"></span> Factura en curso</div><h2>{invoiceNumber}</h2><p>{new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })} <span>·</span> {itemCount} {itemCount === 1 ? 'artículo' : 'artículos'}</p></div><button className="more-button" aria-label="Más opciones"><MoreDots /></button></div>
            <div className="invoice-customer"><div className="customer-icon"><UserRound size={17} /></div><div><span>Cliente</span><strong>Consumidor final</strong></div><button className="change-customer">Cambiar <ChevronDown size={14} /></button></div>
            <div className="cart-list">{cart.length ? cart.map((item) => <CartRow key={item.id} item={item} onChange={updateQuantity} onRemove={(id) => { setCart((current) => current.filter((cartItem) => cartItem.id !== id)); setCapacityError('') }} />) : <div className="empty-cart"><ShoppingCart size={30} /><strong>Tu factura está vacía</strong><span>Selecciona productos del catálogo para comenzar.</span></div>}</div>
            <div className="invoice-summary"><SummaryRow label="Subtotal" value={money(subtotal)} /><SummaryRow label="IVA (19%)" value={money(tax)} /><div className="total-row"><span>Total a pagar</span><strong>{money(total)}</strong></div></div>
            {capacityError && <div className="capacity-error" role="alert"><X size={15} /> {capacityError}</div>}
            <div className={`qr-capacity ${qrBytes > QR_SAFE_LIMIT_BYTES * 0.85 ? 'near-limit' : ''} ${qrBytes > QR_SAFE_LIMIT_BYTES ? 'over-limit' : ''}`}><div><span><QrCode size={13} /> Capacidad segura del QR</span><strong>{formatBytes(qrBytes)} / {formatBytes(QR_SAFE_LIMIT_BYTES)} bytes</strong></div><div className="capacity-track"><span style={{ width: `${qrUsage}%` }} /></div><small>{qrBytes > QR_SAFE_LIMIT_BYTES ? 'Reduce información para poder generar el código.' : 'Se calcula con el JSON real en UTF-8.'}</small></div>
            <button className="generate-button" disabled={!cart.length || qrBytes > QR_SAFE_LIMIT_BYTES} onClick={openQrModal}><span><QrCode size={19} /> Generar factura y QR</span><ArrowRight size={18} /></button>
            <p className="invoice-footnote"><Clipboard size={13} /> El QR guardará la información completa en formato JSON.</p>
          </section>
        </div>
      </main>

      {qrModalOpen && generatedInvoice && <QrModal invoice={generatedInvoice} canvasRef={qrCanvasRef} copied={copied} onCopy={copyJson} onDownload={downloadQr} onClose={() => setQrModalOpen(false)} />}
      {readerOpen && <ReaderModal onClose={() => { setReaderOpen(false); setScanSuccess(null); setScanError('') }} onScan={handleScan} scanError={scanError} scanSuccess={scanSuccess} onLoad={loadScannedInvoice} />}
    </div>
  )
}

function MetricCard({ icon, label, value, delta, positive, color }: { icon: React.ReactNode; label: string; value: string; delta: string; positive?: boolean; color: string }) {
  return <div className="metric-card"><div className={`metric-icon ${color}`}>{icon}</div><div className="metric-info"><span>{label}</span><strong>{value}</strong></div><div className={positive ? 'metric-delta positive' : 'metric-delta'}>{positive && '↗ '}{delta}</div></div>
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) {
  return <article className="product-card" onClick={() => onAdd(product)}><div className={`product-art ${product.color}`}><span>{product.icon}</span>{product.tag && <em>{product.tag}</em>}<button className="quick-add" onClick={(event) => { event.stopPropagation(); onAdd(product) }} aria-label={`Añadir ${product.name}`}><Plus size={17} /></button></div><div className="product-info"><div><span className="product-category">{product.category}</span><h3>{product.name}</h3></div><strong>{money(product.price)}</strong></div><div className="product-meta"><span>SKU {product.id}</span><span className={product.stock < 10 ? 'low-stock' : ''}><i></i>{product.stock} disponibles</span></div></article>
}

function CartRow({ item, onChange, onRemove }: { item: CartItem; onChange: (id: string, delta: number) => void; onRemove: (id: string) => void }) {
  return <div className="cart-row"><div className={`cart-thumb ${item.color}`}>{item.icon}</div><div className="cart-product"><strong>{item.name}</strong><span>{money(item.price)} c/u</span></div><div className="quantity-control"><button onClick={() => onChange(item.id, -1)} aria-label="Reducir cantidad"><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => onChange(item.id, 1)} aria-label="Aumentar cantidad"><Plus size={13} /></button></div><strong className="cart-line-total">{money(item.price * item.quantity)}</strong><button className="remove-item" onClick={() => onRemove(item.id)} aria-label={`Eliminar ${item.name}`}><Trash2 size={15} /></button></div>
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="summary-row"><span>{label}</span><strong>{value}</strong></div> }

function MoreDots() { return <span className="more-dots"><i></i><i></i><i></i></span> }

function QrModal({ invoice, canvasRef, copied, onCopy, onDownload, onClose }: { invoice: Invoice; canvasRef: React.RefObject<HTMLCanvasElement>; copied: boolean; onCopy: () => void; onDownload: () => void; onClose: () => void }) {
  const [fullScreen, setFullScreen] = useState(false)
  const json = JSON.stringify(invoice)
  const jsonBytes = new TextEncoder().encode(json).length
  return <div className={fullScreen ? 'modal-backdrop qr-backdrop-fullscreen' : 'modal-backdrop'} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className={fullScreen ? 'modal qr-modal qr-modal-fullscreen' : 'modal qr-modal'} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button><button className="fullscreen-toggle" onClick={() => setFullScreen((current) => !current)} aria-label={fullScreen ? 'Salir de pantalla completa' : 'Poner QR en pantalla completa'}>{fullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{fullScreen ? 'Salir de pantalla completa' : 'QR a toda la pantalla'}</span></button><div className="modal-kicker"><span><QrCode size={15} /></span> Factura lista</div><h2 id="qr-modal-title">QR de {invoice.invoiceNumber}</h2><p className="modal-subtitle">Escanea este código para transferir la factura completa.</p><div className="qr-stage"><div className="qr-frame"><QRCodeCanvas ref={canvasRef} value={json} size={1024} level="L" minVersion={40} boostLevel={false} includeMargin /></div><div className="qr-specs"><span><i></i> Versión 40</span><span><i></i> Corrección baja (L)</span><span><i></i> {formatBytes(jsonBytes)} / {formatBytes(QR_SAFE_LIMIT_BYTES)} bytes</span></div></div><div className="qr-total"><span>Total de la factura</span><strong>{money(invoice.totals.total)}</strong></div><div className="modal-actions"><button className="button button-secondary" onClick={onCopy}>{copied ? <><Check size={17} /> Copiado</> : <><Copy size={17} /> Copiar JSON</>}</button><button className="button button-primary" onClick={onDownload}><FileDown size={17} /> Descargar QR</button></div><p className="modal-note">El archivo PNG se genera en alta resolución para mejorar la lectura. La sincronización con Spring Boot se añadirá en la siguiente fase.</p></section></div>
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

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}><section className="modal reader-modal" role="dialog" aria-modal="true" aria-labelledby="reader-modal-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button><div className="modal-kicker reader-kicker"><span><Camera size={15} /></span> Importar venta</div><h2 id="reader-modal-title">Leer factura QR</h2><p className="modal-subtitle">Escanea con la cámara o carga una imagen del código de factura.</p><div className="reader-layout"><div className="scanner-column"><div className="scanner-shell"><div id="qr-reader"></div><div id="qr-file-reader" className="file-scanner"></div>{cameraError && <div className="scanner-message"><Camera size={22} /><span>{cameraError}</span></div>}</div><label className="upload-button"><Upload size={16} /> Subir imagen QR<input type="file" accept="image/*" onChange={handleFile} /></label></div><div className="reader-divider"><span>o</span></div><form className="manual-column" onSubmit={submitManual}><label htmlFor="manual-json">Pegar JSON de factura</label><textarea id="manual-json" value={manualJson} onChange={(event) => setManualJson(event.target.value)} placeholder={'{\n  "invoiceNumber": "FAC-..."\n}'}></textarea><button className="button button-secondary" type="submit"><Clipboard size={16} /> Validar JSON</button></form></div>{scanError && <div className="scan-feedback error"><X size={16} /> {scanError}</div>}{scanSuccess && <div className="scan-feedback success"><div className="success-icon"><Check size={16} /></div><div><strong>Factura {scanSuccess.invoiceNumber} encontrada</strong><span>{scanSuccess.items.length} productos · Total {money(scanSuccess.totals.total)}</span></div><button className="button button-primary" onClick={onLoad}>Cargar factura</button></div>}<p className="modal-note">La factura leída reemplazará los productos de la venta actual.</p></section></div>
}

export default App
