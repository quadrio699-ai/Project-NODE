# Adding a Course to Project-NODE — Contributor Guide

This is for anyone adding academic material to the `lessons` folder by
hand. No coding needed — just follow this exactly and everything (search,
downloads, the "Print/Save as PDF" button, and the future QR offline
system) will work correctly.

## 1. Find (or create) the right folder path

Every course lives at:

```
lessons/[Faculty]/[Department]/[Level]/[Course Name]/
```

Example: `lessons/Science/Mathematics/200 Level/Linear Algebra/`

- **Use the exact faculty and department names already in the
  `lessons` folder** if they exist — check the folder list first.
  Don't create "Maths" if "Mathematics" already exists as a folder;
  they need to match exactly, or the system will treat them as two
  different departments.
- If a faculty or department genuinely doesn't have a folder yet,
  it's fine to create one — just use the full, proper name (e.g.
  "Faculty of Agriculture" → folder name `Agriculture`, no "Faculty
  of" prefix, matching how the others are named).
- **Level** folders are always written like `100 Level`, `200 Level`,
  etc. — with a space, not "100level" or "L100".

## 2. Put your content file(s) in that folder

- Plain text files (`.md` for text notes) are strongly preferred over
  Word or PDF — they're much smaller, which matters a lot for the
  offline distribution plan. If you only have a PDF or Word doc, it's
  still fine to drop it in, just know it'll be a much bigger file.
- Name the file something clear: `notes.md`, or a proper title like
  `Cell Biology Fundamentals.md`.

## 3. Add the `_meta.json` file — this is the important part

Every course folder needs one `_meta.json` file sitting right next to
the content, or search/cross-listing won't recognize it. Copy this
template and fill in your course's details:

```json
{
  "courseCode": null,
  "courseTitle": "Your Course Title Here",
  "faculty": "Exact Faculty Folder Name",
  "department": "Exact Department Folder Name",
  "level": "200 Level",
  "topicTags": ["topic one", "topic two", "topic three"],
  "crossListedWith": [],
  "sharedWith": [],
  "prerequisites": [],
  "isCanonical": true,
  "canonicalPath": null
}
```

**Rules for filling it in:**

- `courseCode` — the real course code if you know it (e.g. `"PMT 301"`).
  If you don't know it, leave it as `null` — don't guess.
- `courseTitle`, `faculty`, `department`, `level` — must exactly match
  the actual folder path this file sits in.
- `topicTags` — a few words describing the topics covered, all
  **lowercase, and words separated by spaces, never dashes**. Write
  `"data structures"`, not `"data-structures"`.
- `prerequisites` — plain-language names of things a student should
  already know (e.g. `"basic algebra"`). Doesn't need to be a formal
  course name.
- Leave `crossListedWith`, `sharedWith`, `isCanonical: true`, and
  `canonicalPath: null` as shown **unless** this course shares its core
  content with another department's course — see the next section if
  so.

## 4. If a course overlaps with another department's course

Some subjects (Statistics is the working example already built) get
taught, with small variations, across multiple departments. **Don't
copy-paste the same content into every department's folder.** Instead:

1. Pick ONE department as the "home" of the real content — mark its
   `_meta.json` as `"isCanonical": true`.
2. In every other department's version of that course, write a short
   file with ONLY what's different for that department (not the whole
   course again), and set that folder's `_meta.json` to:
   ```json
   "isCanonical": false,
   "canonicalPath": "Faculty/Department/Level/Course Name"
   ```
   (pointing at the folder from step 1).

See `lessons/Science/Mathematics/200 Level/Statistics/` (canonical) and
`lessons/Management Sciences/Business Administration/200 Level/Statistics/`
(pointer) for a real working example to copy the pattern from.

## 5. Quick checklist before you're done

- [ ] Folder path matches an existing faculty/department name exactly
      (or is a properly-named new one)
- [ ] `_meta.json` is present and filled in
- [ ] Tags have no dashes, all lowercase
- [ ] If this overlaps another department's course, it's set up as
      canonical + pointer(s), not duplicated content
