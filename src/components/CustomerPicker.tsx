import { useEffect, useState } from 'react'
import { createCustomer, getCustomers, type Customer } from '../services/api'
import Modal from './Modal'

export default function CustomerPicker({ onSelect, onClose, registrationOnly = false }: { onSelect: (customer: Customer | null) => void; onClose: () => void; registrationOnly?: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [evidence, setEvidence] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!registrationOnly) getCustomers().then(setCustomers).catch(e => setError(e.message)) }, [registrationOnly])
  return <Modal title={registrationOnly ? 'Registrar cliente fiado' : 'Seleccionar cliente'} onClose={() => { if (!busy) onClose() }}>
    {!registrationOnly && <><button className="button button-secondary" onClick={() => onSelect(null)}>Consumidor final</button>
    <div className="customer-options">{customers.map(c => <button key={c.id} onClick={() => onSelect(c)}>{c.nombre} · saldo {c.saldo.toLocaleString('es-CO')}</button>)}</div></>}
    <form className="data-form" onSubmit={async e => {
      e.preventDefault(); setBusy(true)
      try { const customer = await createCustomer({ nombre: name, telefono: phone, evidencia: evidence, autorizacion: authorized }); onSelect(customer) }
      catch(e) { setError((e as Error).message) } finally { setBusy(false) }
    }}><h3>Registrar cliente para fiados</h3>
      <label>Nombre del cliente<input required value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Teléfono opcional<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
      <p>La finalidad informada es gestionar ventas fiadas, abonos y consulta de saldos. Registra la referencia a la constancia del cliente.</p>
      <label>Referencia de la constancia<input required value={evidence} onChange={e => setEvidence(e.target.value)} /></label>
      <label className="check-label"><input type="checkbox" required checked={authorized} onChange={e => setAuthorized(e.target.checked)} /> El cliente otorgó autorización previa e informada</label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={busy}>{registrationOnly ? 'Guardar cliente' : 'Guardar y seleccionar cliente'}</button>
    </form>
  </Modal>
}
