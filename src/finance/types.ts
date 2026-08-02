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
  note: string
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

export interface ManualBalances {
  cashIsaBalance: number
  moneyboxLisaBalance: number
  snoopBalance: number
  savingsOneBalance: number
  savingsTwoBalance: number
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
