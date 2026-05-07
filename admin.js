// Admin Application Logic

// Mock data simulating a database of aggregated rep reports
const mockDatabase = [
    { date: "2026-05-06T09:12:00Z", repId: "John Doe", device: "Meta Quest 3", status: "Operational", notes: "All good" },
    { date: "2026-05-06T10:05:00Z", repId: "Jane Smith", device: "Ray-Ban Meta", status: "Having Issues", notes: "Bluetooth won't pair with terminal" },
    { date: "2026-05-06T11:30:00Z", repId: "Mike Johnson", device: "Samsung Tablet", status: "Broken/Unusable", notes: "Screen shattered during transit" },
    { date: "2026-05-06T14:45:00Z", repId: "Sarah Connor", device: "Meta Quest 3", status: "Having Issues", notes: "Controllers not tracking correctly" },
    { date: "2026-05-06T15:20:00Z", repId: "John Doe", device: "Samsung Demo Device", status: "Operational", notes: "" }
];

const adminApp = {
    currentUser: null,
    currentData: [],
    usersCache: {},
    reportsCache: [],
    requestsCache: [],

    switchTab: function(tab) {
        document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        
        if (tab === 'login') {
            document.getElementById('auth-login').classList.remove('hidden');
            document.getElementById('auth-signup').classList.add('hidden');
        } else {
            document.getElementById('auth-login').classList.add('hidden');
            document.getElementById('auth-signup').classList.remove('hidden');
        }
        document.getElementById('auth-error').innerText = "";
    },

    signup: async function() {
        const first = document.getElementById('signup-first').value.trim();
        const last = document.getElementById('signup-last').value.trim();
        const date = document.getElementById('signup-date').value;
        const email = document.getElementById('signup-email').value.trim().toLowerCase();
        const pass = document.getElementById('signup-pass').value;
        const errorEl = document.getElementById('auth-error');

        if (!first || !last || !date || !email || !pass) {
            errorEl.innerText = "Please fill in all fields.";
            return;
        }

        if (!email.endsWith('@2020companies.com')) {
            errorEl.innerText = "Email must be a @2020companies.com domain.";
            return;
        }

        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            const userData = { first, last, hireDate: date, role: 'admin' };
            await db.collection('admins').doc(email).set(userData);
            this._completeLogin(userData, email);
        } catch (error) {
            errorEl.innerText = error.message;
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
            await auth.signInWithEmailAndPassword(email, pass);
            const doc = await db.collection('admins').doc(email).get();
            if (doc.exists) {
                this._completeLogin(doc.data(), email);
            } else {
                errorEl.innerText = "Admin profile not found.";
            }
        } catch (error) {
            errorEl.innerText = "Invalid email or password.";
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
        });

        // Real-time listener for reports
        db.collection('reports').onSnapshot((snapshot) => {
            const reports = [];
            snapshot.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));
            this.reportsCache = reports.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.currentData = [...this.reportsCache, ...mockDatabase].sort((a, b) => new Date(b.date) - new Date(a.date));
            this.renderTable(this.currentData);
            this.updateStats(this.currentData);
        });

        // Real-time listener for credential requests
        db.collection('credential_requests').onSnapshot((snapshot) => {
            const requests = [];
            snapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
            this.requestsCache = requests.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.loadRequests();
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
            
            const toggles = user.toggles || { vr: true, glasses: true, tablet: true, demo: true };
            const statuses = user.statuses || {};
            const dynDevices = user.dynamicDevices || [];
            
            // Define base fleet devices
            const baseDevices = [
                { id: 'vr', name: 'Meta Quest 3', icon: 'ph-headset' },
                { id: 'glasses', name: 'Ray-Ban Meta', icon: 'ph-sunglasses' },
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
            if (user.sn_history && user.sn_history.length > 0) {
                const historyItems = user.sn_history.slice().reverse().map(h => {
                    const d = new Date(h.date);
                    const dStr = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                    return `
                        <div style="font-size: 11px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                            <span class="text-muted">${dStr}</span>
                            <span>${h.deviceName}: <b>${h.sn}</b></span>
                        </div>
                    `;
                }).join('');

                historyHtml = `
                    <div style="margin-top: 12px; border-top: 1px solid var(--border); padding-top: 12px;">
                        <h5 style="margin: 0 0 8px 0; font-size: 11px; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <i class="ph ph-clock-counter-clockwise"></i> View SN Audit Log
                        </h5>
                        <div style="display: none; background: #F5F6F7; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-highlight); max-height: 100px; overflow-y: auto;">
                            ${historyItems}
                        </div>
                    </div>
                `;
            }

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

    updateDeviceStatus: async function(email, deviceId, newStatus) {
        try {
            const user = this.usersCache[email];
            if (!user) return;
            if (!user.statuses) user.statuses = {};
            
            user.statuses[deviceId] = newStatus;
            
            await db.collection('users').doc(email).set(user);
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

    updateStats: function(data) {
        const stats = { operational: 0, issues: 0, broken: 0 };
        data.forEach(r => {
            if (r.status === 'Operational') stats.operational++;
            else if (r.status === 'Having Issues') stats.issues++;
            else stats.broken++;
        });
        document.getElementById('stat-online').innerText = stats.operational;
        document.getElementById('stat-issues').innerText = stats.issues;
        document.getElementById('stat-broken').innerText = stats.broken;
    },

    renderTable: function(data) {
        const tbody = document.querySelector('#reports-table tbody');
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
            if (status.toLowerCase().includes('operational') || status === 'closed') statusBadge = `<span class="status-indicator online">${status}</span>`;
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
            const rowId = `report-row-${idx}`;

            html += `
                <tr style="cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='var(--surface-hover)'" onmouseout="this.style.backgroundColor='transparent'" onclick="document.getElementById('${rowId}-details').style.display = document.getElementById('${rowId}-details').style.display === 'none' ? 'table-row' : 'none'">
                    <td class="text-muted">${dateStr}</td>
                    <td style="font-weight: 500;">${repName}</td>
                    <td>${deviceName}</td>
                    <td>${statusBadge}</td>
                    <td class="text-muted" style="max-width: 200px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px;">${summaryText}</span>
                            <i class="ph ph-caret-down"></i>
                        </div>
                    </td>
                </tr>
                <tr id="${rowId}-details" style="display: none; background-color: var(--bg-body);">
                    <td colspan="5" style="padding: 12px 16px; font-size: 13px; color: var(--text-main); white-space: normal; border-left: 4px solid var(--primary);">
                        ${fullNotes}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    filterTable: function() {
        const query = document.getElementById('search-input').value.toLowerCase();
        
        const filtered = this.currentData.filter(row => {
            return (
                row.repId.toLowerCase().includes(query) ||
                row.device.toLowerCase().includes(query) ||
                row.status.toLowerCase().includes(query)
            );
        });

        this.renderTable(filtered);
    },

    exportToCSV: function() {
        const users = JSON.parse(localStorage.getItem('rep_users') || "{}");
        const userEmails = Object.keys(users);
        
        if (userEmails.length === 0) {
            alert("No fleet data available to export.");
            return;
        }

        const headers = "Representative Name,Email,Meta Quest 3,Ray-Ban Meta,Samsung Tablet,Samsung Demo Device,Additional Smart Glasses\n";
        let csvRows = [];

        userEmails.forEach(email => {
            const user = users[email];
            const toggles = user.toggles || { vr: true, glasses: true, tablet: true, demo: true };
            const statuses = user.statuses || {};
            const dynDevices = user.dynamicDevices || [];
            
            const repName = `${user.first} ${user.last}`;

            const getStatus = (id) => toggles[id] !== false ? (statuses[id] || 'Operational') : 'Not Assigned';

            const vrStatus = getStatus('vr');
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

            csvRows.push(`"${repName}","${email}","${vrStatus}","${glassesStatus}","${tabletStatus}","${demoStatus}","${additionalStr}"`);
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "live_fleet_profiles.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    adminApp.checkSession();
});
