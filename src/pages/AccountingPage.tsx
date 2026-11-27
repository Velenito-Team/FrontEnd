import { useEffect, useRef, useState, type FormEvent } from 'react'
import Modal from '../components/Modal'
import { useAuth } from '../hooks/useAuth'
import {
  createDailyExpense,
  createFixedExpense,
  getFixedExpensesSummary,
  getMonthlyBalance,
  getProviders,
  type FixedExpense,
  type FixedExpenseSummary,
  type MonthlyBalance as MonthlyBalanceData,
  type Provider,
} from '../services/api'
import { money, today } from './SalesPage'
import DailyAccountingView from './DailyAccountingView'
import MonthlyBalance from './MonthlyBalance'

export default function AccountingPage() {
  const { hasRole } = useAuth()
  const canCreateExpenses = hasRole('administrador')
  const [period, setPeriod] = useState(() => today().slice(0, 7))
  const [view, setView] = useState<'monthly' | 'daily'>('monthly')
  const [dailyExpenseOpen, setDailyExpenseOpen] = useState(false)
  const [dailyMessage, setDailyMessage] = useState('')

  return (
    <section className="panel management-panel">
      <div className="panel-heading">
        <div className="accounting-views" role="group" aria-label="Vistas de contabilidad">
          <button
            className={`button ${view === 'monthly' ? 'button-primary' : 'button-secondary'}`}
            aria-pressed={view === 'monthly'}
            onClick={() => setView('monthly')}
          >
            Balance y gastos fijos
          </button>
          <button
            className={`button ${view === 'daily' ? 'button-primary' : 'button-secondary'}`}
            aria-pressed={view === 'daily'}
            onClick={() => setView('daily')}
          >
            Balance diario
          </button>
        </div>
        {canCreateExpenses && (
          <button className="button button-primary" onClick={() => setDailyExpenseOpen(true)}>
            Registrar gasto diario
          </button>
        )}
      </div>

      {dailyMessage && (
        <p role="status" className="notice success">
          {dailyMessage}
        </p>
      )}

      {view === 'daily' ? (
        <DailyAccountingView />
      ) : (
        <>
          <div className="panel-heading">
            <h2>Gastos fijos y balance mensual</h2>
          </div>
          <div className="filters">
            <label>
              Mes del balance
              <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
            </label>
          </div>
          {/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period) ? (
            <MonthlyExpenses key={period} period={period} canManage={canCreateExpenses} />
          ) : (
            <p>Selecciona un mes para consultar los gastos fijos.</p>
          )}
        </>
      )}

      {dailyExpenseOpen && (
        <DailyExpenseForm
          onClose={() => setDailyExpenseOpen(false)}
          onSaved={(msg) => {
            setDailyExpenseOpen(false)
            setDailyMessage(msg)
          }}
        />
      )}
    </section>
  )
}

function MonthlyExpenses({ period, canManage }: { period: string; canManage: boolean }) {
  const [summary, setSummary] = useState<FixedExpenseSummary>()
  const [balance, setBalance] = useState<MonthlyBalanceData>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([getFixedExpensesSummary(period), getMonthlyBalance(period)])
      .then(([fixedData, balanceData]) => {
        if (!active) return
        setSummary(fixedData)
        setBalance(balanceData)
      })
      .catch((failure) => {
        if (!active) return
        setError(failure instanceof Error ? failure.message : 'No se pudieron consultar los datos contables del mes.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [period, attempt])

  const expenses = summary?.gastos ?? []
  const total = summary?.total ?? 0

  return (
    <>
      {canManage && (
        <button className="button button-primary" onClick={() => setEditing(true)}>
          Registrar gasto fijo
        </button>
      )}
      {message && (
        <p role="status" className="notice success">
          {message}
        </p>
      )}
      {loading && <p role="status">Consultando gastos y balance del mes…</p>}
      {error && (
        <p role="alert" className="notice error">
          {error}{' '}
          <button className="button button-secondary" onClick={() => setAttempt((value) => value + 1)}>
            Reintentar
          </button>
        </p>
      )}
      {summary && (
        <>
          <p>
            <strong>Total de gastos fijos · {money(total)}</strong>
          </p>
          {expenses.length > 0 ? (
            <div className="table-scroll">
              <table>
                <caption>Gastos fijos de {period}</caption>
                <thead>
                  <tr>
                    <th scope="col">Concepto</th>
                    <th scope="col">Monto</th>
                    <th scope="col">Día de recordatorio</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <th scope="row">{expense.concepto}</th>
                      <td>{money(expense.monto)}</td>
                      <td>{expense.diaRecordatorio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Todavía no hay gastos fijos registrados para este mes.</p>
          )}
          <MonthlyBalance period={period} balance={balance} />
        </>
      )}
      {editing && (
        <FixedExpenseForm
          period={period}
          expenses={expenses}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            setMessage('Gasto fijo registrado.')
            setAttempt((value) => value + 1)
          }}
        />
      )}
    </>
  )
}

function FixedExpenseForm({
  period,
  expenses,
  onClose,
  onSaved,
}: {
  period: string
  expenses: FixedExpense[]
  onClose: () => void
  onSaved: () => void
}) {
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [reminder, setReminder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef<{ payload: string; key: string }>()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const expense = {
      concepto: concept.trim(),
      monto: Number(amount),
      mes: period,
      diaRecordatorio: Number(reminder),
    }
    if (
      !expense.concepto ||
      !Number.isSafeInteger(expense.monto) ||
      expense.monto <= 0 ||
      !Number.isInteger(expense.diaRecordatorio) ||
      expense.diaRecordatorio < 1 ||
      expense.diaRecordatorio > 28
    ) {
      setError('Ingresa un concepto, un monto positivo en pesos enteros y un día entre 1 y 28.')
      return
    }
    if (expenses.some((item) => item.concepto.trim().toLocaleLowerCase('es') === expense.concepto.toLocaleLowerCase('es'))) {
      setError('Ya hay un gasto con este concepto en el mes seleccionado.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = JSON.stringify(expense)
      if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() }
      await createFixedExpense(expense, operation.current.key)
      onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo confirmar el registro del gasto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Registrar gasto fijo" onClose={() => { if (!busy) onClose() }}>
      <form className="data-form" onSubmit={submit}>
        <p>Mes del gasto · {period}</p>
        <label>
          Concepto
          <input
            required
            placeholder="Arriendo, agua, luz…"
            value={concept}
            disabled={busy}
            onChange={(event) => setConcept(event.target.value)}
          />
        </label>
        <label>
          Monto (COP)
          <input
            required
            type="number"
            min="1"
            step="1"
            value={amount}
            disabled={busy}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Día de recordatorio
          <input
            required
            type="number"
            min="1"
            max="28"
            step="1"
            value={reminder}
            disabled={busy}
            onChange={(event) => setReminder(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar gasto'}
        </button>
      </form>
    </Modal>
  )
}

function DailyExpenseForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [dia, setDia] = useState(today)
  const [medio, setMedio] = useState<'efectivo' | 'nequi' | 'daviplata'>('efectivo')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [providers, setProviders] = useState<Provider[]>([])
  const [providersError, setProvidersError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef<{ payload: string; key: string }>()

  useEffect(() => {
    let active = true
    getProviders()
      .then(items => { if (active) setProviders(items) })
      .catch(failure => {
        if (active) setProvidersError(failure instanceof Error ? failure.message : 'No se pudieron consultar los proveedores.')
      })
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const numericAmount = Number(monto)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || !Number.isSafeInteger(numericAmount) || numericAmount <= 0 || !descripcion.trim()) {
      setError('Indica una fecha válida, un monto mayor a cero y una descripción obligatoria.')
      return
    }
    const payload = {
      dia,
      medio,
      monto: numericAmount,
      descripcion: descripcion.trim(),
      ...(proveedorId ? { proveedorId } : {}),
    }
    const serialized = JSON.stringify(payload)
    if (operation.current?.payload !== serialized) {
      operation.current = { payload: serialized, key: crypto.randomUUID() }
    }
    setBusy(true)
    setError('')
    try {
      await createDailyExpense(payload, operation.current.key)
      onSaved(`Gasto operativo registrado (${money(numericAmount)}).`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo registrar el gasto operativo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Registrar gasto diario" onClose={() => { if (!busy) onClose() }}>
      <form className="data-form" onSubmit={submit}>
        <label>
          Fecha
          <input type="date" required value={dia} disabled={busy} onChange={(e) => setDia(e.target.value)} />
        </label>
        <label>
          Medio de pago
          <select
            value={medio}
            disabled={busy}
            onChange={(e) => setMedio(e.target.value as 'efectivo' | 'nequi' | 'daviplata')}
          >
            <option value="efectivo">Efectivo</option>
            <option value="nequi">Nequi</option>
            <option value="daviplata">Daviplata</option>
          </select>
        </label>
        <label>
          Monto (COP)
          <input
            type="number"
            min="1"
            step="1"
            required
            value={monto}
            disabled={busy}
            onChange={(e) => setMonto(e.target.value)}
          />
        </label>
        <label>
          Descripción
          <input
            type="text"
            required
            placeholder="Ej. Pago domicilio, bolsas, servicios..."
            value={descripcion}
            disabled={busy}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>
        <label>
          Proveedor (opcional)
          <select value={proveedorId} disabled={busy} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Sin proveedor</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        {providersError && <p role="alert" className="notice error">{providersError}</p>}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button className="button button-primary" disabled={busy}>
          {busy ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </form>
    </Modal>
  )
}