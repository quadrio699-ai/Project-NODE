# Lessons Folder — Scaffold Status

This replaces the old flat `Computing / Education / Engineering / Science /
Public Resources` structure with LASU's real Faculty → Department →
Level → Course hierarchy. `server.js` and `index.html` were updated
alongside this to scan/render any depth, so this structure just works
with no further code changes.

Every folder in this zip includes a `.gitkeep` placeholder file so empty
folders actually survive a Git commit/GitHub upload — Git doesn't track
empty directories on its own, so without these the empty ones would
silently vanish once pushed. Once a folder has real content in it, its
`.gitkeep` can be deleted.

## Confirmed (from lasu.edu.ng)

- **All 20 faculty/school top-level folders** — names taken directly from
  LASU's official faculty list.
- **Science** — all 10 departments confirmed via LASU's Faculty of Science page.
- **Management Sciences** — all 9 departments confirmed via LASU's Faculty
  of Management Sciences page, including **Management Technology**, which
  now houses **Project Management Technology** (100/200/300/400 Level
  folders ready for course content).
- **Transport** — its own faculty (not a department under Management
  Sciences, per correction). Transport Management Technology sits here;
  exact department name still needs confirming via a direct page fetch.

## Still placeholder (empty folders, no departments listed yet)

Every other faculty/school (Agriculture, Allied Health Sciences, Arts,
Basic Medical Sciences, CESSED, Clinical Sciences, Communications,
Computing and Information Technology, Creativity/Culture/Tourism Studies,
Dentistry, Education, Engineering, Environmental Sciences, Law, Library
Archival and Information Science, Post Graduate Studies, Social Sciences)
currently has no department subfolders — LASU's public site doesn't
expose department lists on those pages without a per-faculty fetch,
which is still in progress across future sessions.

## Content

No course content has been added yet anywhere — that's the next phase,
starting with 300 Level Project Management Technology once the real
course list is confirmed.
