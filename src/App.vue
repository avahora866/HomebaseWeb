<script setup lang="ts">
import { ref } from 'vue'
import AppNav from './layout/AppNav.vue'
import FinanceView from './finance/FinanceView.vue'
import SettingsView from './settings/SettingsView.vue'

const view = ref<'finance' | 'settings'>('finance')
</script>

<template>
  <AppNav :active="view" @navigate="view = $event" />
  <FinanceView v-if="view === 'finance'" />
  <SettingsView v-else />
</template>
