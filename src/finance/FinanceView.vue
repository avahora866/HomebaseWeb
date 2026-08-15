<script setup lang="ts">
import { ref } from 'vue'
import InvestmentView from './InvestmentView.vue'
import BudgetView from './BudgetView.vue'
import NetWorthView from './NetWorthView.vue'

const tab = ref<'invest' | 'budget' | 'networth'>('budget')
</script>

<template>
  <div class="fin-wrap">
    <div class="fin-tabs">
      <button class="fin-tab" :class="{ active: tab === 'budget' }" @click="tab = 'budget'">Budget</button>
      <button class="fin-tab" :class="{ active: tab === 'networth' }" @click="tab = 'networth'">Net Worth</button>
      <button class="fin-tab" :class="{ active: tab === 'invest' }" @click="tab = 'invest'">Investment</button>
    </div>

    <InvestmentView v-if="tab === 'invest'" />
    <NetWorthView v-else-if="tab === 'networth'" />
    <BudgetView v-else />
  </div>
</template>

<style scoped>
.fin-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }
.fin-tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-7); }
.fin-tab { font-family: var(--font-body); font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; background: none; border: none; padding: var(--space-2) 0; color: var(--color-neutral-500); cursor: pointer; border-bottom: 2px solid transparent; }
.fin-tab.active { color: var(--color-text); border-bottom-color: var(--color-accent); }
.fin-tab:hover { color: var(--color-text); }
.fin-tab:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
</style>
