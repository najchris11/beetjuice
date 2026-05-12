import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Album, Item, DuplicateGroup, Stats } from '../types/beets.ts'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (!res.ok) throw new Error(`${options?.method ?? 'GET'} ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function useAlbums() {
  return useQuery<Album[]>({
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
    mutationFn: (id: number) => apiFetch(`/api/albums/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['albums'] })
      qc.invalidateQueries({ queryKey: ['duplicates'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/api/items/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['albums'] })
      qc.invalidateQueries({ queryKey: ['items', id] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
