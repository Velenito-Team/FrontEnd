import { useState } from 'react'
import { exportMonthlyBalanceCsv, type MonthlyBalance as MonthlyBalanceData } from '../services/api'
import { money } from './SalesPage'

export default function MonthlyBalance({ period, balance }: {
  period: string
  balance?: MonthlyBalanceData
}) {
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

  async function exportCsv() {
    setExporting(true)
    setExportError('')
    try {
      const csv = await exportMonthlyBalanceCsv(period)
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `balance-${period}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } catch (failure) {
      setExportError(failure instanceof Error ? failure.message : 'No se pudo exportar el balance.')
    } finally {
      setExporting(false)
    }
  }

  return <section aria-labelledby="monthly-balance-title">
    <div className="panel-heading">
      <h3 id="monthly-balance-title">Balance operativo mensual</h3>
      <button className="button button-secondary" disabled={exporting} onClick={exportCsv}>
        {exporting ? 'Exportando…' : 'Exportar CSV'}
      </button>
    </div>
    {exportError && <p role="alert" className="notice error">{exportError}</p>}
    {!balance ? <p>El balance mensual todavía no está disponible.</p> : <>
      {balance.datosIncompletos && <div role="status">
        <p><strong>Balance parcial</strong></p>
        {balance.gastosFijosFaltantes.length > 0 && (
          <p>Faltan gastos fijos: {balance.gastosFijosFaltantes.join(', ')}.</p>
        )}
      </div>}
      <dl className="settings-details">
        <dt>Días cerrados</dt><dd>{balance.diasCerrados}</dd>
        <dt>Ventas</dt><dd>{money(balance.ventas)}</dd>
        <dt>Abonos</dt><dd>{money(balance.abonos)}</dd>
        <dt>Egresos</dt><dd>{money(balance.egresos)}</dd>
        <dt>Gastos fijos</dt><dd>{money(balance.gastosFijos)}</dd>
        <dt>Diferencia de caja</dt><dd>{money(balance.diferenciaCaja)}</dd>
        <dt><strong>Balance</strong></dt><dd><strong>{money(balance.balance)}</strong></dd>
      </dl>
    </>}
  </section>
}
