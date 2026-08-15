export interface AllocationSlice {
  name: string
  value: number
}

export interface Holding {
  ticker: string
  quantity: number
  currentPrice: number
  averagePrice: number
  value: number
  returnPct: number
}

export interface PortfolioSummary {
  totalValue: number
  allocations: AllocationSlice[]
  holdings: Holding[]
}

export interface MoneyGoal {
  id: number
  name: string
  amount: number
}

export interface Transaction {
  id: number
  date: string // yyyy-MM-dd
  amount: number
  description: string
  source: string
  tags: string
  subscription: boolean
  note: string | null
}

export interface MonthlySummary {
  month: string
  totalIncome: number
  totalSpending: number
  netFlow: number
}

export interface StatementUploadOutcome {
  fileName: string
  success: boolean
  bankDetected: string | null
  added: number
  skipped: number
  error: string | null
}

export type NetWorthCategory =
  | 'CASH'
  | 'SAVINGS'
  | 'INVESTMENT'
  | 'PENSION'
  | 'PROPERTY'
  | 'OTHER'
  | 'LIABILITY'

export interface NetWorthAccount {
  id: number
  name: string
  category: NetWorthCategory
  balance: number
  sortOrder: number
  updatedAt: string | null
}

/** The create/update body — the server assigns `id`/`updatedAt`, and appends when `sortOrder` is omitted. */
export interface NetWorthAccountInput {
  name: string
  category: NetWorthCategory
  balance: number
  sortOrder?: number
}

export interface NetWorthCategoryTotal {
  category: NetWorthCategory
  label: string
  total: number
}

export interface NetWorthSummary {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  categories: NetWorthCategoryTotal[]
  accounts: NetWorthAccount[]
}

export interface TagRule {
  id: number
  priority: number
  statement: string
}

export interface ReapplyResult {
  rulesRun: number
  rowsAffected: number
}

export interface RuleImportOutcome {
  statement: string
  success: boolean
  ruleId: number | null
  error: string | null
}
