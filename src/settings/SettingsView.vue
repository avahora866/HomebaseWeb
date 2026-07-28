<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getManualBalances, updateManualBalances } from '../finance/api'
import {
  LOCAL_API_URL,
  getApiEnvironment,
  getProductionApiUrl,
  resolveApiBaseUrl,
  setApiEnvironment,
  setProductionApiUrl,
  type ApiEnvironment,
} from './apiEnvironment'
import type { ManualBalances } from '../finance/types'

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
</style>
