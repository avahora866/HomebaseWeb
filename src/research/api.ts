import { resolveApiBaseUrl } from '../settings/apiEnvironment'
import type { ResearchShortlist } from './types'

export async function getResearchShortlist(): Promise<ResearchShortlist> {
  const response = await fetch(`${resolveApiBaseUrl()}/research/shortlist`)
  if (!response.ok) {
    throw new Error(`Request to /research/shortlist failed: ${response.status}`)
  }
  return (await response.json()) as ResearchShortlist
}
