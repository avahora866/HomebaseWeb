<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getProjects } from '../projects/api'
import { STATUS_LABEL, TAG_CLASS } from '../projects/status'
import type { Project } from '../projects/types'
import ConfidenceDots from './ConfidenceDots.vue'
import { addLog, addPrerequisite, deleteLog, deleteTopic, linkProject, removePrerequisite, unlinkProject, updateTopic } from './api'
import { formatRating } from './rating'
import type { SpecialisationDetail, Topic, TopicInput } from './types'

const props = defineProps<{ detail: SpecialisationDetail; topic: Topic }>()
const emit = defineEmits<{
  close: []
  select: [topicId: number]
  update: [detail: SpecialisationDetail]
  'add-subtopic': [parent: Topic]
}>()

const caps = computed(() => props.detail.capabilities)
const topicsById = computed(() => new Map(props.detail.topics.map((t) => [t.id, t])))
const kids = computed(() => props.detail.topics.filter((t) => t.parentTopicId === props.topic.id))

/** Root first — shown after the field and specialisation in the breadcrumb, each one a jump back up. */
const ancestors = computed(() => {
  const out: Topic[] = []
  for (let id = props.topic.parentTopicId; id !== null; ) {
    const t = topicsById.value.get(id)
    if (!t) break
    out.unshift(t)
    id = t.parentTopicId
  }
  return out
})

const ratingNote = computed(() => {
  if (props.topic.derived) {
    const n = kids.value.length
    return `Averaged from ${n} subtopic${n === 1 ? '' : 's'}. Unrated subtopics are excluded.`
  }
  return props.topic.confidenceRating === null
    ? 'Unrated. Click a dot to set 1–5.'
    : 'Set manually — this is a leaf topic. Click the same dot again to clear it.'
})

const maxDepth = computed(() => caps.value.maxNestingDepth)
const canNest = computed(() => maxDepth.value === null || props.topic.depth + 1 <= maxDepth.value)
const subtopicLabel = computed(() => {
  if (canNest.value) return '+ Add subtopic'
  return maxDepth.value === 0 ? 'Subtopics not allowed (flat field)' : 'Max nesting depth reached'
})

const busy = ref(false)
const error = ref<string | null>(null)

async function run(action: () => Promise<SpecialisationDetail>, failure: string): Promise<boolean> {
  busy.value = true
  error.value = null
  try {
    emit('update', await action())
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : failure
    return false
  } finally {
    busy.value = false
  }
}

/** Topic PUT is a full replace — start from what's stored and override the one thing being changed. */
function put(patch: Partial<TopicInput>, failure: string) {
  const t = props.topic
  return run(
    () =>
      updateTopic(t.id, {
        name: t.name,
        parentTopicId: t.parentTopicId,
        suggestedOrder: t.suggestedOrder,
        confidenceRating: t.confidenceRating,
        ...patch,
      }),
    failure,
  )
}

// --- name ---
const nameDraft = ref(props.topic.name)
watch(
  () => props.topic.name,
  (name) => (nameDraft.value = name),
)
function saveName() {
  const name = nameDraft.value.trim()
  if (!name) {
    nameDraft.value = props.topic.name
    return
  }
  if (name !== props.topic.name) put({ name }, 'Failed to rename topic')
}

// --- rating ---
function setRating(value: number) {
  if (props.topic.derived || busy.value) return
  put({ confidenceRating: props.topic.confidenceRating === value ? null : value }, 'Failed to set rating')
}

// --- suggested order ---
const orderDraft = ref(props.topic.suggestedOrder?.toString() ?? '')
watch(
  () => props.topic.suggestedOrder,
  (order) => (orderDraft.value = order?.toString() ?? ''),
)
function saveOrder() {
  const raw = orderDraft.value.toString().trim()
  const order = raw === '' ? null : Number(raw)
  if (order !== null && !Number.isInteger(order)) {
    error.value = 'Suggested order must be a whole number'
    return
  }
  if (order !== props.topic.suggestedOrder) put({ suggestedOrder: order }, 'Failed to change suggested order')
}

// --- prerequisites ---
const prereqs = computed(() =>
  props.topic.prerequisiteIds.map((id) => topicsById.value.get(id)).filter((t): t is Topic => t !== undefined),
)
const prereqCandidates = computed(() =>
  props.detail.topics.filter((t) => t.id !== props.topic.id && !props.topic.prerequisiteIds.includes(t.id)),
)
const addingPrereq = ref(false)
const prereqChoice = ref<number | ''>('')

function indentName(t: Topic): string {
  return `${'   '.repeat(t.depth)}${t.name}`
}
async function savePrereq() {
  if (prereqChoice.value === '') return
  const requiresId = prereqChoice.value
  if (await run(() => addPrerequisite(props.topic.id, requiresId), 'Failed to add prerequisite')) {
    addingPrereq.value = false
    prereqChoice.value = ''
  }
}

// --- logs ---
const logDraft = ref('')
async function saveLog() {
  const note = logDraft.value.trim()
  if (!note || busy.value) return
  if (await run(() => addLog(props.topic.id, note), 'Failed to add log entry')) logDraft.value = ''
}
function logDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function logTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB')
}

// --- project links ---
const linking = ref(false)
const projects = ref<Project[]>([])
const linkChoice = ref<number | ''>('')
const linkCandidates = computed(() => {
  const linked = new Set(props.topic.projectLinks.map((l) => l.projectId))
  return projects.value.filter((p) => !linked.has(p.id))
})
async function startLinking() {
  linking.value = true
  linkChoice.value = ''
  try {
    projects.value = await getProjects()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load projects'
  }
}
async function saveLink() {
  if (linkChoice.value === '') return
  const projectId = linkChoice.value
  if (await run(() => linkProject(projectId, { topicId: props.topic.id }), 'Failed to link project')) {
    linking.value = false
  }
}

// --- delete ---
function descendantCount(id: number): number {
  return props.detail.topics
    .filter((t) => t.parentTopicId === id)
    .reduce((n, t) => n + 1 + descendantCount(t.id), 0)
}
function remove() {
  const n = descendantCount(props.topic.id)
  const ok = window.confirm(
    `Delete “${props.topic.name}”${n ? ` and its ${n} subtopic${n === 1 ? '' : 's'}` : ''}? ` +
      'Logs, prerequisite links and project links on them go too — the other topics and the linked projects themselves are kept. This cannot be undone.',
  )
  if (ok) run(() => deleteTopic(props.topic.id), 'Failed to delete topic')
}

// A different topic in the same drawer starts with a clean slate.
watch(
  () => props.topic.id,
  () => {
    error.value = null
    addingPrereq.value = false
    linking.value = false
    logDraft.value = ''
  },
)
</script>

<template>
  <div class="lp-drawer-layer">
    <div class="lp-drawer-backdrop" @click="emit('close')"></div>
    <aside class="lp-drawer" aria-label="Topic details">
      <div class="lp-drawer-head">
        <div class="lp-drawer-titles">
          <nav class="lp-path" aria-label="Topic path">
            <span>{{ detail.fieldName }}</span>
            <span class="lp-path-sep" aria-hidden="true">›</span>
            <span>{{ detail.name }}</span>
            <template v-for="a in ancestors" :key="a.id">
              <span class="lp-path-sep" aria-hidden="true">›</span>
              <button class="lp-path-link" :title="`Open ${a.name}`" @click="emit('select', a.id)">{{ a.name }}</button>
            </template>
          </nav>
          <input
            class="lp-title"
            v-model="nameDraft"
            aria-label="Topic name"
            title="Click to rename"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
            @blur="saveName"
          />
        </div>
        <button class="lp-close" aria-label="Close" @click="emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
        </button>
      </div>

      <p v-if="error" class="lp-error">{{ error }}</p>

      <div class="lp-box">
        <span class="lp-label">Confidence</span>
        <div class="lp-confidence">
          <ConfidenceDots
            :value="topic.effectiveRating"
            :size="16"
            :gap="5"
            :editable="!topic.derived"
            @set="setRating"
          />
          <span class="lp-value">{{ formatRating(topic.effectiveRating) }}</span>
          <span v-if="topic.derived" class="lp-badge">derived &middot; read-only</span>
        </div>
        <p class="lp-note">{{ ratingNote }}</p>
      </div>

      <div v-if="caps.allowsSuggestedOrder" class="lp-section">
        <label class="lp-label" for="lp-order">Suggested order</label>
        <div class="lp-order">
          <input
            id="lp-order"
            class="input lp-order-input"
            type="number"
            step="1"
            v-model="orderDraft"
            placeholder="—"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
            @blur="saveOrder"
          />
          <span class="lp-hint">Sort key among siblings — gaps are fine (10, 20, 30…). Blank sorts by creation date.</span>
        </div>
      </div>

      <div v-if="topic.derived" class="lp-section">
        <span class="lp-label">Subtopics</span>
        <button v-for="k in kids" :key="k.id" class="lp-kid" @click="emit('select', k.id)">
          <span class="lp-kid-name">{{ k.name }}</span>
          <span class="lp-kid-rating">
            <ConfidenceDots :value="k.effectiveRating" :size="8" />
            <span class="lp-kid-value">{{ formatRating(k.effectiveRating) }}</span>
          </span>
        </button>
      </div>

      <div v-if="caps.allowsPrerequisites" class="lp-section">
        <div class="lp-section-head">
          <span class="lp-label">Prerequisites</span>
          <button v-if="!addingPrereq && prereqCandidates.length" class="lp-link-btn" @click="addingPrereq = true">+ Add</button>
        </div>
        <p class="lp-note lp-italic">Informational only &mdash; prerequisites never lock a topic.</p>
        <div v-if="prereqs.length" class="lp-chips">
          <span v-for="p in prereqs" :key="p.id" class="tag tag-accent lp-chip">
            {{ p.name }}
            <button class="lp-chip-remove" :aria-label="`Remove prerequisite ${p.name}`" @click="run(() => removePrerequisite(topic.id, p.id), 'Failed to remove prerequisite')">×</button>
          </span>
        </div>
        <span v-else-if="!addingPrereq" class="lp-none">None set.</span>
        <div v-if="addingPrereq" class="lp-inline-add">
          <select class="input" v-model.number="prereqChoice" aria-label="Prerequisite topic">
            <option value="" disabled>Builds on…</option>
            <option v-for="t in prereqCandidates" :key="t.id" :value="t.id">{{ indentName(t) }}</option>
          </select>
          <button class="btn btn-secondary" :disabled="prereqChoice === '' || busy" @click="savePrereq">Add</button>
          <button class="btn btn-ghost" @click="addingPrereq = false">Cancel</button>
        </div>
      </div>

      <div v-if="caps.allowsLogs" class="lp-section lp-logs">
        <span class="lp-label">Logs</span>
        <div class="lp-inline-add">
          <input class="input lp-log-input" v-model="logDraft" placeholder="Add a log entry…" @keydown.enter="saveLog" />
          <button class="btn btn-secondary" :disabled="!logDraft.trim() || busy" @click="saveLog">Add</button>
        </div>
        <div v-for="l in topic.logs" :key="l.id" class="lp-log">
          <span class="lp-log-head">
            <span class="lp-log-at" :title="logTimestamp(l.createdAt)">{{ logDate(l.createdAt) }}</span>
            <button class="lp-remove" aria-label="Delete log entry" title="Delete" @click="run(() => deleteLog(topic.id, l.id), 'Failed to delete log entry')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
            </button>
          </span>
          <span class="lp-log-note">{{ l.note }}</span>
        </div>
        <span v-if="topic.logs.length === 0" class="lp-none">No entries yet.</span>
      </div>

      <div v-if="caps.allowsProjectLinks" class="lp-section">
        <div class="lp-section-head">
          <span class="lp-label">Linked projects</span>
          <button v-if="!linking" class="lp-link-btn" @click="startLinking">+ Link project</button>
        </div>
        <div v-for="l in topic.projectLinks" :key="l.id" class="lp-link-row">
          <span class="lp-link-name">{{ l.projectName }}</span>
          <span class="lp-link-right">
            <span class="tag" :class="TAG_CLASS[l.projectStatus]">{{ STATUS_LABEL[l.projectStatus] }}</span>
            <button class="lp-remove" aria-label="Unlink project" title="Unlink" @click="run(() => unlinkProject(l.id), 'Failed to unlink project')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
            </button>
          </span>
        </div>
        <span v-if="topic.projectLinks.length === 0 && !linking" class="lp-none">No projects linked.</span>
        <div v-if="linking" class="lp-inline-add">
          <select class="input" v-model.number="linkChoice" aria-label="Project to link">
            <option value="" disabled>{{ linkCandidates.length ? 'Choose a project…' : 'No other projects' }}</option>
            <option v-for="p in linkCandidates" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button class="btn btn-secondary" :disabled="linkChoice === '' || busy" @click="saveLink">Link</button>
          <button class="btn btn-ghost" @click="linking = false">Cancel</button>
        </div>
      </div>

      <div class="lp-drawer-foot">
        <button class="lp-delete" :disabled="busy" @click="remove">Delete topic</button>
        <button class="btn btn-secondary" :disabled="!canNest" @click="emit('add-subtopic', topic)">{{ subtopicLabel }}</button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
@keyframes lp-drawer-in {
  from { transform: translateX(24px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.lp-drawer-layer { position: fixed; inset: 0; z-index: 100; display: flex; justify-content: flex-end; }
.lp-drawer-backdrop { position: absolute; inset: 0; background: color-mix(in srgb, var(--color-neutral-900) 28%, transparent); }
.lp-drawer {
  position: relative; width: min(460px, 100%); height: 100%; overflow-y: auto;
  background: var(--color-surface); box-shadow: var(--shadow-lg); padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-4);
  animation: lp-drawer-in 180ms ease-out;
}

.lp-drawer-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-2); }
.lp-drawer-titles { min-width: 0; flex: 1; }
.lp-path { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-neutral-600); margin: 0 0 6px; }
.lp-path-sep { margin: 0 0.5em; }
.lp-path-link {
  background: none; border: none; padding: 0; cursor: pointer;
  font: inherit; letter-spacing: inherit; text-transform: inherit; color: var(--color-accent-700);
}
.lp-path-link:hover { color: var(--color-accent); text-decoration: underline; }
/* An input dressed as the heading, so renaming is just clicking into it. */
.lp-title {
  display: block; width: 100%; margin: 0 0 0 -4px; padding: 0 4px;
  font-family: var(--font-heading); font-weight: 400; font-size: 26px; line-height: 1.15; color: var(--color-text);
  background: transparent; border: 1px solid transparent; border-radius: var(--radius-md);
}
.lp-title:hover { border-color: var(--color-divider); }
.lp-title:focus-visible { border-color: var(--color-accent); outline: none; background: var(--color-bg); }
.lp-close { background: none; border: none; color: var(--color-neutral-600); cursor: pointer; padding: 4px; display: flex; }
.lp-close:hover { color: var(--color-text); }

.lp-error { font-size: 13px; color: var(--color-accent-2-700); margin: 0; }
.lp-label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-neutral-600); }
.lp-note { font-size: 12.5px; color: var(--color-neutral-600); margin: 0; }
.lp-italic { font-size: 12px; color: var(--color-neutral-500); font-style: italic; }
.lp-hint { font-size: 12px; color: var(--color-neutral-500); }
.lp-none { font-size: 13px; color: var(--color-neutral-500); }

.lp-box { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); background: var(--color-bg); border-radius: var(--radius-md); }
.lp-confidence { display: flex; align-items: center; gap: 12px; }
.lp-value { font-family: var(--font-heading); font-size: 20px; color: var(--color-text); }
.lp-badge {
  font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-600);
  border: 1px solid var(--color-divider); border-radius: calc(var(--radius-md) * 0.75); padding: 1px 6px;
}

.lp-section { display: flex; flex-direction: column; gap: 8px; }
.lp-logs { gap: var(--space-2); }
.lp-section-head { display: flex; align-items: baseline; justify-content: space-between; }
.lp-link-btn { background: none; border: none; padding: 0; font: inherit; font-size: 12px; color: var(--color-accent-700); cursor: pointer; }
.lp-link-btn:hover { text-decoration: underline; }

.lp-order { display: flex; align-items: center; gap: var(--space-2); }
.lp-order-input { width: 90px; flex-shrink: 0; background: var(--color-bg); }

.lp-kid {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
  background: var(--color-bg); border: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
  border-radius: var(--radius-md); padding: 9px 12px; cursor: pointer; color: var(--color-text); text-align: left; font: inherit;
}
.lp-kid:hover { border-color: color-mix(in srgb, var(--color-text) 30%, transparent); }
.lp-kid-name { font-size: 13.5px; }
.lp-kid-rating { display: flex; align-items: center; gap: 8px; }
.lp-kid-value { font-size: 12px; color: var(--color-neutral-700); }

.lp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.lp-chip { gap: 6px; font-size: 12px; padding: 4px 10px; }
.lp-chip-remove { background: none; border: none; padding: 0; font-size: 13px; line-height: 1; color: inherit; opacity: 0.6; cursor: pointer; }
.lp-chip-remove:hover { opacity: 1; }

.lp-inline-add { display: flex; gap: var(--space-2); }
.lp-inline-add .input { flex: 1; min-width: 0; background: var(--color-bg); }
.lp-log { display: flex; flex-direction: column; gap: 2px; padding: var(--space-2) 12px; background: var(--color-bg); border-radius: var(--radius-md); }
.lp-log-head { display: flex; justify-content: space-between; align-items: center; }
.lp-log-at { font-size: 11px; color: var(--color-neutral-500); }
.lp-log-note { font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; }

.lp-link-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: 9px 12px; background: var(--color-bg); border-radius: var(--radius-md); }
.lp-link-name { font-size: 13.5px; }
.lp-link-right { display: flex; align-items: center; gap: var(--space-2); }
.lp-remove { background: none; border: none; color: var(--color-neutral-500); cursor: pointer; padding: 0 2px; display: flex; }
.lp-remove:hover { color: var(--color-accent-2-700); }

.lp-drawer-foot { display: flex; gap: var(--space-2); margin-top: auto; padding-top: var(--space-3); border-top: 1px solid var(--color-divider); }
.lp-drawer-foot .btn { white-space: nowrap; }
.lp-delete {
  margin-right: auto; flex-shrink: 0; white-space: nowrap; background: none; border: none; padding: var(--space-2) var(--space-1); cursor: pointer;
  font-family: var(--font-heading); font-weight: var(--font-heading-weight); font-size: 14px; color: var(--color-accent-2-700);
}
.lp-delete:disabled { opacity: 0.45; cursor: not-allowed; }
</style>
