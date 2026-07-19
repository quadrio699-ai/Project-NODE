// organize-ocw.js
//
// MIT OCW zip downloads usually contain a LOT of files — lecture notes,
// assignments, exams, and often huge video/audio lecture files all mixed
// together. This script pulls out just the lightweight files (PDFs, docs,
// slides) that are actually practical to store and hand out over a local
// network, and drops them straight into the right lessons/ folder — so
// you don't have to unzip and drag files around by hand for every course.
//
// Usage:
//   node organize-ocw.js <path-to-zip> <Category> <Topic>
//
// Example:
//   node organize-ocw.js ~/Downloads/6-006-fall-2020.zip Computing Algorithm
//
// This puts the files at: lessons/Computing/Algorithm/

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// Must match the category list server.js scans for — anything else
// silently won't show up in the app.
const VALID_CATEGORIES = ['Computing', 'Education', 'Engineering', 'Public Resources', 'Science'];

// Lightweight formats only. Lecture videos and audio are skipped on
// purpose — a single video can be hundreds of MB, which adds up fast
// and isn't practical to distribute over a local classroom network.
const KEEP_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.rtf'];

const [, , zipPath, category, topic] = process.argv;

if (!zipPath || !category || !topic) {
    console.log('Usage: node organize-ocw.js <path-to-zip> <Category> <Topic>');
    console.log('Example: node organize-ocw.js ~/Downloads/6-006-fall-2020.zip Computing Algorithm');
    console.log(`\nValid categories: ${VALID_CATEGORIES.join(', ')}`);
    process.exit(1);
}

if (!VALID_CATEGORIES.includes(category)) {
    console.log(`"${category}" isn't one of the categories NODE recognizes.`);
    console.log(`Valid categories: ${VALID_CATEGORIES.join(', ')}`);
    process.exit(1);
}

if (!fs.existsSync(zipPath)) {
    console.log(`Can't find a file at: ${zipPath}`);
    process.exit(1);
}

const destDir = path.join(__dirname, 'lessons', category, topic);
fs.mkdirSync(destDir, { recursive: true });

const zip = new AdmZip(zipPath);
const entries = zip.getEntries();

let copied = 0;
let skipped = 0;
let skippedBytes = 0;
const usedNames = new Set();

entries.forEach(entry => {
    if (entry.isDirectory) return;

    const ext = path.extname(entry.entryName).toLowerCase();
    if (!KEEP_EXTENSIONS.includes(ext)) {
        skipped++;
        skippedBytes += entry.header.size;
        return;
    }

    // The zip's internal folders (e.g. "assignments/", "lecture-notes/")
    // get flattened into one folder here. If two files share a name
    // across different internal folders, keep both instead of overwriting.
    let fileName = path.basename(entry.entryName);
    if (usedNames.has(fileName)) {
        const extOnly = path.extname(fileName);
        const base = path.basename(fileName, extOnly);
        fileName = `${base}-${copied}${extOnly}`;
    }
    usedNames.add(fileName);

    fs.writeFileSync(path.join(destDir, fileName), entry.getData());
    copied++;
    console.log('Added:', fileName);
});

console.log(`\nDone — ${copied} files added to lessons/${category}/${topic}`);
console.log(`Skipped ${skipped} files (videos, audio, and other heavy formats) — about ${(skippedBytes / 1024 / 1024).toFixed(1)} MB not copied.`);
