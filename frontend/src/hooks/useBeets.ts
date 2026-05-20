import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Album, AlbumSummary, Item, DuplicateGroup, Stats } from '../types/beets.ts'
import type { MatchResult, ExportRequest, ExportResult } from '../types/playlists.ts'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `${options?.method ?? 'GET'} ${path} → ${res.status}`
    try {
      const parsed = JSON.parse(body)
      if (parsed.error) message = parsed.error
    } catch { /* use default message */ }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function useAlbums() {
  return useQuery<AlbumSummary[]>({
    queryKey: ['albums'],
    queryFn: () => apiFetch('/api/albums'),
  })
}

export function useAlbum(id: number) {
  return useQuery<Album>({
    queryKey: ['albums', id],
    queryFn: () => apiFetch(`/api/albums/${id}`),
  })
}

export function useAlbumItems(id: number) {
  return useQuery<Item[]>({
    queryKey: ['albums', id, 'items'],
    queryFn: () => apiFetch(`/api/albums/${id}/items`),
  })
}

export function useDuplicates() {
  return useQuery<DuplicateGroup[]>({
    queryKey: ['duplicates'],
    queryFn: () => apiFetch('/api/duplicates'),
  })
}

export function useStats() {
  return useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => apiFetch('/api/stats'),
  })
}

export function useDeleteAlbum() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean; filesDeleted: boolean }>(`/api/albums/${id}`, { method: 'DELETE' }),
    onMutate: async (deletedId) => {
      // Cancel pending queries
      await qc.cancelQueries({ queryKey: ['albums'] })
      await qc.cancelQueries({ queryKey: ['duplicates'] })

      // Snapshot current state for rollback
      const prevAlbums = qc.getQueryData<AlbumSummary[]>(['albums'])
      const prevDuplicates = qc.getQueryData<DuplicateGroup[]>(['duplicates'])

      // Optimistic update: remove the album from the cache
      if (prevAlbums) {
        qc.setQueryData<AlbumSummary[]>(['albums'], prevAlbums.filter(a => a.id !== deletedId))
      }

      // Optimistic update: remove album from duplicate groups
      if (prevDuplicates) {
        qc.setQueryData<DuplicateGroup[]>(['duplicates'],
          prevDuplicates
            .map(g => ({
              ...g,
              copies: g.copies.filter(c => c.id !== deletedId),
            }))
            .filter(g => g.copies.length >= 2)
        )
      }

      return { prevAlbums, prevDuplicates }
    },
    onError: (_err, _id, context) => {
      // Roll back on failure
      if (context?.prevAlbums) {
        qc.setQueryData(['albums'], context.prevAlbums)
      }
      if (context?.prevDuplicates) {
        qc.setQueryData(['duplicates'], context.prevDuplicates)
      }
    },
    onSettled: () => {
      // Always refetch to get the true state
      qc.invalidateQueries({ queryKey: ['albums'] })
      qc.invalidateQueries({ queryKey: ['duplicates'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useBulkDeleteAlbums() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const BATCH = 10
      const results: { ok: boolean; filesDeleted: boolean }[] = []
      let failed = 0
      for (let i = 0; i < ids.length; i += BATCH) {
        const settled = await Promise.allSettled(
          ids.slice(i, i + BATCH).map(id =>
            apiFetch<{ ok: boolean; filesDeleted: boolean }>(`/api/albums/${id}`, { method: 'DELETE' })
          )
        )
        for (const r of settled) {
          if (r.status === 'fulfilled') results.push(r.value)
          else failed++
        }
      }
      if (failed > 0) throw new Error(`${failed} of ${ids.length} deletions failed`)
      return results
    },
    onMutate: async (deletedIds) => {
      await qc.cancelQueries({ queryKey: ['albums'] })
      await qc.cancelQueries({ queryKey: ['duplicates'] })
      const prevAlbums = qc.getQueryData<AlbumSummary[]>(['albums'])
      const prevDuplicates = qc.getQueryData<DuplicateGroup[]>(['duplicates'])
      const idSet = new Set(deletedIds)
      if (prevAlbums) {
        qc.setQueryData<AlbumSummary[]>(['albums'], prevAlbums.filter(a => !idSet.has(a.id)))
      }
      if (prevDuplicates) {
        qc.setQueryData<DuplicateGroup[]>(['duplicates'],
          prevDuplicates
            .map(g => ({ ...g, copies: g.copies.filter(c => !idSet.has(c.id)) }))
            .filter(g => g.copies.length >= 2)
        )
      }
      return { prevAlbums, prevDuplicates }
    },
    onError: (_err, _ids, context) => {
      if (context?.prevAlbums) qc.setQueryData(['albums'], context.prevAlbums)
      if (context?.prevDuplicates) qc.setQueryData(['duplicates'], context.prevDuplicates)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['albums'] })
      qc.invalidateQueries({ queryKey: ['duplicates'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useImportPlaylist() {
  return useMutation({
    mutationFn: async (input: File | { filePath: string }) => {
      if (input instanceof File) {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target?.result as string)
          reader.onerror = reject
          reader.readAsText(input, 'utf-8')
        })
        return apiFetch<MatchResult[]>('/api/playlists/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename: input.name }),
        })
      }
      return apiFetch<MatchResult[]>('/api/playlists/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: input.filePath }),
      })
    },
  })
}

export function useExportPlaylist() {
  return useMutation({
    mutationFn: (req: ExportRequest) =>
      apiFetch<ExportResult>('/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      }),
  })
}

export function useTestNavidrome() {
  return useMutation({
    mutationFn: ({ url, username, password }: { url: string; username: string; password: string }) =>
      apiFetch<{ ok: boolean; message: string }>('/api/playlists/test-navidrome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, username, password }),
      }),
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: boolean; fileDeleted: boolean }>(`/api/items/${id}`, { method: 'DELETE' }),
    onMutate: async (deletedId) => {
      // Find which album this item belongs to and optimistically remove it from the items cache
      const allQueries = qc.getQueriesData<Item[]>({ queryKey: ['albums'] })
      const snapshot = new Map<string, Item[]>()
      for (const [key, data] of allQueries) {
        if (Array.isArray(data) && key.length === 3 && key[2] === 'items') {
          const albumId = key[1] as number
          snapshot.set(JSON.stringify(key), data)
          qc.setQueryData<Item[]>(['albums', albumId, 'items'], data.filter(i => i.id !== deletedId))
        }
      }
      return { snapshot }
    },
    onError: (_err, _id, context) => {
      // Roll back
      if (context?.snapshot) {
        for (const [keyStr, data] of context.snapshot) {
          qc.setQueryData(JSON.parse(keyStr), data)
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['albums'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
