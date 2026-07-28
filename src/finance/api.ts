import { resolveApiBaseUrl } from '../settings/apiEnvironment'
import type {
  ManualBalances,
  MonthlySummary,
  MoneyGoal,
  PortfolioSummary,
  StatementUploadResult,
  Transaction,
} from './types'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`)
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

export function getPortfolio(): Promise<PortfolioSummary> {
  return getJson('/finance/investments/portfolio')
}

export function getGoals(): Promise<MoneyGoal[]> {
  return getJson('/finance/investments/goals')
}

export function getManualBalances(): Promise<ManualBalances> {
  return getJson('/finance/investments/balances')
}

export async function updateManualBalances(balances: ManualBalances): Promise<ManualBalances> {
  const response = await fetch(`${resolveApiBaseUrl()}/finance/investments/balances`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(balances),
  })
  if (!response.ok) {
    throw new Error(`Failed to save balances: ${response.status}`)
  }
  return (await response.json()) as ManualBalances
}

export function getTransactions(from: string, to: string): Promise<Transaction[]> {
  return getJson(`/finance/budget/transactions?from=${from}&to=${to}`)
}

export function getMonthlySummary(month: string): Promise<MonthlySummary> {
  return getJson(`/finance/budget/summary?month=${month}`)
}

export async function uploadStatement(file: File): Promise<StatementUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${resolveApiBaseUrl()}/finance/budget/statements`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? body?.detail ?? `Upload failed: ${response.status}`)
  }
  return (await response.json()) as StatementUploadResult
}
