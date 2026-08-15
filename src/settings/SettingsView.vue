<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createTagRule,
  deleteTagRule,
  getTagRules,
  importTagRuleScript,
  reapplyTagRules,
  updateTagRule,
} from '../finance/api'
import {
  LOCAL_API_URL,
  getApiEnvironment,
  getProductionApiUrl,
  resolveApiBaseUrl,
  setApiEnvironment,
  setProductionApiUrl,
  type ApiEnvironment,
} from './apiEnvironment'
import type { ReapplyResult, RuleImportOutcome, TagRule } from '../finance/types'

const environment = ref<ApiEnvironment>(getApiEnvironment())
const prodUrlDraft = ref(getProductionApiUrl())
const activeBaseUrl = ref(resolveApiBaseUrl())

function selectEnvironment(env: ApiEnvironment) {
  environment.value = env
  setApiEnvironment(env)
  activeBaseUrl.value = resolveApiBaseUrl()
}

function saveProdUrl() {
  setProductionApiUrl(prodUrlDraft.value)
  prodUrlDraft.value = getProductionApiUrl()
  activeBaseUrl.value = resolveApiBaseUrl()
}

const rules = ref<TagRule[]>([])
const rulesLoading = ref(true)
const rulesError = ref<string | null>(null)
const rowSaving = reactive<Record<number, boolean>>({})
const rowErrors = reactive<Record<number, string>>({})
const newStatement = ref('')
const newPriority = ref(0)
const newRuleError = ref<string | null>(null)

async function loadRules() {
  rulesLoading.value = true
  rulesError.value = null
  try {
    rules.value = await getTagRules()
    newPriority.value = rules.value.length ? Math.max(...rules.value.map((r) => r.priority)) + 1 : 0
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to load tag rules'
  } finally {
    rulesLoading.value = false
  }
}

onMounted(loadRules)

interface RuleGroup {
  tag: string | null
  rules: TagRule[]
}

function extractTag(statement: string): string | null {
  const setClauseMatch = statement.match(/\bSET\b([\s\S]*?)\bWHERE\b/i)
  const setClause = setClauseMatch?.[1] ?? statement
  const tagMatch = setClause.match(/\btags\s*=\s*'([^']*)'/i)
  return tagMatch?.[1] ?? null
}

const groupedRules = computed<RuleGroup[]>(() => {
  const byTag = new Map<string, TagRule[]>()
  const ungrouped: TagRule[] = []

  for (const rule of rules.value) {
    const tag = extractTag(rule.statement)
    if (tag === null) {
      ungrouped.push(rule)
      continue
    }
    const list = byTag.get(tag)
    if (list) list.push(rule)
    else byTag.set(tag, [rule])
  }

  const groups: RuleGroup[] = [...byTag.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, groupRules]) => ({ tag, rules: groupRules.sort((a, b) => a.priority - b.priority) }))

  if (ungrouped.length) {
    groups.push({ tag: null, rules: ungrouped.sort((a, b) => a.priority - b.priority) })
  }

  return groups
})

async function saveRule(rule: TagRule) {
  rowSaving[rule.id] = true
  delete rowErrors[rule.id]
  try {
    Object.assign(rule, await updateTagRule(rule.id, rule))
  } catch (e) {
    rowErrors[rule.id] = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    rowSaving[rule.id] = false
  }
}

async function removeRule(id: number) {
  try {
    await deleteTagRule(id)
    rules.value = rules.value.filter((r) => r.id !== id)
  } catch (e) {
    rulesError.value = e instanceof Error ? e.message : 'Failed to delete rule'
  }
}

async function addRule() {
  if (!newStatement.value.trim()) return
  newRuleError.value = null
  try {
    const created = await createTagRule({ statement: newStatement.value, priority: newPriority.value })
    rules.value = [...rules.value, created].sort((a, b) => a.priority - b.priority)
    newStatement.value = ''
    newPriority.value = created.priority + 1
  } catch (e) {
    newRuleError.value = e instanceof Error ? e.message : 'Failed to create rule'
  }
}

const reapplying = ref(false)
const reapplyResult = ref<ReapplyResult | null>(null)
const reapplyError = ref<string | null>(null)

async function reapply() {
  reapplying.value = true
  reapplyError.value = null
  reapplyResult.value = null
  try {
    reapplyResult.value = await reapplyTagRules()
  } catch (e) {
    reapplyError.value = e instanceof Error ? e.message : 'Failed to re-apply rules'
  } finally {
    reapplying.value = false
  }
}

const scriptDraft = ref('')
const importing = ref(false)
const importOutcomes = ref<RuleImportOutcome[] | null>(null)
const importError = ref<string | null>(null)

async function importScript() {
  if (!scriptDraft.value.trim()) return
  importing.value = true
  importError.value = null
  importOutcomes.value = null
  try {
    const outcomes = await importTagRuleScript(scriptDraft.value)
    importOutcomes.value = outcomes
    await loadRules()
    if (outcomes.every((o) => o.success)) {
      scriptDraft.value = ''
    }
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'Failed to import script'
  } finally {
    importing.value = false
  }
}

function onScriptFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    file.text().then((text) => {
      scriptDraft.value = text
    })
  }
  target.value = ''
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine
}
</script>

<template>
  <div class="settings-wrap">
    <p class="fin-kicker">Settings</p>
    <h1 class="fin-title">Settings</h1>

    <section class="settings-section">
      <h2 class="section-title">API Environment</h2>
      <p class="section-hint">Choose which Homebase backend HomebaseWeb talks to.</p>

      <div class="env-row">
        <button
          class="btn"
          :class="environment === 'local' ? 'btn-primary' : 'btn-secondary'"
          @click="selectEnvironment('local')"
        >
          Local
        </button>
        <button
          class="btn"
          :class="environment === 'production' ? 'btn-primary' : 'btn-secondary'"
          @click="selectEnvironment('production')"
        >
          Production
        </button>
      </div>

      <div class="field">
        <label for="prod-url">Production API URL</label>
        <input
          id="prod-url"
          class="input"
          v-model="prodUrlDraft"
          placeholder="https://your-app-name.onrender.com"
        />
      </div>
      <button class="btn btn-secondary" @click="saveProdUrl">Save URL</button>

      <p class="current-url">
        Local URL: <code>{{ LOCAL_API_URL }}</code><br />
        Currently calling: <strong>{{ activeBaseUrl }}</strong>
      </p>
    </section>

    <section class="settings-section">
      <h2 class="section-title">Manual Balances</h2>
      <p class="section-hint">
        Moved to <strong>Finance → Net Worth</strong>, where each balance is its own row you can add,
        edit and delete.
      </p>
    </section>

    <section class="settings-section rules-section">
      <h2 class="section-title">Transaction Tag Rules</h2>
      <p class="section-hint">
        Each rule is a validated SQL statement —
        <code>UPDATE transactions SET tags = '...' [, is_subscription = 0|1] [, note = '...'] WHERE &lt;condition&gt;</code>
        — where the condition combines AND / OR / NOT / parentheses over
        <code>description LIKE '...'</code>, <code>source = '...'</code>,
        <code>amount &gt;=|&lt;=|&gt;|&lt;|= &lt;number&gt;</code>, <code>tags = '...'</code> and
        <code>is_subscription = 0|1</code>. Rules run in priority order (lowest first) as
        sequential updates, so a later rule can overwrite an earlier one's tag — same as re-running
        a sequence of SQL scripts. Set a rule's tag to exactly <code>internal</code> to exclude
        matches (e.g. transfers between your own accounts) from budget totals. Rules apply
        automatically after every statement import; use "Re-apply to all transactions" below to run
        them against existing history too, e.g. right after editing a rule.
      </p>

      <p v-if="rulesLoading" style="color: var(--color-neutral-500)">Loading…</p>
      <template v-else>
        <p v-if="!rules.length" class="section-hint">No rules yet — add one below.</p>

        <div v-for="group in groupedRules" :key="group.tag ?? '__ungrouped'" class="rule-group">
          <h3 class="rule-group-title">
            {{ group.tag ?? 'Other' }}
            <span class="rule-group-count">{{ group.rules.length }}</span>
          </h3>

          <div v-for="rule in group.rules" :key="rule.id" class="rule-card">
            <textarea class="input rule-textarea" v-model="rule.statement" rows="2"></textarea>
            <div class="rule-card-footer">
              <label class="rule-priority-field">
                Priority
                <input class="input rule-priority" type="number" v-model.number="rule.priority" />
              </label>
              <div class="rules-actions">
                <button class="btn btn-secondary" @click="saveRule(rule)" :disabled="rowSaving[rule.id]">
                  {{ rowSaving[rule.id] ? 'Saving…' : 'Save' }}
                </button>
                <button class="btn btn-ghost" @click="removeRule(rule.id)">Delete</button>
              </div>
            </div>
            <p v-if="rowErrors[rule.id]" class="error-text">{{ rowErrors[rule.id] }}</p>
          </div>
        </div>

        <div class="rule-card rule-new">
          <textarea
            class="input rule-textarea"
            v-model="newStatement"
            rows="2"
            placeholder="UPDATE transactions SET tags = 'Groceries' WHERE description LIKE '%tesco%' OR description LIKE '%asda%'"
          ></textarea>
          <div class="rule-card-footer">
            <label class="rule-priority-field">
              Priority
              <input class="input rule-priority" type="number" v-model.number="newPriority" />
            </label>
            <button class="btn btn-primary" @click="addRule">Add rule</button>
          </div>
          <p v-if="newRuleError" class="error-text">{{ newRuleError }}</p>
        </div>

        <p v-if="rulesError" class="error-text">{{ rulesError }}</p>

        <button class="btn btn-secondary reapply-btn" @click="reapply" :disabled="reapplying">
          {{ reapplying ? 'Re-applying…' : 'Re-apply to all transactions' }}
        </button>
        <p v-if="reapplyResult" class="success-text">
          Ran {{ reapplyResult.rulesRun }} rule(s), {{ reapplyResult.rowsAffected }} row-update(s) total.
        </p>
        <p v-if="reapplyError" class="error-text">{{ reapplyError }}</p>
      </template>
    </section>

    <section class="settings-section rules-section">
      <h2 class="section-title">Import a Rules Script</h2>
      <p class="section-hint">
        Paste (or upload) a SQL script with one or more UPDATE statements — each valid one becomes
        its own rule, appended after your current rules, and every rule re-applies to your existing
        transactions immediately. One bad statement doesn't block the rest.
      </p>

      <label class="upload-add-more script-file-label">
        <input type="file" accept=".sql,.txt" style="display: none" @change="onScriptFile" />
        Choose a .sql file…
      </label>

      <textarea
        class="input script-textarea"
        v-model="scriptDraft"
        rows="8"
        placeholder="UPDATE transactions SET tags = 'eating out' WHERE description LIKE '%pret%' OR description LIKE '%costa%';"
      ></textarea>

      <button class="btn btn-primary import-btn" @click="importScript" :disabled="importing">
        {{ importing ? 'Importing…' : 'Import script' }}
      </button>
      <p v-if="importError" class="error-text">{{ importError }}</p>

      <div v-if="importOutcomes" class="import-outcomes">
        <div v-for="(o, i) in importOutcomes" :key="i" class="import-outcome" :class="{ failed: !o.success }">
          <span class="import-outcome-statement">{{ truncate(o.statement, 80) }}</span>
          <span class="import-outcome-detail">{{ o.success ? 'Added' : o.error }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-6); }
.settings-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }
.settings-section { max-width: 480px; margin-bottom: var(--space-9); }
.section-title { font-family: var(--font-heading); font-weight: 400; font-size: 20px; margin: 0 0 var(--space-2); }
.section-hint { font-size: 13px; color: var(--color-neutral-500); margin: 0 0 var(--space-4); }
.env-row { display: flex; gap: var(--space-2); margin-bottom: var(--space-5); }
.field { margin-bottom: var(--space-3); }
.current-url { font-size: 12px; color: var(--color-neutral-600); margin-top: var(--space-4); line-height: 1.8; }
.current-url code { font-family: monospace; }
.error-text { font-size: 13px; color: var(--color-accent-2-700); margin-top: var(--space-3); }
.success-text { font-size: 13px; color: var(--color-accent-700); margin-top: var(--space-3); }

.rules-section { max-width: 720px; }
.rules-section code { font-family: monospace; font-size: 12px; background: var(--color-surface); padding: 1px 5px; border-radius: var(--radius-sm); }
.rule-group { margin-bottom: var(--space-5); }
.rule-group-title { display: flex; align-items: center; gap: var(--space-2); font-family: var(--font-heading); font-weight: 400; font-size: 15px; margin: 0 0 var(--space-2); text-transform: capitalize; }
.rule-group-count { font-family: var(--font-body); font-size: 11px; color: var(--color-neutral-500); background: var(--color-surface); border-radius: 999px; padding: 1px 8px; }
.rule-card { padding: var(--space-3); background: var(--color-surface); border-radius: var(--radius-md); margin-bottom: var(--space-3); }
.rule-textarea { font-family: monospace; font-size: 12.5px; resize: vertical; }
.rule-card-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-top: var(--space-2); }
.rule-priority-field { display: flex; align-items: center; gap: var(--space-2); font-size: 12px; color: var(--color-neutral-600); }
.rule-priority { width: 70px; min-height: 30px; padding: 4px 8px; }
.rules-actions { display: flex; gap: var(--space-2); }
.rule-new { border: 1px dashed var(--color-neutral-400); background: transparent; }
.reapply-btn { margin-top: var(--space-2); }

.script-file-label { display: inline-block; font-size: 13px; color: var(--color-accent-700); cursor: pointer; margin-bottom: var(--space-3); }
.script-file-label:hover { text-decoration: underline; }
.script-textarea { font-family: monospace; font-size: 12.5px; resize: vertical; }
.import-btn { margin-top: var(--space-3); }
.import-outcomes { margin-top: var(--space-4); }
.import-outcome { display: flex; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--color-neutral-300); font-size: 12.5px; }
.import-outcome:first-child { border-top: none; }
.import-outcome-statement { font-family: monospace; color: var(--color-text); }
.import-outcome-detail { color: var(--color-accent-700); text-align: right; white-space: nowrap; }
.import-outcome.failed .import-outcome-detail { color: var(--color-accent-2-700); white-space: normal; text-align: right; max-width: 300px; }
</style>
