import { useEffect, useState } from 'react'
import { getDailyAccounting, type DailyAccounting } from '../services/api'
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
  const [balance, setBalance] = useState<DailyAccounting>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setBalance(undefined)
    setError('')
    getDailyAccounting(date).then(data => {
      if (!data || !['abierta', 'sin_cierre', 'cerrada'].includes(data.estadoCaja)) {
        throw new Error('El servidor no devolvió el estado de la caja.')
      }
      if (data.estadoCaja === 'cerrada' && (
        ![data.cobrosVentas, data.abonosRecibidos, data.egresosMercancia, data.otrosEgresosOperativos]
          .every(value => Number.isSafeInteger(value) && value >= 0) ||
        !Number.isSafeInteger(data.diferenciaArqueo)
      )) throw new Error('El servidor no devolvió los importes completos del balance.')
      if (active) setBalance(data)
    }).catch(failure => {
      if (!active) return
      const status = (failure as { status?: number } | null)?.status
      setError(status === 404 || status === 501
        ? 'El servidor todavía no ofrece el balance diario.'
        : 'No se pudo consultar el balance diario.')
    })
    return () => { active = false }
  }, [date, attempt])

  if (error) return <div role="alert" className="notice error">{error}{' '}
    <button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
  </div>
  if (!balance) return <p role="status">Consultando balance del día…</p>
  if (balance.estadoCaja !== 'cerrada') {
    return <div>
      <p role="status">Para consultar el balance de este día, primero debes cerrar la caja.</p>
      <button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Actualizar estado</button>
    </div>
  }

  const collected = balance.cobrosVentas + balance.abonosRecibidos
  const paid = balance.egresosMercancia + balance.otrosEgresosOperativos

  return <>
    <h3>Cobros efectivamente recibidos</h3>
    <dl className="settings-details">
      <dt>Cobros por ventas</dt><dd>{money(balance.cobrosVentas)}</dd>
      <dt>Abonos recibidos</dt><dd>{money(balance.abonosRecibidos)}</dd>
      <dt>Total de cobros</dt><dd>{money(collected)}</dd>
    </dl>
    <h3>Egresos pagados</h3>
    <dl className="settings-details">
      <dt>Mercancía</dt><dd>{money(balance.egresosMercancia)}</dd>
      <dt>Otros gastos operativos</dt><dd>{money(balance.otrosEgresosOperativos)}</dd>
      <dt>Total de egresos</dt><dd>{money(paid)}</dd>
    </dl>
    <p><strong>Flujo operativo neto del día · {money(collected - paid)}</strong></p>
    <p>Incluye los cobros recibidos y los egresos pagados del día. Los fiados pendientes y la base de caja quedan fuera del cálculo.</p>
    <section aria-labelledby="daily-reconciliation-title">
      <h3 id="daily-reconciliation-title">Arqueo físico</h3>
      <dl className="settings-details">
        <dt>Diferencia de caja</dt><dd>{money(balance.diferenciaArqueo)}</dd>
      </dl>
    </section>
  </>
}
