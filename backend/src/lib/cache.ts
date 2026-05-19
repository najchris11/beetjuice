interface Entry<T> {
  value: T
  expiresAt: number
}

class TtlCache {
  private store = new Map<string, Entry<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  invalidate(...keys: string[]): void {
    for (const key of keys) this.store.delete(key)
  }
}

export const cache = new TtlCache()
export const ALBUMS_TTL = 5 * 60 * 1000   // 5 min
export const DUPES_TTL  = 5 * 60 * 1000
