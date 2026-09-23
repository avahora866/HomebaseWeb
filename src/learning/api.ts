import { resolveApiBaseUrl } from '../settings/apiEnvironment'
import type { FieldInput, LearningField, SpecialisationDetail, TopicInput } from './types'

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

export function getFields(): Promise<LearningField[]> {
  return getJson('/learning/fields')
}

export function createField(field: FieldInput): Promise<LearningField> {
  return sendJson('/learning/fields', 'POST', field)
}

export function updateField(id: number, field: FieldInput): Promise<LearningField> {
  return sendJson(`/learning/fields/${id}`, 'PUT', field)
}

export function deleteField(id: number): Promise<void> {
  return sendJson(`/learning/fields/${id}`, 'DELETE')
}

export function createSpecialisation(fieldId: number, name: string): Promise<SpecialisationDetail> {
  return sendJson(`/learning/fields/${fieldId}/specialisations`, 'POST', { name })
}

export function getSpecialisation(id: number): Promise<SpecialisationDetail> {
  return getJson(`/learning/specialisations/${id}`)
}

export function renameSpecialisation(id: number, name: string): Promise<SpecialisationDetail> {
  return sendJson(`/learning/specialisations/${id}`, 'PUT', { name })
}

export function deleteSpecialisation(id: number): Promise<void> {
  return sendJson(`/learning/specialisations/${id}`, 'DELETE')
}

// Every topic-level write returns the whole refreshed specialisation — one rating change moves
// every derived rating above it.

export function createTopic(specialisationId: number, topic: TopicInput): Promise<SpecialisationDetail> {
  return sendJson(`/learning/specialisations/${specialisationId}/topics`, 'POST', topic)
}

export function updateTopic(id: number, topic: TopicInput): Promise<SpecialisationDetail> {
  return sendJson(`/learning/topics/${id}`, 'PUT', topic)
}

export function deleteTopic(id: number): Promise<SpecialisationDetail> {
  return sendJson(`/learning/topics/${id}`, 'DELETE')
}

export function addPrerequisite(topicId: number, requiresTopicId: number): Promise<SpecialisationDetail> {
  return sendJson(`/learning/topics/${topicId}/prerequisites`, 'POST', { requiresTopicId })
}

export function removePrerequisite(topicId: number, requiresTopicId: number): Promise<SpecialisationDetail> {
  return sendJson(`/learning/topics/${topicId}/prerequisites/${requiresTopicId}`, 'DELETE')
}

export function addLog(topicId: number, note: string): Promise<SpecialisationDetail> {
  return sendJson(`/learning/topics/${topicId}/logs`, 'POST', { note })
}

export function deleteLog(topicId: number, logId: number): Promise<SpecialisationDetail> {
  return sendJson(`/learning/topics/${topicId}/logs/${logId}`, 'DELETE')
}

export function linkProject(
  projectId: number,
  target: { topicId: number } | { specialisationId: number },
): Promise<SpecialisationDetail> {
  return sendJson('/learning/project-links', 'POST', { projectId, topicId: null, specialisationId: null, ...target })
}

export function unlinkProject(id: number): Promise<SpecialisationDetail> {
  return sendJson(`/learning/project-links/${id}`, 'DELETE')
}
