<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  createTagRule,
  deleteTagRule,
  getManualBalances,
  getTagRules,
  reapplyTagRules,
  updateManualBalances,
  updateTagRule,
} from '../finance/api'
import {
  LOCAL_API_URL,
  getApiEnvironment,
  getProductionApiUrl,
  resolveApiBaseUrl,
  setApiEnvironment,
  setProductionApiUrl,
  type ApiEnvironment,
} from './apiEnvironment'
import type { ManualBalances, ReapplyResult, TagRule } from '../finance/types'

const environment = ref<ApiEnvironment>(getApiEnvironment())
const prodUrlDraft = ref(getProductionApiUrl())
const activeBaseUrl = ref(resolveApiBaseUrl())

function selectEnvironment(env: ApiEnvironment) {
  environment.value = env
  setApiEnvironment(env)
  activeBaseUrl.value = resolveApiBaseUrl()
}

function saveProdUrl() {
  setProductionApiUrl(prodUrlDraft.value)
  prodUrlDraft.value = getProductionApiUrl()
  activeBaseUrl.value = resolveApiBaseUrl()
}

const balances = ref<ManualBalances>({
  cashIsaBalance: 0,
  moneyboxLisaBalance: 0,
  snoopBalance: 0,
  savingsOneBalance: 0,
  savingsTwoBalance: 0,
})
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

async function loadBalances() {
  loading.value = true
  loadError.value = null
  try {
    balances.value = await getManualBalances()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load balances'
  } finally {
    loading.value = false
  }
}

onMounted(loadBalances)

async function saveBalances() {
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    balances.value = await updateManualBalances(balances.value)
    saved.value = true
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save balances'
  } finally {
    saving.value = false
  }
}

const rules = ref<TagRule[]>([])
const rulesLoading = ref(true)
const rulesError = ref<string | null>(null)
const rowSaving = reactive<Record<number, boolean>>({})
const rowErrors = reactive<Record<number, string>>({})
const newRule = ref({ pattern: '', tag: '', subscription: false, priority: 0 })

async function loadRules() {
  rulesLoading.value = true
  rulesError.value = null
  try {
    rules.value = await getTagRules()
    newRule.value.priority = rules.value.length ? Math.max(...rules.value.map((r) => r.priority)) + 1 : 0
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to load tag rules'
  } finally {
    rulesLoading.value = false
  }
}

onMounted(loadRules)

async function saveRule(rule: TagRule) {
  rowSaving[rule.id] = true
  delete rowErrors[rule.id]
  try {
    Object.assign(rule, await updateTagRule(rule.id, rule))
  } catch (e) {
    rowErrors[rule.id] = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    rowSaving[rule.id] = false
  }
}

async function removeRule(id: number) {
  try {
    await deleteTagRule(id)
    rules.value = rules.value.filter((r) => r.id !== id)
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to delete rule'
  }
}

async function addRule() {
  if (!newRule.value.pattern.trim() || !newRule.value.tag.trim()) return
  try {
    const created = await createTagRule({ ...newRule.value })
    rules.value = [...rules.value, created].sort((a, b) => a.priority - b.priority)
    newRule.value = { pattern: '', tag: '', subscription: false, priority: created.priority + 1 }
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to create rule'
  }
}

const reapplying = ref(false)
const reapplyResult = ref<ReapplyResult | null>(null)
const reapplyError = ref<string | null>(null)

async function reapply() {
  reapplying.value = true
  reapplyError.value = null
  reapplyResult.value = null
  try {
    reapplyResult.value = await reapplyTagRules()
  } catch (e) {
    reapplyError.value = e instanceof Error ? e.message : 'Failed to re-apply rules'
  } finally {
    reapplying.value = false
  }
}
</script>

<template>
  <div class="settings-wrap">
    <p class="fin-kicker">Settings</p>
    <h1 class="fin-title">Settings</h1>

    <section class="settings-section">
      <h2 class="section-title">API Environment</h2>
      <p class="section-hint">Choose which Homebase backend HomebaseWeb talks to.</p>

      <div class="env-row">
        <button
          class="btn"
          :class="environment === 'local' ? 'btn-primary' : 'btn-secondary'"
          @click="selectEnvironment('local')"
        >
          Local
        </button>
        <button
          class="btn"
          :class="environment === 'production' ? 'btn-primary' : 'btn-secondary'"
          @click="selectEnvironment('production')"
        >
          Production
        </button>
      </div>

      <div class="field">
        <label for="prod-url">Production API URL</label>
        <input
          id="prod-url"
          class="input"
          v-model="prodUrlDraft"
          placeholder="https://your-app-name.onrender.com"
        />
      </div>
      <button class="btn btn-secondary" @click="saveProdUrl">Save URL</button>

      <p class="current-url">
        Local URL: <code>{{ LOCAL_API_URL }}</code><br />
        Currently calling: <strong>{{ activeBaseUrl }}</strong>
      </p>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Manual Balances</h2>
      <p class="section-hint">
        Balances with no live API — feed into the Investment tab's portfolio total.
      </p>

      <p v-if="loading" style="color: var(--color-neutral-500)">Loading…</p>
      <p v-else-if="loadError" class="error-text">{{ loadError }}</p>
      <template v-else>
        <div class="balances-grid">
          <div class="field">
            <label for="cash-isa">Cash ISA</label>
            <input id="cash-isa" class="input" type="number" step="0.01" v-model.number="balances.cashIsaBalance" />
          </div>
          <div class="field">
            <label for="lisa">Moneybox LISA</label>
            <input id="lisa" class="input" type="number" step="0.01" v-model.number="balances.moneyboxLisaBalance" />
          </div>
          <div class="field">
            <label for="snoop">Snoop</label>
            <input id="snoop" class="input" type="number" step="0.01" v-model.number="balances.snoopBalance" />
          </div>
          <div class="field">
            <label for="savings-one">Savings account 1</label>
            <input id="savings-one" class="input" type="number" step="0.01" v-model.number="balances.savingsOneBalance" />
          </div>
          <div class="field">
            <label for="savings-two">Savings account 2</label>
            <input id="savings-two" class="input" type="number" step="0.01" v-model.number="balances.savingsTwoBalance" />
          </div>
        </div>

        <button class="btn btn-primary" @click="saveBalances" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save balances' }}
        </button>
        <p v-if="saveError" class="error-text">{{ saveError }}</p>
        <p v-if="saved" class="success-text">Saved.</p>
      </template>
    </section>

    <section class="settings-section rules-section">
      <h2 class="section-title">Transaction Tag Rules</h2>
      <p class="section-hint">
        Matches a rule's pattern against a transaction's description (case-insensitive, contains).
        Rules are checked in priority order (lowest first) — the first match sets the transaction's
        tag and subscription flag. Set a rule's tag to exactly <code>internal</code> to exclude
        matching transactions (e.g. transfers between your own accounts) from budget totals. New
        rules only apply to newly-imported transactions — use "Re-apply to all transactions" below
        to run rules against your existing history too.
      </p>

      <p v-if="rulesLoading" style="color: var(--color-neutral-500)">Loading…</p>
      <template v-else>
        <div class="rules-scroll">
          <div class="rules-table">
            <div class="rules-row rules-header">
              <span>Pattern</span>
              <span>Tag</span>
              <span>Subscription</span>
              <span>Priority</span>
              <span></span>
            </div>
            <template v-for="rule in rules" :key="rule.id">
              <div class="rules-row">
                <input class="input" v-model="rule.pattern" />
                <input class="input" v-model="rule.tag" />
                <input type="checkbox" v-model="rule.subscription" />
                <input class="input" type="number" v-model.number="rule.priority" />
                <div class="rules-actions">
                  <button class="btn btn-secondary" @click="saveRule(rule)" :disabled="rowSaving[rule.id]">
                    {{ rowSaving[rule.id] ? 'Saving…' : 'Save' }}
                  </button>
                  <button class="btn btn-ghost" @click="removeRule(rule.id)">Delete</button>
                </div>
              </div>
              <p v-if="rowErrors[rule.id]" class="error-text rules-row-error">{{ rowErrors[rule.id] }}</p>
            </template>
            <div class="rules-row rules-new">
              <input class="input" v-model="newRule.pattern" placeholder="e.g. netflix" />
              <input class="input" v-model="newRule.tag" placeholder="e.g. Subscriptions" />
              <input type="checkbox" v-model="newRule.subscription" />
              <input class="input" type="number" v-model.number="newRule.priority" />
              <button class="btn btn-primary" @click="addRule">Add rule</button>
            </div>
          </div>
        </div>

        <p v-if="rulesError" class="error-text">{{ rulesError }}</p>

        <button class="btn btn-secondary reapply-btn" @click="reapply" :disabled="reapplying">
          {{ reapplying ? 'Re-applying…' : 'Re-apply to all transactions' }}
        </button>
        <p v-if="reapplyResult" class="success-text">
          Checked {{ reapplyResult.checked }} transaction(s), updated {{ reapplyResult.updated }}.
        </p>
        <p v-if="reapplyError" class="error-text">{{ reapplyError }}</p>
      </template>
    </section>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-6); }
.settings-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }
.settings-section { max-width: 480px; margin-bottom: var(--space-9); }
.section-title { font-family: var(--font-heading); font-weight: 400; font-size: 20px; margin: 0 0 var(--space-2); }
.section-hint { font-size: 13px; color: var(--color-neutral-500); margin: 0 0 var(--space-4); }
.env-row { display: flex; gap: var(--space-2); margin-bottom: var(--space-5); }
.field { margin-bottom: var(--space-3); }
.current-url { font-size: 12px; color: var(--color-neutral-600); margin-top: var(--space-4); line-height: 1.8; }
.current-url code { font-family: monospace; }
.balances-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3) var(--space-4); margin-bottom: var(--space-4); }
@media (max-width: 500px) { .balances-grid { grid-template-columns: 1fr; } }
.error-text { font-size: 13px; color: var(--color-accent-2-700); margin-top: var(--space-3); }
.success-text { font-size: 13px; color: var(--color-accent-700); margin-top: var(--space-3); }

.rules-section { max-width: 800px; }
.rules-section code { font-family: monospace; background: var(--color-surface); padding: 1px 5px; border-radius: var(--radius-sm); }
.rules-scroll { overflow-x: auto; margin-bottom: var(--space-4); }
.rules-table { display: flex; flex-direction: column; gap: var(--space-2); min-width: 620px; }
.rules-row { display: grid; grid-template-columns: 2fr 1.5fr 110px 90px auto; gap: var(--space-2); align-items: center; }
.rules-header { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-500); }
.rules-header span:nth-child(3) { text-align: center; }
.rules-row input[type='checkbox'] { justify-self: center; width: 16px; height: 16px; accent-color: var(--color-accent); }
.rules-actions { display: flex; gap: var(--space-2); }
.rules-new { padding-top: var(--space-3); border-top: 1px solid var(--color-divider); }
.rules-row-error { margin-top: calc(var(--space-2) * -1); margin-bottom: 0; font-size: 12px; }
.reapply-btn { margin-top: var(--space-2); }
</style>
