<script setup lang="ts">
import { progressLabel, progressPercent, RESOURCE_STATUS_LABEL, RESOURCE_STATUS_TAG, RESOURCE_TYPE_LABEL } from './resources'
import type { LearningResource } from './types'

defineProps<{ resources: LearningResource[] }>()
const emit = defineEmits<{ edit: [resource: LearningResource] }>()
</script>

<template>
  <div class="lp-resources">
    <div
      v-for="r in resources"
      :key="r.id"
      class="lp-resource"
      :class="{ dropped: r.status === 'DROPPED' }"
      role="button"
      tabindex="0"
      :title="`Edit ${r.title}`"
      @click="emit('edit', r)"
      @keydown.enter.self="emit('edit', r)"
    >
      <div class="lp-resource-head">
        <a v-if="r.url" class="lp-resource-title" :href="r.url" target="_blank" rel="noopener noreferrer" @click.stop>
          {{ r.title }} <span aria-hidden="true">↗</span>
        </a>
        <span v-else class="lp-resource-title">{{ r.title }}</span>
        <span class="tag" :class="RESOURCE_STATUS_TAG[r.status]">{{ RESOURCE_STATUS_LABEL[r.status] }}</span>
      </div>
      <div class="lp-resource-meta">
        <span class="lp-resource-type">{{ RESOURCE_TYPE_LABEL[r.type] }}</span>
        <template v-if="progressLabel(r)">
          <span class="lp-resource-bar" aria-hidden="true"><span :style="{ width: `${progressPercent(r)}%` }"></span></span>
          <span class="lp-resource-progress">{{ progressLabel(r) }}</span>
        </template>
      </div>
      <p v-if="r.notes" class="lp-resource-notes">{{ r.notes }}</p>
    </div>
  </div>
</template>

<style scoped>
.lp-resources { display: flex; flex-direction: column; gap: 6px; }
.lp-resource {
  display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; cursor: pointer;
  background: var(--color-bg); border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
  border-radius: var(--radius-md);
}
.lp-resource:hover { border-color: color-mix(in srgb, var(--color-text) 30%, transparent); }
.lp-resource.dropped { opacity: 0.6; }
.lp-resource.dropped .lp-resource-title { text-decoration: line-through; }
.lp-resource-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
.lp-resource-title { font-size: 13.5px; color: var(--color-text); min-width: 0; overflow-wrap: anywhere; }
a.lp-resource-title { color: var(--color-accent-700); }
a.lp-resource-title:hover { color: var(--color-accent); text-decoration: underline; }
.lp-resource-head .tag { flex-shrink: 0; }
.lp-resource-meta { display: flex; align-items: center; gap: var(--space-2); }
.lp-resource-type { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); }
.lp-resource-bar { flex: 1; max-width: 140px; height: 4px; border-radius: 2px; background: var(--color-neutral-300); overflow: hidden; }
.lp-resource-bar span { display: block; height: 100%; background: var(--color-accent-600); }
.lp-resource-progress { font-size: 12px; color: var(--color-neutral-700); }
.lp-resource-notes { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-neutral-700); white-space: pre-wrap; }
</style>
