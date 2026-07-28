import { resolveApiBaseUrl } from '../settings/apiEnvironment'
import type {
  ManualBalances,
  MonthlySummary,
  MoneyGoal,
  PortfolioSummary,
  ReapplyResult,
  StatementUploadOutcome,
  TagRule,
  Transaction,
} from './types'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`)
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

async function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
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

export function updateManualBalances(balances: ManualBalances): Promise<ManualBalances> {
  return sendJson('/finance/investments/balances', 'PUT', balances)
}

export function getTransactions(from: string, to: string): Promise<Transaction[]> {
  return getJson(`/finance/budget/transactions?from=${from}&to=${to}`)
}

export function getMonthlySummary(month: string): Promise<MonthlySummary> {
  return getJson(`/finance/budget/summary?month=${month}`)
}

export async function uploadStatements(files: File[]): Promise<StatementUploadOutcome[]> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  const response = await fetch(`${resolveApiBaseUrl()}/finance/budget/statements`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? body?.detail ?? `Upload failed: ${response.status}`)
  }
  return (await response.json()) as StatementUploadOutcome[]
}

export function getTagRules(): Promise<TagRule[]> {
  return getJson('/finance/budget/tag-rules')
}

export function createTagRule(rule: Omit<TagRule, 'id'>): Promise<TagRule> {
  return sendJson('/finance/budget/tag-rules', 'POST', rule)
}

export function updateTagRule(id: number, rule: Omit<TagRule, 'id'>): Promise<TagRule> {
  return sendJson(`/finance/budget/tag-rules/${id}`, 'PUT', rule)
}

export function deleteTagRule(id: number): Promise<void> {
  return sendJson(`/finance/budget/tag-rules/${id}`, 'DELETE')
}

export function reapplyTagRules(): Promise<ReapplyResult> {
  return sendJson('/finance/budget/tag-rules/apply', 'POST')
}
