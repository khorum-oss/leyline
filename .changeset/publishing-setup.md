---
'@leyline/schema': patch
---

Drops `fixtures` from the published file list. The fixture corpus lives in `src/fixtures/` as test data and has never been part of the tarball, so the entry promised a directory the package does not ship.
