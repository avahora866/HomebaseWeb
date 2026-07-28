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
}

export interface MonthlySummary {
  month: string
  totalIncome: number
  totalSpending: number
  netFlow: number
}

export interface StatementUploadResult {
  fileName: string
  bankDetected: string
  added: number
  skipped: number
}
