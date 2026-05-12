import { useState, useCallback, useEffect } from 'react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  detail?: string
}

let toastId = 0
type Listener = (toasts: Toast[]) => void

// Simple global toast store so any component/hook can trigger toasts
const listeners = new Set<Listener>()
let currentToasts: Toast[] = []

function notify() {
  listeners.forEach(fn => fn([...currentToasts]))
}

export function addToast(type: Toast['type'], message: string, detail?: string) {
  const id = String(++toastId)
  currentToasts = [...currentToasts, { id, type, message, detail }]
  notify()

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    dismissToast(id)
  }, 5000)
}

export function dismissToast(id: string) {
  currentToasts = currentToasts.filter(t => t.id !== id)
  notify()
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>(currentToasts)

  useEffect(() => {
    listeners.add(setToasts)
    return () => { listeners.delete(setToasts) }
  }, [])

  return toasts
}
