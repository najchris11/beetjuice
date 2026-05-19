# Cursor Prompt — Beets Web Plugin File Deletion Bug (Round 2)

Paste the following into Cursor with the beets repo open:

---

## Bug: `DELETE /album/{id}?delete` via web plugin removes DB rows but not files

### Confirmed facts from live testing (Docker, Python 3.12.13, Werkzeug 3.1.8)

1. **Direct curl inside the container** (no proxy, no middleware):
   ```
   curl -X DELETE 'http://localhost:8337/album/1782?delete'
   → {"deleted": true}, HTTP 200
   → DB record removed, FILES STILL ON DISK
   ```

2. **`beet remove -d` works perfectly** for the same user, same paths:
   ```
   su abc -s /bin/bash -c 'beet remove -d album_id:1781'
   → Prompts "Really DELETE 9 files?", files are actually deleted
   ```

3. **Same process user**: Web plugin runs as `abc` (uid mapped to PUID=99). CLI test also ran as `abc`. Permissions are not the issue — `rm` as `abc` works fine.

4. **File ownership**: Files are `abc:abc` with `644`, directories `755`. Write/delete access confirmed.

5. **`is_delete()` is correct**: `flask.request.args.get("delete") is not None` returns `True` for `?delete` (empty string, not None). Already validated in round 1.

### What's different between CLI and web

The CLI (`beets/ui/commands/remove.py`) does:
```python
with lib.transaction():
    for obj in objs:
        obj.remove(delete)
```

The web plugin (`beetsplug/web/__init__.py`) does:
```python
for entity in entities:
    entity.remove(delete=is_delete())
```

Both call the same `Album.remove(delete=True)` in `beets/library/models.py`. Round 1 confirmed the code path is identical and correct.

### Leading hypothesis: Plugin interference

`Album.remove()` calls `plugins.send("album_removed", album=self)` **BEFORE** iterating items and deleting files:

```python
def remove(self, delete=False, with_items=True):
    super().remove()                              # 1. Remove album DB row
    plugins.send("album_removed", album=self)     # 2. ← PLUGINS FIRE HERE
    if delete:                                    # 3. Delete art
        artpath = self.artpath
        if artpath:
            util.remove(artpath)
    if with_items:                                # 4. Delete items + files
        for item in self.items():
            item.remove(delete, False)
```

The user has **23 plugins loaded**: info, the, fetchart, embedart, ftintitle, lastgenre, missing, albumtypes, scrub, zero, mbsync, duplicates, convert, fromfilename, inline, edit, musicbrainz, replaygain, chroma, badfiles, discogs, subsonicupdate, web.

If any plugin's `album_removed` handler raises an unhandled exception, the rest of `remove()` (steps 3-4) would be skipped — DB row gone, files untouched, but the web plugin still returns `{"deleted": true}` because the exception isn't caught at that level.

**BUT** — the CLI also loads the same plugins and calls the same `Album.remove(delete=True)`. So if a plugin exception were the cause, the CLI would fail too. Unless:
- The CLI's `lib.transaction()` wrapper changes behavior
- Flask's threading context affects plugin behavior
- A plugin behaves differently when called from within a Flask request context vs CLI

### What I need you to investigate

1. **`plugins.send()` error handling** — Find `plugins.send` in `beets/plugins.py`. Does it catch exceptions from handlers? Does it log them? Could a handler exception silently abort `Album.remove()` without the web plugin noticing?

2. **`self.items()` after `super().remove()`** — After the album DB row is removed (step 1), does `self.items()` (step 4) still return items? It queries `items WHERE album_id = ?` so it SHOULD work since items are in a separate table. But verify — could `super().remove()` cascade-delete items? Check `dbcore/db.py` for cascade behavior.

3. **Transaction context difference** — The CLI wraps in `lib.transaction()`. The web plugin does not. Could `super().remove()` in the web context auto-commit and cause `self.items()` to return an empty list? Check how `Model.remove()` handles transactions in `dbcore/db.py`.

4. **Flask threading** — The web plugin runs with `threaded=True`. Could SQLite's threading restrictions cause `self.items()` to silently fail or return empty after `super().remove()` commits on a different connection?

5. **`util.remove(soft=True)` swallowing errors** — If files DO exist but `syspath(path)` produces a wrong path, `os.path.exists()` returns False, and `soft=True` silently returns. Is there a path encoding difference between how the CLI and web plugin resolve `self.path`?

6. **Check the web plugin tests** — `test/plugins/test_web.py` has `test_delete_item_with_file`. Does it actually verify the file is deleted from disk, or just check the HTTP response? Is there a test for album deletion with `?delete`?

### Specific files to examine

- `beets/plugins.py` — `send()` function, error handling
- `beets/dbcore/db.py` — `Model.remove()`, transaction handling, cascade behavior
- `beets/library/models.py` — `Album.remove()`, `Item.remove()`, `Album.items()`
- `beets/util/__init__.py` — `remove()`, `syspath()`
- `test/plugins/test_web.py` — existing delete tests, what they actually assert

### Output format

1. **Root cause** — which specific mechanism causes the web path to skip file deletion
2. **Why CLI works** — the exact difference
3. **Proposed fix** — minimal code change with file paths
4. **Test gap** — what's missing in test_web.py
