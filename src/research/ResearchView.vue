<script setup lang="ts">
import { ref } from 'vue'
import { getResearchShortlist } from './api'
import type { ResearchPaperPick } from './types'

const loading = ref(false)
const error = ref<string | null>(null)
const picks = ref<ResearchPaperPick[] | null>(null)

async function findPapers() {
  loading.value = true
  error.value = null
  try {
    const shortlist = await getResearchShortlist()
    picks.value = shortlist.picks
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to build shortlist'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="research-wrap">
    <p class="fin-kicker">Research</p>
    <h1 class="fin-title">Research Paper Picker</h1>
    <p class="research-hint">
      Pulls open-access survey/review papers from Physics, Mathematics and Economics/Political
      Science, then has the LLM pick and summarize the three most worth reading.
    </p>

    <button class="btn btn-primary" @click="findPapers" :disabled="loading">
      {{ loading ? 'Finding papers…' : 'Find papers to read' }}
    </button>

    <p v-if="error" class="error-text">{{ error }}</p>

    <p v-if="picks && picks.length === 0" class="research-empty">
      No shortlist came back — try again in a moment.
    </p>

    <div v-if="picks && picks.length > 0" class="research-grid">
      <article v-for="(pick, i) in picks" :key="i" class="research-card">
        <div class="research-card-meta">
          <span class="tag tag-neutral">{{ pick.field }}</span>
          <span v-if="pick.year" class="research-year">{{ pick.year }}</span>
        </div>
        <h2 class="research-card-title">{{ pick.title }}</h2>
        <p v-if="pick.venue" class="research-venue">{{ pick.venue }}</p>
        <p class="research-blurb">{{ pick.blurb }}</p>
        <div class="research-links">
          <a v-if="pick.paperUrl" :href="pick.paperUrl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
            View paper
          </a>
          <a :href="pick.pdfUrl" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">
            Open PDF
          </a>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-4); }
.research-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }
.research-hint { font-size: 13px; color: var(--color-neutral-500); max-width: 640px; margin: 0 0 var(--space-6); }
.error-text { font-size: 13px; color: var(--color-accent-2-700); margin-top: var(--space-3); }
.research-empty { font-size: 13px; color: var(--color-neutral-500); margin-top: var(--space-5); font-style: italic; }
.research-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-5); margin-top: var(--space-7); }
.research-card { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); background: var(--color-surface); border-radius: var(--radius-lg); }
.research-card-meta { display: flex; align-items: center; gap: var(--space-2); }
.research-year { font-size: 12px; color: var(--color-neutral-500); }
.research-card-title { font-family: var(--font-heading); font-weight: 400; font-size: 18px; margin: 0; line-height: 1.3; }
.research-venue { font-size: 12px; color: var(--color-neutral-500); margin: 0; font-style: italic; }
.research-blurb { font-size: 13.5px; line-height: 1.6; color: var(--color-text); margin: 0; flex: 1 1 auto; }
.research-links { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
</style>
