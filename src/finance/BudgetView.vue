<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getMonthlySummary, getTransactions, uploadStatement } from './api'
import { money, money2, toLocalIsoDate } from './format'
import type { MonthlySummary, Transaction } from './types'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const cal = ref(new Date())
const transactions = ref<Transaction[]>([])
const summary = ref<MonthlySummary | null>(null)
const loading = ref(false)
const modalDay = ref<number | null>(null)

const uploadOpen = ref(false)
const uploadStage = ref<'idle' | 'selected' | 'uploading' | 'done'>('idle')
const uploadFile = ref<File | null>(null)
const uploadResultText = ref('')
const uploadError = ref<string | null>(null)

const monthLabel = computed(() =>
  cal.value.toLocaleString('default', { month: 'long', year: 'numeric' }),
)

async function fetchData() {
  loading.value = true
  const year = cal.value.getFullYear()
  const month = cal.value.getMonth()
  const from = toLocalIsoDate(new Date(year, month, 1))
  const to = toLocalIsoDate(new Date(year, month + 1, 0))
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
}

function nextMonth() {
  const d = new Date(cal.value)
  d.setMonth(d.getMonth() + 1)
  cal.value = d
  modalDay.value = null
}

function txForDay(day: number) {
  const year = cal.value.getFullYear()
  const month = cal.value.getMonth()
  const dateStr = toLocalIsoDate(new Date(year, month, day))
  return transactions.value.filter((t) => t.date === dateStr)
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
}

function openUpload() {
  uploadOpen.value = true
  uploadStage.value = 'idle'
  uploadFile.value = null
  uploadError.value = null
}

function closeUpload() {
  uploadOpen.value = false
}

function onFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    uploadFile.value = file
    uploadStage.value = 'selected'
    uploadError.value = null
  }
}

async function submitUpload() {
  if (!uploadFile.value) return
  uploadStage.value = 'uploading'
  uploadError.value = null
  try {
    const result = await uploadStatement(uploadFile.value)
    uploadResultText.value = `Imported statement — ${result.added} new transaction(s) added from ${result.fileName}.`
    uploadStage.value = 'done'
    await fetchData()
  } catch (e) {
    uploadError.value = e instanceof Error ? e.message : 'Upload failed'
    uploadStage.value = 'selected'
  }
}

const fileSizeLabel = computed(() =>
  uploadFile.value ? `${(uploadFile.value.size / 1024).toFixed(0)} KB` : '',
)
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
      <div class="bud-summary" v-if="summary">
        <span><span class="lbl">In</span><span class="ret-pos">{{ money(summary.totalIncome) }}</span></span>
        <span><span class="lbl">Out</span><span class="ret-neg">{{ money(summary.totalSpending) }}</span></span>
        <span><span class="lbl">Net</span><span :class="summary.netFlow >= 0 ? 'ret-pos' : 'ret-neg'">{{ money(summary.netFlow) }}</span></span>
      </div>
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
      <div class="dialog" @click.stop>
        <div class="dialog-title">{{ modalDate }}</div>
        <div class="dialog-body">
          <p v-if="modalTx.length === 0" style="font-style: italic; color: var(--color-neutral-500)">
            No transactions recorded for this day.
          </p>
          <div v-for="m in modalTx" :key="m.id" class="tx-row">
            <div>
              <div class="tx-desc">{{ m.description }}</div>
              <div class="tx-meta">{{ m.source }}</div>
            </div>
            <span :class="m.amount >= 0 ? 'ret-pos' : 'ret-neg'">
              {{ m.amount > 0 ? '+' : '' }}{{ money2(m.amount) }}
            </span>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="closeModal">Close</button>
        </div>
      </div>
    </div>

    <div v-if="uploadOpen" class="dialog-backdrop" @click="closeUpload">
      <div class="dialog" @click.stop>
        <div class="dialog-title">Upload bank statement</div>
        <div class="dialog-body">
          <label v-if="uploadStage === 'idle'" class="upload-drop">
            <input type="file" accept=".csv,.ofx,.qif,.pdf" style="display: none" @change="onFile" />
            <svg width="28" height="28" viewBox="0 0 256 256" fill="currentColor"><path opacity="0.25" d="M224,152v56a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V152Z"/><path d="M243.31,90.63l-72-72a16,16,0,0,0-22.62,0L136,29.28V152a8,8,0,0,1-16,0V29.28L108.69,18.63a16,16,0,0,0-22.62,0l-72,72A16,16,0,0,0,25.37,116l16-16V208a24,24,0,0,0,24,24H190.63a24,24,0,0,0,24-24V100l16,16a16,16,0,0,0,11.31-27.37Z"/></svg>
            <span class="upload-drop-title">Drag a statement here, or click to browse</span>
            <span class="upload-drop-sub">CSV, OFX, QIF or PDF from your bank</span>
          </label>

          <template v-if="uploadStage === 'selected'">
            <div class="upload-file-row">
              <span class="tag tag-neutral">{{ uploadFile?.name }}</span>
              <span class="upload-file-size">{{ fileSizeLabel }}</span>
            </div>
            <p class="upload-note">We'll match transactions against your existing entries and only add new ones.</p>
            <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
          </template>

          <p v-if="uploadStage === 'uploading'" class="upload-note">Parsing statement…</p>
          <p v-if="uploadStage === 'done'" class="upload-success">{{ uploadResultText }}</p>
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
.bud-summary { display: flex; gap: var(--space-5); font-size: 13px; }
.bud-summary .lbl { color: var(--color-neutral-500); margin-right: var(--space-1); }
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
.tx-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; border-top: 1px solid var(--color-neutral-300); }
.tx-row:first-child { border-top: none; }
.tx-desc { font-size: 14px; }
.tx-meta { font-size: 11px; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
.upload-drop { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); text-align: center; padding: var(--space-8) var(--space-4); border: 1px dashed var(--color-neutral-400); border-radius: var(--radius-md); color: var(--color-accent-700); cursor: pointer; }
.upload-drop:hover { background: var(--color-accent-100); border-color: var(--color-accent-500); }
.upload-drop-title { font-size: 14px; color: var(--color-text); }
.upload-drop-sub { font-size: 12px; color: var(--color-neutral-500); }
.upload-file-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
.upload-file-size { font-size: 12px; color: var(--color-neutral-500); }
.upload-note { font-size: 13px; color: var(--color-neutral-600); }
.upload-success { font-size: 14px; color: var(--color-accent-700); }
.upload-error { font-size: 13px; color: var(--color-accent-2-700); }
.ret-pos { color: var(--color-accent-700); }
.ret-neg { color: var(--color-accent-2-700); }
</style>
