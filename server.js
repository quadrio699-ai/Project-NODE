const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const DB_FILE = './database.json';

app.use(express.json());
app.use(express.static('.'));
app.use('/lessons', express.static('lessons'));

// Load database or initialize if empty
let dataStore = { comments: [] };
if (fs.existsSync(DB_FILE)) {
    dataStore = JSON.parse(fs.readFileSync(DB_FILE));
}

// Track online users and their session start times
let activeSessions = {}; 

// --- 1. HEARTBEAT & SESSION TRACKING ---
// Fixes: Message history reset for new users and online student count
app.post('/api/heartbeat', (req, res) => {
    const { student, isNewLogin } = req.body;
    if (!student) return res.sendStatus(400);

    const now = new Date();
    
    // If it's a first load, we set the sessionStart to NOW
    // This ensures they don't see history from before they logged in
    if (isNewLogin || !activeSessions[student]) {
        activeSessions[student] = { 
            lastSeen: now, 
            sessionStart: now.toISOString() 
        };
    } else { 
        activeSessions[student].lastSeen = now; 
    }
    res.sendStatus(200);
});

// --- 2. DATA RETRIEVAL (FILES & MESSAGES) ---
// Fixes: Nested folders for Physics and hiding old history
app.get('/api/data', (req, res) => {
    const studentName = req.query.user;
    const now = Date.now();

    // Cleanup users inactive for > 10 seconds
    Object.keys(activeSessions).forEach(name => {
        if (now - new Date(activeSessions[name].lastSeen).getTime() > 10000) {
            delete activeSessions[name];
        }
    });

    const baseLessonsPath = path.join(__dirname, 'lessons');
    let categorizedFiles = {};

    // --- NEW DYNAMIC SCANNER ---
    // This looks for your new folders: Computing, Education, Engineering, etc.
    const categories = ['Computing', 'Education', 'Engineering', 'Public Resources', 'Science'];

    categories.forEach(cat => {
        const catPath = path.join(baseLessonsPath, cat);
        
        if (fs.existsSync(catPath) && fs.lstatSync(catPath).isDirectory()) {
            // Prepare the category structure
            categorizedFiles[cat] = { _files: [], subTopics: {} };
            
            const items = fs.readdirSync(catPath);
            items.forEach(item => {
                const itemPath = path.join(catPath, item);
                
                if (fs.lstatSync(itemPath).isDirectory()) {
                    // This handles sub-folders like "Algorithm" or "Programming"
                    categorizedFiles[cat].subTopics[item] = fs.readdirSync(itemPath)
                        .filter(f => fs.lstatSync(path.join(itemPath, f)).isFile());
                } else {
                    // This handles files directly in the main folder
                    categorizedFiles[cat]._files.push(item);
                }
            });
        }
    });

    // Deep Scan Public Resources for Subfolders (e.g., Physics > Electricity)
    const publicPath = path.join(baseLessonsPath, 'Public Resources');
    if (fs.existsSync(publicPath)) {
        let publicData = { subFolders: {} };
        const subjects = fs.readdirSync(publicPath);

        subjects.forEach(subject => {
            const subjectPath = path.join(publicPath, subject);
            if (fs.lstatSync(subjectPath).isDirectory()) {
                publicData.subFolders[subject] = { _files: [], subTopics: {} };
                const items = fs.readdirSync(subjectPath);
                
                items.forEach(item => {
                    const itemPath = path.join(subjectPath, item);
                    if (fs.lstatSync(itemPath).isDirectory()) {
                        // This handles the subfolders inside Physics
                        publicData.subFolders[subject].subTopics[item] = fs.readdirSync(itemPath)
                            .filter(f => fs.lstatSync(path.join(itemPath, f)).isFile());
                    } else {
                        publicData.subFolders[subject]._files.push(item);
                    }
                });
            }
        });
        categorizedFiles['Public Resources'] = publicData;
    }

    // Filter Comments: Only show messages sent AFTER this user's current session began
    let filteredComments = dataStore.comments;
    if (studentName !== "Marvellous" && activeSessions[studentName]) {
        const threshold = new Date(activeSessions[studentName].sessionStart);
        filteredComments = dataStore.comments.filter(c => new Date(c.fullTimestamp) > threshold);
    }

    res.json({
        visitorCount: Object.keys(activeSessions).length,
        categorizedFiles: categorizedFiles,
        comments: filteredComments
    });
});

// --- 3. COMMENTING SYSTEM ---
app.post('/api/comment', (req, res) => {
    const { student, text } = req.body;
    if (!student || !text) return res.sendStatus(400);

    const newComment = {
        student,
        text,
        fullTimestamp: new Date().toISOString()
    };

    dataStore.comments.push(newComment);
    fs.writeFileSync(DB_FILE, JSON.stringify(dataStore, null, 2));
    res.json(newComment);
});

// --- 4. DOWNLOAD HANDLER ---
app.get('/api/download/*', (req, res) => {
    const relativePath = decodeURIComponent(req.params[0]); 
    const filePath = path.join(__dirname, 'lessons', relativePath);
    if (fs.existsSync(filePath)) {
        res.download(filePath, path.basename(filePath)); 
    } else {
        res.status(404).send('File not found');
    }
});

app.listen(80, () => console.log("NODE Server Running on Port 80"));