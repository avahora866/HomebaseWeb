<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getGoals, getPortfolio } from './api'
import { money, money2 } from './format'
import type { Holding, MoneyGoal, PortfolioSummary } from './types'

// Slice names are the net worth categories (from Finance → Net Worth) plus the two live
// Trading212 figures.
const ALLOCATION_COLORS: Record<string, string> = {
  Cash: 'var(--color-accent-300)',
  Savings: 'var(--color-accent-500)',
  Investment: 'var(--color-accent-700)',
  Pension: 'var(--color-neutral-500)',
  Property: 'var(--color-neutral-700)',
  Other: 'var(--color-neutral-400)',
  'Stock Cash': 'var(--color-accent-200)',
  Invested: 'var(--color-accent-2-500)',
}
const FALLBACK_COLORS = [
  'var(--color-accent-600)',
  'var(--color-accent-2-600)',
  'var(--color-neutral-600)',
  'var(--color-accent-800)',
]

function colorFor(name: string, index: number): string {
  return ALLOCATION_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]!
}

type SortKey = 'ticker' | 'quantity' | 'value' | 'return'

const portfolio = ref<PortfolioSummary | null>(null)
const goals = ref<(MoneyGoal & { enabled: boolean })[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const sortKey = ref<SortKey>('value')
const sortDir = ref<'asc' | 'desc'>('desc')

onMounted(async () => {
  try {
    const [portfolioData, goalsData] = await Promise.all([getPortfolio(), getGoals()])
    portfolio.value = portfolioData
    goals.value = goalsData.map((g) => ({ ...g, enabled: true }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load portfolio'
  } finally {
    loading.value = false
  }
})

function toggleGoal(id: number) {
  const goal = goals.value.find((g) => g.id === id)
  if (goal) goal.enabled = !goal.enabled
}

const totalDeductions = computed(() =>
  goals.value.filter((g) => g.enabled).reduce((sum, g) => sum + g.amount, 0),
)

const netAvailable = computed(() => (portfolio.value?.totalValue ?? 0) - totalDeductions.value)

const donutGradient = computed(() => {
  const allocations = portfolio.value?.allocations ?? []
  const total = allocations.reduce((sum, a) => sum + a.value, 0)
  if (total <= 0) return 'var(--color-neutral-300)'

  let angle = 0
  const stops = allocations.map((a, i) => {
    const start = angle
    angle += (a.value / total) * 360
    return `${colorFor(a.name, i)} ${start}deg ${angle}deg`
  })
  return `conic-gradient(${stops.join(',')})`
})

function holdingPpl(h: Holding): number {
  return h.quantity * (h.currentPrice - h.averagePrice)
}

const sortedHoldings = computed(() => {
  const holdings = [...(portfolio.value?.holdings ?? [])]
  holdings.sort((a, b) => {
    let av: number | string
    let bv: number | string
    if (sortKey.value === 'value') {
      av = a.value
      bv = b.value
    } else if (sortKey.value === 'return') {
      av = a.returnPct
      bv = b.returnPct
    } else if (sortKey.value === 'ticker') {
      av = a.ticker
      bv = b.ticker
    } else {
      av = a.quantity
      bv = b.quantity
    }
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  return holdings
})

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const heatTiles = computed(() => {
  const holdings = [...(portfolio.value?.holdings ?? [])].sort((a, b) => b.value - a.value)
  const maxVal = Math.max(1, ...holdings.map((h) => h.value))
  return holdings.map((h) => {
    const ppl = holdingPpl(h)
    const scale = 60 + (h.value / maxVal) * 90
    return {
      ticker: h.ticker,
      positive: ppl >= 0,
      width: `${scale}px`,
      height: `${scale * 0.75}px`,
      pplDisplay: `${ppl >= 0 ? '+' : ''}${ppl.toFixed(0)}`,
    }
  })
})
</script>

<template>
  <div>
    <p class="fin-kicker">Finance — Portfolio</p>
    <h1 class="fin-title">Portfolio Composition</h1>

    <p v-if="loading" style="color: var(--color-neutral-500)">Loading…</p>
    <p v-else-if="error" style="color: var(--color-accent-2-700)">{{ error }}</p>

    <template v-else-if="portfolio">
      <div class="inv-top">
        <div>
          <div class="total-value">{{ money(portfolio.totalValue) }}</div>

          <div class="net-row">
            <span class="net-label">Net Available</span>
            <span
              class="net-value"
              :style="{ color: netAvailable < 0 ? 'var(--color-accent-2-700)' : 'var(--color-accent-700)' }"
            >
              {{ money(netAvailable) }}
            </span>
          </div>

          <p class="alloc-title">Upcoming expenses</p>
          <div
            v-for="g in goals"
            :key="g.id"
            class="alloc-item"
            :class="{ disabled: !g.enabled }"
            @click="toggleGoal(g.id)"
          >
            <button class="alloc-eye" aria-label="Toggle" @click.stop="toggleGoal(g.id)">
              <svg v-if="g.enabled" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
            <span class="alloc-name">{{ g.name }}</span>
            <span class="alloc-amt">{{ g.enabled ? `-${money(g.amount)}` : 'Excluded' }}</span>
          </div>
          <div class="alloc-total"><span>Total allocated</span><span>{{ money(totalDeductions) }}</span></div>
        </div>

        <div class="donut-wrap">
          <div class="donut" :style="{ background: donutGradient }">
            <div class="donut-center">
              <span class="lbl">Net</span>
              <span class="val">{{ money(portfolio.totalValue) }}</span>
            </div>
          </div>
          <div class="legend">
            <div v-for="(c, i) in portfolio.allocations" :key="c.name" class="legend-item">
              <span class="legend-dot" :style="{ background: colorFor(c.name, i) }"></span>{{ c.name }}
              <span class="legend-amt">{{ money(c.value) }}</span>
            </div>
          </div>
          <!-- The slices are the assets; any liabilities tracked on the Net Worth tab are only in
               the net figure at the centre, which is why the two don't add up to each other. -->
          <p class="donut-note">
            Slices are your assets — liabilities are already deducted from the net figure.
          </p>
        </div>
      </div>

      <template v-if="portfolio.holdings.length">
        <h2 class="heat-title">Portfolio Heatmap</h2>
        <div class="heat-grid">
          <div
            v-for="h in heatTiles"
            :key="h.ticker"
            class="heat-tile"
            :style="{
              background: h.positive ? 'var(--color-accent-600)' : 'var(--color-accent-2-600)',
              width: h.width,
              height: h.height,
            }"
          >
            {{ h.ticker }}
            <span class="ret">{{ h.pplDisplay }}</span>
          </div>
        </div>

        <h2 class="section-title">Current Holdings</h2>
        <table class="table">
          <thead>
            <tr>
              <th @click="sortBy('ticker')">Instrument</th>
              <th @click="sortBy('quantity')">Shares</th>
              <th>Price (Avg)</th>
              <th @click="sortBy('value')" class="num">Value</th>
              <th @click="sortBy('return')" class="num">Return (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in sortedHoldings" :key="h.ticker">
              <td><span class="tag tag-neutral">{{ h.ticker }}</span></td>
              <td class="num">{{ h.quantity.toFixed(2) }}</td>
              <td>
                {{ money2(h.currentPrice) }}
                <span style="color: var(--color-neutral-500); font-size: 12px">avg {{ money2(h.averagePrice) }}</span>
              </td>
              <td class="num">{{ money2(h.value) }}</td>
              <td class="num" :class="h.returnPct >= 0 ? 'ret-pos' : 'ret-neg'">
                {{ h.returnPct >= 0 ? '+' : '' }}{{ h.returnPct.toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-6); }
.inv-top { display: grid; grid-template-columns: 1.15fr 1fr; gap: var(--space-8); align-items: start; margin-bottom: var(--space-8); }
@media (max-width: 860px) { .inv-top { grid-template-columns: 1fr; } }
.total-value { font-family: var(--font-heading); font-size: clamp(36px, 5vw, 56px); margin: 0 0 var(--space-6); }
.net-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-4); padding-top: var(--space-5); border-top: 1px solid var(--color-neutral-300); }
.net-label { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-500); }
.net-value { font-family: var(--font-heading); font-size: 22px; }
.alloc-title { font-style: italic; font-size: 13px; color: var(--color-neutral-500); margin: 0 0 var(--space-3); }
.alloc-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; cursor: pointer; }
.alloc-item.disabled { opacity: 0.45; }
.alloc-name { flex: 1; }
.alloc-amt { font-variant-numeric: tabular-nums; color: var(--color-accent-2-700); }
.alloc-item.disabled .alloc-amt { color: var(--color-neutral-500); font-style: italic; }
.alloc-eye { background: none; border: none; padding: 0; display: flex; color: var(--color-accent-700); cursor: pointer; }
.alloc-item.disabled .alloc-eye { color: var(--color-neutral-400); }
.alloc-total { display: flex; justify-content: space-between; padding-top: var(--space-3); margin-top: var(--space-2); border-top: 1px solid var(--color-neutral-300); font-size: 13px; color: var(--color-neutral-600); }
.donut-wrap { display: flex; flex-direction: column; align-items: center; gap: var(--space-5); }
.donut { position: relative; width: 240px; height: 240px; border-radius: 50%; margin: 0 auto; }
.donut::before { content: ""; position: absolute; inset: 34px; border-radius: 50%; background: var(--color-bg); }
.donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.donut-center .lbl { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-500); }
.donut-center .val { font-family: var(--font-heading); font-size: 20px; }
.legend { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-2) var(--space-5); }
.legend-item { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; color: var(--color-neutral-600); }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.legend-amt { font-variant-numeric: tabular-nums; color: var(--color-text); }
.donut-note { font-size: 11.5px; font-style: italic; color: var(--color-neutral-500); text-align: center; max-width: 320px; margin: 0; }
.heat-title, .section-title { font-family: var(--font-heading); font-weight: 400; font-size: 20px; margin: 0 0 var(--space-5); }
.heat-grid { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: var(--space-8); }
.heat-tile { display: flex; flex-direction: column; justify-content: center; align-items: center; color: #fff; font-size: 12px; letter-spacing: 0.02em; min-width: 48px; min-height: 48px; position: relative; }
.heat-tile span.ret { font-size: 10px; opacity: 0.85; }
:deep(.table) th { cursor: pointer; user-select: none; }
:deep(.table) .num { text-align: right; font-variant-numeric: tabular-nums; }
.ret-pos { color: var(--color-accent-700); }
.ret-neg { color: var(--color-accent-2-700); }
</style>
