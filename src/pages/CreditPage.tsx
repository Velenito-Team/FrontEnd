import { useEffect, useState } from 'react'
import { getCustomers, type Customer } from '../services/api'
import { money } from './SalesPage'

export default function CreditPage({ onSale }: { onSale: (customer: Customer) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    getCustomers().then(rows => { if (active) setCustomers(rows) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])
  const filtered = customers.filter(customer => customer.nombre.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section className="panel management-panel"><h2>Cuaderno de fiados</h2>
    {loading ? <p role="status">Consultando saldos…</p> : error ? <div role="alert">No se pudieron consultar los saldos. <button className="button" onClick={() => setAttempt(n => n + 1)}>Reintentar</button></div> : <>
      <label className="credit-search">Buscar cliente<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      {filtered.map(customer => <div className="credit-row" key={customer.id}><div><strong>{customer.nombre}</strong><p>Saldo pendiente · {money(customer.saldo)}</p></div>
        <button className="button button-secondary" onClick={() => onSale(customer)}>Venta fiada</button></div>)}
      {!filtered.length && <p>{customers.length ? 'No hay coincidencias para esa búsqueda.' : 'Todavía no hay clientes autorizados. Puedes registrar uno al preparar una venta fiada.'}</p>}
    </>}
  </section>
}
