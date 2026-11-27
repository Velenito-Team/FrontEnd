import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getCustomerCredits,
  getCustomers,
  registerCreditPayment,
  type CreditPaymentReceipt,
  type Customer,
  type CustomerCredit,
} from '../services/api'
import CustomerPicker from '../components/CustomerPicker'
import Modal from '../components/Modal'
import { money } from './SalesPage'

export default function CreditPage({ onSale }: { onSale: (customer: Customer) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [onlyOutstanding, setOnlyOutstanding] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [registering, setRegistering] = useState(false)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null)
  const [paymentMessage, setPaymentMessage] = useState('')
  const [paymentReceipt, setPaymentReceipt] = useState<CreditPaymentReceipt | null>(null)
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

  const outstanding = customers.filter(customer => customer.saldo > 0)
  const visibleCustomers = onlyOutstanding
    ? outstanding.sort((a, b) => b.saldo - a.saldo || a.nombre.localeCompare(b.nombre, 'es'))
    : customers
  const query = search.trim().toLocaleLowerCase('es')
  const filtered = visibleCustomers.filter(customer => customer.nombre.toLocaleLowerCase('es').includes(query))
  return <section className="panel management-panel credit-page">
    <div className="panel-heading"><div><h2>Cuaderno de fiados</h2><p>Clientes, saldos y compras a crédito.</p></div>
      <button className="button button-primary" onClick={() => setRegistering(true)}>Registrar cliente</button></div>
    {paymentMessage && <p className="notice success" role="status">{paymentMessage}</p>}
    {loading ? <p role="status">Consultando saldos…</p> : error ? <div role="alert">{error} <button className="button" onClick={() => setAttempt(n => n + 1)}>Reintentar</button></div> : <>
      <label className="credit-search">Buscar cliente<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label className="check-label"><input type="checkbox" checked={onlyOutstanding}
        onChange={event => setOnlyOutstanding(event.target.checked)} /> Solo clientes con deuda activa</label>
      <ul className="credit-customers" aria-label={onlyOutstanding ? 'Clientes con deuda activa' : 'Todos los clientes'}>
      {filtered.map(customer => <li className="credit-row" key={customer.id}><div><strong>{customer.nombre}</strong><p>Saldo pendiente · {money(customer.saldo)}</p></div>
        <div className="credit-actions"><button className="button button-secondary" onClick={() => setSelected(customer)}>Ver detalle</button>
          <button className="button button-secondary" onClick={() => onSale(customer)}>Venta fiada</button></div></li>)}
      </ul>
      {!filtered.length && <p role="status">{visibleCustomers.length ? 'No hay coincidencias para esa búsqueda.'
        : onlyOutstanding ? 'No hay clientes con deuda activa.' : 'Todavía no hay clientes registrados.'}</p>}
    </>}
    {selected && <div className="credit-detail" aria-label={`Detalle de ${selected.nombre}`}>
      <div className="panel-heading"><div><h2>{selected.nombre}</h2><p>Saldo pendiente · {money(selected.saldo)}</p></div>
        <div className="credit-actions">
          {selected.saldo > 0 && <button className="button button-primary"
            disabled={creditsLoading || !!creditsError || !credits.some(credit => credit.saldo > 0)}
            onClick={() => {
            setPaymentMessage('')
            setPaymentReceipt(null)
            setPaymentCustomer(selected)
          }}>Registrar abono</button>}
          <button className="button button-secondary" onClick={() => setSelected(null)}>Cerrar detalle</button>
        </div></div>
      {selected.telefono && <p>Teléfono · {selected.telefono}</p>}
      {paymentReceipt && paymentReceipt.clienteId === selected.id && (
        <div className="notice success" role="status">
          <strong>Comprobante de abono · {paymentReceipt.comprobanteId}</strong>
          <p>{money(paymentReceipt.monto)} · {paymentReceipt.medio} · Saldo restante {money(paymentReceipt.saldoRestante)}</p>
          <p>Emitido · {new Date(paymentReceipt.emitidoEn).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
        </div>
      )}
      {creditsLoading ? <p role="status">Consultando compras fiadas…</p> : creditsError ? <p role="status">{creditsError}</p> :
        credits.length ? credits.map(credit => <article className="credit-purchase" key={credit.id}>
          <div className="credit-purchase-heading"><strong>{new Date(credit.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</strong>
            <span>{credit.estado} · Saldo {money(credit.saldo)} de {money(credit.total)}</span></div>
          <ul>{credit.lineas.map((line, index) => <li key={`${line.productoId}-${index}`}>
            <span>{line.nombre} · {line.cantidad} {line.unidad}</span><strong>{money(line.subtotal)}</strong>
          </li>)}</ul>
        </article>) : <p>Este cliente todavía no tiene compras fiadas.</p>}
      {!creditsLoading && !creditsError && selected.saldo > 0 && credits.length > 0 &&
        !credits.some(credit => credit.saldo > 0) && <p role="status">No hay deudas pendientes disponibles para abonar.</p>}
    </div>}
    {registering && <CustomerPicker registrationOnly onClose={() => setRegistering(false)} onSelect={customer => {
      setRegistering(false)
      if (customer) { setCustomers(current => [...current, customer].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))); setSelected(customer) }
    }} />}
    {paymentCustomer && <CreditPayment customer={paymentCustomer} credits={credits} onClose={() => setPaymentCustomer(null)}
      onSaved={receipt => {
        const updated = { ...paymentCustomer, saldo: receipt.saldoRestante }
        setCustomers(current => current.map(customer => customer.id === updated.id ? updated : customer))
        setSelected(updated)
        setPaymentReceipt(receipt)
        setPaymentCustomer(null)
        setPaymentMessage(`Abono registrado para ${updated.nombre}. Saldo pendiente: ${money(receipt.saldoRestante)}.`)
      }} />}
  </section>
}

function CreditPayment({ customer, credits, onClose, onSaved }: {
  customer: Customer
  credits: CustomerCredit[]
  onClose: () => void
  onSaved: (receipt: CreditPaymentReceipt) => void
}) {
  const [amount, setAmount] = useState('')
  const pendingCredits = credits.filter(credit => credit.saldo > 0)
  const [deudaId, setDeudaId] = useState(() => pendingCredits[0]?.id ?? '')
  const [medio, setMedio] = useState<CreditPaymentReceipt['medio']>('efectivo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef<{ payload: string; key: string }>()
  const value = Number(amount)
  const debt = pendingCredits.find(credit => credit.id === deudaId)
  const valid = !!debt && Number.isSafeInteger(value) && value > 0 && value <= debt.saldo

  useEffect(() => {
    if (!pendingCredits.some(credit => credit.id === deudaId)) {
      setDeudaId(pendingCredits[0]?.id ?? '')
    }
  }, [credits, deudaId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      const payment = { deudaId, monto: value, medio }
      const payload = JSON.stringify(payment)
      if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() }
      const result = await registerCreditPayment(customer.id, payment, operation.current.key)
      onSaved(result)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo confirmar el abono.')
    } finally {
      setBusy(false)
    }
  }

  return <Modal title={`Registrar abono · ${customer.nombre}`} onClose={() => { if (!busy) onClose() }}>
    <p>Saldo pendiente · {money(customer.saldo)}</p>
    <form className="data-form" onSubmit={submit}>
      <label>Deuda pendiente
        <select required value={deudaId} disabled={busy || pendingCredits.length === 0}
          onChange={event => { setDeudaId(event.target.value); setError('') }}>
          {pendingCredits.map(credit => (
            <option key={credit.id} value={credit.id}>
              {new Date(credit.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })} · Saldo {money(credit.saldo)}
            </option>
          ))}
        </select>
      </label>
      {pendingCredits.length === 0 && <p role="alert">Este cliente no tiene deudas pendientes disponibles para abonar.</p>}
      <label>Monto del abono (COP)
        <input type="number" min="1" max={debt?.saldo} step="1" required disabled={busy || !debt}
          value={amount} onChange={event => { setAmount(event.target.value); setError('') }} />
      </label>
      <label>Medio de pago
        <select value={medio} disabled={busy} onChange={event => setMedio(event.target.value as CreditPaymentReceipt['medio'])}>
          <option value="efectivo">Efectivo</option>
          <option value="nequi">Nequi</option>
          <option value="daviplata">Daviplata</option>
        </select>
      </label>
      <button type="button" className="button button-secondary" disabled={busy}
        onClick={() => { setAmount(String(debt?.saldo ?? 0)); setError('') }}>Pagar toda esta deuda</button>
      {amount && !valid && <p role="status">Ingresa un monto entero entre {money(1)} y {money(debt?.saldo ?? 0)}.</p>}
      {valid && <p>Saldo después del abono · <strong>{money((debt?.saldo ?? 0) - value)}</strong></p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="button button-primary" disabled={!valid || busy}>{busy ? 'Registrando…' : 'Confirmar abono'}</button>
    </form>
  </Modal>
}
