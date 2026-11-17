<script setup lang="ts">
import { computed, ref } from 'vue'
import { createResource, deleteResource, updateResource } from './api'
import { RESOURCE_STATUSES, RESOURCE_TYPES } from './resources'
import type { LearningResource, ResourceStatus, ResourceType, SpecialisationDetail } from './types'

/**
 * Add a resource to [target], or edit [resource] (placement is fixed once created, so [target] is
 * only used when adding). [placement] says where it's going, e.g. "CAD modelling".
 */
const props = defineProps<{
  resource: LearningResource | null
  target: { topicId: number } | { specialisationId: number }
  placement: string
}>()
const emit = defineEmits<{ close: []; saved: [detail: SpecialisationDetail] }>()

const r = props.resource
const title = ref(r?.title ?? '')
const type = ref<ResourceType>(r?.type ?? 'COURSE')
const status = ref<ResourceStatus>(r?.status ?? 'IN_PROGRESS')
const url = ref(r?.url ?? '')
const progressCurrent = ref<number | ''>(r?.progressCurrent ?? '')
const progressTotal = ref<number | ''>(r?.progressTotal ?? '')
const notes = ref(r?.notes ?? '')
const saving = ref(false)
const error = ref<string | null>(null)

/** Both blank, or a whole-number total ≥ 1 with the current position from 0 to the total. */
const progressError = computed(() => {
  const cur = progressCurrent.value
  const total = progressTotal.value
  if (cur === '' && total === '') return null
  if (cur === '' || total === '') return 'Fill in both, or leave both blank'
  if (!Number.isInteger(cur) || !Number.isInteger(total) || total < 1 || cur < 0 || cur > total) {
    return 'Use whole numbers from 0 up to the total'
  }
  return null
})
const urlError = computed(() =>
  url.value.trim() && !/^https?:\/\/\S+$/i.test(url.value.trim()) ? 'Link must start with http:// or https://' : null,
)
const invalid = computed(() => !title.value.trim() || progressError.value !== null || urlError.value !== null)

async function save() {
  if (invalid.value || saving.value) return
  saving.value = true
  error.value = null
  const input = {
    title: title.value.trim(),
    type: type.value,
    status: status.value,
    url: url.value.trim() || null,
    progressCurrent: progressCurrent.value === '' ? null : progressCurrent.value,
    progressTotal: progressTotal.value === '' ? null : progressTotal.value,
    notes: notes.value.trim() || null,
  }
  try {
    emit('saved', props.resource ? await updateResource(props.resource.id, input) : await createResource(props.target, input))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save resource'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.resource || !window.confirm(`Remove “${props.resource.title}” from ${props.placement}?`)) return
  try {
    emit('saved', await deleteResource(props.resource.id))
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to remove resource'
  }
}
</script>

<template>
  <div class="dialog-backdrop" @click="emit('close')">
    <div class="dialog" @click.stop>
      <div class="dialog-title">{{ resource ? 'Edit resource' : 'New resource' }}</div>
      <div class="dialog-body lr-body">
        <div class="field">
          <label for="lr-title">Title</label>
          <input id="lr-title" class="input" v-model="title" placeholder="e.g. Onshape Fundamentals" @keydown.enter="save" />
        </div>
        <div class="lr-row">
          <div class="field">
            <label for="lr-type">Type</label>
            <select id="lr-type" class="input" v-model="type">
              <option v-for="t in RESOURCE_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </div>
          <div class="field">
            <label for="lr-status">Status</label>
            <select id="lr-status" class="input" v-model="status">
              <option v-for="s in RESOURCE_STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="lr-url">Link</label>
          <input id="lr-url" class="input" type="url" v-model="url" placeholder="Optional — https://…" />
          <span v-if="urlError" class="lr-hint lr-hint-error">{{ urlError }}</span>
        </div>
        <div class="field">
          <label for="lr-progress">Progress</label>
          <div class="lr-progress">
            <input id="lr-progress" class="input" type="number" min="0" step="1" v-model.number="progressCurrent" aria-label="How far you are" />
            <span>of</span>
            <input class="input" type="number" min="1" step="1" v-model.number="progressTotal" aria-label="Total" />
          </div>
          <span class="lr-hint" :class="{ 'lr-hint-error': progressError }">
            {{ progressError ?? 'Optional — modules, chapters or videos, e.g. 4 of 12.' }}
          </span>
        </div>
        <div class="field">
          <label for="lr-notes">Notes</label>
          <textarea id="lr-notes" class="input" rows="3" v-model="notes" placeholder="Optional…"></textarea>
        </div>
        <p class="lr-note">{{ resource ? `On ${placement}.` : `Adds to ${placement}.` }} Resources never change a topic's rating.</p>
      </div>
      <p v-if="error" class="lr-error">{{ error }}</p>
      <div class="dialog-actions">
        <button v-if="resource" class="btn btn-ghost lr-delete" @click="remove">Remove</button>
        <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="invalid || saving" @click="save">
          {{ saving ? 'Saving…' : resource ? 'Save' : 'Add' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lr-body { display: flex; flex-direction: column; gap: var(--space-3); }
.lr-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
.lr-progress { display: flex; align-items: center; gap: var(--space-2); font-size: 13px; color: var(--color-neutral-700); }
.lr-progress .input { width: 80px; }
.lr-hint { font-size: 12px; color: var(--color-neutral-500); margin-top: 4px; }
.lr-hint-error { color: var(--color-accent-2-700); }
.lr-note { font-size: 12px; color: var(--color-neutral-500); font-style: italic; margin: 0; }
.lr-error { font-size: 13px; color: var(--color-accent-2-700); margin: 0; }
.lr-delete { color: var(--color-accent-2-700); margin-right: auto; }
</style>
