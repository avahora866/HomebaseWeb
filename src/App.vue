<script setup lang="ts">
import { ref } from 'vue'
import AppNav from './layout/AppNav.vue'
import FinanceView from './finance/FinanceView.vue'
import ProjectsView from './projects/ProjectsView.vue'
import SettingsView from './settings/SettingsView.vue'

const view = ref<'finance' | 'projects' | 'settings'>('finance')
</script>

<template>
  <AppNav :active="view" @navigate="view = $event" />
  <FinanceView v-if="view === 'finance'" />
  <ProjectsView v-else-if="view === 'projects'" />
  <SettingsView v-else />
</template>
