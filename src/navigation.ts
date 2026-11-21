import type { InjectionKey } from 'vue'

/**
 * Opens a project-tracker project's board from elsewhere in the app. [from] names where the user
 * came from (e.g. a Learning Path topic) — the board's back button returns there instead of to
 * the project list.
 */
export type OpenProject = (projectId: number, from: string) => void

export const openProjectKey: InjectionKey<OpenProject> = Symbol('openProject')
