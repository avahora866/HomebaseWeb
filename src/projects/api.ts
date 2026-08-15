import { resolveApiBaseUrl } from '../settings/apiEnvironment'
import type { Category, Project, ProjectInput, Task, TaskInput } from './types'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`)
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

async function sendJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.message ?? detail?.detail ?? `Request to ${path} failed: ${response.status}`)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

export function getProjects(): Promise<Project[]> {
  return getJson('/projects')
}

export function createProject(project: ProjectInput): Promise<Project> {
  return sendJson('/projects', 'POST', project)
}

export function updateProject(id: number, project: ProjectInput): Promise<Project> {
  return sendJson(`/projects/${id}`, 'PUT', project)
}

export function deleteProject(id: number, confirm: boolean): Promise<void> {
  return sendJson(`/projects/${id}?confirm=${confirm}`, 'DELETE')
}

export function getProjectTasks(projectId: number): Promise<Task[]> {
  return getJson(`/projects/${projectId}/tasks`)
}

export function createTask(projectId: number, task: TaskInput): Promise<Task> {
  return sendJson(`/projects/${projectId}/tasks`, 'POST', task)
}

export function updateTask(id: number, task: TaskInput): Promise<Task> {
  return sendJson(`/tasks/${id}`, 'PUT', task)
}

export function deleteTask(id: number): Promise<void> {
  return sendJson(`/tasks/${id}`, 'DELETE')
}

export function getCategories(): Promise<Category[]> {
  return getJson('/categories')
}

export function createCategory(name: string): Promise<Category> {
  return sendJson('/categories', 'POST', { name })
}
