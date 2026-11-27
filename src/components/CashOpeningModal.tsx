import { useState, type FormEvent } from 'react'
import Modal from './Modal'
import { openCashRegister, type OpenedCashDay } from '../services/api'

export default function CashOpeningModal({ dia, onClose, onSaved }: {
  dia: string
  onClose: () => void
  onSaved: (opened: OpenedCashDay) => void
}) {
  const [base, setBase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const amount = Number(base)
    if (!Number.isSafeInteger(amount) || amount < 0) {
      setError('La base debe ser un monto entero no negativo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const opened = await openCashRegister({ dia, caja: '01', base: amount })
      onSaved(opened)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo abrir la caja.')
    } finally {
      setBusy(false)
    }
  }

  return <Modal title={`Abrir caja · ${dia}`} onClose={() => { if (!busy) onClose() }}>
    <form className="data-form" onSubmit={submit}>
      <label>Base inicial (COP)
        <input type="number" min="0" step="1" required value={base} disabled={busy}
          onChange={event => setBase(event.target.value)} />
      </label>
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="button button-primary" disabled={busy}>{busy ? 'Abriendo…' : 'Confirmar apertura'}</button>
    </form>
  </Modal>
}
