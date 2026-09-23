<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getProjects } from '../projects/api'
import { STATUS_LABEL, TAG_CLASS } from '../projects/status'
import type { Project } from '../projects/types'
import ConfidenceDots from './ConfidenceDots.vue'
import TopicDrawer from './TopicDrawer.vue'
import {
  createTopic,
  deleteSpecialisation,
  getSpecialisation,
  linkProject,
  renameSpecialisation,
  unlinkProject,
} from './api'
import { COVERAGE_HINT, formatRating, rollupLabel } from './rating'
import type { SpecialisationDetail, Topic } from './types'

const props = defineProps<{ specialisationId: number }>()
const emit = defineEmits<{ back: [] }>()

const detail = ref<SpecialisationDetail | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)

async function load() {
  loadError.value = null
  try {
    detail.value = await getSpecialisation(props.specialisationId)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load specialisation'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** Every write returns the whole refreshed specialisation; drop the selection if its topic went with it. */
function applyDetail(next: SpecialisationDetail) {
  detail.value = next
  if (selectedTopicId.value !== null && !next.topics.some((t) => t.id === selectedTopicId.value)) {
    selectedTopicId.value = null
  }
}

// --- tree ---
const topicsById = computed(() => new Map((detail.value?.topics ?? []).map((t) => [t.id, t])))
const childrenOf = computed(() => {
  const map = new Map<number | null, Topic[]>()
  for (const t of detail.value?.topics ?? []) {
    const siblings = map.get(t.parentTopicId) ?? []
    siblings.push(t)
    map.set(t.parentTopicId, siblings)
  }
  return map
})
const expanded = ref<Record<number, boolean>>({})

interface Row {
  topic: Topic
  hasKids: boolean
  open: boolean
  meta: string
}

const rows = computed(() => {
  const out: Row[] = []
  const walk = (parentId: number | null) => {
    for (const t of childrenOf.value.get(parentId) ?? []) {
      const hasKids = (childrenOf.value.get(t.id)?.length ?? 0) > 0
      const open = expanded.value[t.id] ?? false
      const meta: string[] = []
      if (t.prerequisiteIds.length) meta.push(`⇢${t.prerequisiteIds.length}`)
      if (t.logs.length) meta.push(`▤${t.logs.length}`)
      if (t.projectLinks.length) meta.push(`◈${t.projectLinks.length}`)
      out.push({ topic: t, hasKids, open, meta: meta.join(' ') })
      if (hasKids && open) walk(t.id)
    }
  }
  walk(null)
  return out
})

function toggle(id: number) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}

// --- selection / drawer ---
const selectedTopicId = ref<number | null>(null)
const selectedTopic = computed(() =>
  selectedTopicId.value === null ? null : (topicsById.value.get(selectedTopicId.value) ?? null),
)

/** Selects a topic and expands its ancestors so its row is visible behind the drawer. */
function selectTopic(id: number) {
  const next = { ...expanded.value }
  for (let t = topicsById.value.get(id); t && t.parentTopicId !== null; t = topicsById.value.get(t.parentTopicId)) {
    next[t.parentTopicId] = true
  }
  expanded.value = next
  selectedTopicId.value = id
}

// --- new topic / subtopic dialog ---
const topicDialogOpen = ref(false)
const topicDialogParent = ref<Topic | null>(null)
const topicName = ref('')
const topicSaving = ref(false)
const topicError = ref<string | null>(null)

function pathOf(topic: Topic): string {
  const names: string[] = []
  for (let t: Topic | undefined = topic; t; t = t.parentTopicId === null ? undefined : topicsById.value.get(t.parentTopicId)) {
    names.unshift(t.name)
  }
  return names.join(' › ')
}

function openNewTopic(parent: Topic | null) {
  topicDialogParent.value = parent
  topicName.value = ''
  topicError.value = null
  topicDialogOpen.value = true
}

async function saveTopic() {
  if (!detail.value || !topicName.value.trim() || topicSaving.value) return
  topicSaving.value = true
  topicError.value = null
  const parent = topicDialogParent.value
  const before = new Set(detail.value.topics.map((t) => t.id))
  try {
    const next = await createTopic(detail.value.id, {
      name: topicName.value.trim(),
      parentTopicId: parent?.id ?? null,
      suggestedOrder: null,
      confidenceRating: null,
    })
    applyDetail(next)
    topicDialogOpen.value = false
    const created = next.topics.find((t) => !before.has(t.id))
    if (created) selectTopic(created.id)
  } catch (e) {
    topicError.value = e instanceof Error ? e.message : 'Failed to create topic'
  } finally {
    topicSaving.value = false
  }
}

// --- rename / delete specialisation (not Basic) ---
const specDialogOpen = ref(false)
const specName = ref('')
const specSaving = ref(false)
const specError = ref<string | null>(null)

function openEditSpecialisation() {
  if (!detail.value) return
  specName.value = detail.value.name
  specError.value = null
  specDialogOpen.value = true
}

async function saveSpecialisation() {
  if (!detail.value || !specName.value.trim() || specSaving.value) return
  specSaving.value = true
  specError.value = null
  try {
    applyDetail(await renameSpecialisation(detail.value.id, specName.value.trim()))
    specDialogOpen.value = false
  } catch (e) {
    specError.value = e instanceof Error ? e.message : 'Failed to rename specialisation'
  } finally {
    specSaving.value = false
  }
}

async function removeSpecialisation() {
  if (!detail.value) return
  const count = detail.value.topics.length
  const ok = window.confirm(
    `Delete the “${detail.value.name}” specialisation${count ? ` and all ${count} of its topic${count === 1 ? '' : 's'}` : ''}? ` +
      'Logs, prerequisites and project links go with them — linked projects are kept. This cannot be undone.',
  )
  if (!ok) return
  try {
    await deleteSpecialisation(detail.value.id)
    emit('back')
  } catch (e) {
    specError.value = e instanceof Error ? e.message : 'Failed to delete specialisation'
  }
}

// --- specialisation-level project links ---
const linkDialogOpen = ref(false)
const projects = ref<Project[]>([])
const linkProjectId = ref<number | ''>('')
const linkSaving = ref(false)
const linkError = ref<string | null>(null)

const linkCandidates = computed(() => {
  const linked = new Set((detail.value?.projectLinks ?? []).map((l) => l.projectId))
  return projects.value.filter((p) => !linked.has(p.id))
})

async function openLinkProject() {
  linkProjectId.value = ''
  linkError.value = null
  linkDialogOpen.value = true
  try {
    projects.value = await getProjects()
  } catch (e) {
    linkError.value = e instanceof Error ? e.message : 'Failed to load projects'
  }
}

async function saveLink() {
  if (!detail.value || linkProjectId.value === '' || linkSaving.value) return
  linkSaving.value = true
  linkError.value = null
  try {
    applyDetail(await linkProject(linkProjectId.value, { specialisationId: detail.value.id }))
    linkDialogOpen.value = false
  } catch (e) {
    linkError.value = e instanceof Error ? e.message : 'Failed to link project'
  } finally {
    linkSaving.value = false
  }
}

async function removeLink(id: number) {
  actionError.value = null
  try {
    applyDetail(await unlinkProject(id))
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Failed to unlink project'
  }
}

const parentRatingNote = computed(() => {
  const parent = topicDialogParent.value
  if (!parent || parent.confidenceRating === null) return null
  return (
    `“${parent.name}” is currently rated ${parent.confidenceRating} by hand. Adding a subtopic discards that ` +
    'rating — from then on it’s derived from its subtopics.'
  )
})
</script>

<template>
  <div class="lp-wrap">
    <button class="btn btn-ghost lp-back" @click="emit('back')">← Fields</button>

    <p v-if="loading" class="lp-muted">Loading…</p>
    <p v-else-if="loadError" class="lp-error">{{ loadError }}</p>

    <template v-else-if="detail">
      <p class="fin-kicker">Learning Path — {{ detail.fieldName }}</p>
      <div class="lp-head">
        <div>
          <h1 class="fin-title">{{ detail.name }}</h1>
          <div class="lp-rollup">
            <ConfidenceDots :value="detail.rollupRating" :size="11" />
            <span class="lp-rollup-label" :title="detail.leafCount ? COVERAGE_HINT : undefined">
              {{ rollupLabel(detail.rollupRating, detail.ratedLeafCount, detail.leafCount, 'No topics yet') }}
            </span>
          </div>
        </div>
        <div class="lp-actions">
          <button v-if="!detail.basic" class="btn btn-secondary" @click="openEditSpecialisation">Edit</button>
          <button v-if="detail.capabilities.allowsProjectLinks" class="btn btn-secondary" @click="openLinkProject">
            Link a project
          </button>
          <button class="btn btn-primary" @click="openNewTopic(null)">+ New topic</button>
        </div>
      </div>

      <p v-if="actionError" class="lp-error">{{ actionError }}</p>

      <div class="lp-tree">
        <div class="lp-tree-head">
          <span>Topic</span>
          <span class="lp-col-confidence">Confidence</span>
          <span class="lp-col-meta"></span>
        </div>
        <div
          v-for="r in rows"
          :key="r.topic.id"
          class="lp-row"
          :class="{ selected: selectedTopicId === r.topic.id }"
          role="button"
          tabindex="0"
          @click="selectTopic(r.topic.id)"
          @keydown.enter.self="selectTopic(r.topic.id)"
        >
          <span class="lp-row-name" :style="{ paddingLeft: `${r.topic.depth * 22}px` }">
            <button
              v-if="r.hasKids"
              class="lp-caret"
              :aria-label="r.open ? 'Collapse' : 'Expand'"
              :aria-expanded="r.open"
              @click.stop="toggle(r.topic.id)"
            >
              {{ r.open ? '▼' : '▶' }}
            </button>
            <span v-else class="lp-leaf"><span></span></span>
            <span class="lp-name">{{ r.topic.name }}</span>
            <span v-if="r.hasKids && r.topic.effectiveRating !== null" class="lp-badge">derived</span>
          </span>
          <span class="lp-col-confidence lp-row-rating">
            <ConfidenceDots :value="r.topic.effectiveRating" />
            <span class="lp-row-value">{{ formatRating(r.topic.effectiveRating) }}</span>
          </span>
          <span class="lp-col-meta lp-row-meta">{{ r.meta }}</span>
        </div>
      </div>

      <div v-if="rows.length === 0" class="lp-empty">
        <p class="lp-empty-title">No topics in this specialisation yet.</p>
        <p class="lp-empty-hint">Topics can't be moved later &mdash; placement is fixed at creation.</p>
        <button class="btn btn-primary" @click="openNewTopic(null)">+ New topic</button>
      </div>

      <div v-if="detail.capabilities.allowsProjectLinks && detail.projectLinks.length" class="lp-spec-links">
        <span class="lp-section-label">Linked projects</span>
        <div v-for="l in detail.projectLinks" :key="l.id" class="lp-link-row">
          <span class="lp-link-name">{{ l.projectName }}</span>
          <span class="lp-link-right">
            <span class="tag" :class="TAG_CLASS[l.projectStatus]">{{ STATUS_LABEL[l.projectStatus] }}</span>
            <button class="lp-remove" aria-label="Unlink project" title="Unlink" @click="removeLink(l.id)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
            </button>
          </span>
        </div>
      </div>

      <TopicDrawer
        v-if="selectedTopic"
        :detail="detail"
        :topic="selectedTopic"
        @close="selectedTopicId = null"
        @select="selectTopic"
        @update="applyDetail"
        @add-subtopic="openNewTopic"
      />

      <!-- new topic / subtopic dialog — after the drawer so it stacks above it -->
      <div v-if="topicDialogOpen" class="dialog-backdrop" @click="topicDialogOpen = false">
        <div class="dialog" @click.stop>
          <div class="dialog-title">{{ topicDialogParent ? 'New subtopic' : 'New topic' }}</div>
          <div class="dialog-body lp-dialog-body">
            <div class="field">
              <label for="lt-name">Name</label>
              <input id="lt-name" class="input" v-model="topicName" placeholder="Topic name" @keydown.enter="saveTopic" />
            </div>
            <p class="lp-placement">
              {{ topicDialogParent ? `Under ${pathOf(topicDialogParent)}` : `Top level of ${detail.name}` }}
            </p>
            <p class="lp-note">Placement is fixed at creation — topics can't be moved later.</p>
            <p v-if="parentRatingNote" class="lp-note lp-warn">{{ parentRatingNote }}</p>
          </div>
          <p v-if="topicError" class="lp-error">{{ topicError }}</p>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="topicDialogOpen = false">Cancel</button>
            <button class="btn btn-primary" :disabled="!topicName.trim() || topicSaving" @click="saveTopic">
              {{ topicSaving ? 'Creating…' : 'Create' }}
            </button>
          </div>
        </div>
      </div>

      <!-- rename / delete specialisation -->
      <div v-if="specDialogOpen" class="dialog-backdrop" @click="specDialogOpen = false">
        <div class="dialog" @click.stop>
          <div class="dialog-title">Edit specialisation</div>
          <div class="dialog-body lp-dialog-body">
            <div class="field">
              <label for="lsp-name">Name</label>
              <input id="lsp-name" class="input" v-model="specName" @keydown.enter="saveSpecialisation" />
            </div>
          </div>
          <p v-if="specError" class="lp-error">{{ specError }}</p>
          <div class="dialog-actions">
            <button class="btn btn-ghost lp-delete-btn" @click="removeSpecialisation">Delete specialisation</button>
            <button class="btn btn-ghost" @click="specDialogOpen = false">Cancel</button>
            <button class="btn btn-primary" :disabled="!specName.trim() || specSaving" @click="saveSpecialisation">
              {{ specSaving ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>

      <!-- link a project to the specialisation itself -->
      <div v-if="linkDialogOpen" class="dialog-backdrop" @click="linkDialogOpen = false">
        <div class="dialog" @click.stop>
          <div class="dialog-title">Link a project</div>
          <div class="dialog-body lp-dialog-body">
            <div class="field">
              <label for="ll-project">Project</label>
              <select id="ll-project" class="input" v-model.number="linkProjectId">
                <option value="" disabled>Choose a project…</option>
                <option v-for="p in linkCandidates" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </div>
            <p class="lp-note">
              Links to {{ detail.name }} as a whole. To place a project under a specific topic, use Link project in
              that topic's panel. The project itself stays in the project tracker.
            </p>
          </div>
          <p v-if="linkError" class="lp-error">{{ linkError }}</p>
          <div class="dialog-actions">
            <button class="btn btn-ghost" @click="linkDialogOpen = false">Cancel</button>
            <button class="btn btn-primary" :disabled="linkProjectId === '' || linkSaving" @click="saveLink">
              {{ linkSaving ? 'Linking…' : 'Link' }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 40px); margin: 0 0 var(--space-2); }
.lp-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }
.lp-back { padding-inline: 0; margin-bottom: var(--space-4); }
.lp-muted { color: var(--color-neutral-500); }
.lp-error { font-size: 13px; color: var(--color-accent-2-700); }

.lp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-5); }
.lp-rollup { display: flex; align-items: center; gap: 12px; }
.lp-rollup-label { font-size: 13px; color: var(--color-neutral-700); }
.lp-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

/* Rows are subgrids so the confidence and meta columns line up however wide their content gets. */
.lp-tree { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; column-gap: var(--space-2); }
.lp-tree-head, .lp-row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; }
.lp-tree-head {
  padding: 0 var(--space-3) var(--space-2); border-bottom: 1px solid var(--color-divider);
  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600);
}
.lp-col-confidence { min-width: 120px; text-align: right; }
.lp-col-meta { min-width: 44px; text-align: right; }
.lp-row {
  padding: 11px var(--space-3); cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
}
.lp-row:hover { background: color-mix(in srgb, var(--color-text) 4%, transparent); }
.lp-row.selected { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
.lp-row-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lp-caret {
  width: 18px; height: 18px; flex-shrink: 0; display: grid; place-items: center;
  background: none; border: none; padding: 0; cursor: pointer;
  color: var(--color-neutral-600); font-size: 10px; line-height: 1;
}
.lp-leaf { width: 18px; height: 18px; flex-shrink: 0; display: grid; place-items: center; }
.lp-leaf span { width: 4px; height: 4px; border-radius: 50%; background: var(--color-neutral-400); }
.lp-name { font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-badge {
  flex-shrink: 0; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-600);
  border: 1px solid var(--color-divider); border-radius: calc(var(--radius-md) * 0.75); padding: 1px 5px;
}
.lp-row-rating { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-2); }
.lp-row-value { font-size: 12.5px; color: var(--color-neutral-700); min-width: 26px; text-align: right; }
.lp-row-meta { font-size: 12px; color: var(--color-neutral-500); white-space: nowrap; }

.lp-empty { padding: var(--space-9) var(--space-3); text-align: center; }
.lp-empty-title { font-size: 15px; color: var(--color-neutral-700); margin: 0 0 var(--space-1); }
.lp-empty-hint { font-size: 13px; color: var(--color-neutral-500); font-style: italic; margin: 0 0 var(--space-4); }

.lp-spec-links { display: flex; flex-direction: column; gap: 8px; margin-top: var(--space-6); max-width: 560px; }
.lp-section-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); }
.lp-link-row {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
  padding: 9px 12px; background: var(--color-surface); border-radius: var(--radius-md);
}
.lp-link-name { font-size: 13.5px; }
.lp-link-right { display: flex; align-items: center; gap: var(--space-2); }
.lp-remove { background: none; border: none; color: var(--color-neutral-500); cursor: pointer; padding: 0 2px; display: flex; }
.lp-remove:hover { color: var(--color-accent-2-700); }

.lp-dialog-body { display: flex; flex-direction: column; gap: var(--space-3); }
.lp-placement { font-size: 13px; color: var(--color-neutral-700); margin: 0; }
.lp-note { font-size: 12px; color: var(--color-neutral-500); font-style: italic; margin: 0; }
.lp-warn { color: var(--color-accent-2-700); }
.lp-delete-btn { color: var(--color-accent-2-700); margin-right: auto; }
</style>
