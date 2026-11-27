import { useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Store } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AccessPage() {
  const { login, enterDevPreview, authNotice, clearAuthNotice } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [devPreview, setDevPreview] = useState(false)
  const [previewRole, setPreviewRole] = useState<'administrador' | 'tendero' | 'cajero'>('administrador')
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')

  async function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    clearAuthNotice()
    try {
      if (devPreview && import.meta.env.DEV) {
        if (!enterDevPreview) throw new Error('La vista de demostración no está disponible.')
        enterDevPreview(previewRole)
        return
      }
      await login(username.trim(), password)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Usuario o contraseña incorrectos.')
      setBusy(false)
    }
  }

  const displayedError = error || authNotice

  return (
    <main className="login-screen">
      <header className="login-masthead">
        <div className="login-brand">
          <Store size={26} aria-hidden="true" /> El Veleñito
        </div>
        <span>Punto de venta</span>
      </header>
      <section className="login-body" aria-labelledby="login-title">
        <h1 id="login-title">Iniciar sesión</h1>
        <p id="login-note">Ingresa con tus credenciales asignadas para operar el punto de venta.</p>
        <form onSubmit={enter} aria-describedby="login-note" autoComplete="off">
          <label htmlFor="login-user">Usuario</label>
          <input
            id="login-user"
            type="text"
            required={!devPreview}
            pattern={'.*\\S.*'}
            title="Escribe un usuario"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setError('')
            }}
          />
          <label htmlFor="login-password">Contraseña</label>
          <div className="login-password">
            <input
              id="login-password"
              type={visible ? 'text' : 'password'}
              required={!devPreview}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
            />
            <button
              type="button"
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-controls="login-password"
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {import.meta.env.DEV && <>
            <label className="login-preview">
              <input
                type="checkbox"
                checked={devPreview}
                onChange={(event) => setDevPreview(event.target.checked)}
              />
              Ver interfaz de administrador (demostración local)
            </label>
            {devPreview && <label htmlFor="login-preview-role">
              Rol para previsualizar
              <select
                id="login-preview-role"
                value={previewRole}
                onChange={(event) => setPreviewRole(event.target.value as typeof previewRole)}
              >
                <option value="administrador">Administrador</option>
                <option value="tendero">Tendero</option>
                <option value="cajero">Cajero</option>
              </select>
            </label>}
          </>}
          {displayedError && (
            <p className="notice error" role="alert">
              {displayedError}
            </p>
          )}
          <button className="button button-primary login-submit" disabled={busy}>
            {busy ? 'Iniciando sesión…' : 'Entrar a la caja'} <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  )
}