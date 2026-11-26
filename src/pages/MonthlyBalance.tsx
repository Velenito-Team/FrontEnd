import type { FixedExpense, MonthlyAccounting } from '../services/api'
import { money } from './SalesPage'

export default function MonthlyBalance({ period, balance, expenses, fixedTotal }: {
  period: string; balance: MonthlyAccounting['balance']; expenses: FixedExpense[]; fixedTotal: number
}) {
  const title = 'Balance operativo mensual'
  if (!balance || !Number.isSafeInteger(balance.resultadoOperativo)) {
    return <section><h3>{title}</h3><p>El balance mensual todavía no está disponible.</p></section>
  }

  const { resultadoOperativo, cobros, egresosOperativos, diasSinCierre, gastosFijosPendientes } = balance
  const net = resultadoOperativo - fixedTotal
  const warnings: string[] = []
  if (diasSinCierre?.length) warnings.push(`Días sin cierre: ${diasSinCierre.join(', ')}.`)
  if (gastosFijosPendientes || !expenses.length) warnings.push('Puede haber gastos fijos del mes pendientes de registrar.')
  if (cobros == null || egresosOperativos == null) warnings.push('El desglose de cobros y egresos todavía no está completo.')

  function exportCsv() {
    const rows = [
      ['Balance operativo mensual', period],
      ['Concepto', 'Monto (COP)'],
      ['Cobros recibidos', cobros ?? ''],
      ['Egresos operativos pagados', egresosOperativos ?? ''],
      ['Flujo operativo antes de gastos fijos', resultadoOperativo],
      ['Gastos fijos incluidos', fixedTotal],
      ['Flujo operativo neto del mes', net],
      [],
      ['Gasto fijo', 'Monto (COP)'],
      ...expenses.map(expense => [expense.concepto, expense.monto]),
      ...warnings.map(warning => ['Aviso', warning]),
    ]
    const csv = rows.map(row => row.map(value => {
      if (typeof value === 'number') return String(value)
      const text = /^[\s\uFEFF]*[=+\-@]/.test(value) ? "'" + value : value
      return '"' + text.replaceAll('"', '""') + '"'
    }).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `balance-operativo-${period}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return <section aria-labelledby="monthly-balance-title">
    <div className="panel-heading">
      <h3 id="monthly-balance-title">{title}</h3>
      <button className="button button-secondary" onClick={exportCsv}>Exportar CSV</button>
    </div>
    {warnings.length > 0 && <div role="status">
      <p><strong>Balance parcial</strong></p>
      <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    </div>}
    <dl className="settings-details">
      <dt>Cobros recibidos</dt><dd>{cobros == null ? 'Sin datos' : money(cobros)}</dd>
      <dt>Egresos operativos pagados</dt><dd>{egresosOperativos == null ? 'Sin datos' : money(egresosOperativos)}</dd>
      <dt>Flujo operativo antes de gastos fijos</dt><dd>{money(resultadoOperativo)}</dd>
      <dt>Gastos fijos incluidos</dt><dd>{money(fixedTotal)}</dd>
      <dt><strong>Flujo operativo neto del mes</strong></dt><dd><strong>{money(net)}</strong></dd>
    </dl>
  </section>
}
