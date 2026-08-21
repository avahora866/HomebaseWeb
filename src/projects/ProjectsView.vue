<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  createCategory,
  createProject,
  createTask,
  deleteProject as apiDeleteProject,
  deleteTask as apiDeleteTask,
  getCategories,
  getProjectTasks,
  getProjects,
  updateProject,
  updateTask,
} from './api'
import type { Category, Project, ProjectStatus, Task, TaskPriority, TaskStatus } from './types'

const STATUSES: { key: ProjectStatus; label: string }[] = [
  { key: 'IDEA', label: 'Idea' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'PAUSED', label: 'Paused' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ARCHIVED', label: 'Archived' },
]
const STATUS_LABEL: Record<ProjectStatus, string> = Object.fromEntries(
  STATUSES.map((s) => [s.key, s.label]),
) as Record<ProjectStatus, string>
const TAG_CLASS: Record<ProjectStatus, string> = {
  IDEA: 'tag-neutral',
  IN_PROGRESS: 'tag-accent',
  PAUSED: 'tag-outline',
  COMPLETED: 'tag-accent-2',
  ARCHIVED: 'tag-neutral',
}

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'DONE', label: 'Complete' },
]

const PRIORITIES: { key: TaskPriority | ''; label: string }[] = [
  { key: '', label: 'No priority' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
]

const view = ref<'list' | 'board'>('list')
const projects = ref<Project[]>([])
const categories = ref<Category[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

const search = ref('')
const statusFilter = ref<ProjectStatus | ''>('')
const categoryFilter = ref<number | ''>('')
const sortKey = ref<'name' | 'status' | 'category'>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

async function loadProjects() {
  loading.value = true
  loadError.value = null
  try {
    projects.value = await getProjects()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load projects'
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = await getCategories()
  } catch (e) {
    console.error('Failed to load categories', e)
  }
}

onMounted(() => {
  loadProjects()
  loadCategories()
})

const filteredProjects = computed(() => {
  let rows = projects.value.filter((p) => (statusFilter.value ? p.status === statusFilter.value : true))
  rows = rows.filter((p) => (categoryFilter.value ? p.categoryId === categoryFilter.value : true))
  const q = search.value.trim().toLowerCase()
  if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q))
  rows = [...rows].sort((a, b) => {
    const av = (sortKey.value === 'category' ? a.categoryName : a[sortKey.value]).toLowerCase()
    const bv = (sortKey.value === 'category' ? b.categoryName : b[sortKey.value]).toLowerCase()
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return rows
})

function sortIcon(key: 'name' | 'status' | 'category'): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '▲' : '▼'
}
function toggleSort(key: 'name' | 'status' | 'category') {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function taskSummary(project: Project): string {
  return project.taskCount ? `${project.taskCount} task${project.taskCount === 1 ? '' : 's'}` : 'No tasks'
}

// --- list <-> board navigation ---
const activeProjectId = ref<number | null>(null)
const activeTasks = ref<Task[]>([])
const tasksLoading = ref(false)

const activeProject = computed(() => projects.value.find((p) => p.id === activeProjectId.value) ?? null)
const canAddTasks = computed(
  () => activeProject.value?.status === 'IDEA' || activeProject.value?.status === 'IN_PROGRESS',
)
const board = computed(() =>
  COLUMNS.map((col) => ({ ...col, tasks: activeTasks.value.filter((t) => t.status === col.key) })),
)

async function loadTasks() {
  if (activeProjectId.value === null) return
  tasksLoading.value = true
  try {
    activeTasks.value = await getProjectTasks(activeProjectId.value)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load tasks'
  } finally {
    tasksLoading.value = false
  }
}

async function openBoard(id: number) {
  activeProjectId.value = id
  view.value = 'board'
  await loadTasks()
}
function backToList() {
  view.value = 'list'
  activeProjectId.value = null
  activeTasks.value = []
}

// --- new project dialog ---
const newProjectOpen = ref(false)
const newProjectName = ref('')
const newProjectDescription = ref('')
const newProjectStatus = ref<ProjectStatus>('IDEA')
const newProjectCategoryId = ref<number | null>(null)
const newProjectAddCategory = ref(false)
const newProjectCategoryName = ref('')
const newProjectSaving = ref(false)
const newProjectError = ref<string | null>(null)

function openNewProject() {
  newProjectOpen.value = true
  newProjectName.value = ''
  newProjectDescription.value = ''
  newProjectStatus.value = 'IDEA'
  newProjectCategoryId.value = categories.value[0]?.id ?? null
  newProjectAddCategory.value = categories.value.length === 0
  newProjectCategoryName.value = ''
  newProjectError.value = null
}
function closeNewProject() {
  newProjectOpen.value = false
}
const newProjectInvalid = computed(() => {
  if (!newProjectName.value.trim()) return true
  return newProjectAddCategory.value ? !newProjectCategoryName.value.trim() : !newProjectCategoryId.value
})

async function saveNewProject() {
  if (newProjectInvalid.value || newProjectSaving.value) return
  newProjectSaving.value = true
  newProjectError.value = null
  try {
    let categoryId = newProjectCategoryId.value
    if (newProjectAddCategory.value) {
      const created = await createCategory(newProjectCategoryName.value.trim())
      categories.value = [...categories.value, created]
      categoryId = created.id
    }
    if (!categoryId) return
    const created = await createProject({
      name: newProjectName.value.trim(),
      description: newProjectDescription.value.trim() || null,
      status: newProjectStatus.value,
      categoryId,
    })
    projects.value = [...projects.value, created]
    newProjectOpen.value = false
  } catch (e) {
    newProjectError.value = e instanceof Error ? e.message : 'Failed to create project'
  } finally {
    newProjectSaving.value = false
  }
}

// --- edit project dialog ---
const editProjectOpen = ref(false)
const editProjectId = ref<number | null>(null)
const editProjectName = ref('')
const editProjectDescription = ref('')
const editProjectStatus = ref<ProjectStatus>('IDEA')
const editProjectCategoryId = ref<number | null>(null)
const editProjectSaving = ref(false)
const editProjectError = ref<string | null>(null)

function openEditProject(id: number) {
  const p = projects.value.find((x) => x.id === id)
  if (!p) return
  editProjectOpen.value = true
  editProjectId.value = id
  editProjectName.value = p.name
  editProjectDescription.value = p.description ?? ''
  editProjectStatus.value = p.status
  editProjectCategoryId.value = p.categoryId
  editProjectError.value = null
}
function openEditActiveProject() {
  if (activeProjectId.value !== null) openEditProject(activeProjectId.value)
}
function closeEditProject() {
  editProjectOpen.value = false
}
const editProjectInvalid = computed(() => !editProjectName.value.trim() || !editProjectCategoryId.value)

async function saveEditProject() {
  if (editProjectInvalid.value || editProjectSaving.value || editProjectId.value === null) return
  editProjectSaving.value = true
  editProjectError.value = null
  try {
    const updated = await updateProject(editProjectId.value, {
      name: editProjectName.value.trim(),
      description: editProjectDescription.value.trim() || null,
      status: editProjectStatus.value,
      categoryId: editProjectCategoryId.value!,
    })
    const idx = projects.value.findIndex((p) => p.id === updated.id)
    if (idx !== -1) projects.value[idx] = updated
    editProjectOpen.value = false
  } catch (e) {
    editProjectError.value = e instanceof Error ? e.message : 'Failed to save project'
  } finally {
    editProjectSaving.value = false
  }
}

// --- delete project ---
async function removeProject(id: number) {
  if (!window.confirm('Delete this project and all its tasks? This cannot be undone.')) return
  try {
    await apiDeleteProject(id, true)
    projects.value = projects.value.filter((p) => p.id !== id)
    if (activeProjectId.value === id) backToList()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to delete project'
  }
}
function deleteActiveProject() {
  if (activeProjectId.value !== null) removeProject(activeProjectId.value)
}

// --- new task dialog ---
const newTaskOpen = ref(false)
const newTaskTitle = ref('')
const newTaskDescription = ref('')
const newTaskPriority = ref<TaskPriority | ''>('')
const newTaskColumn = ref<TaskStatus>('TODO')
const newTaskSaving = ref(false)
const newTaskError = ref<string | null>(null)

function openNewTask() {
  newTaskOpen.value = true
  newTaskTitle.value = ''
  newTaskDescription.value = ''
  newTaskPriority.value = ''
  newTaskColumn.value = 'TODO'
  newTaskError.value = null
}
function closeNewTask() {
  newTaskOpen.value = false
}
const newTaskInvalid = computed(() => !newTaskTitle.value.trim())

async function saveNewTask() {
  if (newTaskInvalid.value || newTaskSaving.value || activeProjectId.value === null) return
  newTaskSaving.value = true
  newTaskError.value = null
  try {
    const created = await createTask(activeProjectId.value, {
      title: newTaskTitle.value.trim(),
      description: newTaskDescription.value.trim() || null,
      status: newTaskColumn.value,
      priority: newTaskPriority.value || null,
      subtasks: [],
    })
    activeTasks.value = [...activeTasks.value, created]
    const pid = activeProjectId.value
    projects.value = projects.value.map((p) => (p.id === pid ? { ...p, taskCount: p.taskCount + 1 } : p))
    newTaskOpen.value = false
  } catch (e) {
    newTaskError.value = e instanceof Error ? e.message : 'Failed to create task'
  } finally {
    newTaskSaving.value = false
  }
}

// --- task detail dialog ---
interface SubtaskDraft {
  id: number | null
  title: string
  done: boolean
}

const taskDetailOpen = ref(false)
const taskDetailId = ref<number | null>(null)
const taskDetailTitle = ref('')
const taskDetailDescription = ref('')
const taskDetailPriority = ref<TaskPriority | ''>('')
const taskDetailColumn = ref<TaskStatus>('TODO')
const taskDetailSubtasks = ref<SubtaskDraft[]>([])
const newSubtaskText = ref('')
const taskDetailSaving = ref(false)
const taskDetailError = ref<string | null>(null)
let nextDraftSubtaskId = -1

function openTaskDetail(task: Task) {
  taskDetailOpen.value = true
  taskDetailId.value = task.id
  taskDetailTitle.value = task.title
  taskDetailDescription.value = task.description ?? ''
  taskDetailPriority.value = task.priority ?? ''
  taskDetailColumn.value = task.status
  taskDetailSubtasks.value = task.subtasks.map((s) => ({ ...s }))
  newSubtaskText.value = ''
  taskDetailError.value = null
}
function closeTaskDetail() {
  taskDetailOpen.value = false
}
const taskDetailInvalid = computed(() => !taskDetailTitle.value.trim())

function addSubtask() {
  const title = newSubtaskText.value.trim()
  if (!title) return
  taskDetailSubtasks.value = [...taskDetailSubtasks.value, { id: nextDraftSubtaskId--, title, done: false }]
  newSubtaskText.value = ''
}
function toggleSubtask(id: number | null) {
  taskDetailSubtasks.value = taskDetailSubtasks.value.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
}
function removeSubtask(id: number | null) {
  taskDetailSubtasks.value = taskDetailSubtasks.value.filter((s) => s.id !== id)
}

async function saveTaskDetail() {
  if (taskDetailInvalid.value || taskDetailSaving.value || taskDetailId.value === null) return
  taskDetailSaving.value = true
  taskDetailError.value = null
  try {
    const updated = await updateTask(taskDetailId.value, {
      title: taskDetailTitle.value.trim(),
      description: taskDetailDescription.value.trim() || null,
      status: taskDetailColumn.value,
      priority: taskDetailPriority.value || null,
      subtasks: taskDetailSubtasks.value.map((s) => ({ title: s.title, done: s.done })),
    })
    activeTasks.value = activeTasks.value.map((t) => (t.id === updated.id ? updated : t))
    taskDetailOpen.value = false
  } catch (e) {
    taskDetailError.value = e instanceof Error ? e.message : 'Failed to save task'
  } finally {
    taskDetailSaving.value = false
  }
}

async function deleteTaskDetail() {
  if (taskDetailId.value === null) return
  const id = taskDetailId.value
  try {
    await apiDeleteTask(id)
    activeTasks.value = activeTasks.value.filter((t) => t.id !== id)
    const pid = activeProjectId.value
    projects.value = projects.value.map((p) => (p.id === pid ? { ...p, taskCount: Math.max(0, p.taskCount - 1) } : p))
    taskDetailOpen.value = false
  } catch (e) {
    taskDetailError.value = e instanceof Error ? e.message : 'Failed to delete task'
  }
}

// --- kanban drag and drop ---
const draggingTaskId = ref<number | null>(null)

function onDragStart(taskId: number) {
  draggingTaskId.value = taskId
}
function onDragOver(e: DragEvent) {
  e.preventDefault()
}
async function onDrop(columnKey: TaskStatus, e: DragEvent) {
  e.preventDefault()
  const taskId = draggingTaskId.value
  draggingTaskId.value = null
  if (taskId === null) return
  const task = activeTasks.value.find((t) => t.id === taskId)
  if (!task || task.status === columnKey) return
  const previousStatus = task.status
  activeTasks.value = activeTasks.value.map((t) => (t.id === taskId ? { ...t, status: columnKey } : t))
  try {
    const updated = await updateTask(taskId, {
      title: task.title,
      description: task.description,
      status: columnKey,
      priority: task.priority,
      subtasks: task.subtasks.map((s) => ({ title: s.title, done: s.done })),
    })
    activeTasks.value = activeTasks.value.map((t) => (t.id === updated.id ? updated : t))
  } catch (e) {
    activeTasks.value = activeTasks.value.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
    loadError.value = e instanceof Error ? e.message : 'Failed to move task'
  }
}

function descriptionPreview(description: string | null): string {
  if (!description) return ''
  return description.length > 90 ? description.slice(0, 87) + '…' : description
}
function subtaskLabel(subtasks: { done: boolean }[]): string {
  const done = subtasks.filter((s) => s.done).length
  return `${done}/${subtasks.length} subtask${subtasks.length === 1 ? '' : 's'}`
}
</script>

<template>
  <div class="proj-wrap">
    <template v-if="view === 'list'">
      <p class="fin-kicker">Projects</p>
      <h1 class="fin-title">Projects</h1>

      <p v-if="loadError" class="upload-error">{{ loadError }}</p>

      <div class="proj-filters">
        <div class="field">
          <label for="proj-search">Search</label>
          <input id="proj-search" class="input" v-model="search" placeholder="Search by name…" />
        </div>
        <div class="field">
          <label for="proj-status">Status</label>
          <select id="proj-status" class="input" v-model="statusFilter">
            <option value="">All statuses</option>
            <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="proj-category">Category</label>
          <select id="proj-category" class="input" v-model.number="categoryFilter">
            <option value="">All categories</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <span class="proj-count">{{ filteredProjects.length }} project{{ filteredProjects.length === 1 ? '' : 's' }}</span>
        <button class="btn btn-primary" @click="openNewProject">+ New project</button>
      </div>

      <p v-if="loading" style="color: var(--color-neutral-500)">Loading…</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th class="proj-sortable" @click="toggleSort('name')">Name {{ sortIcon('name') }}</th>
            <th class="proj-sortable" @click="toggleSort('status')">Status {{ sortIcon('status') }}</th>
            <th class="proj-sortable" @click="toggleSort('category')">Category {{ sortIcon('category') }}</th>
            <th>Tasks</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProjects" :key="p.id" class="proj-row" @click="openBoard(p.id)">
            <td>{{ p.name }}</td>
            <td><span class="tag" :class="TAG_CLASS[p.status]">{{ STATUS_LABEL[p.status] }}</span></td>
            <td><span class="tag tag-outline">{{ p.categoryName }}</span></td>
            <td class="proj-task-summary">{{ taskSummary(p) }}</td>
            <td class="proj-row-actions">
              <button class="btn btn-ghost btn-icon" aria-label="Edit project" title="Edit" @click.stop="openEditProject(p.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
              </button>
              <button class="btn btn-ghost btn-icon" aria-label="Delete project" title="Delete" @click.stop="removeProject(p.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!loading && filteredProjects.length === 0" class="proj-empty">No projects match your search or filter.</p>
    </template>

    <template v-else-if="view === 'board' && activeProject">
      <button class="btn btn-ghost proj-back" @click="backToList">← Projects</button>
      <p class="fin-kicker">Projects — Board</p>
      <div class="proj-board-head">
        <div>
          <h1 class="fin-title proj-board-title">{{ activeProject.name }}</h1>
          <span class="tag" :class="TAG_CLASS[activeProject.status]">{{ STATUS_LABEL[activeProject.status] }}</span>
          <span class="tag tag-outline">{{ activeProject.categoryName }}</span>
        </div>
        <div class="proj-board-actions">
          <button class="btn btn-secondary" @click="openEditActiveProject">Edit project</button>
          <button class="btn btn-secondary" @click="deleteActiveProject">Delete project</button>
          <button
            class="btn btn-primary"
            :disabled="!canAddTasks"
            :title="canAddTasks ? '' : 'Tasks can only be added while the project is Idea or In Progress'"
            @click="openNewTask"
          >
            + New task
          </button>
        </div>
      </div>

      <p v-if="tasksLoading" style="color: var(--color-neutral-500)">Loading tasks…</p>
      <div v-else class="proj-board">
        <div
          v-for="col in board"
          :key="col.key"
          class="proj-col"
          @dragover="onDragOver"
          @drop="onDrop(col.key, $event)"
        >
          <div class="proj-col-head">
            <span class="proj-col-label">{{ col.label }}</span>
            <span class="proj-col-count">{{ col.tasks.length }}</span>
          </div>
          <div class="proj-col-body">
            <div
              v-for="t in col.tasks"
              :key="t.id"
              class="card elev-sm proj-task-card"
              draggable="true"
              @dragstart="onDragStart(t.id)"
              @click="openTaskDetail(t)"
            >
              <div class="card-title proj-task-title">{{ t.title }}</div>
              <div v-if="t.description" class="card-body proj-task-desc">{{ descriptionPreview(t.description) }}</div>
              <span v-if="t.priority" class="tag tag-outline proj-task-priority">{{ t.priority }}</span>
              <div v-if="t.subtasks.length" class="proj-task-subtasks">☑ {{ subtaskLabel(t.subtasks) }}</div>
            </div>
            <div v-if="col.tasks.length === 0" class="proj-col-empty">Drop tasks here</div>
          </div>
        </div>
      </div>
    </template>

    <!-- new project dialog -->
    <div v-if="newProjectOpen" class="dialog-backdrop" @click="closeNewProject">
      <div class="dialog" @click.stop>
        <div class="dialog-title">New project</div>
        <div class="dialog-body proj-dialog-body">
          <div class="field">
            <label for="np-name">Name</label>
            <input id="np-name" class="input" v-model="newProjectName" placeholder="Project name" />
          </div>
          <div class="field">
            <label for="np-desc">Description</label>
            <textarea id="np-desc" class="input" rows="3" v-model="newProjectDescription" placeholder="Optional description…"></textarea>
          </div>
          <div class="field">
            <label for="np-status">Status</label>
            <select id="np-status" class="input" v-model="newProjectStatus">
              <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
          </div>
          <div class="field">
            <label>Category</label>
            <select v-if="!newProjectAddCategory" class="input" v-model.number="newProjectCategoryId">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <input v-else class="input" v-model="newProjectCategoryName" placeholder="New category name" />
            <button class="proj-link-btn" @click="newProjectAddCategory = !newProjectAddCategory">
              {{ newProjectAddCategory ? '← Choose existing category' : '+ New category' }}
            </button>
          </div>
        </div>
        <p v-if="newProjectError" class="upload-error">{{ newProjectError }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="closeNewProject">Cancel</button>
          <button class="btn btn-primary" :disabled="newProjectInvalid || newProjectSaving" @click="saveNewProject">
            {{ newProjectSaving ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- edit project dialog -->
    <div v-if="editProjectOpen" class="dialog-backdrop" @click="closeEditProject">
      <div class="dialog" @click.stop>
        <div class="dialog-title">Edit project</div>
        <div class="dialog-body proj-dialog-body">
          <div class="field">
            <label for="ep-name">Name</label>
            <input id="ep-name" class="input" v-model="editProjectName" />
          </div>
          <div class="field">
            <label for="ep-desc">Description</label>
            <textarea id="ep-desc" class="input" rows="3" v-model="editProjectDescription" placeholder="Optional description…"></textarea>
          </div>
          <div class="field">
            <label for="ep-status">Status</label>
            <select id="ep-status" class="input" v-model="editProjectStatus">
              <option v-for="s in STATUSES" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
          </div>
          <div class="field">
            <label for="ep-category">Category</label>
            <select id="ep-category" class="input" v-model.number="editProjectCategoryId">
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <p v-if="editProjectError" class="upload-error">{{ editProjectError }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="closeEditProject">Cancel</button>
          <button class="btn btn-primary" :disabled="editProjectInvalid || editProjectSaving" @click="saveEditProject">
            {{ editProjectSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- new task dialog -->
    <div v-if="newTaskOpen" class="dialog-backdrop" @click="closeNewTask">
      <div class="dialog" @click.stop>
        <div class="dialog-title">New task</div>
        <div class="dialog-body proj-dialog-body">
          <div class="field">
            <label for="nt-title">Title</label>
            <input id="nt-title" class="input" v-model="newTaskTitle" placeholder="Task title" />
          </div>
          <div class="field">
            <label for="nt-desc">Description</label>
            <textarea id="nt-desc" class="input" rows="3" v-model="newTaskDescription" placeholder="Optional description…"></textarea>
          </div>
          <div class="field">
            <label for="nt-priority">Priority</label>
            <select id="nt-priority" class="input" v-model="newTaskPriority">
              <option v-for="p in PRIORITIES" :key="p.key" :value="p.key">{{ p.label }}</option>
            </select>
          </div>
          <div class="field">
            <label for="nt-column">Column</label>
            <select id="nt-column" class="input" v-model="newTaskColumn">
              <option v-for="c in COLUMNS" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </div>
        </div>
        <p v-if="newTaskError" class="upload-error">{{ newTaskError }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" @click="closeNewTask">Cancel</button>
          <button class="btn btn-primary" :disabled="newTaskInvalid || newTaskSaving" @click="saveNewTask">
            {{ newTaskSaving ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- task detail dialog -->
    <div v-if="taskDetailOpen" class="dialog-backdrop" @click="closeTaskDetail">
      <div class="dialog" @click.stop>
        <div class="dialog-title">Task details</div>
        <div class="dialog-body proj-dialog-body">
          <div class="field">
            <label for="td-title">Title</label>
            <input id="td-title" class="input" v-model="taskDetailTitle" />
          </div>
          <div class="field">
            <label for="td-desc">Description</label>
            <textarea id="td-desc" class="input" rows="4" v-model="taskDetailDescription" placeholder="Optional description…"></textarea>
          </div>
          <div class="field">
            <label for="td-priority">Priority</label>
            <select id="td-priority" class="input" v-model="taskDetailPriority">
              <option v-for="p in PRIORITIES" :key="p.key" :value="p.key">{{ p.label }}</option>
            </select>
          </div>
          <div class="field">
            <label for="td-column">Column</label>
            <select id="td-column" class="input" v-model="taskDetailColumn">
              <option v-for="c in COLUMNS" :key="c.key" :value="c.key">{{ c.label }}</option>
            </select>
          </div>
          <div class="field">
            <label>Subtasks</label>
            <div class="proj-subtasks">
              <div v-for="st in taskDetailSubtasks" :key="st.id ?? st.title" class="proj-subtask-row">
                <input type="checkbox" :checked="st.done" @change="toggleSubtask(st.id)" />
                <span class="proj-subtask-text" :class="{ done: st.done }">{{ st.title }}</span>
                <button class="proj-subtask-remove" aria-label="Remove subtask" title="Remove" @click="removeSubtask(st.id)">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
                </button>
              </div>
              <div class="proj-subtask-add">
                <input class="input" v-model="newSubtaskText" placeholder="Add a subtask…" @keydown.enter="addSubtask" />
                <button class="btn btn-secondary" @click="addSubtask">Add</button>
              </div>
            </div>
          </div>
        </div>
        <p v-if="taskDetailError" class="upload-error">{{ taskDetailError }}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost proj-delete-btn" @click="deleteTaskDetail">Delete</button>
          <button class="btn btn-ghost" @click="closeTaskDetail">Cancel</button>
          <button class="btn btn-primary" :disabled="taskDetailInvalid || taskDetailSaving" @click="saveTaskDetail">
            {{ taskDetailSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fin-kicker { font-family: var(--font-body); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--color-accent-700); margin: 0 0 var(--space-2); }
.fin-title { font-family: var(--font-heading); font-weight: 400; font-size: clamp(28px, 3.4vw, 44px); margin: 0 0 var(--space-6); }
.proj-wrap { max-width: 1180px; margin: 0 auto; padding: var(--space-8) var(--space-6) var(--space-9); }

.proj-filters { display: flex; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
.proj-filters .field:first-child { width: 260px; }
.proj-filters .field:nth-child(2) { width: 180px; }
.proj-filters .field:nth-child(3) { width: 180px; }
.proj-count { margin-left: auto; font-size: 13px; color: var(--color-neutral-500); padding-bottom: 8px; }

.proj-sortable { cursor: pointer; user-select: none; }
.proj-row { cursor: pointer; }
.proj-task-summary { color: var(--color-neutral-600); font-size: 13px; }
.proj-row-actions { text-align: right; white-space: nowrap; }
.proj-empty { font-style: italic; color: var(--color-neutral-500); padding: var(--space-4) 0; }

.proj-back { padding-inline: 0; margin-bottom: var(--space-4); }
.proj-board-head { display: flex; justify-content: space-between; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-6); flex-wrap: wrap; }
.proj-board-title { font-size: clamp(28px, 3.4vw, 40px); margin-bottom: var(--space-2); }
.proj-board-head .tag + .tag { margin-left: var(--space-2); }
.proj-board-actions { display: flex; gap: var(--space-2); }

.proj-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); align-items: start; }
.proj-col { display: flex; flex-direction: column; gap: var(--space-3); background: var(--color-surface); padding: var(--space-3); border-radius: var(--radius-lg); min-height: 200px; }
.proj-col-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-divider); }
.proj-col-label { font-family: var(--font-heading); font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-neutral-700); }
.proj-col-count { font-size: 12px; color: var(--color-neutral-500); }
.proj-col-body { display: flex; flex-direction: column; gap: var(--space-3); }
.proj-col-empty { font-size: 12px; color: var(--color-neutral-500); font-style: italic; padding: var(--space-2) 0; }

.proj-task-card { cursor: grab; background: var(--color-bg); }
.proj-task-title { font-size: 14px; }
.proj-task-desc { font-size: 12px; color: var(--color-neutral-600); margin-top: 4px; }
.proj-task-priority { align-self: flex-start; margin-top: 2px; }
.proj-task-subtasks { font-size: 11px; color: var(--color-neutral-500); margin-top: 6px; }

.proj-dialog-body { display: flex; flex-direction: column; gap: var(--space-3); }
.proj-link-btn { align-self: flex-start; margin-top: var(--space-1); background: none; border: none; padding: 0; font-size: 12px; color: var(--color-accent-700); cursor: pointer; }
.proj-link-btn:hover { text-decoration: underline; }

.proj-subtasks { display: flex; flex-direction: column; gap: var(--space-2); }
.proj-subtask-row { display: flex; align-items: center; gap: var(--space-2); }
.proj-subtask-text { flex: 1; font-size: 13px; }
.proj-subtask-text.done { text-decoration: line-through; color: var(--color-neutral-500); }
.proj-subtask-remove { background: none; border: none; color: var(--color-neutral-500); cursor: pointer; padding: 0 var(--space-1); display: flex; }
.proj-subtask-remove:hover { color: var(--color-accent-2-700); }
.proj-subtask-add { display: flex; gap: var(--space-2); }
.proj-subtask-add .input { flex: 1; }

.proj-delete-btn { color: var(--color-accent-2-700); margin-right: auto; }
.upload-error { font-size: 13px; color: var(--color-accent-2-700); }
</style>
