export async function postPlaylistToNavidrome(
  url: string,
  token: string,
  playlistName: string,
  m3uContent: string,
): Promise<void> {
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

export async function testNavidromeConnection(url: string, token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const endpoint = `${url.replace(/\/$/, '')}/api/user/me`
    const res = await fetch(endpoint, {
      headers: { 'X-ND-Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return { ok: true, message: 'Connected successfully' }
    if (res.status === 401) return { ok: false, message: 'Invalid token' }
    return { ok: false, message: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
}
