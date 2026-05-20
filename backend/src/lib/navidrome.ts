async function login(url: string, username: string, password: string): Promise<string> {
  const endpoint = `${url.replace(/\/$/, '')}/auth/login`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Navidrome login failed ${res.status}: ${body || res.statusText}`)
  }
  const data = await res.json() as { token?: string }
  if (!data.token) throw new Error('Navidrome login returned no token')
  return data.token
}

export async function postPlaylistToNavidrome(
  url: string,
  username: string,
  password: string,
  playlistName: string,
  m3uContent: string,
): Promise<void> {
  const token = await login(url, username, password)
  const endpoint = `${url.replace(/\/$/, '')}/api/playlist`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/x-mpegurl',
      'X-ND-Authorization': `Bearer ${token}`,
      'X-ND-Client-Unique-Id': 'beetjuice',
      'X-ND-Playlist-Name': playlistName,
    },
    body: m3uContent,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Navidrome API ${res.status}: ${body || res.statusText}`)
  }
}

export async function testNavidromeConnection(
  url: string,
  username: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await login(url, username, password)
    const endpoint = `${url.replace(/\/$/, '')}/api/user/me`
    const res = await fetch(endpoint, {
      headers: { 'X-ND-Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const data = await res.json() as { name?: string }
      return { ok: true, message: `Connected as ${data.name ?? username}` }
    }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}
