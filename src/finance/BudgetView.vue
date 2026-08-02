<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  createTagRule,
  deleteTagRule,
  getMonthlySummary,
  getTagRules,
  getTransactions,
  reapplyTagRules,
  updateTagRule,
  updateTransactionTags,
  uploadStatement,
} from './api'
import { money, money2, toLocalIsoDate } from './format'
import type { MonthlySummary, ReapplyResult, StatementUploadOutcome, TagRule, Transaction } from './types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface UploadItem {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  outcome: StatementUploadOutcome | null
  error: string | null
}

const NO_TAGS_VALUE = '__no_tags__'

const cal = ref(new Date())
const transactions = ref<Transaction[]>([])
const summary = ref<MonthlySummary | null>(null)
const loading = ref(false)
const modalDay = ref<number | null>(null)
const selectedTx = ref<Transaction | null>(null)

const tagFilter = ref('')
const subscriptionsOnly = ref(false)

const tagDraft = ref('')
const subscriptionDraft = ref(false)
const savingTag = ref(false)
const tagSaveError = ref<string | null>(null)

const tagRules = ref<TagRule[]>([])
const ruleModalOpen = ref(false)
const ruleSearch = ref('')
const rulesLoading = ref(false)
const rulesError = ref<string | null>(null)
const editingRuleId = ref<number | null>(null)
const ruleDraftStatement = ref('')
const ruleDraftPriority = ref(0)
const newRuleOpen = ref(false)
const newRuleStatement = ref('')
const newRulePriority = ref(0)
const ruleSaving = ref(false)
const ruleSaveError = ref<string | null>(null)
const reapplying = ref(false)
const reapplyResult = ref<ReapplyResult | null>(null)
const copiedField = ref<string | null>(null)
let copiedFieldTimeout: ReturnType<typeof setTimeout> | undefined

const uploadOpen = ref(false)
const uploadStage = ref<'idle' | 'selected' | 'uploading' | 'done'>('idle')
const uploadFiles = ref<File[]>([])
const uploadItems = ref<UploadItem[]>([])
const uploadError = ref<string | null>(null)

const exportRangeOpen = ref(false)
const exportFrom = ref('')
const exportTo = ref('')
const exportError = ref<string | null>(null)
const exporting = ref(false)

const monthLabel = computed(() =>
  cal.value.toLocaleString('default', { month: 'long', year: 'numeric' }),
)

const monthRange = computed(() => {
  const year = cal.value.getFullYear()
  const month = cal.value.getMonth()
  return {
    from: toLocalIsoDate(new Date(year, month, 1)),
    to: toLocalIsoDate(new Date(year, month + 1, 0)),
  }
})

async function fetchData() {
  loading.value = true
  const { from, to } = monthRange.value
  const year = cal.value.getFullYear()
  const month = cal.value.getMonth()
  const monthParam = `${year}-${String(month + 1).padStart(2, '0')}`

  try {
    const [txData, summaryData] = await Promise.all([
      getTransactions(from, to),
      getMonthlySummary(monthParam),
    ])
    transactions.value = txData
    summary.value = summaryData
  } catch (e) {
    console.error('Failed to load budget data', e)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
watch(cal, fetchData)

function prevMonth() {
  const d = new Date(cal.value)
  d.setMonth(d.getMonth() - 1)
  cal.value = d
  modalDay.value = null
  selectedTx.value = null
}

function nextMonth() {
  const d = new Date(cal.value)
  d.setMonth(d.getMonth() + 1)
  cal.value = d
  modalDay.value = null
  selectedTx.value = null
}

const availableTags = computed(() => {
  const tags = new Set<string>()
  for (const t of transactions.value) {
    if (t.tags) tags.add(t.tags)
  }
  return [...tags].sort((a, b) => a.localeCompare(b))
})

const filtersActive = computed(() => tagFilter.value !== '' || subscriptionsOnly.value)

function clearFilters() {
  tagFilter.value = ''
  subscriptionsOnly.value = false
}

const filteredTransactions = computed(() => {
  return transactions.value.filter((t) => {
    if (subscriptionsOnly.value && !t.subscription) return false
    if (tagFilter.value === NO_TAGS_VALUE && t.tags) return false
    if (tagFilter.value && tagFilter.value !== NO_TAGS_VALUE && t.tags !== tagFilter.value) return false
    return true
  })
})

function txForDay(day: number) {
  const year = cal.value.getFullYear()
  const month = cal.value.getMonth()
  const dateStr = toLocalIsoDate(new Date(year, month, day))
  return filteredTransactions.value.filter((t) => t.date === dateStr)
}

const calendarTiles = computed(() => {
  const year = cal.value.getFullYear()
  const month = cal.value.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstIdx = (new Date(year, month, 1).getDay() + 6) % 7
  const today = new Date()

  const tiles: {
    day: number | null
    empty: boolean
    today: boolean
    income: number
    expense: number
  }[] = []

  for (let i = 0; i < firstIdx; i++) {
    tiles.push({ day: null, empty: true, today: false, income: 0, expense: 0 })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayTx = txForDay(day)
    const income = dayTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const expense = dayTx.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0)
    tiles.push({
      day,
      empty: false,
      today:
        today.getFullYear() === year && today.getMonth() === month && today.getDate() === day,
      income,
      expense,
    })
  }
  return tiles
})

const modalOpen = computed(() => modalDay.value !== null)
const modalTx = computed(() => (modalDay.value !== null ? txForDay(modalDay.value) : []))
const modalDate = computed(() => {
  if (modalDay.value === null) return ''
  const d = new Date(cal.value.getFullYear(), cal.value.getMonth(), modalDay.value)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

function closeModal() {
  modalDay.value = null
  selectedTx.value = null
}

const txDetailOpen = computed(() => selectedTx.value !== null)
const txDetailDate = computed(() => {
  if (!selectedTx.value) return ''
  const parts = selectedTx.value.date.split('-').map(Number)
  return new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

function openTxDetail(t: Transaction) {
  selectedTx.value = t
}

function closeTxDetail() {
  selectedTx.value = null
}

watch(selectedTx, (t) => {
  tagDraft.value = t?.tags ?? ''
  subscriptionDraft.value = t?.subscription ?? false
  tagSaveError.value = null
})

const tagEditDirty = computed(() => {
  if (!selectedTx.value) return false
  return tagDraft.value.trim() !== (selectedTx.value.tags ?? '') || subscriptionDraft.value !== selectedTx.value.subscription
})

async function saveTagEdit() {
  if (!selectedTx.value || savingTag.value) return
  savingTag.value = true
  tagSaveError.value = null
  try {
    const updated = await updateTransactionTags(selectedTx.value.id, tagDraft.value.trim(), subscriptionDraft.value)
    const idx = transactions.value.findIndex((t) => t.id === updated.id)
    if (idx !== -1) transactions.value[idx] = updated
    selectedTx.value = updated
  } catch (e) {
    tagSaveError.value = e instanceof Error ? e.message : 'Failed to save tag'
  } finally {
    savingTag.value = false
  }
}

const filteredRules = computed(() => {
  const q = ruleSearch.value.trim().toLowerCase()
  if (!q) return tagRules.value
  return tagRules.value.filter((r) => r.statement.toLowerCase().includes(q))
})

async function loadTagRules() {
  rulesLoading.value = true
  rulesError.value = null
  try {
    tagRules.value = await getTagRules()
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to load tag rules'
  } finally {
    rulesLoading.value = false
  }
}

function openRuleModal() {
  ruleModalOpen.value = true
  ruleSearch.value = selectedTx.value?.tags ?? ''
  editingRuleId.value = null
  newRuleOpen.value = false
  ruleSaveError.value = null
  reapplyResult.value = null
  loadTagRules()
}

function closeRuleModal() {
  ruleModalOpen.value = false
  editingRuleId.value = null
  newRuleOpen.value = false
}

async function copyField(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copiedField.value = label
    clearTimeout(copiedFieldTimeout)
    copiedFieldTimeout = setTimeout(() => {
      copiedField.value = null
    }, 1500)
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to copy to clipboard'
  }
}

function startEditRule(rule: TagRule) {
  editingRuleId.value = rule.id
  ruleDraftStatement.value = rule.statement
  ruleDraftPriority.value = rule.priority
  ruleSaveError.value = null
  newRuleOpen.value = false
}

function cancelEditRule() {
  editingRuleId.value = null
  ruleSaveError.value = null
}

async function reapplyRulesAndRefresh() {
  reapplying.value = true
  try {
    reapplyResult.value = await reapplyTagRules()
    await fetchData()
    if (selectedTx.value) {
      const refreshed = transactions.value.find((t) => t.id === selectedTx.value!.id)
      if (refreshed) selectedTx.value = refreshed
    }
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to reapply tag rules'
  } finally {
    reapplying.value = false
  }
}

async function saveRuleEdit(id: number) {
  ruleSaving.value = true
  ruleSaveError.value = null
  try {
    const updated = await updateTagRule(id, { statement: ruleDraftStatement.value, priority: ruleDraftPriority.value })
    const idx = tagRules.value.findIndex((r) => r.id === id)
    if (idx !== -1) tagRules.value[idx] = updated
    editingRuleId.value = null
    await reapplyRulesAndRefresh()
  } catch (e) {
    ruleSaveError.value = e instanceof Error ? e.message : 'Failed to save rule'
  } finally {
    ruleSaving.value = false
  }
}

async function deleteRule(id: number) {
  ruleSaving.value = true
  ruleSaveError.value = null
  try {
    await deleteTagRule(id)
    tagRules.value = tagRules.value.filter((r) => r.id !== id)
    if (editingRuleId.value === id) editingRuleId.value = null
    await reapplyRulesAndRefresh()
  } catch (e) {
    ruleSaveError.value = e instanceof Error ? e.message : 'Failed to delete rule'
  } finally {
    ruleSaving.value = false
  }
}

function startNewRule() {
  newRuleOpen.value = true
  editingRuleId.value = null
  const maxPriority = tagRules.value.reduce((max, r) => Math.max(max, r.priority), -1)
  newRulePriority.value = maxPriority + 1
  const tagGuess = selectedTx.value?.tags || ruleSearch.value.trim() || '...'
  newRuleStatement.value = `UPDATE transactions SET tags = '${tagGuess}' WHERE description LIKE '%...%'`
  ruleSaveError.value = null
}

function cancelNewRule() {
  newRuleOpen.value = false
}

async function createNewRule() {
  ruleSaving.value = true
  ruleSaveError.value = null
  try {
    const created = await createTagRule({ statement: newRuleStatement.value, priority: newRulePriority.value })
    tagRules.value = [...tagRules.value, created].sort((a, b) => a.priority - b.priority)
    newRuleOpen.value = false
    await reapplyRulesAndRefresh()
  } catch (e) {
    ruleSaveError.value = e instanceof Error ? e.message : 'Failed to create rule'
  } finally {
    ruleSaving.value = false
  }
}

function openUpload() {
  uploadOpen.value = true
  uploadStage.value = 'idle'
  uploadFiles.value = []
  uploadItems.value = []
  uploadError.value = null
}

function closeUpload() {
  uploadOpen.value = false
}

function onFile(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []
  if (files.length) {
    uploadFiles.value = [...uploadFiles.value, ...files]
    uploadStage.value = 'selected'
    uploadError.value = null
  }
  target.value = ''
}

function removeFile(index: number) {
  uploadFiles.value = uploadFiles.value.filter((_, i) => i !== index)
  if (uploadFiles.value.length === 0) {
    uploadStage.value = 'idle'
  }
}

async function submitUpload() {
  if (!uploadFiles.value.length) return
  uploadStage.value = 'uploading'
  uploadError.value = null
  uploadItems.value = uploadFiles.value.map((file) => ({
    file,
    status: 'pending',
    outcome: null,
    error: null,
  }))

  for (const item of uploadItems.value) {
    item.status = 'uploading'
    try {
      item.outcome = await uploadStatement(item.file)
      item.status = item.outcome.success ? 'success' : 'error'
    } catch (e) {
      item.status = 'error'
      item.error = e instanceof Error ? e.message : 'Upload failed'
    }
  }

  uploadStage.value = 'done'
  await fetchData()
}

function fileSizeLabel(file: File): string {
  return `${(file.size / 1024).toFixed(0)} KB`
}

function downloadJson(data: Transaction[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportMonth() {
  const { from, to } = monthRange.value
  downloadJson(transactions.value, `transactions-${from}-to-${to}.json`)
}

function toggleExportRange() {
  exportRangeOpen.value = !exportRangeOpen.value
  if (exportRangeOpen.value) {
    exportFrom.value = monthRange.value.from
    exportTo.value = monthRange.value.to
    exportError.value = null
  }
}

async function exportCustomRange() {
  if (!exportFrom.value || !exportTo.value) {
    exportError.value = 'Choose both a start and end date.'
    return
  }
  if (exportFrom.value > exportTo.value) {
    exportError.value = 'Start date must be before end date.'
    return
  }
  exportError.value = null
  exporting.value = true
  try {
    const data = await getTransactions(exportFrom.value, exportTo.value)
    downloadJson(data, `transactions-${exportFrom.value}-to-${exportTo.value}.json`)
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'Export failed'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div>
    <p class="fin-kicker">Finance — Budget</p>
    <h1 class="fin-title">Budget Tracker</h1>

    <div class="bud-head">
      <div class="bud-nav">
        <button class="btn btn-ghost btn-icon" @click="prevMonth" aria-label="Previous month">←</button>
        <h2>{{ monthLabel }}</h2>
        <button class="btn btn-ghost btn-icon" @click="nextMonth" aria-label="Next month">→</button>
      </div>
      <button class="btn btn-secondary" @click="openUpload">Upload bank statement</button>
      <div class="bud-export">
        <button class="btn btn-secondary" @click="exportMonth">Export JSON</button>
        <button
          class="btn btn-ghost"
          @click="toggleExportRange"
          :aria-expanded="exportRangeOpen"
        >
          Custom range {{ exportRangeOpen ? '▴' : '▾' }}
        </button>
      </div>
      <div class="bud-summary" v-if="summary">
        <span><span class="lbl">In</span><span class="ret-pos">{{ money(summary.totalIncome) }}</span></span>
        <span><span class="lbl">Out</span><span class="ret-neg">{{ money(summary.totalSpending) }}</span></span>
        <span><span class="lbl">Net</span><span :class="summary.netFlow >= 0 ? 'ret-pos' : 'ret-neg'">{{ money(summary.netFlow) }}</span></span>
      </div>
    </div>

    <div v-if="exportRangeOpen" class="bud-export-range">
      <div class="field">
        <label for="export-from">From</label>
        <input id="export-from" class="input" type="date" v-model="exportFrom" />
      </div>
      <div class="field">
        <label for="export-to">To</label>
        <input id="export-to" class="input" type="date" v-model="exportTo" />
      </div>
      <button class="btn btn-primary" @click="exportCustomRange" :disabled="exporting">
        {{ exporting ? 'Exporting…' : 'Export range' }}
      </button>
      <button class="btn btn-ghost" @click="exportRangeOpen = false">Cancel</button>
      <p v-if="exportError" class="upload-error">{{ exportError }}</p>
    </div>

    <div class="bud-filters">
      <div class="field">
        <label for="tag-filter">Tag</label>
        <select id="tag-filter" class="input" v-model="tagFilter">
          <option value="">All tags</option>
          <option :value="NO_TAGS_VALUE">No tags</option>
          <option v-for="t in availableTags" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <label class="bud-filter-check">
        <input type="checkbox" v-model="subscriptionsOnly" />
        Subscriptions only
      </label>
      <button v-if="filtersActive" class="btn btn-ghost" @click="clearFilters">Clear filters</button>
    </div>

    <div class="cal-grid">
      <div v-for="d in DAY_LABELS" :key="d" class="cal-daylabel">{{ d }}</div>
      <div
        v-for="(t, i) in calendarTiles"
        :key="i"
        class="cal-tile"
        :class="{ empty: t.empty, today: t.today }"
        @click="t.day !== null && (modalDay = t.day)"
      >
        <span class="cal-daynum">{{ t.day ?? '' }}</span>
        <div class="cal-metrics">
          <span v-if="t.income > 0" class="in">+{{ money(t.income) }}</span>
          <span v-if="t.expense > 0" class="out">-{{ money(t.expense) }}</span>
        </div>
      </div>
    </div>

    <div v-if="modalOpen" class="dialog-backdrop" @click="closeModal">
      <div class="dialog dialog-with-panel" :class="{ 'panel-open': txDetailOpen }" @click.stop>
        <div class="dialog-main">
          <div class="dialog-title">{{ modalDate }}</div>
          <div class="dialog-body">
            <p v-if="modalTx.length === 0" style="font-style: italic; color: var(--color-neutral-500)">
              No transactions recorded for this day.
            </p>
            <div
              v-for="m in modalTx"
              :key="m.id"
              class="tx-row tx-row-clickable"
              :class="{ active: selectedTx?.id === m.id }"
              @click="openTxDetail(m)"
            >
              <div class="tx-info">
                <div class="tx-desc">{{ m.description }}</div>
                <div class="tx-meta">
                  {{ m.source }}
                  <span v-if="m.tags" class="tag tag-neutral tx-tag">{{ m.tags }}</span>
                  <span v-if="m.subscription" class="tag tag-neutral tx-tag">Subscription</span>
                </div>
              </div>
              <span class="tx-amount" :class="m.amount >= 0 ? 'ret-pos' : 'ret-neg'">
                {{ m.amount > 0 ? '+' : '' }}{{ money2(m.amount) }}
              </span>
            </div>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="closeModal">Close</button>
          </div>
        </div>

        <transition name="tx-panel-slide">
          <div v-if="txDetailOpen" class="tx-panel">
            <div class="tx-panel-header">
              <span>Transaction details</span>
              <button class="tx-panel-close" aria-label="Close details" @click="closeTxDetail">×</button>
            </div>
            <div class="tx-panel-body">
              <div class="tx-desc" style="font-size: 16px; margin-bottom: var(--space-2)">
                {{ selectedTx?.description }}
              </div>
              <div class="tx-detail-amount" :class="(selectedTx?.amount ?? 0) >= 0 ? 'ret-pos' : 'ret-neg'">
                {{ (selectedTx?.amount ?? 0) > 0 ? '+' : '' }}{{ money2(selectedTx?.amount ?? 0) }}
              </div>
              <div class="tx-detail-row">
                <span class="tx-detail-label">Date</span>
                <span>{{ txDetailDate }}</span>
              </div>
              <div class="tx-detail-row">
                <span class="tx-detail-label">Source</span>
                <span>{{ selectedTx?.source }}</span>
              </div>
              <div class="tx-detail-row tx-detail-edit">
                <span class="tx-detail-label">Tag</span>
                <div class="tx-tag-edit">
                  <input
                    class="input"
                    list="tag-suggestions"
                    v-model="tagDraft"
                    placeholder="Untagged"
                    @keydown.enter="saveTagEdit"
                  />
                  <datalist id="tag-suggestions">
                    <option v-for="t in availableTags" :key="t" :value="t" />
                  </datalist>
                </div>
              </div>
              <div class="tx-detail-row">
                <span class="tx-detail-label">Subscription</span>
                <label class="tx-sub-toggle">
                  <input type="checkbox" v-model="subscriptionDraft" />
                  {{ subscriptionDraft ? 'Yes' : 'No' }}
                </label>
              </div>
              <div class="tx-tag-actions">
                <button
                  class="btn btn-primary"
                  @click="saveTagEdit"
                  :disabled="savingTag || !tagEditDirty"
                >
                  {{ savingTag ? 'Saving…' : 'Save' }}
                </button>
                <p v-if="tagSaveError" class="upload-error">{{ tagSaveError }}</p>
              </div>
              <div class="tx-rule-link">
                <button class="btn btn-ghost" @click="openRuleModal">Manage matching tag rule →</button>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div v-if="ruleModalOpen" class="dialog-backdrop" @click="closeRuleModal">
      <div class="dialog dialog-rules" @click.stop>
        <div class="dialog-title">Tag rules</div>
        <div class="dialog-body">
          <div v-if="selectedTx" class="rule-tx-ref">
            <div class="rule-tx-ref-row">
              <span class="tx-detail-label">Description</span>
              <div class="rule-tx-ref-value">
                <code>{{ selectedTx.description }}</code>
                <button class="rule-copy" @click="copyField('description', selectedTx.description)">
                  {{ copiedField === 'description' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="rule-tx-ref-row">
              <span class="tx-detail-label">Source</span>
              <div class="rule-tx-ref-value">
                <code>{{ selectedTx.source }}</code>
                <button class="rule-copy" @click="copyField('source', selectedTx.source)">
                  {{ copiedField === 'source' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="rule-tx-ref-row">
              <span class="tx-detail-label">Amount</span>
              <div class="rule-tx-ref-value">
                <code>{{ selectedTx.amount }}</code>
                <button class="rule-copy" @click="copyField('amount', String(selectedTx.amount))">
                  {{ copiedField === 'amount' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
            <div v-if="selectedTx.tags" class="rule-tx-ref-row">
              <span class="tx-detail-label">Current tag</span>
              <div class="rule-tx-ref-value">
                <code>{{ selectedTx.tags }}</code>
                <button class="rule-copy" @click="copyField('tags', selectedTx.tags)">
                  {{ copiedField === 'tags' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>
          </div>

          <div class="field rule-search">
            <label for="rule-search">Search by tag or keyword</label>
            <input
              id="rule-search"
              class="input"
              v-model="ruleSearch"
              placeholder="e.g. Netflix, Entertainment"
            />
          </div>

          <p v-if="rulesLoading" class="upload-note">Loading rules…</p>
          <p v-else-if="filteredRules.length === 0" class="upload-note" style="font-style: italic">
            No matching rules. Create one below.
          </p>

          <div v-for="rule in filteredRules" :key="rule.id" class="rule-row">
            <template v-if="editingRuleId === rule.id">
              <div class="field">
                <label>Priority</label>
                <input class="input" type="number" v-model.number="ruleDraftPriority" />
              </div>
              <div class="field">
                <label>Statement</label>
                <textarea class="input rule-textarea" v-model="ruleDraftStatement" rows="3"></textarea>
              </div>
              <div class="rule-actions">
                <button class="btn btn-primary" @click="saveRuleEdit(rule.id)" :disabled="ruleSaving">
                  {{ ruleSaving ? 'Saving…' : 'Save' }}
                </button>
                <button class="btn btn-ghost" @click="cancelEditRule">Cancel</button>
                <button class="btn btn-ghost rule-delete" @click="deleteRule(rule.id)" :disabled="ruleSaving">
                  Delete
                </button>
              </div>
            </template>
            <template v-else>
              <div class="rule-view" @click="startEditRule(rule)">
                <span class="rule-priority">#{{ rule.priority }}</span>
                <code class="rule-statement">{{ rule.statement }}</code>
              </div>
            </template>
          </div>

          <div class="rule-new">
            <button v-if="!newRuleOpen" class="btn btn-secondary" @click="startNewRule">+ New tag rule</button>
            <template v-else>
              <div class="field">
                <label>Priority</label>
                <input class="input" type="number" v-model.number="newRulePriority" />
              </div>
              <div class="field">
                <label>Statement</label>
                <textarea class="input rule-textarea" v-model="newRuleStatement" rows="3"></textarea>
              </div>
              <div class="rule-actions">
                <button class="btn btn-primary" @click="createNewRule" :disabled="ruleSaving">
                  {{ ruleSaving ? 'Creating…' : 'Create' }}
                </button>
                <button class="btn btn-ghost" @click="cancelNewRule">Cancel</button>
              </div>
            </template>
          </div>

          <p v-if="ruleSaveError" class="upload-error">{{ ruleSaveError }}</p>
          <p v-if="rulesError" class="upload-error">{{ rulesError }}</p>
          <p v-if="reapplying" class="upload-note">Reapplying rules…</p>
          <p v-else-if="reapplyResult" class="upload-note">
            Applied {{ reapplyResult.rulesRun }} rule(s), {{ reapplyResult.rowsAffected }} row update(s).
          </p>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="closeRuleModal">Close</button>
        </div>
      </div>
    </div>

    <div v-if="uploadOpen" class="dialog-backdrop" @click="closeUpload">
      <div class="dialog" @click.stop>
        <div class="dialog-title">Upload bank statements</div>
        <div class="dialog-body">
          <label v-if="uploadStage === 'idle'" class="upload-drop">
            <input type="file" accept=".csv,.ofx,.qif,.pdf" multiple style="display: none" @change="onFile" />
            <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor"><path opacity="0.25" d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152Z"/><path d="M243.31,90.63l-72-72a16,16,0,0,0-22.62,0L136,29.28V152a8,8,0,0,1-16,0V29.28L108.69,18.63a16,16,0,0,0-22.62,0l-72,72A16,16,0,0,0,25.37,116l16-16V208a24,24,0,0,0,24,24H190.63a24,24,0,0,0,24-24V100l16,16a16,16,0,0,0,11.31-27.37Z"/></svg>
            <span class="upload-drop-title">Drag statements here, or click to browse</span>
            <span class="upload-drop-sub">CSV, OFX, QIF or PDF from your bank — select as many as you like</span>
          </label>

          <template v-if="uploadStage === 'selected'">
            <div v-for="(file, i) in uploadFiles" :key="`${file.name}-${i}`" class="upload-file-row">
              <span class="tag tag-neutral">{{ file.name }}</span>
              <span class="upload-file-size">{{ fileSizeLabel(file) }}</span>
              <button class="upload-remove" aria-label="Remove file" @click="removeFile(i)">×</button>
            </div>
            <label class="upload-add-more">
              <input type="file" accept=".csv,.ofx,.qif,.pdf" multiple style="display: none" @change="onFile" />
              + Add more files
            </label>
            <p class="upload-note">We'll match transactions against your existing entries and only add new ones.</p>
            <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
          </template>

          <template v-if="uploadStage === 'uploading' || uploadStage === 'done'">
            <p class="upload-note">
              {{ uploadStage === 'uploading' ? `Importing ${uploadFiles.length} statement(s)…` : 'Import complete' }}
            </p>
            <div
              v-for="(item, i) in uploadItems"
              :key="`${item.file.name}-${i}`"
              class="upload-outcome"
              :class="{ failed: item.status === 'error' }"
            >
              <span class="upload-outcome-name">
                <span v-if="item.status === 'uploading'" class="upload-spinner" aria-hidden="true"></span>
                <span v-else-if="item.status === 'success'" class="upload-status-icon success" aria-hidden="true">✓</span>
                <span v-else-if="item.status === 'error'" class="upload-status-icon error" aria-hidden="true">✕</span>
                {{ item.file.name }}
              </span>
              <span v-if="item.status === 'pending'" class="upload-outcome-detail">Waiting…</span>
              <span v-else-if="item.status === 'uploading'" class="upload-outcome-detail">Importing…</span>
              <span v-else-if="item.status === 'success' && item.outcome" class="upload-outcome-detail">
                {{ item.outcome.added }} added, {{ item.outcome.skipped }} skipped
              </span>
              <span v-else class="upload-outcome-detail">{{ item.outcome?.error ?? item.error }}</span>
            </div>
          </template>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="closeUpload">{{ uploadStage === 'done' ? 'Close' : 'Cancel' }}</button>
          <button v-if="uploadStage === 'selected'" class="btn btn-primary" @click="submitUpload">Upload</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-6); }
.bud-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--space-5); margin-bottom: var(--space-6); }
.bud-nav { display: flex; align-items: center; gap: var(--space-4); }
.bud-nav h2 { font-family: var(--font-heading); font-weight: 400; font-size: 22px; margin: 0; min-width: 200px; text-align: center; }
.bud-export { display: flex; align-items: center; gap: var(--space-2); }
.bud-export-range { display: flex; align-items: flex-end; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-6); }
.bud-export-range .field { width: 170px; }
.bud-export-range .upload-error { flex-basis: 100%; margin: 0; }
.bud-summary { display: flex; gap: var(--space-5); font-size: 13px; }
.bud-summary .lbl { color: var(--color-neutral-500); margin-right: var(--space-1); }
.bud-filters { display: flex; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-5); }
.bud-filters .field { width: 200px; }
.bud-filter-check { display: flex; align-items: center; gap: var(--space-2); font-size: 13px; padding-bottom: 8px; cursor: pointer; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-2); }
.cal-daylabel { text-align: center; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-500); padding-bottom: var(--space-2); }
.cal-tile { border-top: 1px solid var(--color-neutral-300); min-height: 92px; padding: var(--space-2); display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; }
.cal-tile:hover { background: var(--color-accent-100); }
.cal-tile.empty { border-top: none; cursor: default; }
.cal-tile.empty:hover { background: none; }
.cal-tile.today { background: var(--color-accent-100); }
.cal-daynum { font-size: 13px; color: var(--color-neutral-600); }
.cal-metrics { display: flex; flex-direction: column; align-items: flex-end; font-size: 12px; gap: 2px; }
.cal-metrics .in { color: var(--color-accent-700); }
.cal-metrics .out { color: var(--color-accent-2-700); }
.tx-row { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) 0; border-top: 1px solid var(--color-neutral-300); }
.tx-row:first-child { border-top: none; }
.tx-row-clickable { cursor: pointer; border-radius: var(--radius-md); }
.tx-row-clickable:hover { background: var(--color-accent-100); }
.tx-row-clickable.active { background: var(--color-accent-100); }
.tx-info { min-width: 0; flex: 1 1 auto; }
.tx-desc { font-size: 14px; overflow-wrap: anywhere; }
.tx-meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); font-size: 11px; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
.tx-tag { text-transform: none; letter-spacing: 0.02em; }
.tx-amount { flex: 0 0 auto; white-space: nowrap; }

.dialog-with-panel { flex-direction: row; align-items: stretch; gap: 0; overflow: hidden; width: min(480px, 100%); transition: width 0.22s ease; }
.dialog-with-panel.panel-open { width: min(800px, 100%); }
.dialog-main { display: flex; flex-direction: column; gap: var(--space-3); flex: 1 1 auto; min-width: 0; }
.dialog-body { overflow-x: hidden; scrollbar-width: thin; scrollbar-color: var(--color-neutral-400) transparent; }
.dialog-body::-webkit-scrollbar { width: 6px; }
.dialog-body::-webkit-scrollbar-track { background: transparent; }
.dialog-body::-webkit-scrollbar-thumb { background: var(--color-neutral-400); border-radius: 999px; }
.dialog-body::-webkit-scrollbar-thumb:hover { background: var(--color-neutral-500); }
.tx-panel { flex: 0 0 280px; width: 280px; margin-left: var(--space-4); padding-left: var(--space-4); border-left: 1px solid var(--color-neutral-300); display: flex; flex-direction: column; gap: var(--space-3); }
.tx-panel-header { display: flex; justify-content: space-between; align-items: center; font-family: var(--font-heading); font-weight: var(--font-heading-weight); font-size: 16px; }
.tx-panel-close { background: none; border: none; font-size: 20px; line-height: 1; color: var(--color-neutral-500); cursor: pointer; padding: 0 var(--space-1); }
.tx-panel-close:hover { color: var(--color-text); }
.tx-panel-body { display: flex; flex-direction: column; gap: 0; }
.tx-panel-slide-enter-active, .tx-panel-slide-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.tx-panel-slide-enter-from, .tx-panel-slide-leave-to { opacity: 0; transform: translateX(12px); }
.tx-detail-amount { font-size: 24px; margin-bottom: var(--space-2); }
.tx-detail-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; border-top: 1px solid var(--color-neutral-300); }
.tx-detail-row:first-of-type { border-top: none; }
.tx-detail-label { color: var(--color-neutral-500); font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.tx-detail-edit .tx-tag-edit { width: 160px; }
.tx-detail-edit .input { width: 100%; }
.tx-sub-toggle { display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: 13px; }
.tx-tag-actions { display: flex; align-items: center; gap: var(--space-3); padding-top: var(--space-3); }
.tx-rule-link { padding-top: var(--space-2); }
.dialog-rules { width: min(620px, 100%); }
.rule-tx-ref { padding-bottom: var(--space-4); margin-bottom: var(--space-4); border-bottom: 1px solid var(--color-neutral-300); display: flex; flex-direction: column; gap: var(--space-2); }
.rule-tx-ref-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.rule-tx-ref-value { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.rule-tx-ref-value code { font-size: 12px; overflow-wrap: anywhere; text-align: right; }
.rule-copy { flex: 0 0 auto; background: none; border: none; color: var(--color-accent-700); font-size: 11px; cursor: pointer; padding: 2px 6px; border-radius: var(--radius-sm); }
.rule-copy:hover { background: var(--color-accent-100); }
.rule-search { margin-bottom: var(--space-4); }
.rule-row { padding: var(--space-3) 0; border-top: 1px solid var(--color-neutral-300); display: flex; flex-direction: column; gap: var(--space-2); }
.rule-row:first-of-type { border-top: none; }
.rule-view { display: flex; align-items: flex-start; gap: var(--space-3); cursor: pointer; padding: var(--space-1); border-radius: var(--radius-md); }
.rule-view:hover { background: var(--color-accent-100); }
.rule-priority { flex: 0 0 auto; font-size: 11px; color: var(--color-neutral-500); padding-top: 2px; }
.rule-statement { flex: 1 1 auto; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.rule-textarea { font-family: monospace; font-size: 12px; resize: vertical; }
.rule-actions { display: flex; gap: var(--space-2); }
.rule-delete { color: var(--color-accent-2-700); }
.rule-new { padding-top: var(--space-3); border-top: 1px solid var(--color-neutral-300); margin-top: var(--space-2); display: flex; flex-direction: column; gap: var(--space-2); align-items: flex-start; }
.upload-drop { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; padding: var(--space-8) var(--space-4); border: 1px dashed var(--color-neutral-400); border-radius: var(--radius-md); color: var(--color-accent-700); cursor: pointer; }
.upload-drop:hover { background: var(--color-accent-100); border-color: var(--color-accent-500); }
.upload-drop-title { font-size: 14px; color: var(--color-text); }
.upload-drop-sub { font-size: 12px; color: var(--color-neutral-500); }
.upload-file-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
.upload-file-size { font-size: 12px; color: var(--color-neutral-500); }
.upload-remove { margin-left: auto; background: none; border: none; color: var(--color-neutral-500); font-size: 18px; line-height: 1; cursor: pointer; padding: 0 var(--space-1); }
.upload-remove:hover { color: var(--color-accent-2-700); }
.upload-add-more { display: inline-block; font-size: 13px; color: var(--color-accent-700); cursor: pointer; margin-bottom: var(--space-3); }
.upload-add-more:hover { text-decoration: underline; }
.upload-note { font-size: 13px; color: var(--color-neutral-600); }
.upload-success { font-size: 14px; color: var(--color-accent-700); }
.upload-error { font-size: 13px; color: var(--color-accent-2-700); }
.upload-outcome { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--color-neutral-300); font-size: 13px; }
.upload-outcome:first-child { border-top: none; }
.upload-outcome-name { color: var(--color-text); display: flex; align-items: center; gap: var(--space-2); }
.upload-outcome-detail { color: var(--color-accent-700); text-align: right; }
.upload-outcome.failed .upload-outcome-detail { color: var(--color-accent-2-700); }
.upload-spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--color-neutral-300); border-top-color: var(--color-accent-700); animation: upload-spin 0.7s linear infinite; flex-shrink: 0; }
.upload-status-icon { font-size: 12px; flex-shrink: 0; }
.upload-status-icon.success { color: var(--color-accent-700); }
.upload-status-icon.error { color: var(--color-accent-2-700); }
@keyframes upload-spin { to { transform: rotate(360deg); } }
.ret-pos { color: var(--color-accent-700); }
.ret-neg { color: var(--color-accent-2-700); }
</style>
