import type { ProjectStatus } from './types'

export const STATUSES: { key: ProjectStatus; label: string }[] = [
  { key: 'IDEA', label: 'Idea' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'PAUSED', label: 'Paused' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ARCHIVED', label: 'Archived' },
]
export const STATUS_LABEL: Record<ProjectStatus, string> = Object.fromEntries(
  STATUSES.map((s) => [s.key, s.label]),
) as Record<ProjectStatus, string>
export const TAG_CLASS: Record<ProjectStatus, string> = {
  IDEA: 'tag-neutral',
  IN_PROGRESS: 'tag-accent',
  PAUSED: 'tag-outline',
  COMPLETED: 'tag-accent-2',
  ARCHIVED: 'tag-neutral',
}
