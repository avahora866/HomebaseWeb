<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getPortfolio } from './api'
import { money, money2 } from './format'
import type { Holding, PortfolioSummary } from './types'

type SortKey = 'ticker' | 'quantity' | 'value' | 'return'

const portfolio = ref<PortfolioSummary | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const sortKey = ref<SortKey>('value')
const sortDir = ref<'asc' | 'desc'>('desc')

onMounted(async () => {
  try {
    portfolio.value = await getPortfolio()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load portfolio'
  } finally {
    loading.value = false
  }
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
      <div class="total-value">{{ money(portfolio.totalValue) }}</div>
      <p class="total-note">
        Your tracked net worth plus the live Trading212 cash and invested value.
      </p>

      <!-- With the donut gone this is the whole page, so an empty holdings list needs saying out
           loud rather than leaving a blank screen. -->
      <p v-if="!portfolio.holdings.length" class="no-holdings">
        No holdings to show — Trading212 returned nothing, which usually means its API credentials
        aren't set or the call failed.
      </p>

      <template v-else>
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
.total-value { font-family: var(--font-heading); font-size: clamp(36px, 5vw, 56px); margin: 0 0 var(--space-2); }
.total-note { font-size: 13px; color: var(--color-neutral-500); margin: 0 0 var(--space-8); max-width: 520px; }
.no-holdings { font-size: 13px; color: var(--color-neutral-500); max-width: 520px; }
.heat-title, .section-title { font-family: var(--font-heading); font-weight: 400; font-size: 20px; margin: 0 0 var(--space-5); }
.heat-grid { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: var(--space-8); }
.heat-tile { display: flex; flex-direction: column; justify-content: center; align-items: center; color: #fff; font-size: 12px; letter-spacing: 0.02em; min-width: 48px; min-height: 48px; position: relative; }
.heat-tile span.ret { font-size: 10px; opacity: 0.85; }
:deep(.table) th { cursor: pointer; user-select: none; }
:deep(.table) .num { text-align: right; font-variant-numeric: tabular-nums; }
.ret-pos { color: var(--color-accent-700); }
.ret-neg { color: var(--color-accent-2-700); }
</style>
