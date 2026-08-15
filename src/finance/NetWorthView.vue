<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createNetWorthAccount,
  deleteNetWorthAccount,
  getGoals,
  getNetWorthSummary,
  updateNetWorthAccount,
} from './api'
import { money, money2 } from './format'
import type { MoneyGoal, NetWorthAccount, NetWorthCategory, NetWorthSummary } from './types'

const CATEGORIES: { value: NetWorthCategory; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'PENSION', label: 'Pension' },
  { value: 'PROPERTY', label: 'Property' },
  { value: 'OTHER', label: 'Other' },
  { value: 'LIABILITY', label: 'Liability' },
]

const CATEGORY_COLORS: Record<NetWorthCategory, string> = {
  CASH: 'var(--color-accent-300)',
  SAVINGS: 'var(--color-accent-500)',
  INVESTMENT: 'var(--color-accent-700)',
  PENSION: 'var(--color-neutral-500)',
  PROPERTY: 'var(--color-neutral-700)',
  OTHER: 'var(--color-neutral-400)',
  LIABILITY: 'var(--color-accent-2-600)',
}

function labelFor(category: NetWorthCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category
}

const summary = ref<NetWorthSummary | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

/** Editable copies of the server rows, keyed by id, plus the untouched originals to diff against. */
const drafts = ref<NetWorthAccount[]>([])
const originals = ref<Map<number, NetWorthAccount>>(new Map())
const rowSaving = reactive<Record<number, boolean>>({})
const rowErrors = reactive<Record<number, string>>({})

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const data = await getNetWorthSummary()
    summary.value = data
    drafts.value = data.accounts.map((a) => ({ ...a }))
    originals.value = new Map(data.accounts.map((a) => [a.id, { ...a }]))
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load net worth'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Loaded once, not inside load() — that re-runs after every account write, and re-fetching would
// throw away which expenses the user has toggled off.
const goals = ref<(MoneyGoal & { enabled: boolean })[]>([])
const goalsError = ref<string | null>(null)

onMounted(async () => {
  try {
    goals.value = (await getGoals()).map((g) => ({ ...g, enabled: true }))
  } catch (e) {
    goalsError.value = e instanceof Error ? e.message : 'Failed to load upcoming expenses'
  }
})

function toggleGoal(id: number) {
  const goal = goals.value.find((g) => g.id === id)
  if (goal) goal.enabled = !goal.enabled
}

const totalDeductions = computed(() =>
  goals.value.filter((g) => g.enabled).reduce((sum, g) => sum + g.amount, 0),
)

const netAvailable = computed(() => (summary.value?.netWorth ?? 0) - totalDeductions.value)

function isDirty(account: NetWorthAccount): boolean {
  const original = originals.value.get(account.id)
  if (!original) return true
  return (
    original.name !== account.name ||
    original.category !== account.category ||
    original.balance !== account.balance
  )
}

async function saveRow(account: NetWorthAccount) {
  rowSaving[account.id] = true
  delete rowErrors[account.id]
  try {
    await updateNetWorthAccount(account.id, {
      name: account.name,
      category: account.category,
      balance: account.balance,
    })
    await load()
  } catch (e) {
    rowErrors[account.id] = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    rowSaving[account.id] = false
  }
}

const pendingDelete = ref<NetWorthAccount | null>(null)
const deleteError = ref<string | null>(null)

async function confirmDelete() {
  const account = pendingDelete.value
  if (!account) return
  deleteError.value = null
  try {
    await deleteNetWorthAccount(account.id)
    pendingDelete.value = null
    await load()
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete'
  }
}

const newName = ref('')
const newCategory = ref<NetWorthCategory>('CASH')
const newBalance = ref<number>(0)
const adding = ref(false)
const addError = ref<string | null>(null)

const canAdd = computed(() => newName.value.trim().length > 0)

async function addAccount() {
  if (!canAdd.value) return
  adding.value = true
  addError.value = null
  try {
    await createNetWorthAccount({
      name: newName.value.trim(),
      category: newCategory.value,
      balance: newBalance.value || 0,
    })
    newName.value = ''
    newBalance.value = 0
    await load()
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Failed to add account'
  } finally {
    adding.value = false
  }
}

/** Assets only — a liability has no width on a bar that adds up to total assets. */
const assetCategories = computed(() =>
  (summary.value?.categories ?? []).filter((c) => c.category !== 'LIABILITY' && c.total > 0),
)

const assetBarTotal = computed(() => assetCategories.value.reduce((sum, c) => sum + c.total, 0))

function formatUpdated(updatedAt: string | null): string {
  if (!updatedAt) return '—'
  const date = new Date(updatedAt)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB')
}
</script>

<template>
  <div>
    <p class="fin-kicker">Finance — Net Worth</p>
    <h1 class="fin-title">Net Worth</h1>

    <p v-if="loading" style="color: var(--color-neutral-500)">Loading…</p>
    <p v-else-if="loadError" style="color: var(--color-accent-2-700)">{{ loadError }}</p>

    <template v-else-if="summary">
      <div class="nw-total" :class="{ negative: summary.netWorth < 0 }">
        {{ money(summary.netWorth) }}
      </div>
      <div class="nw-totals-row">
        <div class="nw-stat">
          <span class="nw-stat-label">Assets</span>
          <span class="nw-stat-value">{{ money(summary.totalAssets) }}</span>
        </div>
        <div class="nw-stat">
          <span class="nw-stat-label">Liabilities</span>
          <span class="nw-stat-value neg">{{ money(summary.totalLiabilities) }}</span>
        </div>
        <div class="nw-stat">
          <span class="nw-stat-label">Accounts</span>
          <span class="nw-stat-value">{{ summary.accounts.length }}</span>
        </div>
      </div>

      <template v-if="assetBarTotal > 0">
        <div class="nw-bar">
          <span
            v-for="c in assetCategories"
            :key="c.category"
            class="nw-bar-slice"
            :style="{
              width: `${(c.total / assetBarTotal) * 100}%`,
              background: CATEGORY_COLORS[c.category],
            }"
            :title="`${c.label}: ${money(c.total)}`"
          ></span>
        </div>
        <div class="legend">
          <div v-for="c in summary.categories" :key="c.category" class="legend-item">
            <span class="legend-dot" :style="{ background: CATEGORY_COLORS[c.category] }"></span>
            {{ c.label }}
            <span class="legend-amt">{{ money(c.total) }}</span>
          </div>
        </div>
      </template>

      <section class="expenses">
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
        <p v-if="goalsError" class="error-text">{{ goalsError }}</p>
        <p v-else-if="!goals.length" class="alloc-empty">Nothing set aside.</p>
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
        <div v-if="goals.length" class="alloc-total">
          <span>Total allocated</span><span>{{ money(totalDeductions) }}</span>
        </div>
      </section>

      <h2 class="section-title">Accounts</h2>
      <p class="section-hint">
        Everything here is entered by hand — accounts with no API. Liabilities are entered as a
        positive figure and subtracted from the total.
      </p>

      <table class="table nw-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th class="num">Balance</th>
            <th>Updated</th>
            <th class="actions-col"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in drafts" :key="account.id">
            <td><input class="input" v-model="account.name" aria-label="Account name" /></td>
            <td>
              <select class="input" v-model="account.category" aria-label="Category">
                <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </td>
            <td class="num">
              <input
                class="input balance-input"
                type="number"
                step="0.01"
                v-model.number="account.balance"
                aria-label="Balance"
              />
            </td>
            <td class="updated-cell">{{ formatUpdated(account.updatedAt) }}</td>
            <td class="actions-col">
              <div class="row-actions">
                <button
                  class="btn btn-secondary"
                  :disabled="!isDirty(account) || rowSaving[account.id]"
                  @click="saveRow(account)"
                >
                  {{ rowSaving[account.id] ? 'Saving…' : 'Save' }}
                </button>
                <button class="btn btn-ghost" @click="pendingDelete = account">Delete</button>
              </div>
              <p v-if="rowErrors[account.id]" class="error-text">{{ rowErrors[account.id] }}</p>
            </td>
          </tr>

          <tr v-if="!drafts.length">
            <td colspan="5" class="empty-cell">No accounts yet — add one below.</td>
          </tr>

          <tr class="new-row">
            <td>
              <input class="input" v-model="newName" placeholder="e.g. Cash ISA" aria-label="New account name" />
            </td>
            <td>
              <select class="input" v-model="newCategory" aria-label="New account category">
                <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </td>
            <td class="num">
              <input
                class="input balance-input"
                type="number"
                step="0.01"
                v-model.number="newBalance"
                aria-label="New account balance"
              />
            </td>
            <td class="updated-cell">—</td>
            <td class="actions-col">
              <button class="btn btn-primary" :disabled="!canAdd || adding" @click="addAccount">
                {{ adding ? 'Adding…' : 'Add' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="addError" class="error-text">{{ addError }}</p>
    </template>

    <div v-if="pendingDelete" class="dialog-backdrop" @click.self="pendingDelete = null">
      <div class="dialog">
        <h2 class="dialog-title">Delete account</h2>
        <p class="dialog-body">
          Remove <strong>{{ pendingDelete.name }}</strong> ({{ money2(pendingDelete.balance) }},
          {{ labelFor(pendingDelete.category) }}) from your net worth? This can't be undone.
        </p>
        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="pendingDelete = null">Cancel</button>
          <button class="btn btn-primary" @click="confirmDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-6); }
.nw-total { font-family: var(--font-heading); font-size: clamp(36px, 5vw, 56px); margin-bottom: var(--space-4); }
.nw-total.negative { color: var(--color-accent-2-700); }
.nw-totals-row { display: flex; flex-wrap: wrap; gap: var(--space-8); padding-top: var(--space-4); border-top: 1px solid var(--color-neutral-300); margin-bottom: var(--space-6); }
.nw-stat { display: flex; flex-direction: column; gap: var(--space-1); }
.nw-stat-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-500); }
.nw-stat-value { font-family: var(--font-heading); font-size: 22px; font-variant-numeric: tabular-nums; }
.nw-stat-value.neg { color: var(--color-accent-2-700); }

.nw-bar { display: flex; width: 100%; height: 14px; overflow: hidden; border-radius: var(--radius-sm); margin-bottom: var(--space-3); }
.nw-bar-slice { display: block; height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-5); margin-bottom: var(--space-8); }
.legend-item { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; color: var(--color-neutral-600); }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.legend-amt { font-variant-numeric: tabular-nums; color: var(--color-text); }

.expenses { max-width: 520px; margin-bottom: var(--space-8); }
.net-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-4); padding-top: var(--space-5); border-top: 1px solid var(--color-neutral-300); }
.net-label { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-500); }
.net-value { font-family: var(--font-heading); font-size: 22px; }
.alloc-title { font-style: italic; font-size: 13px; color: var(--color-neutral-500); margin: 0 0 var(--space-3); }
.alloc-empty { font-size: 13px; color: var(--color-neutral-500); margin: 0; }
.alloc-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; cursor: pointer; }
.alloc-item.disabled { opacity: 0.45; }
.alloc-name { flex: 1; }
.alloc-amt { font-variant-numeric: tabular-nums; color: var(--color-accent-2-700); }
.alloc-item.disabled .alloc-amt { color: var(--color-neutral-500); font-style: italic; }
.alloc-eye { background: none; border: none; padding: 0; display: flex; color: var(--color-accent-700); cursor: pointer; }
.alloc-item.disabled .alloc-eye { color: var(--color-neutral-400); }
.alloc-total { display: flex; justify-content: space-between; padding-top: var(--space-3); margin-top: var(--space-2); border-top: 1px solid var(--color-neutral-300); font-size: 13px; color: var(--color-neutral-600); }

.section-title { font-family: var(--font-heading); font-weight: 400; font-size: 20px; margin: 0 0 var(--space-2); }
.section-hint { font-size: 13px; color: var(--color-neutral-500); margin: 0 0 var(--space-4); max-width: 640px; }

.nw-table { table-layout: auto; }
.nw-table td { vertical-align: top; }
:deep(.table) .num { text-align: right; font-variant-numeric: tabular-nums; }
.balance-input { text-align: right; }
.updated-cell { font-size: 12px; color: var(--color-neutral-500); white-space: nowrap; padding-top: 14px; }
.actions-col { width: 1%; white-space: nowrap; }
.row-actions { display: flex; gap: var(--space-2); justify-content: flex-end; }
.empty-cell { text-align: center; color: var(--color-neutral-500); font-style: italic; }
.new-row td { border-top: 1px solid var(--color-neutral-400); }
.error-text { font-size: 12px; color: var(--color-accent-2-700); margin: var(--space-1) 0 0; }

@media (max-width: 760px) {
  .nw-table thead { display: none; }
  .nw-table tr { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); padding: var(--space-3) 0; border-bottom: 1px solid var(--color-divider); }
  .nw-table td { border: none; padding: 0; }
  .nw-table td:first-child, .nw-table .actions-col { grid-column: 1 / -1; width: auto; }
  .updated-cell { padding-top: 0; }
  .row-actions { justify-content: flex-start; }
}
</style>
