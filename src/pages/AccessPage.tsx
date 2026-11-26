import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Store } from 'lucide-react'
import { getSettings, type Settings } from '../services/api'

export default function AccessPage({ onEnter }: { onEnter: (operator: Settings) => void }) {
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const operator = await getSettings()
      if (!['administrador', 'cajero'].includes(operator.rol)) throw new Error()
      onEnter(operator)
    } catch {
      setError('No se pudo abrir la caja. Revisa la conexión y el operador asignado.')
      setBusy(false)
    }
  }

  return <main className="login-screen">
    <header className="login-masthead">
      <div className="login-brand"><Store size={26} aria-hidden="true" /> El Veleñito</div>
      <span>Punto de venta</span>
    </header>
    <section className="login-body" aria-labelledby="login-title">
      <h1 id="login-title">Iniciar sesión</h1>
      <p id="login-note">Usa un usuario y una contraseña ficticios para probar el acceso a la caja.</p>
      <form onSubmit={enter} aria-describedby="login-note" autoComplete="off">
        <label htmlFor="login-user">Usuario</label>
        <input id="login-user" type="text" required pattern={'.*\\S.*'} title="Escribe un usuario" autoCapitalize="none" spellCheck={false} />
        <label htmlFor="login-password">Contraseña</label>
        <div className="login-password">
          <input id="login-password" type={visible ? 'text' : 'password'} required />
          <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-controls="login-password" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="button button-primary login-submit" disabled={busy}>
          {busy ? 'Abriendo caja…' : 'Entrar a la caja'} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </section>
  </main>
}
