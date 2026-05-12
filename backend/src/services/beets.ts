function base() {
  return process.env.BEETS_API_URL ?? 'http://localhost:8337'
}

async function request(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${base()}${path}`, options)
  if (!res.ok) throw new Error(`beets ${options?.method ?? 'GET'} ${path} → ${res.status}`)
  return res
}

export async function beetsGet<T>(path: string): Promise<T> {
  return request(path).then(r => r.json() as Promise<T>)
}

export async function beetsDelete(path: string, deleteFile = false): Promise<void> {
  const url = deleteFile ? `${path}?delete` : path
  await request(url, { method: 'DELETE' })
}

export async function beetsGetRaw(path: string): Promise<Response> {
  return request(path)
}
