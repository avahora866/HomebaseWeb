<script setup lang="ts">
import { provide, ref } from 'vue'
import AppNav from './layout/AppNav.vue'
import FinanceView from './finance/FinanceView.vue'
import ProjectsView from './projects/ProjectsView.vue'
import ResearchView from './research/ResearchView.vue'
import LearningPathView from './learning/LearningPathView.vue'
import SettingsView from './settings/SettingsView.vue'
import { openProjectKey } from './navigation'

type View = 'finance' | 'projects' | 'research' | 'learning' | 'settings'

const view = ref<View>('finance')

/** Set while Projects was opened on a specific project from Learning Path, so it can send the user back. */
const projectRequest = ref<{ projectId: number; from: string } | null>(null)

function navigate(next: View) {
  projectRequest.value = null
  view.value = next
}

provide(openProjectKey, (projectId, from) => {
  projectRequest.value = { projectId, from }
  view.value = 'projects'
})

function returnToLearning() {
  projectRequest.value = null
  view.value = 'learning'
}
</script>

<template>
  <AppNav :active="view" @navigate="navigate" />
  <FinanceView v-if="view === 'finance'" />
  <ProjectsView
    v-else-if="view === 'projects'"
    :open-project-id="projectRequest?.projectId ?? null"
    :return-label="projectRequest?.from ?? null"
    @return="returnToLearning"
  />
  <ResearchView v-else-if="view === 'research'" />
  <SettingsView v-else-if="view === 'settings'" />
  <!-- Kept alive so leaving for a linked project (or any other tab) and coming back lands on the same topic. -->
  <KeepAlive>
    <LearningPathView v-if="view === 'learning'" />
  </KeepAlive>
</template>
