async function login(url: string, username: string, password: string): Promise<string> {
  const endpoint = `${url.replace(/\/$/, '')}/auth/login`
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    throw new Error(`Cannot reach Navidrome at ${url}: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('Invalid username or password')
    throw new Error(`Navidrome login failed (HTTP ${res.status}): ${body || res.statusText}`)
  }
  const data = await res.json() as { token?: string }
  if (!data.token) throw new Error('Navidrome login response did not include a token')
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
    throw new Error(`Navidrome playlist API ${res.status}: ${body || res.statusText}`)
  }
}

export async function testNavidromeConnection(
  url: string,
  username: string,
  password: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    // Login is the real auth test — if this succeeds, credentials are valid
    const token = await login(url, username, password)

    // Best-effort: fetch display name. Failure here doesn't mean auth is broken.
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/api/user/me`, {
        headers: { 'X-ND-Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json() as { name?: string; username?: string }
        const name = data.name ?? data.username ?? username
        return { ok: true, message: `Connected as ${name}` }
      }
    } catch {
      // user/me failed — auth still succeeded
    }

    return { ok: true, message: `Connected as ${username}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
