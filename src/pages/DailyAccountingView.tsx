import { useEffect, useState } from 'react'
import { ApiError, getDailyBalance, type DailyBalance } from '../services/api'
import { money, today } from './SalesPage'

export default function DailyAccountingView() {
  const latestDate = today()
  const [date, setDate] = useState(latestDate)
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= latestDate

  return <section aria-labelledby="daily-accounting-title">
    <h2 id="daily-accounting-title">Balance operativo diario</h2>
    <div className="filters">
      <label>Fecha del balance<input type="date" max={latestDate} value={date}
        onChange={event => setDate(event.target.value)} /></label>
    </div>
    {validDate ? <DailySummary key={date} date={date} /> : <p>Selecciona una fecha hasta el día de hoy.</p>}
  </section>
}

function DailySummary({ date }: { date: string }) {
  const [balance, setBalance] = useState<DailyBalance>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [notClosed, setNotClosed] = useState(false)

  useEffect(() => {
    let active = true
    setBalance(undefined)
    setError('')
    setNotClosed(false)
    getDailyBalance(date).then(data => {
      if (active) setBalance(data)
    }).catch(failure => {
      if (!active) return
      if (failure instanceof ApiError && failure.status === 409) {
        setNotClosed(true)
        return
      }
      setError(failure instanceof Error ? failure.message : 'No se pudo consultar el balance diario.')
    })
    return () => { active = false }
  }, [date, attempt])

  if (error) return <div role="alert" className="notice error">{error}{' '}
    <button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
  </div>
  if (notClosed) {
    return <div>
      <p role="status">Primero debes cerrar la caja para consultar el balance de este día.</p>
      <button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Actualizar estado</button>
    </div>
  }

  if (!balance) return <p role="status">Consultando balance del día…</p>

  return <>
    <h3>Ventas cobradas</h3>
    <dl className="settings-details">
      <dt>Efectivo</dt><dd>{money(balance.ventasCobradas.efectivo)}</dd>
      <dt>Nequi</dt><dd>{money(balance.ventasCobradas.nequi)}</dd>
      <dt>Daviplata</dt><dd>{money(balance.ventasCobradas.daviplata)}</dd>
    </dl>
    <h3>Abonos</h3>
    <dl className="settings-details">
      <dt>Efectivo</dt><dd>{money(balance.abonos.efectivo)}</dd>
      <dt>Nequi</dt><dd>{money(balance.abonos.nequi)}</dd>
      <dt>Daviplata</dt><dd>{money(balance.abonos.daviplata)}</dd>
    </dl>
    <h3>Egresos</h3>
    <dl className="settings-details">
      <dt>Efectivo</dt><dd>{money(balance.egresos.efectivo)}</dd>
      <dt>Nequi</dt><dd>{money(balance.egresos.nequi)}</dd>
      <dt>Daviplata</dt><dd>{money(balance.egresos.daviplata)}</dd>
    </dl>
    <p><strong>Flujo operativo neto del día · {money(balance.flujoOperativoNeto)}</strong></p>
    <section aria-labelledby="daily-reconciliation-title">
      <h3 id="daily-reconciliation-title">Arqueo físico</h3>
      <dl className="settings-details">
        <dt>Diferencia de caja</dt><dd>{money(balance.diferenciaCaja)}</dd>
      </dl>
    </section>
  </>
}
