/**
 * Shared contract for every AI agent in the platform.
 *
 * Agents are long-running and multi-step, so a run is persisted as a row in
 * `agent_jobs`. The UI polls that row instead of holding an open request, which
 * means a refresh or a closed tab never loses work.
 */

export type AgentId =
  | 'story_to_comic'
  | 'comic_to_video'
  | 'cover_designer'
  | 'landing_page'
  | 'marketing_content'
  | 'prompt_enhancer'
  | 'business_agent'

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface AgentJob<TInput = unknown, TOutput = unknown> {
  id: string
  user_id: string
  project_id: string | null
  agent: AgentId
  status: JobStatus
  progress: number
  current_step: string | null
  total_steps: number
  input: TInput
  output: TOutput | null
  error: string | null  created_at: string
  updated_at: string
}

export interface AgentStep {
  key: string
  label: string
}

export interface AgentDefinition {
  id: AgentId
  name: string
  description: string
  /** Ordered steps, used to render progress and compute percentages. */
  steps: AgentStep[]
  /** Credit cost; a function when it depends on the input (e.g. page count). */
  cost: number | ((input: Record<string, unknown>) => number)
  /** false while an agent is still being built, so the UI can mark it clearly. */
  available: boolean
}

/** Percentage complete based on which step is currently running. */
export function progressForStep(definition: AgentDefinition, stepKey: string): number {
  const index = definition.steps.findIndex((s) => s.key === stepKey)
  if (index === -1) return 0
  return Math.round(((index + 1) / definition.steps.length) * 100)
}

export function costOf(
  definition: AgentDefinition,
  input: Record<string, unknown> = {}
): number {
  return typeof definition.cost === 'function' ? definition.cost(input) : definition.cost
}
