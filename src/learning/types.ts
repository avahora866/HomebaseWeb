import type { ProjectStatus } from '../projects/types'

export interface FieldCapabilities {
  allowsPrerequisites: boolean
  allowsSuggestedOrder: boolean
  allowsLogs: boolean
  allowsProjectLinks: boolean
  /** null = unlimited, 0 = flat (topics can't have subtopics), n = n levels below a top-level topic */
  maxNestingDepth: number | null
}

export interface SpecialisationSummary {
  id: number
  name: string
  basic: boolean
  /** Decimal average of the top-level topics; null = nothing rated yet */
  rollupRating: number | null
  ratedLeafCount: number
  leafCount: number
}

export interface LearningField {
  id: number
  name: string
  capabilities: FieldCapabilities
  specialisations: SpecialisationSummary[]
}

export interface FieldInput {
  name: string
  capabilities: FieldCapabilities
}

export interface ProjectLink {
  id: number
  projectId: number
  projectName: string
  projectStatus: ProjectStatus
}

export interface TopicLog {
  id: number
  createdAt: string
  note: string
}

export interface Topic {
  id: number
  parentTopicId: number | null
  name: string
  suggestedOrder: number | null
  /** Stored 1–5 rating — only ever set on a leaf */
  confidenceRating: number | null
  /** What to display: a leaf's own rating or the decimal average derived from its subtopics */
  effectiveRating: number | null
  /** Has subtopics, so the rating is read-only */
  derived: boolean
  depth: number
  prerequisiteIds: number[]
  /** Newest first */
  logs: TopicLog[]
  projectLinks: ProjectLink[]
  createdAt: string
}

export interface TopicInput {
  name: string
  parentTopicId: number | null
  suggestedOrder: number | null
  confidenceRating: number | null
}

export interface SpecialisationDetail {
  id: number
  fieldId: number
  fieldName: string
  name: string
  basic: boolean
  capabilities: FieldCapabilities
  rollupRating: number | null
  ratedLeafCount: number
  leafCount: number
  /** Depth-first, siblings in display order */
  topics: Topic[]
  /** Links on the specialisation itself — topic links are on each topic */
  projectLinks: ProjectLink[]
}
