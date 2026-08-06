# Lessons Folder — Scaffold Status

This replaces the old flat `Computing / Education / Engineering / Science /
Public Resources` structure with LASU's real Faculty → Department →
Level → Course hierarchy. `server.js` was updated alongside this to
scan/render any depth, plus expose `/api/catalog` and `/api/search`
(fuzzy, alias-aware) reading each course folder's `_meta.json`. See
`METADATA_SCHEMA.md` for the full metadata spec.

Every empty folder includes a `.gitkeep` placeholder (a hidden dotfile)
so it survives a GitHub upload.

## Confirmed department-level structure (from lasu.edu.ng)

- **Science** — 10 departments (Computer Science moved out — see below)
- **Management Sciences** — 9 departments, including Management
  Technology (houses Project Management Technology)
- **Transport** — its own faculty (not under Management Sciences)
- **Engineering** — 4 departments: Chemical and Polymer Engineering,
  Electronic and Computer Engineering, Mechanical Engineering, Aerospace
  Engineering
- **Computing and Information Technology** — new faculty (est. 2025), 5
  departments: Computer Science, Cyber Security, Data Science, ICT,
  Software Engineering. Absorbed the old Science-faculty Computer
  Science department.
- **Social Sciences** — 5 departments: Economics, Geography, Political
  Science, Psychology, Sociology
- **Arts** — 8 departments: English, Foreign Languages, History and
  International Studies, Linguistics, African Languages Literatures and
  Communication Arts, Music, Philosophy, Religions and Peace Studies,
  Theatre Arts
- **Education** — 5 departments: Educational Management, Human Kinetic
  Sports and Health Education, Language Arts and Social Science
  Education, Educational Foundation and Counseling Psychology, Science
  and Technology Education
- **Law** — 2 departments confirmed: Public and Private Law, Business Law

## Real content added so far (6 course folders)

- Management Sciences / Management Technology / Project Management
  Technology / 300 Level / Principles of Project Management
- Science / Mathematics / 200 Level / Linear Algebra
- Science / Mathematics / 200 Level / Statistics **(canonical — shared
  core content, referenced by the two entries below)**
- Engineering / Electronic and Computer Engineering / 200 Level /
  Digital Logic Design
- Computing and Information Technology / Computer Science / 200 Level /
  Data Structures and Algorithms
- Management Sciences / Business Administration / 200 Level / Statistics
  **(pointer — department-specific variation notes only, pulls
  canonical content from Mathematics)**
- Social Sciences / Economics / 200 Level / Statistics **(pointer, same
  pattern)**

All original content, MIT/Ivy/top-tier caliber per discipline, written
to cover standard undergraduate curricula — not sourced from any
copyrighted textbook or paywalled platform. Every course folder has a
`_meta.json` (see METADATA_SCHEMA.md) with space-separated (no dash)
topicTags.

## Still placeholder / not yet built out

Departments not yet confirmed for: Agriculture, Allied Health Sciences,
Basic Medical Sciences, CESSED, Clinical Sciences, Communications,
Creativity/Culture/Tourism Studies, Dentistry, Environmental Sciences,
Library Archival and Information Science, Post Graduate Studies,
Transport (department-level). These remain empty top-level faculty
folders only.

Every confirmed department beyond the 6 course folders above still needs
actual content.
