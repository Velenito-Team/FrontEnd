import { useEffect, useState } from 'react'
import { getSettings, type Settings } from '../services/api'

export type Preferences = { method: 'efectivo' | 'nequi' | 'daviplata'; lowOnly: boolean }
export function readPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem('velenito-preferences') ?? '{}')
    return { method: ['efectivo','nequi','daviplata'].includes(p.method) ? p.method : 'efectivo', lowOnly: p.lowOnly === true }
  } catch { return { method: 'efectivo', lowOnly: false } }
}
export default function SettingsPage({ onSaved }: { onSaved: (preferences: Preferences) => void }) {
  const [settings, setSettings] = useState<Settings>()
  const [preferences, setPreferences] = useState(readPreferences)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => { getSettings().then(setSettings).catch(e => setError(e.message)) }, [])
  return <section className="panel management-panel">
    <h2>Configuración de la caja</h2>
    {error && <p role="alert" className="notice error">{error}</p>}
    {settings && <dl className="settings-details">
      <dt>Tienda</dt><dd>{settings.tienda}</dd><dt>Caja</dt><dd>{settings.caja}</dd><dt>Operador</dt><dd>{settings.operador} · {settings.usuario}</dd>
      <dt>Rol</dt><dd>{settings.rol}</dd><dt>Conexión</dt><dd>{settings.primario ? 'Disponible para registrar ventas' : 'Sin primario disponible'}</dd>
    </dl>}
    <form className="data-form" onSubmit={e => {
      e.preventDefault()
      try { localStorage.setItem('velenito-preferences', JSON.stringify(preferences)); onSaved(preferences); setSaved(true) }
      catch { setError('El navegador no permite guardar preferencias locales.') }
    }}>
      <h3>Preferencias de este navegador</h3><label>Medio de pago predeterminado<select value={preferences.method} onChange={e => { setSaved(false); setPreferences({ ...preferences, method: e.target.value as Preferences['method'] }) }}>
        <option value="efectivo">Efectivo</option><option value="nequi">Nequi</option><option value="daviplata">Daviplata</option></select></label>
      <label className="check-label"><input type="checkbox" checked={preferences.lowOnly} onChange={e => { setSaved(false); setPreferences({ ...preferences, lowOnly: e.target.checked }) }} /> Abrir el catálogo filtrado por stock bajo</label>
      <button className="button button-primary">Guardar preferencias</button>
      {saved && <p role="status" className="notice success">Preferencias guardadas.</p>}
    </form>
  </section>
}
