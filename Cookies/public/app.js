document.addEventListener('DOMContentLoaded', () => {
    // Connect to the WebSocket Server
    const socket = io();

    // DOM Elements
    const downloadForm = document.getElementById('download-form');
    const videoUrlInput = document.getElementById('video-url');
    const cookieSelect = document.getElementById('cookie-select');
    const refreshCookiesBtn = document.getElementById('refresh-cookies');
    const startBtn = document.getElementById('start-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    const statusBadge = document.getElementById('status-badge');
    const percentLabel = document.getElementById('percent-label');
    const statusMessage = document.getElementById('status-message');
    const progressBarFill = document.getElementById('progress-bar-fill');

    const statSpeed = document.getElementById('stat-speed');
    const statEta = document.getElementById('stat-eta');
    const statSize = document.getElementById('stat-size');

    const terminalLogs = document.getElementById('terminal-logs');
    const clearLogsBtn = document.getElementById('clear-logs');

    // Load available cookie files on startup
    fetchCookies();

    // Event Listeners
    refreshCookiesBtn.addEventListener('click', fetchCookies);
    clearLogsBtn.addEventListener('click', clearTerminalLogs);

    downloadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const url = videoUrlInput.value.trim();
        const cookieFile = cookieSelect.value;

        if (!url) return;

        // Reset UI states for a fresh download
        resetProgressDisplay();
        setUIStateDownloading(true);

        // Send start signal to backend via websocket
        socket.emit('start-download', { url, cookieFile });
        logToTerminal(`[SYSTEM] Mengirim permintaan download untuk: ${url}`, 'system');
    });

    cancelBtn.addEventListener('click', () => {
        socket.emit('cancel-download');
        logToTerminal('[SYSTEM] Permintaan pembatalan download dikirim ke server.', 'warning');
        setUIStateDownloading(false);
        updateStatusBadge('idle');
    });

    // ==========================================================================
    // SOCKET.IO EVENT HANDLERS
    // ==========================================================================
    
    // Listen for raw stdout from yt-dlp
    socket.on('stdout-line', (line) => {
        logToTerminal(line);
    });

    // Listen for progress updates
    socket.on('download-progress', (progress) => {
        const { status, percent, size, speed, eta, message } = progress;

        // Update progress bar & percentage label
        percentLabel.textContent = `${percent.toFixed(1)}%`;
        progressBarFill.style.width = `${percent}%`;

        if (status === 'downloading') {
            updateStatusBadge('downloading');
            statusMessage.textContent = 'Mengunduh data video/audio...';
            statSpeed.textContent = speed || '-';
            statEta.textContent = eta || '-';
            statSize.textContent = size || '-';
        } else if (status === 'merging') {
            updateStatusBadge('merging');
            statusMessage.textContent = message || 'Menggabungkan format video dan audio...';
            statSpeed.textContent = 'Merging...';
            statEta.textContent = 'Saving...';
        }
    });

    // Listen for general status messages
    socket.on('status-update', (update) => {
        const { status, message } = update;
        
        if (status === 'starting' || status === 'extracting') {
            statusMessage.textContent = message;
            if (status === 'starting') updateStatusBadge('starting');
        } else if (status === 'warning') {
            logToTerminal(`[WARN] ${message}`, 'warning');
        } else if (status === 'canceled') {
            statusMessage.textContent = message;
            updateStatusBadge('idle');
            setUIStateDownloading(false);
        }
    });

    // Listen for successful download completion
    socket.on('download-complete', (result) => {
        logToTerminal(`[SUCCESS] ${result.message}`, 'success');
        statusMessage.textContent = result.message;
        updateStatusBadge('completed');
        
        // Full progress bar state
        percentLabel.textContent = '100%';
        progressBarFill.style.width = '100%';
        
        statSpeed.textContent = 'Done';
        statEta.textContent = 'Done';

        setUIStateDownloading(false);
    });

    // Listen for errors
    socket.on('download-error', (errorMsg) => {
        logToTerminal(`[ERROR] ${errorMsg}`, 'error');
        statusMessage.textContent = 'Proses download gagal.';
        updateStatusBadge('error');
        setUIStateDownloading(false);
    });

    // ==========================================================================
    // HELPER FUNCTIONS
    // ==========================================================================

    // Fetch cookie files from backend API
    function fetchCookies() {
        cookieSelect.disabled = true;
        cookieSelect.innerHTML = '<option disabled>Scanning workspace...</option>';
        logToTerminal('[SYSTEM] Memindai file cookies di workspace...', 'system');

        fetch('/api/cookies')
            .then(res => res.json())
            .then(data => {
                cookieSelect.disabled = false;
                if (data.success && data.cookies.length > 0) {
                    cookieSelect.innerHTML = '';
                    data.cookies.forEach(file => {
                        const option = document.createElement('option');
                        option.value = file;
                        option.textContent = file;
                        // Select Untitled-2.txt by default if it exists
                        if (file === 'Untitled-2.txt') {
                            option.selected = true;
                        }
                        cookieSelect.appendChild(option);
                    });
                    logToTerminal(`[SYSTEM] Menemukan ${data.cookies.length} file cookies di workspace.`, 'success');
                } else {
                    cookieSelect.innerHTML = '<option value="">(Tidak ada file cookies ditemukan)</option>';
                    logToTerminal('[WARN] Tidak ada file cookies (.txt / .json) yang ditemukan di workspace.', 'warning');
                }
            })
            .catch(err => {
                cookieSelect.disabled = false;
                cookieSelect.innerHTML = '<option value="">Gagal memuat cookies</option>';
                logToTerminal(`[ERROR] Gagal memuat cookies: ${err.message}`, 'error');
            });
    }

    // Append logs to the scrollable terminal console window
    function logToTerminal(text, type = '') {
        const cleanText = text.trim();
        if (!cleanText) return;

        // Split text by newlines if yt-dlp outputs multiple lines at once
        const lines = cleanText.split('\n');

        lines.forEach(line => {
            const lineEl = document.createElement('div');
            lineEl.className = 'log-line';
            lineEl.textContent = line;

            // Apply coloring classes depending on keywords/type
            if (type === 'system' || line.startsWith('[SYSTEM]')) {
                lineEl.classList.add('system-line');
            } else if (type === 'error' || line.startsWith('[ERROR]') || line.includes('ERROR:')) {
                lineEl.classList.add('error-line');
            } else if (type === 'warning' || line.startsWith('[WARN]') || line.includes('WARNING:')) {
                lineEl.classList.add('warning-line');
            } else if (type === 'success' || line.startsWith('[SUCCESS]')) {
                lineEl.classList.add('success-line');
            }

            terminalLogs.appendChild(lineEl);
        });

        // Auto-scroll to the bottom of the log console
        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }

    function clearTerminalLogs() {
        terminalLogs.innerHTML = '';
        logToTerminal('[SYSTEM] Log dibersihkan.', 'system');
    }

    // Toggle form states during download activity
    function setUIStateDownloading(isDownloading) {
        videoUrlInput.disabled = isDownloading;
        cookieSelect.disabled = isDownloading;
        refreshCookiesBtn.disabled = isDownloading;

        if (isDownloading) {
            startBtn.classList.add('hidden');
            cancelBtn.classList.remove('hidden');
        } else {
            startBtn.classList.remove('hidden');
            cancelBtn.classList.add('hidden');
        }
    }

    function resetProgressDisplay() {
        percentLabel.textContent = '0%';
        progressBarFill.style.width = '0%';
        statusMessage.textContent = 'Menghubungkan ke server download...';
        statSpeed.textContent = '-';
        statEta.textContent = '-';
        statSize.textContent = '-';
    }

    function updateStatusBadge(status) {
        // Reset classes
        statusBadge.className = 'badge';
        statusBadge.classList.add(`badge-${status}`);
        
        // Capitalize status text
        statusBadge.textContent = status === 'idle' ? 'Idle' : 
                                 status === 'starting' ? 'Starting' :
                                 status === 'downloading' ? 'Downloading' :
                                 status === 'merging' ? 'Merging' :
                                 status === 'completed' ? 'Completed' : 'Error';
    }
});
