import { useEffect, useState } from 'react'
import { getCustomerCredits, getCustomers, type Customer, type CustomerCredit } from '../services/api'
import CustomerPicker from '../components/CustomerPicker'
import { money } from './SalesPage'

export default function CreditPage({ onSale }: { onSale: (customer: Customer) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [registering, setRegistering] = useState(false)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [credits, setCredits] = useState<CustomerCredit[]>([])
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [creditsError, setCreditsError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getCustomers().then(rows => { if (active) setCustomers(rows) })
      .catch(() => { if (active) setError('No se pudieron consultar los clientes y saldos.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    if (!selected) return
    let active = true
    setCreditsLoading(true)
    setCreditsError('')
    setCredits([])
    getCustomerCredits(selected.id).then(rows => { if (active) setCredits(rows) })
      .catch(() => { if (active) setCreditsError('El historial de compras fiadas de este cliente todavía no está disponible.') })
      .finally(() => { if (active) setCreditsLoading(false) })
    return () => { active = false }
  }, [selected])

  const filtered = customers.filter(customer => customer.nombre.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section className="panel management-panel credit-page">
    <div className="panel-heading"><div><h2>Cuaderno de fiados</h2><p>Clientes, saldos y compras a crédito.</p></div>
      <button className="button button-primary" onClick={() => setRegistering(true)}>Registrar cliente</button></div>
    {loading ? <p role="status">Consultando saldos…</p> : error ? <div role="alert">{error} <button className="button" onClick={() => setAttempt(n => n + 1)}>Reintentar</button></div> : <>
      <label className="credit-search">Buscar cliente<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {filtered.map(customer => <div className="credit-row" key={customer.id}><div><strong>{customer.nombre}</strong><p>Saldo pendiente · {money(customer.saldo)}</p></div>
        <div className="credit-actions"><button className="button button-secondary" onClick={() => setSelected(customer)}>Ver detalle</button>
          <button className="button button-secondary" onClick={() => onSale(customer)}>Venta fiada</button></div></div>)}
      {!filtered.length && <p>{customers.length ? 'No hay coincidencias para esa búsqueda.' : 'Todavía no hay clientes registrados.'}</p>}
    </>}
    {selected && <div className="credit-detail" aria-label={`Detalle de ${selected.nombre}`}>
      <div className="panel-heading"><div><h2>{selected.nombre}</h2><p>Saldo pendiente · {money(selected.saldo)}</p></div>
        <button className="button button-secondary" onClick={() => setSelected(null)}>Cerrar detalle</button></div>
      {selected.telefono && <p>Teléfono · {selected.telefono}</p>}
      {creditsLoading ? <p role="status">Consultando compras fiadas…</p> : creditsError ? <p role="status">{creditsError}</p> :
        credits.length ? credits.map(credit => <article className="credit-purchase" key={credit.id}>
          <div className="credit-purchase-heading"><strong>{new Date(credit.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</strong>
            <span>{credit.estado} · Saldo {money(credit.saldo)} de {money(credit.total)}</span></div>
          <ul>{credit.lineas.map((line, index) => <li key={`${line.productoId}-${index}`}>
            <span>{line.nombre} · {line.cantidad} {line.unidad}</span><strong>{money(line.subtotal)}</strong>
          </li>)}</ul>
        </article>) : <p>Este cliente todavía no tiene compras fiadas.</p>}
    </div>}
    {registering && <CustomerPicker registrationOnly onClose={() => setRegistering(false)} onSelect={customer => {
      setRegistering(false)
      if (customer) { setCustomers(current => [...current, customer].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))); setSelected(customer) }
    }} />}
  </section>
}
