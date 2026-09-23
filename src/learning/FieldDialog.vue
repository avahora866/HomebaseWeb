<script setup lang="ts">
import { computed, ref } from 'vue'
import { createField, deleteField, updateField } from './api'
import type { FieldCapabilities, LearningField } from './types'

const props = defineProps<{ field: LearningField | null }>()
const emit = defineEmits<{ close: []; saved: []; deleted: [] }>()

type Nesting = 'unlimited' | 'flat' | 'limited'

const CAPABILITIES: { key: Exclude<keyof FieldCapabilities, 'maxNestingDepth'>; label: string; hint: string }[] = [
  { key: 'allowsPrerequisites', label: 'Prerequisites', hint: 'Topics can note what they build on — informational only, never locks anything.' },
  { key: 'allowsSuggestedOrder', label: 'Suggested order', hint: 'Order sibling topics by a sort key instead of creation date.' },
  { key: 'allowsLogs', label: 'Logs', hint: 'Timestamped notes on any topic.' },
  { key: 'allowsProjectLinks', label: 'Project links', hint: 'Link project-tracker projects to topics or specialisations.' },
]

const initial = props.field?.capabilities
const name = ref(props.field?.name ?? '')
const caps = ref({
  allowsPrerequisites: initial?.allowsPrerequisites ?? true,
  allowsSuggestedOrder: initial?.allowsSuggestedOrder ?? true,
  allowsLogs: initial?.allowsLogs ?? true,
  allowsProjectLinks: initial?.allowsProjectLinks ?? true,
})
const initialDepth = initial ? initial.maxNestingDepth : null
const nesting = ref<Nesting>(initialDepth === null ? 'unlimited' : initialDepth === 0 ? 'flat' : 'limited')
const depthLimit = ref<number>(initialDepth && initialDepth > 0 ? initialDepth : 1)
const saving = ref(false)
const error = ref<string | null>(null)

const invalid = computed(
  () => !name.value.trim() || (nesting.value === 'limited' && !(Number.isInteger(depthLimit.value) && depthLimit.value >= 1)),
)

async function save() {
  if (invalid.value || saving.value) return
  saving.value = true
  error.value = null
  const input = {
    name: name.value.trim(),
    capabilities: {
      ...caps.value,
      maxNestingDepth: nesting.value === 'unlimited' ? null : nesting.value === 'flat' ? 0 : depthLimit.value,
    },
  }
  try {
    if (props.field) await updateField(props.field.id, input)
    else await createField(input)
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save field'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.field) return
  const ok = window.confirm(
    `Delete “${props.field.name}”, all of its specialisations (Basic included) and every topic beneath them? ` +
      'Linked projects are kept — only the links go. This cannot be undone.',
  )
  if (!ok) return
  try {
    await deleteField(props.field.id)
    emit('deleted')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete field'
  }
}
</script>

<template>
  <div class="dialog-backdrop" @click="emit('close')">
    <div class="dialog" @click.stop>
      <div class="dialog-title">{{ field ? 'Edit field' : 'New field' }}</div>
      <div class="dialog-body lp-dialog-body">
        <div class="field">
          <label for="lf-name">Name</label>
          <input id="lf-name" class="input" v-model="name" placeholder="e.g. Cooking" @keydown.enter="save" />
        </div>
        <div class="field">
          <label>Capabilities</label>
          <div class="lp-caps">
            <label v-for="c in CAPABILITIES" :key="c.key" class="lp-cap">
              <input type="checkbox" v-model="caps[c.key]" />
              <span>
                <span class="lp-cap-label">{{ c.label }}</span>
                <span class="lp-cap-hint">{{ c.hint }}</span>
              </span>
            </label>
          </div>
        </div>
        <div class="field">
          <label for="lf-nesting">Subtopic nesting</label>
          <div class="lp-nesting">
            <select id="lf-nesting" class="input" v-model="nesting">
              <option value="unlimited">Unlimited</option>
              <option value="flat">Flat — no subtopics</option>
              <option value="limited">Limited</option>
            </select>
            <input
              v-if="nesting === 'limited'"
              class="input lp-depth"
              type="number"
              min="1"
              step="1"
              v-model.number="depthLimit"
              aria-label="Levels below a top-level topic"
            />
            <span v-if="nesting === 'limited'" class="lp-cap-hint">levels below a top-level topic</span>
          </div>
        </div>
        <p v-if="!field" class="lp-note">A Basic specialisation is created with the field.</p>
        <p v-else class="lp-note">
          A capability that existing data relies on can't be switched off — you'll be told what's in the way.
        </p>
      </div>
      <p v-if="error" class="lp-error">{{ error }}</p>
      <div class="dialog-actions">
        <button v-if="field" class="btn btn-ghost lp-delete-btn" @click="remove">Delete field</button>
        <button class="btn btn-ghost" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="invalid || saving" @click="save">
          {{ saving ? 'Saving…' : field ? 'Save' : 'Create' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lp-dialog-body { display: flex; flex-direction: column; gap: var(--space-3); }
.lp-caps { display: flex; flex-direction: column; gap: var(--space-2); }
.lp-cap { display: flex; align-items: flex-start; gap: var(--space-2); cursor: pointer; }
.lp-cap input { margin-top: 4px; }
.lp-cap > span { display: flex; flex-direction: column; }
.lp-cap-label { font-size: 14px; color: var(--color-text); }
.lp-cap-hint { font-size: 12px; color: var(--color-neutral-500); }
.lp-nesting { display: flex; align-items: center; gap: var(--space-2); }
.lp-nesting select { width: auto; }
.lp-depth { width: 72px; }
.lp-note { font-size: 12px; color: var(--color-neutral-500); font-style: italic; margin: 0; }
.lp-error { font-size: 13px; color: var(--color-accent-2-700); margin: 0; }
.lp-delete-btn { color: var(--color-accent-2-700); margin-right: auto; }
</style>
