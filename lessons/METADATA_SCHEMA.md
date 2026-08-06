# Course Metadata Schema

Every course folder (the lowest level: `Faculty/Department/Level/Course/`)
contains a `_meta.json` file alongside its content files. This is the
layer that makes three things possible without restructuring later:

1. **Cross-listing** — shared content (e.g. Statistics) lives in one
   canonical place and gets *referenced*, not duplicated, by every
   department that teaches a variant of it.
2. **The QR offline-broadcast system** — a student's device can filter
   the broadcast stream to just the frames tagged with their
   faculty/department/level (plus anything cross-listed to them),
   instead of capturing everything.
3. **The future LASU Connect "Learning Materials" catalog endpoint** —
   same filtering logic, served over HTTP instead of QR.

## Schema

```json
{
  "courseCode": "PMT 301",
  "courseTitle": "Principles of Project Management",
  "faculty": "Management Sciences",
  "department": "Management Technology",
  "level": "300 Level",
  "topicTags": ["project management", "scheduling", "risk management"],
  "crossListedWith": [],
  "sharedWith": [],
  "prerequisites": [],
  "isCanonical": true,
  "canonicalPath": null
}
```

### Field meanings

- **courseCode / courseTitle** — as specific as we have. If the exact
  LASU course code isn't confirmed yet, `courseCode` can be `null` — the
  folder name and title still work fine without it.
- **faculty / department / level** — must match the folder path exactly.
  This is redundant with the path on purpose: it means any tool reading
  `_meta.json` files can build the full catalog without needing to parse
  folder paths.
- **topicTags** — concept-level tags, lowercase, space-separated (no
  dashes — write "data structures", not "data-structures"). This is
  what actually drives cross-linking and QR relevance-matching — two
  courses sharing a tag like `statistics` or `linear algebra` are
  related even if their folder paths never intersect. Search against
  these (and against faculty/department/course names) is alias- and
  typo-tolerant — "Maths" finds "Mathematics", "compsci" finds
  "Computer Science", and small typos still match — via `/api/search`
  in `server.js`.
- **crossListedWith** — array of `{faculty, department, level}` objects
  for *other departments* that also offer a variant of this exact
  course. Used for the "same course, different home" case (e.g.
  Transport Management Technology and Project Management Technology
  both under a shared parent history).
- **sharedWith** — array of full paths (as strings) to *other course
  folders* whose canonical content this folder should pull in rather
  than duplicate. Used for the "different course, shared core content"
  case (e.g. a Statistics course used by three different departments).
- **prerequisites** — array of plain-text course names/topic tags a
  student should already know. Doesn't need to resolve to an exact path
  — "Linear Algebra" or the tag `linear-algebra` is enough for now.
- **isCanonical / canonicalPath** — if this folder holds real, original
  content, `isCanonical: true` and `canonicalPath: null`. If this folder
  is a *pointer* to another department's canonical version (see the
  Statistics example below), `isCanonical: false` and `canonicalPath`
  points at the real folder's path, so a broadcast/catalog reader knows
  where to actually pull the files from.

## Cross-listing pattern (worked example: Statistics)

Statistics is taught, with variations, in Mathematics (Science),
Management Sciences (business statistics), and Social Sciences
(applied/social statistics). Rather than writing the same core content
three times:

```
Science/Mathematics/200 Level/Statistics/
  _meta.json          (isCanonical: true — the real content lives here)
  notes.md

Management Sciences/[Department]/200 Level/Statistics/
  _meta.json          (isCanonical: false, canonicalPath points at the
                        Mathematics folder above)
  variation-notes.md  (ONLY the department-specific additions — e.g.
                        business applications, not the shared core)

Social Sciences/[Department]/200 Level/Statistics/
  _meta.json          (same pattern)
  variation-notes.md
```

A catalog reader (or the QR broadcaster) sees a non-canonical folder,
knows to serve the canonical folder's files *plus* this folder's own
`variation-notes.md`, and never duplicates the core content in storage.
