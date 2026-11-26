import { useEffect, useRef, useState } from 'react'
import { getProducts, saveProduct, deactivateProduct, receiveStock, type BackendProduct, type ProductInput } from '../services/api'
import Modal from '../components/Modal'

const empty: ProductInput = { nombre: '', categoria: '', precioCompra: 1, precioVenta: 1,
  unidad: 'unidad', stock: 0, activo: true, fraccionable: false }
const money = (value: number) => value.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function ProductsPage({ inventory, onChange, canManage = true }: { canManage?: boolean; inventory: boolean; onChange: () => void }) {
  const [products, setProducts] = useState<BackendProduct[]>([])
  const [query, setQuery] = useState('')
  const [low, setLow] = useState(false)
  const [inactive, setInactive] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<BackendProduct | 'new' | null>(null)
  const [entry, setEntry] = useState<BackendProduct | null>(null)
  const [confirmation, setConfirmation] = useState<BackendProduct | null>(null)
  const [busy, setBusy] = useState(false)
  const load = async () => {
    setLoading(true)
    try { setProducts(await getProducts()); setError('') } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const changed = async (text: string) => { setMessage(text); await load(); onChange() }
  const filtered = products.filter(p => (inactive || p.activo) && (!low || p.umbralMinimo != null && p.stock <= p.umbralMinimo)
    && `${p.nombre} ${p.categoria}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <section className="panel management-panel">
    <div className="panel-heading"><h2>{inventory ? 'Existencias y entradas' : 'Productos'}</h2>
      <button className="button button-primary" onClick={() => setEditing('new')}>Nuevo producto</button></div>
    <div className="filters"><label>Buscar producto<input value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label className="check-label"><input type="checkbox" checked={low} onChange={e => setLow(e.target.checked)} /> Stock bajo</label>
      <label className="check-label"><input type="checkbox" checked={inactive} onChange={e => setInactive(e.target.checked)} /> Incluir inactivos</label>
      <button className="button button-secondary" onClick={load}>Actualizar</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {message && <p className="notice success" role="status">{message}</p>}
    {loading ? <p role="status">Cargando productos…</p> : <div className="table-scroll"><table>
      <thead><tr><th>Producto</th><th>Categoría</th><th>Precio venta</th><th>Stock</th><th>Umbral</th><th>Estado</th>{canManage && <th>Acciones</th>}</tr></thead>
      <tbody>{filtered.map(p => <tr key={p.id}><td>{p.nombre}</td><td>{p.categoria}</td><td>{money(p.precioVenta)}</td>
        <td className={p.umbralMinimo != null && p.stock <= p.umbralMinimo ? 'low-stock' : ''}>{p.stock} {p.unidad}</td>
        <td>{p.umbralMinimo ?? '—'}</td><td>{p.activo ? 'Activo' : 'Inactivo'}</td>{canManage && <td className="row-actions">
          <button onClick={() => setEditing(p)} aria-label={`Editar ${p.nombre}`}>Editar</button>
          {inventory && <button onClick={() => setEntry(p)} aria-label={`Entrada de ${p.nombre}`}>Registrar entrada</button>}
          {p.activo && <button onClick={() => setConfirmation(p)} aria-label={`Desactivar ${p.nombre}`}>Desactivar</button>}
        </td>}</tr>)}</tbody>
    </table>{!filtered.length && <p>No hay productos con estos filtros.</p>}</div>}
    {editing && <ProductEditor product={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
      onSaved={async () => { setEditing(null); await changed('Producto guardado.') }} />}
    {entry && <StockEntry product={entry} onClose={() => setEntry(null)}
      onSaved={async () => { setEntry(null); await changed('Entrada registrada y stock actualizado.') }} />}
    {confirmation && <Modal title="Desactivar producto" onClose={() => { if (!busy) setConfirmation(null) }}>
      <p>¿Confirmas la desactivación de {confirmation.nombre}?</p><p>Sus movimientos históricos se conservan.</p>
      <button className="button button-primary" disabled={busy} onClick={async () => {
        setBusy(true)
        try { await deactivateProduct(confirmation.id); setConfirmation(null); await changed('Producto desactivado.') }
        catch(e) { setError((e as Error).message); setConfirmation(null) } finally { setBusy(false) }
      }}>Confirmar desactivación</button>
    </Modal>}
  </section>
}

function ProductEditor({ product, onClose, onSaved }: {
  product: BackendProduct | null; onClose: () => void; onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<ProductInput>(product ? { ...product } : { ...empty })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function field<K extends keyof ProductInput>(key: K, value: ProductInput[K]) { setForm(current => ({ ...current, [key]: value })) }
  return <Modal title={product ? 'Editar producto' : 'Nuevo producto'} onClose={() => { if (!busy) onClose() }}>
    <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('')
      try { await saveProduct(form, product?.id); await onSaved() }
      catch(e) { setError((e as Error).message) } finally { setBusy(false) }
    }} className="data-form">
      <label>Nombre<input required value={form.nombre} onChange={e => field('nombre', e.target.value)} /></label>
      <label>Categoría<input required value={form.categoria} onChange={e => field('categoria', e.target.value)} /></label>
      <div className="form-grid">
        <label>Precio de compra<input type="number" min="0.001" step="0.001" required value={form.precioCompra} onChange={e => field('precioCompra', +e.target.value)} /></label>
        <label>Precio de venta<input type="number" min="0.001" step="0.001" required value={form.precioVenta} onChange={e => field('precioVenta', +e.target.value)} /></label>
        <label>Unidad<select disabled={!!product} value={form.unidad} onChange={e => field('unidad', e.target.value as ProductInput['unidad'])}>
          {['unidad','kg','g','l'].map(u => <option key={u}>{u}</option>)}</select></label>
        <label>Stock inicial<input type="number" min="0" step={form.fraccionable ? '0.001' : '1'} required disabled={!!product}
          value={form.stock} onChange={e => field('stock', +e.target.value)} /></label>
        <label>Umbral mínimo<input type="number" min="0" step="0.001" value={form.umbralMinimo ?? ''}
          onChange={e => field('umbralMinimo', e.target.value === '' ? undefined : +e.target.value)} /></label>
      </div>
      <label className="check-label"><input type="checkbox" checked={form.fraccionable} onChange={e => field('fraccionable', e.target.checked)} /> Venta fraccionada</label>
      <label className="check-label"><input type="checkbox" checked={form.activo} onChange={e => field('activo', e.target.checked)} /> Producto activo</label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</button>
    </form>
  </Modal>
}

function StockEntry({ product, onClose, onSaved }: { product: BackendProduct; onClose: () => void; onSaved: () => Promise<void> }) {
  const [quantity, setQuantity] = useState('1')
  const [cost, setCost] = useState(String(product.precioCompra))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef({ fingerprint: '', key: '' })
  return <Modal title={`Entrada de ${product.nombre}`} onClose={() => { if (!busy) onClose() }}>
    <form className="data-form" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('')
      const fingerprint = `${quantity}:${cost}`
      if (operation.current.fingerprint !== fingerprint) operation.current = { fingerprint, key: crypto.randomUUID() }
      try {
        await receiveStock({ productoId: product.id, cantidad: +quantity, costoUnitario: +cost }, operation.current.key)
        await onSaved()
      } catch(e) { setError((e as Error).message) } finally { setBusy(false) }
    }}>
      <label>Cantidad recibida ({product.unidad})<input required type="number" min={product.fraccionable ? '0.001' : '1'}
        step={product.fraccionable ? '0.001' : '1'} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label>Costo por {product.unidad}<input required type="number" min="0.001" step="0.001" value={cost} onChange={e => setCost(e.target.value)} /></label>
      <p>La recepción aumenta el stock. El costo recibido queda guardado en su historial.</p>
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="button button-primary" disabled={busy}>Confirmar entrada</button>
    </form>
  </Modal>
}
