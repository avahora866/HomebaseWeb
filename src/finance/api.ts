import { resolveApiBaseUrl } from '../settings/apiEnvironment'
import type {
  ManualBalances,
  MonthlySummary,
  MoneyGoal,
  PortfolioSummary,
  ReapplyResult,
  RuleImportOutcome,
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

export function updateTransactionTags(
  id: number,
  tags: string,
  subscription: boolean,
): Promise<Transaction> {
  return sendJson(`/finance/budget/transactions/${id}/tags`, 'PATCH', { tags, subscription })
}

export async function uploadStatement(file: File): Promise<StatementUploadOutcome> {
  const formData = new FormData()
  formData.append('files', file)

  const response = await fetch(`${resolveApiBaseUrl()}/finance/budget/statements`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message ?? body?.detail ?? `Upload failed: ${response.status}`)
  }
  const outcomes = (await response.json()) as StatementUploadOutcome[]
  return (
    outcomes[0] ?? {
      fileName: file.name,
      success: false,
      bankDetected: null,
      added: 0,
      skipped: 0,
      error: 'No result returned',
    }
  )
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

export async function importTagRuleScript(script: string): Promise<RuleImportOutcome[]> {
  const response = await fetch(`${resolveApiBaseUrl()}/finance/budget/tag-rules/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: script,
  })
  if (!response.ok) {
    throw new Error(`Import failed: ${response.status}`)
  }
  return (await response.json()) as RuleImportOutcome[]
}
