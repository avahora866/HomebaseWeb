<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfidenceDots from './ConfidenceDots.vue'
import FieldDialog from './FieldDialog.vue'
import { createSpecialisation, getFields } from './api'
import { COVERAGE_HINT, capabilityLabels, rollupLabel } from './rating'
import type { LearningField } from './types'

const emit = defineEmits<{ open: [specialisationId: number] }>()

const fields = ref<LearningField[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

async function load() {
  loadError.value = null
  try {
    fields.value = await getFields()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load fields'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// --- new / edit field dialog ---
const fieldDialogOpen = ref(false)
const editingField = ref<LearningField | null>(null)

function openNewField() {
  editingField.value = null
  fieldDialogOpen.value = true
}
function openEditField(field: LearningField) {
  editingField.value = field
  fieldDialogOpen.value = true
}
function onFieldSaved() {
  fieldDialogOpen.value = false
  load()
}

// --- new specialisation dialog ---
const specDialogField = ref<LearningField | null>(null)
const specName = ref('')
const specSaving = ref(false)
const specError = ref<string | null>(null)
const specInvalid = computed(() => !specName.value.trim())

function openNewSpecialisation(field: LearningField) {
  specDialogField.value = field
  specName.value = ''
  specError.value = null
}
async function saveSpecialisation() {
  const field = specDialogField.value
  if (!field || specInvalid.value || specSaving.value) return
  specSaving.value = true
  specError.value = null
  try {
    await createSpecialisation(field.id, specName.value.trim())
    specDialogField.value = null
    await load()
  } catch (e) {
    specError.value = e instanceof Error ? e.message : 'Failed to create specialisation'
  } finally {
    specSaving.value = false
  }
}
</script>

<template>
  <div class="lp-wrap">
    <p class="fin-kicker">Learning Path</p>
    <div class="lp-head">
      <h1 class="fin-title">Fields</h1>
      <button class="btn btn-primary" @click="openNewField">+ New field</button>
    </div>
    <p class="lp-hint">
      Every field has a Basic specialisation, plus any named ones. Confidence is rated 1&ndash;5 on leaf topics only
      &mdash; everything above is derived.
    </p>

    <p v-if="loadError" class="lp-error">{{ loadError }}</p>
    <p v-if="loading" class="lp-muted">Loading…</p>
    <p v-else-if="!loadError && fields.length === 0" class="lp-empty">No fields yet — add one to start a learning path.</p>

    <div v-else class="lp-grid">
      <section v-for="f in fields" :key="f.id" class="lp-card">
        <div class="lp-card-head">
          <h2 class="lp-card-title">{{ f.name }}</h2>
          <span class="lp-card-count">
            {{ f.specialisations.length }} specialisation{{ f.specialisations.length === 1 ? '' : 's' }}
          </span>
        </div>
        <div class="lp-caps">
          <span v-for="c in capabilityLabels(f.capabilities)" :key="c" class="tag tag-neutral">{{ c }}</span>
        </div>
        <div class="lp-specs">
          <button v-for="s in f.specialisations" :key="s.id" class="lp-spec" @click="emit('open', s.id)">
            <span class="lp-spec-name-wrap">
              <span class="lp-spec-name">{{ s.name }}</span>
              <span v-if="s.basic" class="lp-basic">basic</span>
            </span>
            <span class="lp-spec-rating">
              <ConfidenceDots :value="s.rollupRating" />
              <span class="lp-spec-rollup" :title="s.leafCount ? COVERAGE_HINT : undefined">
                {{ rollupLabel(s.rollupRating, s.ratedLeafCount, s.leafCount, 'no topics yet') }}
              </span>
            </span>
          </button>
        </div>
        <div class="lp-card-actions">
          <button class="lp-link-btn" @click="openNewSpecialisation(f)">+ Specialisation</button>
          <button class="lp-link-btn" @click="openEditField(f)">Edit field</button>
        </div>
      </section>
    </div>

    <FieldDialog
      v-if="fieldDialogOpen"
      :field="editingField"
      @close="fieldDialogOpen = false"
      @saved="onFieldSaved"
      @deleted="onFieldSaved"
    />

    <div v-if="specDialogField" class="dialog-backdrop" @click="specDialogField = null">
      <div class="dialog" @click.stop>
        <div class="dialog-title">New specialisation</div>
        <div class="dialog-body lp-dialog-body">
          <div class="field">
            <label for="ls-name">Name</label>
            <input id="ls-name" class="input" v-model="specName" placeholder="e.g. French" @keydown.enter="saveSpecialisation" />
          </div>
          <p class="lp-note">
            Adds to {{ specDialogField.name }}. It gets its own topics, independent of Basic and every other
            specialisation.
          </p>
        </div>
        <p v-if="specError" class="lp-error">{{ specError }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="specDialogField = null">Cancel</button>
          <button class="btn btn-primary" :disabled="specInvalid || specSaving" @click="saveSpecialisation">
            {{ specSaving ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0; }
.lp-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }
.lp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-5); }
.lp-hint { font-size: 13px; color: var(--color-neutral-500); max-width: 640px; margin: 0 0 var(--space-6); }
.lp-muted { color: var(--color-neutral-500); }
.lp-empty { font-style: italic; color: var(--color-neutral-500); padding: var(--space-4) 0; }
.lp-error { font-size: 13px; color: var(--color-accent-2-700); }

.lp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: var(--space-5); }
.lp-card { display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); background: var(--color-surface); border-radius: var(--radius-lg); }
.lp-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.lp-card-title { font-family: var(--font-heading); font-weight: 400; font-size: 22px; line-height: 1.2; margin: 0; }
.lp-card-count { font-size: 12px; color: var(--color-neutral-500); white-space: nowrap; }
.lp-caps { display: flex; flex-wrap: wrap; gap: var(--space-1); }

.lp-specs { display: flex; flex-direction: column; gap: 2px; margin-top: var(--space-1); }
/* Wraps the rating under the name when the card is too narrow for both, rather than truncating the name. */
.lp-spec {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px var(--space-2);
  width: 100%; text-align: left; font: inherit; color: var(--color-text); cursor: pointer;
  background: var(--color-bg); border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
  border-radius: var(--radius-md); padding: 12px var(--space-3);
}
.lp-spec:hover { border-color: color-mix(in srgb, var(--color-text) 30%, transparent); }
.lp-spec-name-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1 1 auto; }
.lp-spec-name { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-basic { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); }
.lp-spec-rating { display: flex; align-items: center; gap: var(--space-2); margin-left: auto; }
.lp-spec-rollup { font-size: 12px; color: var(--color-neutral-700); min-width: 96px; text-align: right; }

.lp-card-actions { display: flex; gap: var(--space-3); margin-top: auto; }
.lp-link-btn { background: none; border: none; padding: 0; font: inherit; font-size: 12px; color: var(--color-accent-700); cursor: pointer; }
.lp-link-btn:hover { text-decoration: underline; }

.lp-dialog-body { display: flex; flex-direction: column; gap: var(--space-3); }
.lp-note { font-size: 12px; color: var(--color-neutral-500); font-style: italic; margin: 0; }
</style>
