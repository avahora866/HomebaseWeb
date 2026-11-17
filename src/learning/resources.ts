import type { LearningResource, ResourceStatus, ResourceType } from './types'

export const RESOURCE_TYPES: { key: ResourceType; label: string }[] = [
  { key: 'COURSE', label: 'Course' },
  { key: 'BOOK', label: 'Book' },
  { key: 'VIDEO', label: 'Video' },
  { key: 'ARTICLE', label: 'Article' },
  { key: 'OTHER', label: 'Other' },
]

export const RESOURCE_STATUSES: { key: ResourceStatus; label: string }[] = [
  { key: 'PLANNED', label: 'Planned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'DROPPED', label: 'Dropped' },
]

export const RESOURCE_TYPE_LABEL = Object.fromEntries(RESOURCE_TYPES.map((t) => [t.key, t.label])) as Record<
  ResourceType,
  string
>
export const RESOURCE_STATUS_LABEL = Object.fromEntries(RESOURCE_STATUSES.map((s) => [s.key, s.label])) as Record<
  ResourceStatus,
  string
>
export const RESOURCE_STATUS_TAG: Record<ResourceStatus, string> = {
  PLANNED: 'tag-neutral',
  IN_PROGRESS: 'tag-accent',
  COMPLETED: 'tag-accent-2',
  DROPPED: 'tag-neutral',
}

/** "4 of 12", or null when the resource has no progress set. */
export function progressLabel(r: LearningResource): string | null {
  return r.progressCurrent !== null && r.progressTotal !== null ? `${r.progressCurrent} of ${r.progressTotal}` : null
}

export function progressPercent(r: LearningResource): number {
  if (r.progressCurrent === null || !r.progressTotal) return 0
  return Math.round((r.progressCurrent / r.progressTotal) * 100)
}
