### Problem

When using the web plugin's `DELETE` endpoint with the `?delete` query parameter, the album and its items are removed from the beets database, but the actual audio files remain on disk. The API returns `{"deleted": true}` with HTTP 200, suggesting success.

**Confirmed reproduction — direct to Flask inside the container, no proxy:**

```
root@bc72491ff826:/# curl -v -X DELETE 'http://localhost:8337/album/1782?delete'
> DELETE /album/1782?delete HTTP/1.1
> Host: localhost:8337
< HTTP/1.1 200 OK
< Server: Werkzeug/3.1.8 Python/3.12.13
< Content-Type: application/json
{"deleted":true}
```

DB record removed, **files remain on disk**.

**CLI item-level deletion works fine** for the same user (`abc`), same paths, same permissions:

```
su abc -s /bin/bash -c 'beet remove -d album_id:1781'
→ Files are actually deleted
```

Note: `beet remove -d album_id:…` without `-a` resolves to **Item** objects and calls `Item.remove(delete=True)` directly — it does **not** go through `Album.remove()`.

### Root Cause Analysis

`Album.remove()` in `beets/library/models.py` deletes the album DB row **before** iterating items to delete their files:

```python
def remove(self, delete=False, with_items=True):
    super().remove()                              # 1. DELETE FROM albums WHERE id=?
    plugins.send("album_removed", album=self)     # 2. Fire plugin events
    if delete:                                    # 3. Delete album art
        artpath = self.artpath
        if artpath:
            util.remove(artpath)
    if with_items:                                # 4. Find items and delete files
        for item in self.items():                 #    ← self.items() may return []
            item.remove(delete, False)            #       if album row is already gone
```

After step 1 removes the album row, `self.items()` at step 4 may return an empty list — either because:
- A `database_change` listener triggered by `super().remove()` cleans up related rows
- SQLite query behavior differs after the parent row is committed
- Some other DB-level interaction causes the items to not be found

When `self.items()` returns empty, `Item.remove(delete=True)` is never called, so `util.remove()` never runs, and **files stay on disk**.

**The CLI avoids this entirely** because `beet remove -d` (without `-a`) resolves the query to individual `Item` objects and calls `Item.remove(delete=True)` on each one directly — it never goes through `Album.remove()`.

### Proposed Fix

Snapshot items **before** removing the album row:

```python
def remove(self, delete=False, with_items=True):
    # Snapshot items before the album row is removed
    items_snapshot = list(self.items()) if with_items else []

    super().remove()
    plugins.send("album_removed", album=self)

    if delete:
        artpath = self.artpath
        if artpath:
            util.remove(artpath)

    if with_items:
        for item in items_snapshot:          # Use snapshot instead of self.items()
            item.remove(delete, False)
```

### Test Gap

`test/plugins/test_web.py` has `test_delete_item_with_file` which asserts the file is gone from disk. But there is **no equivalent album-level test** — `test_delete_album_id` only checks the album disappears from the API, not that track files are deleted. Adding a `test_delete_album_with_files` that creates an album with real files, calls `DELETE /album/{id}?delete`, and asserts files are removed would prevent this regression.

Running this command in verbose (`-vv`) mode:

```sh
$ beet -vv web
```

Led to this problem:

```
DELETE /album/1782?delete returns {"deleted": true} but files remain on disk.
No errors or warnings are logged on the beets side.
```

Here's a link to the music files that trigger the bug (if relevant):

Not file-specific — reproducible with any album in the library.

### Setup

* OS: Unraid (Docker container — linuxserver/beets, Python 3.12.13)
* Python version: 3.12.13
* beets version: *(fill in — run `beet version`)*
* Turning off plugins made problem go away (yes/no): Not tested yet — but root cause is in `Album.remove()` ordering, not plugin-specific

My configuration (output of `beet config`) is:

```yaml
plugins:
- info
- the
- fetchart
- embedart
- ftintitle
- lastgenre
- missing
- albumtypes
- scrub
- zero
- mbsync
- duplicates
- convert
- fromfilename
- inline
- edit
- musicbrainz
- replaygain
- chroma
- badfiles
- discogs
- subsonicupdate
- web

directory: /music/clean
artist_credit: yes
per_disc_numbering: no
asciify_paths: yes
threaded: no

import:
    move: no
    copy: yes
    write: yes
    log: /logs/last_beets_imports.log
    quiet_fallback: skip
    detail: yes
    duplicate_action: ask
    artist_credit: yes

ui:
    color: yes

replace:
    '[\\]': ''
    '[_]': '-'
    '[/]': '-'
    ^\.+: ''
    '[\x00-\x1f]': ''
    '[<>:"\?\*\|]': ''
    \.$: ''
    \s+$: ''
    ^\s+: ''
    ^-: ''
    "\u2019": ''
    "\u2032": ''
    "\u2033": ''
    "\u2010": '-'

match:
    strong_rec_thresh: 0.1
    distance_weights:
        data_source: 0.0
        missing_tracks: 0.2

musicbrainz:
    external_ids:
        discogs: yes
        bandcamp: yes
        spotify: yes
        deezer: yes
        beatport: yes
        tidal: yes
    search_limit: 5

web:
    host: 0.0.0.0
    port: 8337
    readonly: no
    cors: ''
    cors_supports_credentials: no
    reverse_proxy: no
    include_paths: no

fetchart:
    minwidth: 500
    enforce_ratio: 10px
    sources: [filesystem, itunes, fanarttv, spotify, albumart, coverart]
    auto: yes
    cover_names: [cover, front, art, album, folder]
    high_resolution: no

embedart:
    auto: yes
    ifempty: yes
    remove_art_file: yes

ftintitle:
    auto: yes
    format: '(feat. {0})'
    custom_words: [with, duet with]
    preserve_album_artist: yes

lastgenre:
    auto: yes
    count: 4
    prefer_specific: yes
    force: yes
    source: track
    separator: '; '
    keep_existing: yes
    whitelist: yes
    title_case: yes

replaygain:
    backend: ffmpeg
    overwrite: no
    auto: yes
    threads: 24
    targetlevel: 89

scrub:
    auto: yes

zero:
    auto: yes

convert:
    threads: 24
    format: mp3
    auto: no

# API keys/secrets redacted
```
