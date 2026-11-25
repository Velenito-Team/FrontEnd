import { useEffect, useState } from 'react'
import { cancelSale, getProducts, getReport, getSales, reopenReceipt, type BackendProduct,
  type BackendReceipt, type Filters, type Report } from '../services/api'
import Modal from '../components/Modal'

export function today() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`
}
export const money = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export default function SalesPage({ reportOnly, onReceipt, onChange }: {
  reportOnly: boolean; onReceipt: (receipt: BackendReceipt, token: string) => void; onChange: () => void
}) {
  const [filters, setFilters] = useState<Filters>({ desde: today(), hasta: today() })
  const [data, setData] = useState<BackendReceipt[]>([])
  const [report, setReport] = useState<Report>()
  const [products, setProducts] = useState<BackendProduct[]>([])
  const [applied, setApplied] = useState<Filters>(filters)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<BackendReceipt | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function load(value: Filters) {
    setLoading(true); setError('')
    try {
      const [sales, summary] = await Promise.all([getSales(value), getReport(value)])
      setData(sales); setReport(summary); setApplied(value)
    } catch(e) { setError((e as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load(filters); getProducts().then(setProducts).catch(() => undefined) }, [])
  const csv = () => {
    const cell = (value: unknown) => {
      const text = String(value ?? '')
      return '"' + (/^[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"'
    }
    const rows: unknown[][] = [['ID','Fecha','Estado','Medio','Total COP'],
      ...data.map(s => [s.id, s.fecha, s.estado, s.metodo, s.total]),
      [], ['Período', applied.desde, applied.hasta], ['Total ventas vigentes COP', report?.total ?? 0]]
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ventas-${applied.desde}-${applied.hasta}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  return <section className="panel management-panel report-page">
    <div className="panel-heading"><h2>{reportOnly ? 'Reporte de ventas' : 'Historial de ventas'}</h2>
      <div className="row-actions"><button disabled={loading || !!error} onClick={csv}>Exportar CSV</button>
        <button disabled={loading || !!error} onClick={() => window.print()}>Imprimir / PDF</button></div></div>
    <form className="filters" onSubmit={e => { e.preventDefault(); void load(filters) }}>
      <label>Desde<input required type="date" value={filters.desde} onChange={e => setFilters({ ...filters, desde: e.target.value })} /></label>
      <label>Hasta<input required type="date" min={filters.desde} value={filters.hasta} onChange={e => setFilters({ ...filters, hasta: e.target.value })} /></label>
      <label>Medio<select value={filters.metodo ?? ''} onChange={e => setFilters({ ...filters, metodo: e.target.value })}>
        <option value="">Todos</option>{['efectivo','nequi','daviplata','fiado'].map(m => <option key={m}>{m}</option>)}</select></label>
      <label>Estado<select value={filters.estado ?? ''} onChange={e => setFilters({ ...filters, estado: e.target.value })}>
        <option value="">Todos</option><option>confirmada</option><option>anulada</option></select></label>
      <label>Producto<select value={filters.productoId ?? ''} onChange={e => setFilters({ ...filters, productoId: e.target.value })}>
        <option value="">Todos</option>{products.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <button className="button button-primary" disabled={loading}>Consultar</button>
    </form>
    {error && <p role="alert" className="notice error">{error}</p>}
    {loading ? <p role="status">Consultando ventas…</p> : !error && <>
      <p>Período {applied.desde} — {applied.hasta}</p>
      {report && <div className="stats-grid"><div><span>Ventas vigentes</span><strong>{report.ventas}</strong></div>
        <div><span>Total vendido</span><strong>{money(report.total)}</strong></div>
        <div><span>Ticket promedio</span><strong>{money(report.promedio)}</strong></div>
        <div><span>Anuladas</span><strong>{report.anuladas}</strong></div></div>}
      {reportOnly && report && <div className="report-breakdown"><section><h3>Ventas por medio</h3>
        {Object.entries(report.porMedio).map(([method,total]) => <p key={method}>{method}<strong>{money(total)}</strong></p>)}</section>
        <section><h3>Ventas por día</h3>{Object.entries(report.porDia).map(([day,total]) => <p key={day}>{day}<strong>{money(total)}</strong></p>)}</section>
        <section><h3>Productos vendidos</h3>{report.productos.map(p => <p key={p.productoId}>{p.nombre} · {p.cantidad}<strong>{money(p.total)}</strong></p>)}</section></div>}
      <div className="table-scroll"><table><thead><tr><th>Comprobante</th><th>Fecha Bogotá</th><th>Medio</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{data.map(sale => <tr key={sale.id}><td title={sale.id}>{sale.id.slice(-8)}</td>
          <td>{new Date(sale.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td><td>{sale.metodo}</td>
          <td>{money(sale.total)}</td><td>{sale.estado}</td><td className="row-actions">
            <button disabled={busy} onClick={async () => {
              setBusy(true)
              try { const result = await reopenReceipt(sale.id); onReceipt(result.comprobante, result.token) }
              catch(e) { setError((e as Error).message) } finally { setBusy(false) }
            }}>Ver comprobante</button>
            {sale.estado === 'confirmada' && new Date(sale.fecha).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) === today() &&
              <button onClick={() => { setReason(''); setSelected(sale) }}>Anular</button>}
          </td></tr>)}</tbody></table>{!data.length && <p>No hay ventas para este período.</p>}</div>
      <p className="muted">Los totales incluyen ventas fiadas vigentes. Los cobros se registran según el medio de pago.</p>
    </>}
    {selected && <Modal title="Anular venta" onClose={() => { if (!busy) setSelected(null) }}>
      <form className="data-form" onSubmit={async e => {
        e.preventDefault(); setBusy(true)
        try { await cancelSale(selected.id, reason); setSelected(null); await load(applied); onChange() }
        catch(e) { setError((e as Error).message); setSelected(null) } finally { setBusy(false) }
      }}><p>Se restituirán los productos y se revertirá el cobro de {money(selected.total)}.</p>
        <label>Motivo obligatorio<textarea required value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button disabled={busy || !reason.trim()} className="button button-primary">Confirmar anulación</button></form>
    </Modal>}
  </section>
}
