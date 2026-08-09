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
//   node organize-ocw.js <path-to-zip> <folder/path/inside/lessons>
//
// The destination can be any depth now (Faculty/Department/Level/Course),
// matching lessons/ being a fully recursive tree — there's no fixed
// category list to keep in sync anymore.
//
// Example:
//   node organize-ocw.js ~/Downloads/6-006-fall-2020.zip "Science/Computer Science/300 Level/CSC 301 - Algorithms"
//
// This puts the files at:
//   lessons/Science/Computer Science/300 Level/CSC 301 - Algorithms/

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

// Lightweight formats only. Lecture videos and audio are skipped on
// purpose — a single video can be hundreds of MB, which adds up fast
// and isn't practical to distribute over a local classroom network.
const KEEP_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.rtf'];

const [, , zipPath, destPath] = process.argv;

if (!zipPath || !destPath) {
    console.log('Usage: node organize-ocw.js <path-to-zip> <folder/path/inside/lessons>');
    console.log('Example: node organize-ocw.js ~/Downloads/6-006-fall-2020.zip "Science/Computer Science/300 Level/CSC 301 - Algorithms"');
    process.exit(1);
}

if (!fs.existsSync(zipPath)) {
    console.log(`Can't find a file at: ${zipPath}`);
    process.exit(1);
}

const destDir = path.join(__dirname, 'lessons', destPath);
fs.mkdirSync(destDir, { recursive: true });

// If a .gitkeep placeholder is sitting in this folder, remove it now
// that real content is landing here.
const gitkeepPath = path.join(destDir, '.gitkeep');
if (fs.existsSync(gitkeepPath)) fs.unlinkSync(gitkeepPath);

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

console.log(`\nDone — ${copied} files added to lessons/${destPath}`);
console.log(`Skipped ${skipped} files (videos, audio, and other heavy formats) — about ${(skippedBytes / 1024 / 1024).toFixed(1)} MB not copied.`);

    
