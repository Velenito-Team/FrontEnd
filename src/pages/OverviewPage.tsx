import { useEffect, useState } from 'react'
import { getReport, getProducts, type Report, type BackendProduct } from '../services/api'
import { today, money } from './SalesPage'

export default function OverviewPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [report, setReport] = useState<Report>()
  const [products, setProducts] = useState<BackendProduct[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([getReport({ desde: today(), hasta: today() }), getProducts()]).then(([r,p]) => { setReport(r); setProducts(p.filter(x => x.activo)) })
      .catch(e => setError((e as Error).message))
  }, [])
  if (error) return <p role="alert" className="notice error">{error}</p>
  if (!report) return <p role="status">Cargando resumen…</p>
  const low = products.filter(p => p.umbralMinimo != null && p.stock <= p.umbralMinimo)
  return <section className="panel management-panel">
    <h2>Actividad de hoy</h2><div className="stats-grid">
      <div><span>Ventas vigentes</span><strong>{report.ventas}</strong></div><div><span>Total vendido</span><strong>{money(report.total)}</strong></div>
      <div><span>Ticket promedio</span><strong>{money(report.promedio)}</strong></div><div><span>Productos activos</span><strong>{products.length}</strong></div></div>
    <div className="report-breakdown"><section><h3>Stock por reponer · {low.length}</h3>
      {low.map(p => <p key={p.id}>{p.nombre}<strong>{p.stock} {p.unidad}</strong></p>)}
      {!low.length && <p>Los productos están por encima de su umbral.</p>}
      <button className="button button-secondary" onClick={() => onNavigate('Inventario')}>Consultar inventario</button></section>
      <section><h3>Ventas por medio</h3>{Object.entries(report.porMedio).map(([method,total]) => <p key={method}>{method}<strong>{money(total)}</strong></p>)}
        <button className="button button-primary" onClick={() => onNavigate('Ventas')}>Nueva venta</button></section></div>
  </section>
}
