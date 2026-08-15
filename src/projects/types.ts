export type ProjectStatus = 'IDEA' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface Category {
  id: number
  name: string
}

export interface Project {
  id: number
  name: string
  description: string | null
  status: ProjectStatus
  categoryId: number
  categoryName: string
  taskCount: number
  createdAt: string
  updatedAt: string
}

export interface ProjectInput {
  name: string
  description: string | null
  status: ProjectStatus
  categoryId: number
}

export interface Subtask {
  id: number
  title: string
  done: boolean
}

export interface SubtaskInput {
  title: string
  done: boolean
}

export interface Task {
  id: number
  projectId: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority | null
  subtasks: Subtask[]
  createdAt: string
  updatedAt: string
}

export interface TaskInput {
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority | null
  subtasks: SubtaskInput[]
}
