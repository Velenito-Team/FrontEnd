import { useState, type FormEvent } from 'react'
import Modal from './Modal'
import { closeCashRegister, rectifyCashClosing, type CashClosing } from '../services/api'

export default function CashClosingModal({ dia, closingId, onClose, onSaved }: {
  dia: string
  closingId?: string
  onClose: () => void
  onSaved: (closing: CashClosing) => void
}) {
  const [efectivoContado, setEfectivoContado] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const rectifying = !!closingId

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const amount = Number(efectivoContado)
    if (!Number.isSafeInteger(amount) || amount < 0 || rectifying && !motivo.trim()) {
      setError(rectifying
        ? 'Indica un efectivo contado no negativo y el motivo de la rectificación.'
        : 'El efectivo contado debe ser un monto entero no negativo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = rectifying
        ? await rectifyCashClosing(closingId, { efectivoContado: amount, motivo: motivo.trim() })
        : await closeCashRegister({ dia, caja: '01', efectivoContado: amount })
      onSaved(result)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el cierre de caja.')
    } finally {
      setBusy(false)
    }
  }

  return <Modal title={`${rectifying ? 'Rectificar cierre' : 'Cerrar caja'} · ${dia}`}
    onClose={() => { if (!busy) onClose() }}>
    <form className="data-form" onSubmit={submit}>
      <label>Efectivo contado (COP)
        <input type="number" min="0" step="1" required value={efectivoContado} disabled={busy}
          onChange={event => setEfectivoContado(event.target.value)} />
      </label>
      {rectifying && <label>Motivo de rectificación
        <textarea required value={motivo} disabled={busy} onChange={event => setMotivo(event.target.value)} />
      </label>}
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="button button-primary" disabled={busy}>
        {busy ? 'Guardando…' : rectifying ? 'Guardar rectificación' : 'Confirmar cierre'}
      </button>
    </form>
  </Modal>
}
