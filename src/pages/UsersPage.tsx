import { useEffect, useState, type FormEvent } from 'react'
import { createUser, getUsers, updateUserRole, updateUserStatus, type AuthUser, type UserRole } from '../services/api'

const roles: UserRole[] = ['administrador', 'tendero', 'cajero']

export default function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [rol, setRol] = useState<UserRole>('cajero')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    getUsers().then(rows => {
      if (active) {
        setUsers(rows)
        setError('')
      }
    }).catch(failure => {
      if (active) setError(failure instanceof Error ? failure.message : 'No se pudieron consultar los usuarios.')
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
      await createUser({ nombre: nombre.trim(), usuario: usuario.trim(), contrasena, rol })
      setNombre('')
      setUsuario('')
      setContrasena('')
      setMessage('Usuario creado.')
      setAttempt(value => value + 1)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo crear el usuario.')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(user: AuthUser) {
    setBusyId(user.id)
    setError('')
    try {
      const updated = await updateUserStatus(user.id, !user.activo)
      setUsers(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo cambiar el estado del usuario.')
    } finally {
      setBusyId('')
    }
  }

  async function changeRole(user: AuthUser, nextRole: UserRole) {
    if (user.rol === nextRole) return
    setBusyId(user.id)
    setError('')
    try {
      const updated = await updateUserRole(user.id, nextRole)
      setUsers(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo cambiar el rol del usuario.')
    } finally {
      setBusyId('')
    }
  }

  return <section className="panel management-panel">
    <div className="panel-heading"><div><h2>Usuarios</h2><p>Administración de cuentas y roles de acceso.</p></div></div>
    {message && <p role="status" className="notice success">{message}</p>}
    {error && <p role="alert" className="notice error">{error}
      <button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Actualizar listado</button>
    </p>}
    <form className="data-form" onSubmit={submit}>
      <label>Nombre<input required value={nombre} disabled={busy} onChange={event => setNombre(event.target.value)} /></label>
      <label>Usuario<input required value={usuario} disabled={busy} onChange={event => setUsuario(event.target.value)} /></label>
      <label>Contraseña (mínimo 8 caracteres)
        <input type="password" minLength={8} required value={contrasena} disabled={busy}
          onChange={event => setContrasena(event.target.value)} />
      </label>
      <label>Rol<select value={rol} disabled={busy} onChange={event => setRol(event.target.value as UserRole)}>
        {roles.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <button className="button button-primary" disabled={busy}>{busy ? 'Creando…' : 'Crear usuario'}</button>
    </form>
    {loading ? <p role="status">Consultando usuarios…</p> : <div className="table-scroll">
      <table>
        <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{users.map(user => <tr key={user.id}>
          <th scope="row">{user.nombre}</th><td>{user.usuario}</td>
          <td><select aria-label={`Rol de ${user.nombre}`} value={user.rol} disabled={busyId === user.id}
            onChange={event => void changeRole(user, event.target.value as UserRole)}>
            {roles.map(value => <option key={value} value={value}>{value}</option>)}
          </select></td>
          <td>{user.activo ? 'Activo' : 'Inactivo'}</td>
          <td><button className="button button-secondary" disabled={busyId === user.id}
            onClick={() => void changeStatus(user)}>{user.activo ? 'Desactivar' : 'Activar'} {user.nombre}</button></td>
        </tr>)}</tbody>
      </table>
      {!users.length && <p>No hay usuarios registrados.</p>}
    </div>}
  </section>
}
