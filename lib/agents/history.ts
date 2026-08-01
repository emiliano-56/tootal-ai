'use client'

import { supabase } from '@/lib/db'
import type { AgentId } from './types'

/**
 * Persistence for agent runs.
 *
 * Every agent writes one row to `agent_jobs`, which gives a single unified
 * history across all of them. Agents whose output needs querying later
 * (landing pages, marketing copy) additionally write to their own table.
 */

export interface AgentRun<T = any> {
  id: string
  agent: AgentId
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  progress: number
  current_step: string | null
  input: Record<string, any>
  output: T | null
  error: string | null
  credits_used: number
  created_at: string
}

/** Human label shown in the history list. */
export const AGENT_LABELS: Record<string, string> = {
  story_to_comic: 'Story-to-Comic',
  comic_to_video: 'Comic-to-Video',
  cover_designer: 'Cover Designer',
  landing_page: 'Landing Page',
  marketing_content: 'Marketing Kit',
  prompt_enhancer: 'Prompt Enhancer',
  business_agent: 'Business Agent',
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Records a finished agent run.
 *
 * Persistence must never break the feature that called it, so failures are
 * logged and swallowed — the user still has their generated result on screen.
 */
export async function saveAgentRun(params: {
  agent: AgentId
  input: unknown
  output: unknown
  title?: string
  status?: 'succeeded' | 'failed'
  error?: string
  creditsUsed?: number
}): Promise<string | null> {
  try {
    const userId = await currentUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('agent_jobs')
      .insert({
        user_id: userId,
        agent: params.agent,
        status: params.status ?? 'succeeded',
        progress: params.status === 'failed' ? 0 : 100,
        current_step: params.title ?? null,
        input: params.input ?? {},
        output: params.output ?? null,
        error: params.error ?? null,
        credits_used: params.creditsUsed ?? 0,
      })
      .select('id')
      .single()

    if (error) throw error
    return data?.id ?? null
  } catch (err) {
    console.error('[history] could not save agent run:', err)
    return null
  }
}

/** Lists the most recent runs for the signed-in user. */
export async function listAgentRuns(limit = 60): Promise<AgentRun[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('agent_jobs')
    .select('id, agent, status, progress, current_step, input, output, error, credits_used, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as AgentRun[]
}

export async function deleteAgentRun(id: string): Promise<void> {
  const { error } = await supabase.from('agent_jobs').delete().eq('id', id)
  if (error) throw error
}

/** Turns a title into a URL-safe, collision-resistant slug. */
function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return `${base || 'page'}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Saves a generated landing page so it can be reopened, edited and published.
 * `slug` is unique in the schema, hence the random suffix.
 */
export async function saveLandingPage(params: {
  title: string
  config: unknown
  html: string
}): Promise<string | null> {
  try {
    const userId = await currentUserId()
    if (!userId) return null

    const { data, error } = await supabase
      .from('landing_pages')
      .insert({
        user_id: userId,
        title: params.title,
        slug: slugify(params.title),
        config: params.config ?? {},
        html: params.html,
        published: false,
      })
      .select('id')
      .single()

    if (error) throw error
    return data?.id ?? null
  } catch (err) {
    console.error('[history] could not save landing page:', err)
    return null
  }
}

/** Saves individual marketing pieces so they can be searched by kind later. */
export async function saveMarketingAssets(
  assets: { kind: string; title?: string; content: string; meta?: unknown }[]
): Promise<void> {
  try {
    const userId = await currentUserId()
    if (!userId || assets.length === 0) return

    const rows = assets
      .filter((a) => a.content?.trim())
      .map((a) => ({
        user_id: userId,
        kind: a.kind,
        title: a.title ?? null,
        content: a.content,
        meta: a.meta ?? {},
      }))

    if (rows.length === 0) return

    const { error } = await supabase.from('marketing_assets').insert(rows)
    if (error) throw error
  } catch (err) {
    console.error('[history] could not save marketing assets:', err)
  }
}
