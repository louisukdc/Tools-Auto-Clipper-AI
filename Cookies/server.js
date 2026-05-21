const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const WORKSPACE_DIR = __dirname;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// API to list all available cookie files in the workspace
app.get('/api/cookies', (req, res) => {
    try {
        const files = fs.readdirSync(WORKSPACE_DIR);
        // Find .txt or .json files, excluding package files
        const cookieFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            const base = path.basename(file).toLowerCase();
            return (ext === '.txt' || ext === '.json') && 
                   base !== 'package.json' && 
                   base !== 'package-lock.json';
        });
        res.json({ success: true, cookies: cookieFiles });
    } catch (error) {
        console.error('Error scanning cookies:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Socket.io Real-time download stream
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    let activeProcess = null;

    socket.on('start-download', (data) => {
        const { url, cookieFile } = data;

        if (!url) {
            return socket.emit('download-error', 'YouTube URL is required.');
        }

        console.log(`Starting download for URL: ${url} using cookie: ${cookieFile || 'None'}`);
        socket.emit('status-update', { status: 'starting', message: 'Initializing download parameters...' });

        // Build yt-dlp arguments
        const args = [];

        if (cookieFile) {
            const cookiePath = path.join(WORKSPACE_DIR, cookieFile);
            if (fs.existsSync(cookiePath)) {
                args.push('--cookies', cookieFile);
            } else {
                return socket.emit('download-error', `Cookie file "${cookieFile}" not found in workspace.`);
            }
        }

        // Add robust flags for modern JS challenges and streaming
        args.push('--js-runtimes', 'node');
        args.push('--remote-components', 'ejs:github');
        args.push(url);

        // Spawn yt-dlp child process in the workspace CWD
        activeProcess = spawn('yt-dlp', args, {
            cwd: WORKSPACE_DIR,
            shell: true // Safe since we run on a personal local system and input is trusted
        });

        // Regex helpers to parse download progress
        // Group 1: Percent, Group 2: Total Size, Group 3: Speed, Group 4: ETA
        const progressRegex = /\[download\]\s+([\d.]+)%\s+of\s+([\d.a-zA-Z]+)\s+at\s+([\d.a-zA-Z/]+)\s+ETA\s+([\d:]+)/i;
        const mergerRegex = /\[Merger\]\s+Merging\s+formats\s+into\s+"(.+)"/i;
        const extractRegex = /\[youtube\]\s+([a-zA-Z0-9_-]+):\s+Downloading\s+(.+)/i;

        activeProcess.stdout.on('data', (buffer) => {
            const output = buffer.toString();
            socket.emit('stdout-line', output);

            // Parse progress percentage
            const progressMatch = output.match(progressRegex);
            if (progressMatch) {
                const percent = parseFloat(progressMatch[1]);
                const size = progressMatch[2];
                const speed = progressMatch[3];
                const eta = progressMatch[4];

                socket.emit('download-progress', {
                    status: 'downloading',
                    percent,
                    size,
                    speed,
                    eta
                });
                return;
            }

            // Parse merger status
            const mergerMatch = output.match(mergerRegex);
            if (mergerMatch) {
                socket.emit('download-progress', {
                    status: 'merging',
                    percent: 99.9,
                    message: 'Combining audio and video streams together...'
                });
                return;
            }

            // Parse general download updates
            const extractMatch = output.match(extractRegex);
            if (extractMatch) {
                socket.emit('status-update', {
                    status: 'extracting',
                    message: `Extracting: ${extractMatch[2]}...`
                });
            }
        });

        activeProcess.stderr.on('data', (buffer) => {
            const errOutput = buffer.toString();
            socket.emit('stdout-line', `[ERROR] ${errOutput}`);

            // Send warning info if visible
            if (errOutput.includes('WARNING:')) {
                socket.emit('status-update', { status: 'warning', message: errOutput.trim() });
            }
        });

        activeProcess.on('close', (code) => {
            console.log(`yt-dlp exited with code ${code}`);
            activeProcess = null;

            if (code === 0) {
                socket.emit('download-complete', {
                    status: 'completed',
                    message: 'Download and merging successfully completed!'
                });
            } else {
                socket.emit('download-error', `Download failed with exit code ${code}. Check the logs below.`);
            }
        });

        activeProcess.on('error', (err) => {
            console.error('Failed to start child process:', err);
            socket.emit('download-error', `Failed to start yt-dlp: ${err.message}`);
        });
    });

    socket.on('cancel-download', () => {
        if (activeProcess) {
            console.log('Canceling active download process...');
            activeProcess.kill('SIGINT');
            socket.emit('status-update', { status: 'canceled', message: 'Download canceled by user.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (activeProcess) {
            console.log('Client disconnected. Terminating download process...');
            activeProcess.kill();
        }
    });
});

server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Member YouTube Downloader Server running!`);
    console.log(`🌐 Address: http://localhost:${PORT}`);
    console.log(`📂 Working Directory: ${WORKSPACE_DIR}`);
    console.log(`====================================================`);
});
