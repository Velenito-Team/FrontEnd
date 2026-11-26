import { useState } from 'react'
import { Store } from 'lucide-react'
import { getSettings, type Settings } from '../services/api'

export default function AccessPage({ onEnter }: { onEnter: (operator: Settings) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <main className="access-screen"><section className="access-card">
    <div className="awning" aria-hidden="true" />
    <Store size={40} aria-hidden="true" /><h1>El Veleñito</h1>
    <h2>Entrar a la caja</h2><p>Continúa con el operador asignado a este punto de venta.</p>
    {error && <p role="alert" className="notice error">{error}</p>}
    <button className="button button-primary" disabled={busy} onClick={async () => {
      setBusy(true); setError('')
      try {
        const operator = await getSettings()
        if (!['administrador', 'cajero'].includes(operator.rol)) throw new Error()
        onEnter(operator)
      } catch { setError('No se pudo abrir la caja. Revisa la conexión y el operador asignado.'); setBusy(false) }
    }}>{busy ? 'Consultando operador…' : 'Entrar a la caja'}</button>
  </section></main>
}
