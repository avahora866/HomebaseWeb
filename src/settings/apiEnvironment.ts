export type ApiEnvironment = 'local' | 'production'

const STORAGE_KEY_ENV = 'homebase.apiEnvironment'
const STORAGE_KEY_PROD_URL = 'homebase.productionApiUrl'

export const LOCAL_API_URL = 'http://localhost:8080'

export function getApiEnvironment(): ApiEnvironment {
  return localStorage.getItem(STORAGE_KEY_ENV) === 'production' ? 'production' : 'local'
}

export function setApiEnvironment(env: ApiEnvironment): void {
  localStorage.setItem(STORAGE_KEY_ENV, env)
}

export function getProductionApiUrl(): string {
  return localStorage.getItem(STORAGE_KEY_PROD_URL) ?? ''
}

export function setProductionApiUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY_PROD_URL, url.trim().replace(/\/$/, ''))
}

/**
 * The base URL currently in effect for API calls. Falls back to local if "production" is
 * selected but no production URL has been saved yet — read fresh on every call so a Settings
 * change takes effect immediately for the next request, without needing a page reload.
 */
export function resolveApiBaseUrl(): string {
  if (getApiEnvironment() === 'production') {
    const prodUrl = getProductionApiUrl()
    if (prodUrl) return prodUrl
  }
  return LOCAL_API_URL
}
