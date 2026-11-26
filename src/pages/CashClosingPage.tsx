import { useEffect, useState } from 'react'
import CashClosingModal from '../components/CashClosingModal'
import CashOpeningModal from '../components/CashOpeningModal'
import { ApiError, getDailyBalance, type CashClosing, type DailyBalance, type OpenedCashDay } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { money, today } from './SalesPage'

export default function CashClosingPage() {
  const { hasRole } = useAuth()
  const canOpenOrRectify = hasRole('administrador')
  const canClose = hasRole('administrador', 'tendero')
  const [dia, setDia] = useState(today)
  const [balance, setBalance] = useState<DailyBalance>()
  const [closing, setClosing] = useState<CashClosing>()
  const [opened, setOpened] = useState<OpenedCashDay>()
  const [openingModal, setOpeningModal] = useState(false)
  const [closingModal, setClosingModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notClosed, setNotClosed] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setBalance(undefined)
    setError('')
    setNotClosed(false)
    getDailyBalance(dia)
      .then(result => {
        if (!active) return
        setBalance(result)
        setNotClosed(false)
      })
      .catch(failure => {
        if (!active) return
        if (failure instanceof ApiError && failure.status === 409) {
          setNotClosed(true)
          return
        }
        setError(failure instanceof Error ? failure.message : 'No se pudo consultar el estado de la caja.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [dia, attempt])

  function showClosing(result: CashClosing) {
    setClosing(result)
    setBalance(undefined)
    setNotClosed(false)
    setMessage(result.resultado === 'cuadrada' ? 'La caja quedó cuadrada.' : `Cierre con ${result.resultado}.`)
    setClosingModal(false)
    setAttempt(value => value + 1)
  }

  return <section className="panel management-panel">
    <div className="panel-heading">
      <div><h2>Caja y cierres</h2><p>Apertura, arqueo físico y consulta de diferencias.</p></div>
    </div>
    <div className="filters">
      <label>Día de caja
        <input type="date" max={today()} value={dia} onChange={event => {
          setDia(event.target.value)
          setClosing(undefined)
          setOpened(undefined)
          setMessage('')
        }} />
      </label>
      {canOpenOrRectify && !balance && !opened && <button className="button button-secondary"
        disabled={!dia || loading} onClick={() => setOpeningModal(true)}>Abrir caja</button>}
      {canClose && !balance && <button className="button button-primary"
        disabled={!dia || loading} onClick={() => setClosingModal(true)}>Cerrar caja</button>}
      {canOpenOrRectify && (balance || closing) && <button className="button button-secondary"
        onClick={() => setClosingModal(true)}>Rectificar cierre</button>}
      <button className="button button-secondary" disabled={loading}
        onClick={() => setAttempt(value => value + 1)}>Actualizar</button>
    </div>
    {message && <p role="status" className="notice success">{message}</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    {loading && <p role="status">Consultando estado de caja…</p>}
    {!loading && notClosed && <p role="status">
      La caja de este día no tiene un cierre. Puedes registrar la apertura y el cierre según tu rol.
    </p>}
    {opened && opened.dia === dia && <p role="status" className="notice success">
      Caja {opened.caja} abierta con base de {money(opened.base)}.
    </p>}
    {(closing || balance) && <section aria-labelledby="cash-closing-summary">
      <h3 id="cash-closing-summary">Resumen del cierre · {dia}</h3>
      {closing && <>
        <dl className="settings-details">
          <dt>Base de caja</dt><dd>{money(closing.resumen.base)}</dd>
          <dt>Efectivo esperado</dt><dd>{money(closing.resumen.efectivoEsperado)}</dd>
          <dt>Efectivo contado</dt><dd>{money(closing.resumen.efectivoContado)}</dd>
          <dt>Diferencia</dt><dd>{money(closing.resumen.diferencia)}</dd>
          <dt>Resultado</dt><dd>{closing.resultado}</dd>
          <dt>Ventas fiadas (informativo)</dt><dd>{money(closing.resumen.totalVentasFiadas)}</dd>
        </dl>
        {closing.motivo && <p>Motivo de rectificación: {closing.motivo}</p>}
      </>}
      {balance && !closing && <>
        <dl className="settings-details">
          <dt>Ventas cobradas</dt><dd>{money(balance.ventasCobradas.efectivo + balance.ventasCobradas.nequi + balance.ventasCobradas.daviplata)}</dd>
          <dt>Abonos</dt><dd>{money(balance.abonos.efectivo + balance.abonos.nequi + balance.abonos.daviplata)}</dd>
          <dt>Egresos</dt><dd>{money(balance.egresos.efectivo + balance.egresos.nequi + balance.egresos.daviplata)}</dd>
          <dt>Flujo operativo neto</dt><dd>{money(balance.flujoOperativoNeto)}</dd>
          <dt>Diferencia de caja</dt><dd>{money(balance.diferenciaCaja)}</dd>
        </dl>
        <p>El backend confirma que el cierre está registrado. El arqueo detallado estará disponible al registrar un cierre o rectificación en esta sesión.</p>
      </>}
    </section>}
    {openingModal && <CashOpeningModal dia={dia} onClose={() => setOpeningModal(false)} onSaved={result => {
      setOpened(result)
      setOpeningModal(false)
      setMessage('Apertura de caja registrada.')
    }} />}
    {closingModal && <CashClosingModal dia={dia} closingId={balance?.cierreId ?? closing?.id}
      onClose={() => setClosingModal(false)} onSaved={showClosing} />}
  </section>
}
