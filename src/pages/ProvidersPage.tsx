import { useEffect, useState, type FormEvent } from 'react'
import { createProvider, getProviders, type Provider } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function ProvidersPage() {
  const { hasRole } = useAuth()
  const canCreate = hasRole('administrador')
  const [providers, setProviders] = useState<Provider[]>([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getProviders().then(rows => {
      if (active) {
        setProviders(rows)
        setError('')
      }
    }).catch(failure => {
      if (active) setError(failure instanceof Error ? failure.message : 'No se pudieron consultar los proveedores.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await createProvider({ nombre: nombre.trim(), ...(telefono.trim() ? { telefono: telefono.trim() } : {}) })
      setNombre('')
      setTelefono('')
      setMessage('Proveedor registrado.')
      setAttempt(value => value + 1)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo registrar el proveedor.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="panel management-panel">
    <div className="panel-heading"><div><h2>Proveedores</h2><p>Consulta y mantenimiento de proveedores.</p></div></div>
    {message && <p role="status" className="notice success">{message}</p>}
    {error && <p role="alert" className="notice error">{error}
      <button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
    </p>}
    {canCreate && <form className="data-form" onSubmit={submit}>
      <label>Nombre del proveedor
        <input required value={nombre} disabled={busy} onChange={event => setNombre(event.target.value)} />
      </label>
      <label>Teléfono (opcional)
        <input type="tel" value={telefono} disabled={busy} onChange={event => setTelefono(event.target.value)} />
      </label>
      <button className="button button-primary" disabled={busy}>{busy ? 'Guardando…' : 'Registrar proveedor'}</button>
    </form>}
    {loading ? <p role="status">Consultando proveedores…</p> : providers.length ? (
      <div className="table-scroll"><table>
        <thead><tr><th>Proveedor</th><th>Teléfono</th></tr></thead>
        <tbody>{providers.map(provider => <tr key={provider.id}>
          <th scope="row">{provider.nombre}</th><td>{provider.telefono || '—'}</td>
        </tr>)}</tbody>
      </table></div>
    ) : !error && <p>Todavía no hay proveedores registrados.</p>}
  </section>
}
