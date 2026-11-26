import { useEffect, useRef, useState, type FormEvent } from 'react'
import Modal from '../components/Modal'
import { createFixedExpense, getMonthlyAccounting, type FixedExpense, type MonthlyAccounting } from '../services/api'
import { money, today } from './SalesPage'

export default function AccountingPage() {
  const [period, setPeriod] = useState(() => today().slice(0, 7))
  return <section className="panel management-panel">
    <div className="panel-heading"><h2>Gastos fijos mensuales</h2></div>
    <div className="filters">
      <label>Mes del balance<input type="month" value={period} onChange={event => setPeriod(event.target.value)} /></label>
    </div>
    {/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period)
      ? <MonthlyExpenses key={period} period={period} />
      : <p>Selecciona un mes para consultar los gastos fijos.</p>}
  </section>
}

function MonthlyExpenses({ period }: { period: string }) {
  const [month, setMonth] = useState<MonthlyAccounting>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getMonthlyAccounting(period).then(data => {
      if (!Array.isArray(data?.gastosFijos)) throw new Error('El servidor no devolvió los gastos del mes.')
      if (active) setMonth(data)
    }).catch(() => {
      if (active) setError('No se pudieron consultar los gastos fijos del mes.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period, attempt])

  const expenses = month?.gastosFijos ?? []
  const total = expenses.reduce((sum, expense) => sum + expense.monto, 0)

  return <>
    <button className="button button-primary" onClick={() => setEditing(true)}>Registrar gasto fijo</button>
    {message && <p role="status" className="notice success">{message}</p>}
    {loading && <p role="status">Consultando gastos del mes…</p>}
    {error && <p role="alert" className="notice error">{error} <button className="button button-secondary"
      onClick={() => setAttempt(value => value + 1)}>Reintentar</button></p>}
    {month && <>
      <p><strong>Total de gastos fijos · {money(total)}</strong></p>
      {expenses.length > 0 ? <div className="table-scroll"><table>
        <caption>Gastos fijos de {period}</caption>
        <thead><tr><th scope="col">Concepto</th><th scope="col">Monto</th><th scope="col">Día de recordatorio</th></tr></thead>
        <tbody>{expenses.map(expense => <tr key={expense.id}>
          <th scope="row">{expense.concepto}</th><td>{money(expense.monto)}</td><td>{expense.diaRecordatorio}</td>
        </tr>)}</tbody>
      </table></div> : <p>Todavía no hay gastos fijos registrados para este mes.</p>}
      <h3>Balance mensual</h3>
      {month.balance ? <dl className="settings-details">
        <dt>Resultado operativo</dt><dd>{money(month.balance.resultadoOperativo)}</dd>
        <dt>Gastos fijos incluidos</dt><dd>{money(month.balance.gastosFijos)}</dd>
        <dt>Resultado neto</dt><dd>{money(month.balance.resultadoNeto)}</dd>
      </dl> : <p>El balance mensual todavía no está disponible.</p>}
    </>}
    {editing && <FixedExpenseForm period={period} expenses={expenses} onClose={() => setEditing(false)}
      onSaved={() => {
        setEditing(false)
        setMessage('Gasto fijo registrado.')
        setMonth(undefined)
        setAttempt(value => value + 1)
      }} />}
  </>
}

function FixedExpenseForm({ period, expenses, onClose, onSaved }: {
  period: string; expenses: FixedExpense[]; onClose: () => void; onSaved: () => void
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
    const expense = { concepto: concept.trim(), monto: Number(amount), periodo: period, diaRecordatorio: Number(reminder) }
    if (!expense.concepto || !Number.isSafeInteger(expense.monto) || expense.monto <= 0 ||
        !Number.isInteger(expense.diaRecordatorio) || expense.diaRecordatorio < 1 || expense.diaRecordatorio > 28) {
      setError('Ingresa un concepto, un monto positivo en pesos enteros y un día entre 1 y 28.')
      return
    }
    if (expenses.some(item => item.concepto.trim().toLocaleLowerCase('es') === expense.concepto.toLocaleLowerCase('es'))) {
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
      const status = (failure as { status?: number } | null)?.status
      if (status === 404 || status === 405 || status === 501) setError('El servidor todavía no permite registrar gastos fijos.')
      else if (status === 409) setError('Ya hay un gasto con este concepto en el mes seleccionado.')
      else setError(failure instanceof Error ? failure.message : 'No se pudo confirmar el registro del gasto.')
    } finally {
      setBusy(false)
    }
  }

  return <Modal title="Registrar gasto fijo" onClose={() => { if (!busy) onClose() }}>
    <form className="data-form" onSubmit={submit}>
      <p>Mes del gasto · {period}</p>
      <label>Concepto<input required placeholder="Arriendo, agua, luz…" value={concept} disabled={busy}
        onChange={event => setConcept(event.target.value)} /></label>
      <label>Monto (COP)<input required type="number" min="1" step="1" value={amount} disabled={busy}
        onChange={event => setAmount(event.target.value)} /></label>
      <label>Día de recordatorio<input required type="number" min="1" max="28" step="1" value={reminder} disabled={busy}
        onChange={event => setReminder(event.target.value)} /></label>
      {error && <p role="alert" className="notice error">{error}</p>}
      <button className="button button-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar gasto'}</button>
    </form>
  </Modal>
}
