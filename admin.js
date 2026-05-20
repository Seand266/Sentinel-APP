// Admin Application Logic

let secondaryApp;
try {
    secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
} catch(e) {
    secondaryApp = firebase.app("Secondary");
}

const adminApp = {
    logDeviceHealth: function(sn, status, eventType) {
        if (!sn || sn === 'Cleared' || sn === 'Unknown') return;
        const adminName = "Admin";
        db.collection('device_health_logs').add({
            serialNumber: sn,
            timestamp: new Date().toISOString(),
            status: status,
            eventType: eventType,
            repId: adminName
        });
    },

    // --- Logger Service ---
    logger: {
        // Generated once per page load — groups all events from a single visit
        sessionId: 'sess_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now(),
        _lastViewTime: Date.now(),
        _lastView: null,

        logView: function(viewId) {
            const now = Date.now();
            const timeOnPrev = this._lastView ? Math.round((now - this._lastViewTime) / 1000) : null;
            this._lastViewTime = now;
            this._lastView = viewId;
            const extra = timeOnPrev !== null ? { timeOnPreviousViewSec: timeOnPrev, previousView: this._lastView } : {};
            this._writeLog('page_view', `Admin: ${viewId}`, extra);
        },
        logEvent: function(eventName, details = {}) {
            this._writeLog('interaction', eventName, details);
        },
        _getEnrichedMeta: function() {
            // Platform from userAgent
            const ua = navigator.userAgent;
            let platform = 'Unknown';
            if (/iPhone|iPad|iPod/.test(ua)) platform = 'iOS';
            else if (/Android/.test(ua)) platform = 'Android';
            else if (/Windows/.test(ua)) platform = 'Windows';
            else if (/Mac OS/.test(ua)) platform = 'macOS';
            else if (/Linux/.test(ua)) platform = 'Linux';

            // Connection type (not available on all browsers)
            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            const connectionType = conn ? (conn.effectiveType || conn.type || 'unknown') : 'unavailable';

            return {
                sessionId: this.sessionId,
                platform: platform,
                screenResolution: `${screen.width}x${screen.height}`,
                language: navigator.language || 'unknown',
                connectionType: connectionType,
                referrer: document.referrer || 'direct'
            };
        },
        _writeLog: async function(type, viewOrEvent, details = {}) {
            try {
                const userId = adminApp.currentUser ? adminApp.currentUser.email : "anonymous_admin";
                const enriched = this._getEnrichedMeta();
                const logData = {
                    timestamp: new Date().toISOString(),
                    view: viewOrEvent,
                    userId: userId,
                    userAgent: navigator.userAgent,
                    type: type,
                    ...enriched,
                    ...details
                };
                
                console.debug('[Logger] Writing log:', logData);
                db.collection('view_logs').add(logData).catch((err) => {
                    console.error('[Logger] Firestore write FAILED:', err.message, logData);
                });
            } catch (err) {
                console.error('[Logger] Internal error in _writeLog:', err);
            }
        }
    },

    currentUser: null,
    currentData: [],
    usersCache: {},
    reportsCache: [],
    diagCache: [],
    requestsCache: [],
    logsCache: [],



    resetPassword: async function() {
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const errorEl = document.getElementById('auth-error');
        if (!email) {
            errorEl.innerText = "Please enter your email address above first to request a reset.";
            errorEl.style.color = 'var(--danger)';
            return;
        }
        try {
            await db.collection('reset_requests').add({
                email: email,
                date: new Date().toISOString()
            });
            if (typeof emailjs !== 'undefined') {
                emailjs.send("service_syb4oto", "template_0tx65cr", {
                    ticket_type: "Admin Account Reset Request",
                    rep_name: email,
                    details: "An admin has requested a password reset/clear."
                }).catch(e => console.error(e));
            }
            errorEl.innerText = "Account reset request sent! Please wait for an Admin to clear your account before trying to sign up again.";
            errorEl.style.color = 'var(--success)';
        } catch (err) {
            errorEl.innerText = "Error: " + err.message;
            errorEl.style.color = 'var(--danger)';
        }
    },

    login: async function() {
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const pass = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('auth-error');

        if (!email || !pass) {
            errorEl.innerText = "Please fill in all fields.";
            return;
        }

        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await auth.signInWithEmailAndPassword(email, pass);
            const doc = await db.collection('admins').doc(email).get();
            if (doc.exists) {
                this._completeLogin(doc.data(), email);
            } else {
                errorEl.innerText = "Admin profile not found.";
            }
        } catch (error) {
            console.error("Login error details:", error);
            errorEl.innerText = "Invalid email or password. Details: " + error.message;
        }
    },

    logout: async function() {
        await auth.signOut();
        this.currentUser = null;
        document.getElementById('admin-content').style.display = 'none';
        document.getElementById('view-auth').classList.add('flex-active');
        document.getElementById('login-pass').value = '';
    },

    _completeLogin: function(userData, email) {
        this.currentUser = { ...userData, email };
        document.getElementById('view-auth').classList.remove('flex-active');
        document.getElementById('admin-content').style.display = 'flex';
        
        this.loadData();
    },

    checkSession: function() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const doc = await db.collection('admins').doc(user.email).get();
                if (doc.exists) {
                    this._completeLogin(doc.data(), user.email);
                }
            } else {
                this.logout();
            }
        });
    },

    loadData: function() {
        // Real-time listener for users
        db.collection('users').onSnapshot((snapshot) => {
            const users = {};
            snapshot.forEach(doc => {
                users[doc.id] = doc.data();
            });
            this.usersCache = users;
            this.loadUsers();
            this.updateAnalytics();
        });

        // Real-time listener for reports
        db.collection('reports').onSnapshot((snapshot) => {
            const allReports = [];
            snapshot.forEach(doc => allReports.push({ id: doc.id, ...doc.data() }));
            
            const standardReports = allReports.filter(r => r.model !== 'Diagnostic Run');
            const diagReports = allReports.filter(r => r.model === 'Diagnostic Run');

            this.reportsCache = standardReports.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.diagCache = diagReports.sort((a, b) => new Date(b.date) - new Date(a.date));

            this.renderTable(this.reportsCache, 'reports-table');
            this.renderTable(this.diagCache, 'diagnostics-table');
            this.updateStats(allReports);
        });

        // Real-time listener for credential requests
        db.collection('credential_requests').onSnapshot((snapshot) => {
            const requests = [];
            snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
            this.requestsCache = requests.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.loadRequests();
        });

        // Real-time listener for reset requests
        db.collection('reset_requests').onSnapshot((snapshot) => {
            const resets = [];
            snapshot.forEach(doc => resets.push({ id: doc.id, ...doc.data() }));
            this.resetsCache = resets.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.loadResets();
        });

        // Real-time listener for replacement requests
        db.collection('replacement_requests').onSnapshot((snapshot) => {
            const replacements = [];
            snapshot.forEach(doc => replacements.push({ id: doc.id, ...doc.data() }));
            this.replacementsCache = replacements.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.loadReplacements();
        });

        // Real-time listener for FAQs
        db.collection('faqs').onSnapshot((snapshot) => {
            const faqs = [];
            snapshot.forEach(doc => faqs.push({ id: doc.id, ...doc.data() }));
            faqs.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
            this.renderAdminFaqs(faqs);
        });

        // Real-time listener for admins
        db.collection('admins').onSnapshot((snapshot) => {
            const adminsList = [];
            snapshot.forEach(doc => adminsList.push({ email: doc.id, ...doc.data() }));
            this.renderAdminsList(adminsList);
        });

        // Real-time listener for view_logs (limit to 500 to prevent crashing)
        db.collection('view_logs').orderBy('timestamp', 'desc').limit(500).onSnapshot((snapshot) => {
            const logs = [];
            snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
            this.logsCache = logs;
            this.renderLogsTable(logs);
        });
    },

    loadUsers: function(searchQuery = '') {
        const users = this.usersCache;
        const container = document.getElementById('users-grid');
        let html = '';

        const userEmails = Object.keys(users);
        if (userEmails.length === 0) {
            container.innerHTML = '<div class="text-muted text-center" style="grid-column: 1 / -1; width: 100%;">No representative accounts found.</div>';
            return;
        }

        const query = searchQuery.toLowerCase();
        let visibleCount = 0;

        userEmails.forEach(email => {
            const user = users[email];
            const fullName = `${user.first} ${user.last}`.toLowerCase();
            
            if (query && !fullName.includes(query) && !email.toLowerCase().includes(query)) {
                return;
            }
            visibleCount++;

            let devicesHtml = '';
            
            const toggles = user.toggles || { vr: true, vr3s: true, glasses: true, tablet: true, demo: true };
            const statuses = user.statuses || {};
            const dynDevices = user.dynamicDevices || [];
            
            // Define base fleet devices
            const baseDevices = [
                { id: 'vr', name: 'Meta Quest 3', icon: 'ph-headset' },
                { id: 'vr3s', name: 'Meta Quest 3S', icon: 'ph-headset' },
                { id: 'glasses', name: 'Ray-Ban Meta Gen 2', icon: 'ph-sunglasses' },
                { id: 'tablet', name: 'Samsung Tablet', icon: 'ph-device-tablet' },
                { id: 'demo', name: 'Samsung Demo Device', icon: 'ph-device-mobile' }
            ];
            
            let activeDevices = 0;

            // Process base devices
            baseDevices.forEach(d => {
                if (toggles[d.id] !== false) {
                    activeDevices++;
                    const status = statuses[d.id] || 'Operational';
                    const sn = (user.sns && user.sns[d.id]) ? `SN: ${user.sns[d.id]}` : 'SN: Not Set';
                    let badgeClass = 'online';
                    if (status === 'Having Issues') badgeClass = 'warning';
                    if (status === 'Broken/Unusable') badgeClass = 'error';
                    
                    devicesHtml += `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
                            <span style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="ph ${d.icon}" style="font-size: 14px;"></i> ${d.name}</span>
                                <span style="font-size: 10px; color: var(--text-muted);">${sn}</span>
                            </span>
                            <select class="status-indicator ${badgeClass}" style="padding: 2px 6px; font-size: 10px; border: none; outline: none; cursor: pointer; appearance: auto;" onchange="adminApp.updateDeviceStatus('${email}', '${d.id}', this.value)">
                                <option value="Operational" ${status === 'Operational' ? 'selected' : ''}>Operational</option>
                                <option value="Having Issues" ${status === 'Having Issues' ? 'selected' : ''}>Having Issues</option>
                                <option value="Broken/Unusable" ${status === 'Broken/Unusable' ? 'selected' : ''}>Broken/Unusable</option>
                            </select>
                        </div>
                    `;
                }
            });

            // Process dynamic devices
            dynDevices.forEach(d => {
                if (toggles[d.key] !== false) {
                    activeDevices++;
                    const status = statuses[d.key] || 'Operational';
                    const sn = (user.sns && user.sns[d.key]) ? `SN: ${user.sns[d.key]}` : 'SN: Not Set';
                    let badgeClass = 'online';
                    if (status === 'Having Issues') badgeClass = 'warning';
                    if (status === 'Broken/Unusable') badgeClass = 'error';
                    
                    devicesHtml += `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
                            <span style="display: flex; flex-direction: column; gap: 2px;">
                                <span style="color: var(--text-main); display: flex; align-items: center; gap: 6px;"><i class="ph ph-sunglasses" style="font-size: 14px;"></i> ${d.model}</span>
                                <span style="font-size: 10px; color: var(--text-muted);">${sn}</span>
                            </span>
                            <select class="status-indicator ${badgeClass}" style="padding: 2px 6px; font-size: 10px; border: none; outline: none; cursor: pointer; appearance: auto;" onchange="adminApp.updateDeviceStatus('${email}', '${d.key}', this.value)">
                                <option value="Operational" ${status === 'Operational' ? 'selected' : ''}>Operational</option>
                                <option value="Having Issues" ${status === 'Having Issues' ? 'selected' : ''}>Having Issues</option>
                                <option value="Broken/Unusable" ${status === 'Broken/Unusable' ? 'selected' : ''}>Broken/Unusable</option>
                            </select>
                        </div>
                    `;
                }
            });

            if (activeDevices === 0) {
                devicesHtml = '<div class="text-muted" style="font-size: 12px; font-style: italic;">No devices active.</div>';
            }

            let historyHtml = '';

            html += `
                <div class="card glass-panel" style="padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                        <div>
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; color: var(--text-main);">${user.first} ${user.last}</h4>
                            <div style="font-size: 11px; color: var(--text-muted);">${email}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="ph ph-trash" style="font-size: 18px; color: var(--danger); cursor: pointer; transition: transform 0.2s;" title="Delete User Account" onclick="adminApp.deleteUser('${email}')" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></i>
                            <i class="ph ph-user-circle" style="font-size: 24px; color: var(--primary);"></i>
                        </div>
                    </div>
                    <div>
                        <h5 style="margin: 0 0 8px 0; font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Device Fleet</h5>
                        ${devicesHtml}
                    </div>
                    ${historyHtml}
                </div>
            `;
        });

        if (visibleCount === 0) {
            container.innerHTML = '<div class="text-muted text-center" style="grid-column: 1 / -1; width: 100%;">No representatives match your search.</div>';
        } else {
            container.innerHTML = html;
        }
    },

    filterReps: function() {
        const query = document.getElementById('rep-search-input').value;
        this.loadUsers(query);
    },

    deleteUser: async function(email) {
        if(confirm(`Are you absolutely SURE you want to permanently delete the account for ${email}? This will erase their fleet profile, history, and active sessions. This action cannot be undone.`)) {
            try {
                await db.collection('users').doc(email).delete();
                alert("User account successfully deleted.");
            } catch (err) {
                alert("Failed to delete user: " + err.message);
            }
        }
    },

    migrateCredentials: async function() {
        const btn = document.getElementById('btn-migrate-creds');
        const statusEl = document.getElementById('migration-status');
        const progressContainer = document.getElementById('migration-progress-container');
        const progressBar = document.getElementById('migration-progress-bar');
        const progressText = document.getElementById('migration-progress-text');
        const progressPct = document.getElementById('migration-progress-pct');
        const logEl = document.getElementById('migration-log');

        if (!btn || !statusEl || !progressContainer || !progressBar || !progressText || !progressPct || !logEl) {
            console.error('[Migration] Critical UI elements missing.');
            return;
        }

        // Disable button, initialize UI
        btn.disabled = true;
        statusEl.innerText = "Status: Processing...";
        progressContainer.style.display = 'block';
        logEl.style.display = 'block';
        logEl.innerHTML = '';
        progressBar.style.width = '0%';
        progressText.innerText = 'Initializing...';
        progressPct.innerText = '0%';

        function addLog(msg, type = 'info') {
            let color = 'var(--text-main)';
            if (type === 'error') color = 'var(--danger)';
            else if (type === 'success') color = 'var(--success)';
            else if (type === 'warning') color = '#ffaa00';
            
            logEl.innerHTML += `<div style="color: ${color}; margin-bottom: 4px;">[${new Date().toLocaleTimeString()}] ${msg}</div>`;
            logEl.scrollTop = logEl.scrollHeight;
        }

        addLog('Starting secure credentials migration...', 'info');

        try {
            progressBar.style.width = '50%';
            progressPct.innerText = '50%';
            progressText.innerText = 'Fetching sheets data and matching active representative records on server...';
            addLog('Requesting cloud execution of syncSpreadsheetCredentials...', 'info');

            const syncFunc = firebase.app().functions('us-central1').httpsCallable('syncSpreadsheetCredentials');
            const result = await syncFunc();

            const { success, migratedCount, skippedCount } = result.data;

            progressBar.style.width = '100%';
            progressPct.innerText = '100%';
            progressText.innerText = 'Synchronization completed.';

            if (success) {
                statusEl.innerText = `Status: Complete! ${migratedCount} migrated, ${skippedCount} skipped.`;
                statusEl.style.color = 'var(--success)';
                
                addLog('============================================', 'info');
                addLog(`Synchronization Finished Successfully!`, 'success');
                addLog(`- Securely Migrated to Firestore: ${migratedCount}`, 'success');
                addLog(`- Skipped/Matched Spreadsheet Records: ${skippedCount}`, 'warning');
                addLog('Safe to Lock Down Sheet! You can now set the Google Sheet to "Restricted" in Google Drive.', 'success');
            } else {
                throw new Error("Cloud Function completed but returned unsuccessful status.");
            }

        } catch (err) {
            console.error('[Migration] Failed:', err);
            progressBar.style.width = '100%';
            progressPct.innerText = '100%';
            addLog(`[CRITICAL ERROR] Synchronization halted: ${err.message}`, 'error');
            statusEl.innerText = "Status: Failed";
            statusEl.style.color = 'var(--danger)';
        } finally {
            btn.disabled = false;
        }
    },

    updateDeviceStatus: async function(email, deviceId, newStatus) {
        try {
            const user = this.usersCache[email];
            if (!user) return;
            if (!user.statuses) user.statuses = {};
            
            user.statuses[deviceId] = newStatus;
            
            await db.collection('users').doc(email).set(user);
            
            const sn = (user.sns && user.sns[deviceId]) ? user.sns[deviceId] : 'Unknown';
            this.logDeviceHealth(sn, newStatus, 'Admin Status Override');
        } catch (err) {
            alert("Failed to update device status: " + err.message);
            this.loadUsers(document.getElementById('rep-search-input').value); // Revert UI
        }
    },

    deleteReport: async function(reportId) {
        if(confirm("Are you sure you want to permanently delete this report?")) {
            try {
                await db.collection('reports').doc(reportId).delete();
                // onSnapshot will auto-refresh
            } catch (err) {
                alert("Failed to delete report: " + err.message);
            }
        }
    },

    toggleSelectAll: function(tableId, isChecked) {
        document.querySelectorAll(`.report-checkbox-${tableId}`).forEach(cb => cb.checked = isChecked);
    },

    deleteSelectedReports: async function(tableId) {
        const checkboxes = document.querySelectorAll(`.report-checkbox-${tableId}:checked`);
        if (checkboxes.length === 0) {
            alert("Please select at least one report to delete.");
            return;
        }

        if(confirm(`Are you absolutely SURE you want to permanently delete these ${checkboxes.length} reports?`)) {
            for (const cb of checkboxes) {
                try {
                    await db.collection('reports').doc(cb.value).delete();
                } catch(e) {
                    console.error("Error deleting report", cb.value, e);
                }
            }
            // Real-time listener will auto-refresh the tables
            document.querySelector(`#${tableId} thead input[type="checkbox"]`).checked = false;
        }
    },

    loadRequests: function() {
        const requests = this.requestsCache;
        const tbody = document.querySelector('#credentials-table tbody');
        let html = '';

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;" class="text-muted">No pending requests.</td></tr>';
            return;
        }

        // Clone and sort to show newest first
        const sorted = [...requests].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(row => {
            const d = new Date(row.date);
            const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            
            const escapedName = row.repName.replace(/"/g, '&quot;').replace(/'/g, "\\'");
            const escapedSystem = row.system.replace(/"/g, '&quot;').replace(/'/g, "\\'");
            const escapedReason = row.reason.replace(/"/g, '&quot;').replace(/'/g, "\\'");

            html += `
                <tr>
                    <td class="text-muted">${dateStr}</td>
                    <td style="font-weight: 500;">${row.repName}</td>
                    <td>${row.system}</td>
                    <td class="text-muted" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${row.reason.replace(/"/g, '&quot;')}">${row.reason}</td>
                    <td>
                        <button class="btn primary" style="padding: 6px 12px; font-size: 12px;" onclick="adminApp.draftEmail('${escapedName}', '${escapedSystem}', '${escapedReason}')">
                            <i class="ph ph-envelope-simple"></i> Draft
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    draftEmail: function(repName, system, reason) {
        const subject = `Hey! Need a quick credential reset for ${repName} (${system})`;
        const body = `Hi Operations team,\n\nHope you're having a great day! Could you please help us out with a quick credential reset for one of our reps?\n\n` +
                     `Who: ${repName}\nSystem: ${system}\nWhy: ${reason}\n\nWe've already verified this request on our end.\n\nThanks so much for the help!\n- Tech Support Team`;
        window.location.href = `mailto:operationsupport@2020companies.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    clearRequests: function() {
        if(confirm("Are you sure you want to clear all pending credential requests?")) {
            this.requestsCache.forEach(async req => {
                await db.collection('credential_requests').doc(req.id).delete();
            });
            // The onSnapshot listener will automatically reload the requests
        }
    },

    loadResets: function() {
        const resets = this.resetsCache || [];
        const tbody = document.querySelector('#resets-table tbody');
        let html = '';

        if (resets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;" class="text-muted">No pending account resets.</td></tr>';
            return;
        }

        resets.forEach(row => {
            const d = new Date(row.date);
            const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            
            html += `
                <tr>
                    <td class="text-muted">${dateStr}</td>
                    <td style="font-weight: 500;">${row.email}</td>
                    <td>
                        <button class="btn" style="background: transparent; color: var(--success); border: 1px solid var(--success); font-size: 12px; padding: 6px 12px;" onclick="adminApp.resolveResetRequest('${row.id}', '${row.email}')">
                            <i class="ph ph-check-circle"></i> Clear Account Data & Resolve
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    resolveResetRequest: async function(requestId, email) {
        if(confirm(`IMPORTANT: Have you already deleted ${email} from the Firebase Authentication console?\n\nIf yes, click OK to wipe their database profile and clear this ticket.`)) {
            try {
                await db.collection('users').doc(email).delete();
                await db.collection('reset_requests').doc(requestId).delete();
            } catch(e) {
                alert("Failed to resolve request: " + e.message);
            }
        }
    },

    loadReplacements: function() {
        const replacements = this.replacementsCache || [];
        const tbody = document.querySelector('#replacements-table tbody');
        if (!tbody) return;
        let html = '';

        if (replacements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;" class="text-muted">No pending replacement requests.</td></tr>';
            return;
        }

        replacements.forEach(row => {
            const d = new Date(row.date);
            const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            const escapedDevice = (row.device || '').replace(/'/g, "\\'");
            const escapedSN = (row.serialNumber || 'Not Set').replace(/'/g, "\\'");
            const escapedRep = (row.repName || '').replace(/'/g, "\\'");
            const escapedReason = (row.reason || '').replace(/'/g, "\\'");
            const escapedNotes = (row.notes || 'N/A').replace(/'/g, "\\'");

            html += `
                <tr>
                    <td class="text-muted">${dateStr}</td>
                    <td style="font-weight: 500;">${row.repName || 'Unknown'}<br><span style="font-size:11px; color:var(--text-muted);">${row.repEmail || ''}</span></td>
                    <td>${row.device || 'Unknown'}</td>
                    <td><code style="font-size:12px; background:var(--bg-base); padding:2px 6px; border-radius:4px;">${row.serialNumber || 'Not Set'}</code></td>
                    <td>${row.reason || 'N/A'}</td>
                    <td class="text-muted" style="max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${(row.notes||'').replace(/"/g,'&quot;')}">${row.notes || 'N/A'}</td>
                    <td style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn primary" style="padding:6px 10px; font-size:12px;" onclick="adminApp.draftReplacementEmail('${escapedRep}', '${escapedDevice}', '${escapedSN}', '${escapedReason}', '${escapedNotes}')">
                            <i class="ph ph-envelope-simple"></i> Draft
                        </button>
                        <button class="btn" style="padding:6px 10px; font-size:12px; background:transparent; border:1px solid var(--success); color:var(--success);" onclick="adminApp.resolveReplacement('${row.id}')">
                            <i class="ph ph-check-circle"></i> Resolve
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    resolveReplacement: async function(requestId) {
        if (confirm('Mark this replacement request as resolved and remove it from the queue?')) {
            try {
                await db.collection('replacement_requests').doc(requestId).delete();
            } catch(e) {
                alert('Failed to resolve: ' + e.message);
            }
        }
    },

    clearReplacements: function() {
        if (confirm('Are you sure you want to clear ALL pending replacement requests?')) {
            (this.replacementsCache || []).forEach(async req => {
                await db.collection('replacement_requests').doc(req.id).delete();
            });
        }
    },

    draftReplacementEmail: function(repName, device, sn, reason, notes) {
        const subject = `Device Replacement Request — ${repName} (${device})`;
        const body = `Hi,\n\nWe have a device replacement request and would appreciate your assistance.\n\n` +
                     `Representative: ${repName}\nDevice: ${device}\nSerial Number: ${sn}\nReason: ${reason}\nNotes: ${notes}\n\nWe have verified this request on our end.\n\nThank you!\n- Tech Support Team`;
        window.location.href = `mailto:JDikio.Meta@2020companies.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    submitAdminReplacement: function() {
        const repName  = document.getElementById('admin-replace-rep').value.trim();
        const repEmail = document.getElementById('admin-replace-email').value.trim();
        const device   = document.getElementById('admin-replace-device').value.trim();
        const sn       = document.getElementById('admin-replace-sn').value.trim();
        const reason   = document.getElementById('admin-replace-reason').value;
        const notes    = document.getElementById('admin-replace-notes').value.trim();
        const errorEl  = document.getElementById('admin-replace-error');

        if (!repName || !device || !sn) {
            errorEl.innerText = 'Rep Name, Device, and Serial Number are required.';
            return;
        }
        errorEl.innerText = '';

        db.collection('replacement_requests').add({
            date: new Date().toISOString(),
            repName: repName,
            repEmail: repEmail || 'N/A',
            device: device,
            serialNumber: sn,
            reason: reason,
            notes: notes || 'N/A',
            store: 'Admin Entry'
        }).then(() => {
            // Clear form
            document.getElementById('admin-replace-rep').value = '';
            document.getElementById('admin-replace-email').value = '';
            document.getElementById('admin-replace-device').value = '';
            document.getElementById('admin-replace-sn').value = '';
            document.getElementById('admin-replace-notes').value = '';
            // Auto-draft the email
            this.draftReplacementEmail(repName, device, sn, reason, notes || 'N/A');
        }).catch(e => alert('Failed to save request: ' + e.message));
    },

    updateStats: function(data) {
        const stats = { operational: 0, issues: 0, broken: 0 };
        data.forEach(r => {
            if (r.status === 'Operational') stats.operational++;
            else if (r.status === 'Having Issues') stats.issues++;
            else stats.broken++;
        });
        document.getElementById('hist-stat-online').innerText = stats.operational;
        document.getElementById('hist-stat-issues').innerText = stats.issues;
        document.getElementById('hist-stat-broken').innerText = stats.broken;
    },

    renderTable: function(data, tableId) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        let html = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;" class="text-muted">No reports found.</td></tr>';
            return;
        }

        data.forEach((row, idx) => {
            const d = new Date(row.date);
            const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            
            // Normalize properties since both mock data and real firestore data are merged
            const repName = row.repId || row.userName || 'Unknown Rep';
            const deviceName = row.device || row.deviceName || 'Unknown Device';
            const status = row.status || 'open';
            
            let statusBadge = '';
            if (status.toLowerCase().includes('operational') || status === 'closed' || status.toLowerCase().includes('resolved')) statusBadge = `<span class="status-indicator online">${status}</span>`;
            else if (status.toLowerCase().includes('issue') || status === 'open') statusBadge = `<span class="status-indicator warning">${status}</span>`;
            else statusBadge = `<span class="status-indicator error">${status}</span>`;

            // Build the expanded notes content
            let fullNotes = '';
            if (row.notes) fullNotes += `<div style="margin-bottom: 4px;"><b>Notes:</b> ${row.notes}</div>`;
            if (row.issuePath) fullNotes += `<div style="margin-bottom: 4px;"><b>Diagnostic Path:</b> ${row.issuePath}</div>`;
            if (row.resolution) fullNotes += `<div style="margin-bottom: 4px;"><b>Resolution:</b> ${row.resolution}</div>`;
            if (row.photoUrl) fullNotes += `<div><a href="${row.photoUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">View Uploaded Photo</a></div>`;
            if (row.id) fullNotes += `<div style="margin-top: 12px;"><button class="btn" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); font-size: 11px; padding: 4px 12px; cursor: pointer; border-radius: var(--radius-sm);" onclick="adminApp.deleteReport('${row.id}')"><i class="ph ph-trash"></i> Delete Report</button></div>`;
            if (!fullNotes) fullNotes = '<i>No additional notes provided.</i>';

            const summaryText = row.notes || row.resolution || 'View details';
            const rowId = `${tableId}-row-${idx}`;

            const store = row.store && row.store !== 'N/A' ? row.store : '<span class="text-muted">N/A</span>';
            const category = row.category && row.category !== 'N/A' ? row.category : '<span class="text-muted">N/A</span>';

            html += `
                <tr style="cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--surface-hover)'" onmouseout="this.style.backgroundColor='transparent'" onclick="if(event.target.tagName !== 'INPUT') document.getElementById('${rowId}-details').style.display = document.getElementById('${rowId}-details').style.display === 'none' ? 'table-row' : 'none'">
                    <td onclick="event.stopPropagation()" style="text-align: center;"><input type="checkbox" class="report-checkbox-${tableId}" value="${row.id}" style="cursor: pointer;"></td>
                    <td class="text-muted">${dateStr}</td>
                    <td style="font-weight: 500;">${repName}</td>
                    <td>${deviceName}</td>
                    <td>${store}</td>
                    <td>${statusBadge}</td>
                    <td>${category}</td>
                    <td class="text-muted" style="max-width: 200px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px;">${summaryText}</span>
                            <i class="ph ph-caret-down"></i>
                        </div>
                    </td>
                </tr>
                <tr id="${rowId}-details" style="display: none; background-color: var(--bg-body);">
                    <td colspan="8" style="padding: 12px 16px; font-size: 13px; color: var(--text-main); white-space: normal; border-left: 4px solid var(--primary);">
                        ${fullNotes}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    filterTable: function() {
        const query = document.getElementById('search-input').value.toLowerCase();
        
        const filtered = this.reportsCache.filter(row => {
            return (
                row.repId.toLowerCase().includes(query) ||
                row.device.toLowerCase().includes(query) ||
                row.status.toLowerCase().includes(query)
            );
        });

        this.renderTable(filtered, 'reports-table');
    },

    filterDiagTable: function() {
        const query = document.getElementById('diag-search-input').value.toLowerCase();
        
        const filtered = this.diagCache.filter(row => {
            return (
                row.repId.toLowerCase().includes(query) ||
                row.device.toLowerCase().includes(query) ||
                row.status.toLowerCase().includes(query)
            );
        });

        this.renderTable(filtered, 'diagnostics-table');
    },

    searchDeviceHistory: async function() {
        const query = document.getElementById('sn-search-input').value.trim();
        const resultsContainer = document.getElementById('device-health-results');
        const tbody = document.querySelector('#device-health-table tbody');
        const flagAlert = document.getElementById('reliability-flag');

        if (!query) {
            resultsContainer.style.display = 'none';
            return;
        }

        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Searching...</td></tr>';
        resultsContainer.style.display = 'block';
        flagAlert.style.display = 'none';

        try {
            const snapshot = await db.collection('device_health_logs')
                .where('serialNumber', '==', query)
                .get();

            const logs = [];
            snapshot.forEach(doc => logs.push(doc.data()));

            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;" class="text-muted">No history found for this Serial Number.</td></tr>';
                return;
            }

            // Sort newest first
            logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            let html = '';
            let downEvents30Days = 0;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            logs.forEach(log => {
                const d = new Date(log.timestamp);
                const dateStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                
                let statusBadge = '';
                if (log.status.toLowerCase().includes('operational')) statusBadge = `<span class="status-indicator online">${log.status}</span>`;
                else if (log.status.toLowerCase().includes('issue')) statusBadge = `<span class="status-indicator warning">${log.status}</span>`;
                else statusBadge = `<span class="status-indicator error">${log.status}</span>`;

                html += `
                    <tr>
                        <td class="text-muted" style="padding-left: 16px;">${dateStr}</td>
                        <td style="font-weight: 500;">${log.eventType}</td>
                        <td>${statusBadge}</td>
                        <td class="text-muted">${log.repId}</td>
                    </tr>
                `;

                if (log.status === 'Having Issues' || log.status === 'Broken/Unusable') {
                    if (d >= thirtyDaysAgo) {
                        downEvents30Days++;
                    }
                }
            });

            tbody.innerHTML = html;

            if (downEvents30Days >= 2) {
                flagAlert.style.display = 'flex';
            }

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Error searching logs: ${err.message}</td></tr>`;
        }
    },

    switchAdminTab: function(tabId) {
        document.querySelectorAll('.admin-tab-btn').forEach(b => {
            b.classList.remove('primary');
            b.classList.add('secondary');
        });
        document.getElementById(`tab-btn-${tabId}`).classList.remove('secondary');
        document.getElementById(`tab-btn-${tabId}`).classList.add('primary');

        document.getElementById('admin-view-data').style.display = 'none';
        document.getElementById('admin-view-replacements').style.display = 'none';
        document.getElementById('admin-view-analytics').style.display = 'none';
        document.getElementById('admin-view-faq').style.display = 'none';
        document.getElementById('admin-view-admins').style.display = 'none';
        document.getElementById('admin-view-logs').style.display = 'none';
        
        document.getElementById(`admin-view-${tabId}`).style.display = 'block';
        if (tabId === 'analytics') {
            this.updateAnalytics();
        }

        if(this.logger) this.logger.logView(`admin_${tabId}`);
    },

    createAdmin: async function() {
        const first = document.getElementById('new-admin-first').value.trim();
        const last = document.getElementById('new-admin-last').value.trim();
        const email = document.getElementById('new-admin-email').value.trim().toLowerCase();
        const pass = document.getElementById('new-admin-pass').value;
        const confirmPass = document.getElementById('new-admin-confirm-pass').value;
        const errorEl = document.getElementById('create-admin-error');
        const btn = document.getElementById('btn-create-admin');

        errorEl.innerText = "";

        if (!first || !last || !email || !pass || !confirmPass) {
            errorEl.innerText = "Please fill in all fields.";
            errorEl.style.color = "var(--danger)";
            return;
        }

        if (pass !== confirmPass) {
            errorEl.innerText = "Passwords do not match.";
            errorEl.style.color = "var(--danger)";
            return;
        }

        if (!email.endsWith('@2020companies.com')) {
            errorEl.innerText = "Email must be a @2020companies.com domain.";
            errorEl.style.color = "var(--danger)";
            return;
        }

        btn.disabled = true;
        btn.innerHTML = 'Provisioning... <i class="ph ph-spinner ph-spin"></i>';

        try {
            // Use the secondary app to create the user so the current admin is NOT logged out
            await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
            await secondaryApp.auth().signOut();
            
            // Write to the admins collection using the PRIMARY app (which is logged in as an admin)
            await db.collection('admins').doc(email).set({
                first: first,
                last: last,
                role: 'admin'
            });

            // Clear form
            document.getElementById('new-admin-first').value = '';
            document.getElementById('new-admin-last').value = '';
            document.getElementById('new-admin-email').value = '';
            document.getElementById('new-admin-pass').value = '';
            document.getElementById('new-admin-confirm-pass').value = '';
            
            errorEl.innerText = "Administrator account successfully provisioned!";
            errorEl.style.color = "var(--success)";
        } catch (error) {
            errorEl.innerText = error.message;
            errorEl.style.color = "var(--danger)";
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Provision Administrator <i class="ph ph-shield-plus"></i>';
        }
    },

    deleteAdmin: async function(email) {
        if(email === this.currentUser.email) {
            alert("You cannot delete your own admin account.");
            return;
        }
        if(confirm(`Are you sure you want to revoke admin access for ${email}? NOTE: This only removes their dashboard access. Their Firebase Auth account must be deleted manually if required.`)) {
            try {
                await db.collection('admins').doc(email).delete();
            } catch(e) {
                alert("Error deleting admin: " + e.message);
            }
        }
    },

    renderAdminsList: function(adminsList) {
        const container = document.getElementById('admin-list');
        if (!container) return;
        
        if (adminsList.length === 0) {
            container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 20px;">No administrators found.</div>';
            return;
        }

        let html = '';
        adminsList.forEach(admin => {
            const isMe = admin.email === this.currentUser.email;
            html += `
                <div style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; background: var(--bg-base); display: flex; justify-content: space-between; align-items: center; gap: 16px;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <i class="ph ph-shield-check" style="font-size: 32px; color: var(--primary);"></i>
                        <div>
                            <div style="font-weight: 600; font-size: 15px; margin-bottom: 2px; color: var(--text-main);">${admin.first} ${admin.last} ${isMe ? '<span style="font-size: 11px; background: var(--primary); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">You</span>' : ''}</div>
                            <div style="font-size: 13px; color: var(--text-muted);">${admin.email}</div>
                        </div>
                    </div>
                    ${!isMe ? `<button class="btn" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); height: fit-content; padding: 8px 12px; border-radius: var(--radius-sm);" onclick="adminApp.deleteAdmin('${admin.email}')" title="Revoke Admin Access">
                        <i class="ph ph-trash"></i>
                    </button>` : ''}
                </div>
            `;
        });
        container.innerHTML = html;
    },

    addFaq: async function() {
        const q = document.getElementById('admin-faq-q').value.trim();
        const a = document.getElementById('admin-faq-a').value.trim();
        const fileInput = document.getElementById('admin-faq-image');
        const btn = document.getElementById('btn-add-faq');

        if (!q || !a) {
            alert('Please provide both a question and an answer.');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = 'Publishing... <i class="ph ph-spinner ph-spin"></i>';

        try {
            let imageUrl = null;
            if (fileInput && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                imageUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = event => {
                        const img = new Image();
                        img.src = event.target.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 600;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > MAX_WIDTH) {
                                height = Math.round((height * MAX_WIDTH) / width);
                                width = MAX_WIDTH;
                            }
                            canvas.width = width;
                            canvas.height = height;
                            
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            resolve(canvas.toDataURL('image/jpeg', 0.7));
                        };
                        img.onerror = error => reject(error);
                    };
                    reader.onerror = error => reject(error);
                });
            }

            await db.collection('faqs').add({
                question: q,
                answer: a,
                imageUrl: imageUrl,
                dateAdded: new Date().toISOString()
            });
            document.getElementById('admin-faq-q').value = '';
            document.getElementById('admin-faq-a').value = '';
            if (fileInput) fileInput.value = '';
        } catch (error) {
            alert("Error adding FAQ: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Publish FAQ <i class="ph ph-plus"></i>';
        }
    },

    deleteFaq: async function(id) {
        if (!confirm('Are you sure you want to delete this FAQ?')) return;
        try {
            await db.collection('faqs').doc(id).delete();
        } catch (error) {
            alert("Error deleting FAQ: " + error.message);
        }
    },

    renderAdminFaqs: function(faqs) {
        const container = document.getElementById('admin-faq-list');
        if (!container) return;
        
        if (faqs.length === 0) {
            container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 20px;">No FAQs added yet.</div>';
            return;
        }

        let html = '';
        faqs.forEach(f => {
            const imgThumbnail = f.imageUrl ? `<img src="${f.imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--radius-sm); margin-right: 16px; border: 1px solid var(--border);">` : '';
            html += `
                <div style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; background: var(--bg-base); display: flex; justify-content: space-between; gap: 16px;">
                    <div style="display: flex; flex: 1; align-items: center;">
                        ${imgThumbnail}
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 15px; margin-bottom: 4px; color: var(--text-main);">${f.question}</div>
                            <div style="font-size: 13px; color: var(--text-muted); white-space: pre-wrap;">${f.answer}</div>
                        </div>
                    </div>
                    <button class="btn" style="background: transparent; color: var(--danger); border: 1px solid var(--danger); height: fit-content; padding: 8px 12px; border-radius: var(--radius-sm);" onclick="adminApp.deleteFaq('${f.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    updateAnalytics: function() {
        if (!this.usersCache || document.getElementById('admin-view-analytics').style.display === 'none') return;

        let totalOp = 0, totalIssue = 0, totalBroken = 0;
        let retailers = {};
        
        let models = {
            'Meta Quest 3': { op: 0, issue: 0, broken: 0 },
            'Meta Quest 3S': { op: 0, issue: 0, broken: 0 },
            'Ray-Ban Meta Gen 2': { op: 0, issue: 0, broken: 0 },
            'Samsung Tablet': { op: 0, issue: 0, broken: 0 },
            'Samsung Demo Device': { op: 0, issue: 0, broken: 0 }
        };

        Object.values(this.usersCache).forEach(u => {
            const ret = u.retailer || 'Unassigned';
            retailers[ret] = (retailers[ret] || 0) + 1;

            const t = u.toggles || {vr: true, vr3s: true, glasses: true, tablet: true, demo: true};
            const s = u.statuses || {};
            
            const checkStatus = (key, modelName) => {
                if (t[key] !== false) {
                    const stat = s[key] || 'Operational';
                    if (stat === 'Operational') { totalOp++; models[modelName].op++; }
                    else if (stat === 'Having Issues') { totalIssue++; models[modelName].issue++; }
                    else if (stat === 'Broken/Unusable') { totalBroken++; models[modelName].broken++; }
                }
            };

            checkStatus('vr', 'Meta Quest 3');
            checkStatus('vr3s', 'Meta Quest 3S');
            checkStatus('glasses', 'Ray-Ban Meta Gen 2');
            checkStatus('tablet', 'Samsung Tablet');
            checkStatus('demo', 'Samsung Demo Device');

            if (u.dynamicDevices) {
                u.dynamicDevices.forEach(d => {
                    if (t[d.key] !== false) {
                        if (!models[d.model]) models[d.model] = { op: 0, issue: 0, broken: 0 };
                        const stat = s[d.key] || 'Operational';
                        if (stat === 'Operational') { totalOp++; models[d.model].op++; }
                        else if (stat === 'Having Issues') { totalIssue++; models[d.model].issue++; }
                        else if (stat === 'Broken/Unusable') { totalBroken++; models[d.model].broken++; }
                    }
                });
            }
        });

        // Update the Global Stats cards in the dashboard
        document.getElementById('live-stat-online').innerText = totalOp;
        document.getElementById('live-stat-issues').innerText = totalIssue;
        document.getElementById('live-stat-broken').innerText = totalBroken;

        // Destroy existing charts to prevent memory leaks / overlap
        if (this.healthChart) this.healthChart.destroy();
        if (this.retailerChart) this.retailerChart.destroy();
        if (this.modelChart) this.modelChart.destroy();

        // 1. Health Pie Chart
        const ctxHealth = document.getElementById('healthPieChart').getContext('2d');
        this.healthChart = new Chart(ctxHealth, {
            type: 'pie',
            data: {
                labels: ['Operational', 'Having Issues', 'Broken'],
                datasets: [{
                    data: [totalOp, totalIssue, totalBroken],
                    backgroundColor: ['#10B981', '#F59E0B', '#EF4444']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 2. Retailer Doughnut
        const ctxRetailer = document.getElementById('retailerDoughnutChart').getContext('2d');
        this.retailerChart = new Chart(ctxRetailer, {
            type: 'doughnut',
            data: {
                labels: Object.keys(retailers),
                datasets: [{
                    data: Object.values(retailers),
                    backgroundColor: ['#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#3B82F6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        // 3. Model Bar Chart
        const ctxModel = document.getElementById('modelBarChart').getContext('2d');
        const modelLabels = Object.keys(models);
        this.modelChart = new Chart(ctxModel, {
            type: 'bar',
            data: {
                labels: modelLabels,
                datasets: [
                    { label: 'Operational', data: modelLabels.map(m => models[m].op), backgroundColor: '#10B981' },
                    { label: 'Having Issues', data: modelLabels.map(m => models[m].issue), backgroundColor: '#F59E0B' },
                    { label: 'Broken', data: modelLabels.map(m => models[m].broken), backgroundColor: '#EF4444' }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    },

    exportToCSV: function() {
        const users = this.usersCache || {};
        const userEmails = Object.keys(users);
        
        if (userEmails.length === 0) {
            alert("No fleet data available to export.");
            return;
        }

        const headers = "Representative Name,Email,Retailer,Meta Quest 3,Meta Quest 3S,Ray-Ban Meta Gen 2,Samsung Tablet,Samsung Demo Device,Additional Smart Glasses\n";
        let csvRows = [];

        userEmails.forEach(email => {
            const user = users[email];
            const toggles = user.toggles || { vr: true, vr3s: true, glasses: true, tablet: true, demo: true };
            const statuses = user.statuses || {};
            const dynDevices = user.dynamicDevices || [];
            const retailer = user.retailer || 'Unassigned';
            
            const repName = `${user.first} ${user.last}`;

            const getStatus = (id) => toggles[id] !== false ? (statuses[id] || 'Operational') : 'Not Assigned';

            const vrStatus = getStatus('vr');
            const vr3sStatus = getStatus('vr3s');
            const glassesStatus = getStatus('glasses');
            const tabletStatus = getStatus('tablet');
            const demoStatus = getStatus('demo');

            let additional = [];
            dynDevices.forEach(d => {
                if (toggles[d.key] !== false) {
                    const status = statuses[d.key] || 'Operational';
                    additional.push(`${d.model} (${status})`);
                }
            });
            const additionalStr = additional.length > 0 ? additional.join(" | ") : "None";

            csvRows.push(`"${repName}","${email}","${retailer}","${vrStatus}","${vr3sStatus}","${glassesStatus}","${tabletStatus}","${demoStatus}","${additionalStr}"`);
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "live_fleet_profiles.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    renderLogsTable: function(logsData) {
        const tbody = document.querySelector('#logs-table tbody');
        if (!tbody) return;
        
        if (logsData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No logs available.</td></tr>';
            return;
        }

        let html = '';
        logsData.forEach(log => {
            const d = new Date(log.timestamp);
            const dateStr = `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            
            let typeBadge = '';
            if (log.type === 'page_view') typeBadge = '<span class="status-indicator online">Page View</span>';
            else if (log.type === 'interaction') typeBadge = '<span class="status-indicator warning">Interaction</span>';
            else typeBadge = `<span class="status-indicator">${log.type}</span>`;

            // Build structured metadata display for all known fields
            const pill = (label, value, color = 'var(--text-muted)') =>
                value ? `<div style="display:flex; gap:6px; margin-bottom:4px; font-size:12px; align-items:baseline;">
                    <span style="color:var(--text-muted); min-width:110px; font-size:11px;">${label}</span>
                    <span style="color:${color}; font-weight:500; word-break:break-all;">${value}</span>
                </div>` : '';

            // Platform icon
            const platIcons = { iOS: 'ph-device-mobile', Android: 'ph-device-mobile', Windows: 'ph-desktop', macOS: 'ph-apple-logo', Linux: 'ph-linux-logo' };
            const platIcon = platIcons[log.platform] || 'ph-question';

            // Connection badge color
            const connColor = log.connectionType === '4g' || log.connectionType === 'wifi' ? 'var(--success)'
                : log.connectionType === '3g' ? 'var(--warning)'
                : log.connectionType === 'slow-2g' || log.connectionType === '2g' ? 'var(--danger)'
                : 'var(--text-muted)';

            // Any remaining unknown extra fields
            const knownFields = new Set(['id','timestamp','type','view','userId','userAgent','sessionId','platform','screenResolution','language','connectionType','referrer','timeOnPreviousViewSec','previousView']);
            const extras = Object.entries(log).filter(([k]) => !knownFields.has(k));

            const metadataHtml = `
                <div style="border:1px solid var(--border); border-radius:var(--radius-md); padding:10px; background:var(--bg-base);">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border);">
                        <i class="ph ${platIcon}" style="font-size:16px; color:var(--primary);"></i>
                        <span style="font-weight:600; font-size:13px;">${log.platform || 'Unknown'}</span>
                        <span style="color:var(--text-muted); font-size:11px; margin-left:4px;">${log.screenResolution || ''}</span>
                    </div>
                    ${pill('Session ID', log.sessionId ? log.sessionId.substring(0,18) + '…' : null)}
                    ${pill('Connection', log.connectionType, connColor)}
                    ${pill('Language', log.language)}
                    ${pill('Referrer', log.referrer || 'direct')}
                    ${log.timeOnPreviousViewSec != null ? pill('Prev. View Time', `${log.timeOnPreviousViewSec}s on "${log.previousView}"`) : ''}
                    ${extras.map(([k,v]) => pill(k, typeof v === 'object' ? JSON.stringify(v) : String(v))).join('')}
                    <details style="margin-top:6px;">
                        <summary style="font-size:11px; color:var(--text-muted); cursor:pointer;">Raw User Agent</summary>
                        <div style="font-size:10px; color:var(--text-muted); word-break:break-all; margin-top:4px; line-height:1.4;">${log.userAgent || 'N/A'}</div>
                    </details>
                </div>
            `;

            html += `
                <tr>
                    <td style="white-space: nowrap; color: var(--text-muted);">${dateStr}</td>
                    <td>${typeBadge}</td>
                    <td style="font-weight: 500;">${log.view}</td>
                    <td>${log.userId}</td>
                    <td style="font-size: 13px; max-width: 320px;">${metadataHtml}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    },

    filterLogsTable: function() {
        const query = document.getElementById('search-logs-input').value.toLowerCase();
        const filtered = this.logsCache.filter(log => {
            const searchStr = `${log.view} ${log.userId} ${log.type} ${log.userAgent}`.toLowerCase();
            return searchStr.includes(query);
        });
        this.renderLogsTable(filtered);
    },

    exportLogsToCSV: function() {
        const data = this.logsCache;
        if (data.length === 0) {
            alert("No logs to export.");
            return;
        }

        const headers = "Timestamp,Type,View/Action,User ID,User Agent,Details\n";
        const csvRows = [];

        data.forEach(log => {
            const details = {...log};
            delete details.id; delete details.timestamp; delete details.type; delete details.view; delete details.userId; delete details.userAgent;
            const detailsStr = Object.keys(details).length > 0 ? JSON.stringify(details).replace(/"/g, '""') : '';
            
            csvRows.push(`"${log.timestamp}","${log.type}","${log.view}","${log.userId}","${log.userAgent.replace(/"/g, '""')}","${detailsStr}"`);
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "system_logs_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    deleteAllLogs: async function() {
        const count = this.logsCache.length;
        if (count === 0) {
            alert('There are no logs to delete.');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete all ${count} log entries? This cannot be undone.`)) return;

        const btn = document.getElementById('btn-delete-logs');
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Deleting...';

        try {
            // Firestore doesn't support collection-level deletes; delete each doc by ID
            const deletePromises = this.logsCache.map(log =>
                db.collection('view_logs').doc(log.id).delete().catch(e => {
                    console.error('Failed to delete log:', log.id, e.message);
                })
            );
            await Promise.all(deletePromises);
            // The onSnapshot listener will auto-refresh the table to empty
        } catch (err) {
            alert('Error deleting logs: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-trash"></i> Delete All Logs';
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    adminApp.checkSession();
});
