// SENTINEL - Main Application Logic

const logicTreeNodes = {
    start: { question: "What is the primary issue with the Meta Quest headset?", options: [ { label: "Software Freeze / Unresponsive", next: "freeze_1", icon: "ph-snowflake" }, { label: "Won't Turn On / Power", next: "power_1", icon: "ph-power" }, { label: "Network Connection", next: "network_1", icon: "ph-wifi-slash" }, { label: "Physical Damage", next: "physical", icon: "ph-hammer" } ] },
    freeze_1: { question: "Does the device respond to the physical power button?", options: [ { label: "Yes, screen turns on", next: "freeze_yes", icon: "ph-check" }, { label: "No, completely unresponsive", next: "freeze_no", icon: "ph-x" } ] },
    freeze_yes: { question: "Is the device stuck on the boot logo, or is an app frozen?", options: [ { label: "Stuck on Boot Logo", next: "tier2_software", icon: "ph-arrows-clockwise" }, { label: "App is frozen", next: "hard_reboot", icon: "ph-app-window" } ] },
    freeze_no: { question: "Hold the Power button and Volume Down simultaneously for 30 seconds. Did the device reboot?", options: [ { label: "Yes, it rebooted", resolution: "Issue Resolved. The hard reset cleared the frozen state.", type: "success" }, { label: "No, still unresponsive", next: "rma_dead", icon: "ph-x" } ] },
    hard_reboot: { question: "Hold the Power button for 10 seconds to force shut down. After powering back on, is it resolved?", options: [ { label: "Yes", resolution: "Issue Resolved. Forced shut down cleared the freeze.", type: "success" }, { label: "No", next: "tier2_software", icon: "ph-x" } ] },
    tier2_software: { resolution: "Persistent software corruption or freeze detected. DO NOT factory reset. Escalate to Tier 2 Support.", type: "warning" },
    power_1: { question: "Connect to a known working charger. Is the charging indicator light on?", options: [ { label: "Yes, it's charging", resolution: "Leave device charging for 30 minutes before attempting to power on.", type: "success" }, { label: "No light", next: "power_cable", icon: "ph-plug-x" } ] },
    power_cable: { question: "Try a different USB-C cable and power brick. Does it charge now?", options: [ { label: "Yes", resolution: "Issue Resolved. Replace the defective charging cable/brick.", type: "success" }, { label: "No", next: "rma_dead", icon: "ph-x" } ] },
    network_1: { question: "Go to Settings > Network. Can the device see available Wi-Fi networks?", options: [ { label: "Yes", next: "network_forget", icon: "ph-wifi-high" }, { label: "No", resolution: "Hardware Wi-Fi failure detected. Prepare device for RMA.", type: "error" } ] },
    network_forget: { question: "Select 'Forget Network' and reconnect. Did it connect successfully?", options: [ { label: "Yes", resolution: "Issue Resolved. Network credentials refreshed.", type: "success" }, { label: "No", resolution: "Escalate to Tier 2 Network Support to verify MAC address whitelisting.", type: "warning" } ] },
    physical: { question: "What type of physical damage has occurred?", options: [ { label: "Cracked Screen/Lens", resolution: "RMA Required: Cracked Lens.", type: "error" }, { label: "Broken Strap/Hinge", resolution: "RMA Required: Structural Damage.", type: "error" }, { label: "Water Damage", resolution: "RMA Required: Liquid Damage.", type: "error" } ] },
    rma_dead: { resolution: "Unrecoverable hardware failure (No Power/Boot). Prepare device for RMA.", type: "error" },

    // --- Smart Glasses Tree ---
    glasses_start: { question: "What is the primary issue with the Ray-Ban Meta Gen 2 Smart Glasses?", options: [ { label: "Won't Turn On / Power", next: "glasses_power", icon: "ph-power" }, { label: "Bluetooth / Pairing Issues", next: "glasses_bt", icon: "ph-bluetooth-connected" }, { label: "Meta AI Not Responding", next: "glasses_ai", icon: "ph-chat-circle-dots" }, { label: "Camera / Audio Issues", next: "glasses_media", icon: "ph-camera" }, { label: "Physical Damage", next: "physical", icon: "ph-hammer" } ] },
    glasses_power: { question: "Is the charging case fully charged and the glasses seated properly inside?", options: [ { label: "Yes, case has power", next: "glasses_power_reset", icon: "ph-check" }, { label: "No, case LED is off", next: "glasses_power_case", icon: "ph-x" } ] },
    glasses_power_case: { question: "Plug the case into a wall charger. Does the case LED light up?", options: [ { label: "Yes", resolution: "Let case and glasses charge for 30 minutes. Issue Resolved.", type: "success" }, { label: "No", resolution: "Hardware Failure: Charging Case. RMA required.", type: "error" } ] },
    glasses_power_reset: { question: "Attempt a hard restart: Slide the power switch off, wait 5s, slide it back on. Does the white LED pulse?", options: [ { label: "Yes", resolution: "Issue Resolved via Hard Restart.", type: "success" }, { label: "No", next: "glasses_factory_reset", icon: "ph-arrows-clockwise" } ] },
    glasses_factory_reset: { question: "Place glasses in case. Press and hold the back pairing button for 15s until LED flashes white then green. Did this work?", options: [ { label: "Yes", resolution: "Issue Resolved via Factory Reset. Please pair them again in the Meta View app.", type: "success" }, { label: "No", resolution: "Hardware Failure: Glasses Unresponsive. RMA required.", type: "error" } ] },
    glasses_bt: { question: "Are the glasses showing in the Meta View app but failing to connect, or not showing at all?", options: [ { label: "Failing to connect", next: "glasses_bt_forget", icon: "ph-link-break" }, { label: "Not showing up", next: "glasses_bt_pairing_mode", icon: "ph-eye-slash" } ] },
    glasses_bt_forget: { question: "Forget the glasses in your phone's Bluetooth settings and unpair in Meta View. Try pairing again. Did it work?", options: [ { label: "Yes", resolution: "Issue Resolved. Bluetooth cache cleared.", type: "success" }, { label: "No", next: "glasses_factory_reset", icon: "ph-arrows-clockwise" } ] },
    glasses_bt_pairing_mode: { question: "With glasses in the open case, press and hold the back button until the LED pulses blue. Did it pulse?", options: [ { label: "Yes, and it paired", resolution: "Issue Resolved. Forced pairing mode successful.", type: "success" }, { label: "No", next: "glasses_power", icon: "ph-x" } ] },
    glasses_ai: { question: "When you say 'Hey Meta', do you hear the listening chime?", options: [ { label: "Yes, but can't connect", next: "glasses_ai_network", icon: "ph-wifi-high" }, { label: "No chime at all", next: "glasses_ai_mic", icon: "ph-microphone-slash" } ] },
    glasses_ai_network: { question: "Meta AI requires an active internet connection via your phone. Does your phone have cellular/Wi-Fi?", options: [ { label: "Yes", resolution: "Toggle Bluetooth off/on and restart the Meta View app. If issue persists, check if Meta AI servers are down.", type: "warning" }, { label: "No", resolution: "Connect phone to the internet to use Meta AI features. Issue Resolved.", type: "success" } ] },
    glasses_ai_mic: { question: "Is the physical privacy power switch on the left arm engaged (showing red)?", options: [ { label: "Yes, it shows red", resolution: "Slide switch forward to enable microphones and cameras. Issue Resolved.", type: "success" }, { label: "No, it is pushed forward", resolution: "Microphone hardware failure or software bug. Escalate for deep diagnostic.", type: "warning" } ] },
    glasses_media: { question: "Is the issue with capturing Photos/Videos, or with Audio Playback?", options: [ { label: "Photos / Videos", next: "glasses_camera", icon: "ph-camera" }, { label: "Audio Playback", next: "glasses_audio", icon: "ph-speaker-high" } ] },
    glasses_camera: { question: "Is the capture LED on the front right blocked, or is the internal storage full?", options: [ { label: "Storage is full", resolution: "Import existing media to your phone and clear glasses storage. Issue Resolved.", type: "success" }, { label: "Capture LED is blocked", resolution: "Clean the front camera and LED area. The glasses will NOT record if the privacy LED is blocked. Issue Resolved.", type: "success" }, { label: "Neither", next: "glasses_factory_reset", icon: "ph-arrows-clockwise" } ] },
    glasses_audio: { question: "Is the audio completely silent, or distorted/muffled?", options: [ { label: "Completely Silent", resolution: "Check phone volume and ensure audio is routing to the glasses. If yes and still silent, RMA required.", type: "error" }, { label: "Distorted / Muffled", resolution: "Clean the speaker grilles on the arms. If distortion persists at all volumes, speaker is blown. RMA required.", type: "error" } ] },
    
    // --- Samsung Tablet Tree ---
    tablet_start: { question: "What is the primary issue with the Samsung Device?", options: [ { label: "Screen / Touch Issue", next: "tablet_screen", icon: "ph-device-tablet" }, { label: "Battery / Power", next: "power_1", icon: "ph-battery-warning" }, { label: "App / Software Freeze", next: "hard_reboot", icon: "ph-app-window" }, { label: "Network Connection", next: "network_1", icon: "ph-wifi-slash" }, { label: "Physical Damage", next: "physical", icon: "ph-hammer" } ] },
    tablet_screen: { question: "Is the screen physically cracked or just unresponsive to touch?", options: [ { label: "Cracked", resolution: "RMA Required: Cracked Screen.", type: "error" }, { label: "Unresponsive", next: "hard_reboot", icon: "ph-hand-pointing" } ] }
};

const deviceMappings = {
    'vr': 'Meta Quest 3',
    'vr3s': 'Meta Quest 3S',
    'glasses': 'Ray-Ban Meta Gen 2',
    'tablet': 'Samsung Tablet',
    'demo': 'Samsung Demo Device'
};

const app = {
    logDeviceHealth: function(sn, status, eventType) {
        if (!sn || sn === 'Cleared' || sn === 'Unknown') return;
        const repName = app.auth.currentUser ? `${app.auth.currentUser.first} ${app.auth.currentUser.last}` : "Unknown Rep";
        db.collection('device_health_logs').add({
            serialNumber: sn,
            timestamp: new Date().toISOString(),
            status: status,
            eventType: eventType,
            repId: repName,
            repEmail: app.auth.currentUser ? app.auth.currentUser.email : 'unknown'
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
            this._writeLog('page_view', `App: ${viewId}`, extra);
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
                const userId = app.auth.currentUser ? app.auth.currentUser.email : "anonymous";
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

    // --- Auth System ---
    auth: {
        currentUser: null,
        
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
            const retailer = document.getElementById('signup-retailer').value;
            const email = document.getElementById('signup-email').value.trim().toLowerCase();
            const pass = document.getElementById('signup-pass').value;
            const confirmPass = document.getElementById('signup-confirm-pass').value;
            const errorEl = document.getElementById('auth-error');

            if (!first || !last || !retailer || !email || !pass || !confirmPass) {
                errorEl.innerText = "Please fill in all fields.";
                return;
            }

            if (pass !== confirmPass) {
                errorEl.innerText = "Passwords do not match.";
                return;
            }

            if (!email.endsWith('@2020companies.com')) {
                errorEl.innerText = "Email must be a @2020companies.com domain.";
                return;
            }

            const btn = document.querySelector('#view-auth button[onclick*="signUp"]');
            const originalText = btn ? btn.innerHTML : 'Sign Up';
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = 'Creating Account... <i class="ph ph-spinner ph-spin"></i>';
            }

            try {
                // Call secure backend registration Cloud Function
                const registerUser = firebase.app().functions('us-central1').httpsCallable('registerUser');
                await registerUser({
                    email: email,
                    password: pass,
                    firstName: first,
                    lastName: last,
                    retailer: retailer
                });
                
                // Automatically log user in upon successful backend creation
                await auth.signInWithEmailAndPassword(email, pass);
            } catch (error) {
                console.error("Registration error:", error);
                errorEl.innerText = error.message || "Server registration failed.";
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            }
        },

        resetPassword: async function() {
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const errorEl = document.getElementById('auth-error');
            if (!email) {
                errorEl.innerText = "Please enter your email address above first to request a reset.";
                errorEl.style.color = 'var(--danger)';
                return;
            }
            try {
                errorEl.innerText = "Submitting reset request...";
                errorEl.style.color = 'var(--primary)';

                const sendSecureEmail = firebase.app().functions('us-central1').httpsCallable('sendSecureEmail');
                await sendSecureEmail({
                    ticketType: "Account Reset Request",
                    repName: email,
                    details: "User has requested a password reset/clear."
                });

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
                // Set explicit local persistence to keep users logged in
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                
                // Sign in with Firebase Auth
                const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                const emailLower = email.toLowerCase();
                
                // Fetch extended profile data from Firestore
                const doc = await db.collection('users').doc(emailLower).get();
                if (doc.exists) {
                    await this._completeLogin(doc.data(), emailLower);
                } else {
                    // Fallback for Admins who are not in the users collection
                    const tokenResult = await userCredential.user.getIdTokenResult(true);
                    if (tokenResult.claims.admin === true) {
                        const adminDoc = await db.collection('admins').doc(emailLower).get();
                        const adminData = adminDoc.exists ? adminDoc.data() : { first: 'Administrator', last: '' };
                        await this._completeLogin({ ...adminData, role: 'admin' }, emailLower);
                    } else {
                        errorEl.innerText = "User profile not found in database.";
                    }
                }
            } catch (error) {
                console.error("Login error details:", error);
                errorEl.innerText = "Invalid email or password. Details: " + error.message;
            }
        },

        logout: async function() {
            await auth.signOut();
            this.currentUser = null;
            
            // Clear encryption session key and purge encrypted credentials cache
            if (window.encryptionService) {
                window.encryptionService.clearSessionKey();
                window.encryptionService.clearEncrypted('meta_ai_cached_creds');
            } else {
                localStorage.removeItem('meta_ai_cached_creds');
            }

            document.getElementById('view-auth').classList.add('flex-active');
            document.getElementById('main-ui').style.display = 'none';
            document.getElementById('login-pass').value = '';
        },

        _completeLogin: async function(userData, email) {
            this.currentUser = { ...userData, email };
            
            // Derive cryptographic key for encryption and session caching
            try {
                const user = auth.currentUser;
                if (user) {
                    const key = await encryptionService.deriveKey(user.uid, email);
                    encryptionService.setSessionKey(key);
                    console.log("[Security] Cryptographic key derived from User UID successfully.");
                }
            } catch (err) {
                console.error("[Security] Key derivation failed:", err);
            }

            document.getElementById('view-auth').classList.remove('flex-active');
            document.getElementById('main-ui').style.display = 'flex';
            
            // Auto-fill credential form with known details
            document.getElementById('rep-name').value = `${userData.first} ${userData.last}`;
            
            app.dashboard.loadDashboardState();
            await app.credentials.loadMetaCredentials();
            app.intake.loadFaqs();
        },

        checkSession: function() {
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    try {
                        const errorEl = document.getElementById('auth-error');
                        // Use cached token result by default to prevent infinite token refresh loop
                        let tokenResult = await user.getIdTokenResult(false);
                        let claims = tokenResult.claims;

                        if (claims.role !== 'user' && claims.admin !== true) {
                            console.log("[Security] Custom claims missing. Attempting secure self-healing...");
                            if (errorEl) {
                                errorEl.innerText = "Verifying credentials, please wait...";
                                errorEl.style.color = 'var(--warning)';
                            }
                            try {
                                const selfHealFn = firebase.app().functions('us-central1').httpsCallable('selfHealMyClaims');
                                const healRes = await selfHealFn();
                                console.log("[Security] Claims healed successfully. Role resolved:", healRes.data?.role);
                                
                                // Force refresh token to pull newly provisioned claims
                                tokenResult = await user.getIdTokenResult(true);
                                claims = tokenResult.claims;
                            } catch (healErr) {
                                console.error("[Security] Self-healing failed:", healErr);
                            }
                        }

                        if (claims.role === 'user' || claims.admin === true) {
                            const emailLower = user.email.toLowerCase();
                            const doc = await db.collection('users').doc(emailLower).get();
                            if (doc.exists) {
                                await this._completeLogin(doc.data(), emailLower);
                            } else if (claims.admin === true) {
                                // If they are an admin, look up in the admins collection instead of kicking them out
                                const adminDoc = await db.collection('admins').doc(emailLower).get();
                                const adminData = adminDoc.exists ? adminDoc.data() : { first: 'Administrator', last: '' };
                                await this._completeLogin({ ...adminData, role: 'admin' }, emailLower);
                            } else {
                                if (errorEl) {
                                    errorEl.innerText = "User profile not found in database.";
                                    errorEl.style.color = 'var(--danger)';
                                }
                                await this.logout();
                            }
                        } else {
                            console.error("[Security] Session blocked: missing custom claims");
                            if (errorEl) {
                                errorEl.innerText = "Access blocked: Your email is not validated in the Allowlist.";
                                errorEl.style.color = 'var(--danger)';
                            }
                            await this.logout();
                        }
                    } catch (err) {
                        console.error("[Security] Session validation failed:", err);
                        await this.logout();
                    }
                } else {
                    await this.logout();
                }
            });
        },

        _saveCurrentUser: async function() {
            if (this.currentUser) {
                await db.collection('users').doc(this.currentUser.email).set(this.currentUser);
            }
        }
    },

    // --- Navigation System ---
    nav: {
        goTo: function(viewId) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            if(event && event.currentTarget) event.currentTarget.classList.add('active');
            document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');
            
            // Trigger background view logger
            if(app.logger) app.logger.logView(viewId);
        }
    },

    // --- Dashboard & Device Reporting ---
    dashboard: {
        currentDevice: null,

        loadDashboardState: function() {
            const sns = app.auth.currentUser.sns || {};
            const statuses = app.auth.currentUser.statuses || {};
            const toggles = app.auth.currentUser.toggles || { vr: true, vr3s: true, glasses: true, tablet: true, demo: true };
            const keys = ['vr', 'vr3s', 'glasses', 'tablet', 'demo'];
            
            keys.forEach(k => {
                const span = document.getElementById(`sn-display-${k}`);
                if (span) {
                    if (sns[k]) {
                        span.innerHTML = `SN: ${sns[k]} <i class="ph ph-pencil-simple"></i>`;
                    } else {
                        span.innerHTML = `SN: Click to set <i class="ph ph-pencil-simple"></i>`;
                    }
                }

                const statusEl = document.getElementById(`status-${k}`);
                if (statusEl) {
                    const status = statuses[k] || 'Operational';
                    statusEl.innerText = status;
                    statusEl.className = 'status-indicator';
                    if (status === 'Operational') statusEl.classList.add('online');
                    else if (status === 'Having Issues') statusEl.classList.add('warning');
                    else statusEl.classList.add('error');
                }

                const card = document.getElementById(`card-${k}`);
                if (card) {
                    card.style.display = toggles[k] !== false ? 'flex' : 'none';
                }

                // SN Gate: disable Report Status button if no SN set
                const reportBtn = document.getElementById(`report-btn-${k}`);
                if (reportBtn) {
                    if (sns[k]) {
                        reportBtn.classList.remove('disabled');
                        reportBtn.title = '';
                    } else {
                        reportBtn.classList.add('disabled');
                        reportBtn.title = 'Set your serial number first';
                    }
                }
            });

            // Load Dynamic Devices
            const dynDevices = app.auth.currentUser.dynamicDevices || [];
            document.querySelectorAll('.dynamic-card').forEach(el => el.remove());
            const grid = document.querySelector('.dashboard-grid');
            
            dynDevices.forEach(device => {
                const status = statuses[device.key] || 'Operational';
                const sn = sns[device.key] ? `SN: ${sns[device.key]} <i class="ph ph-pencil-simple"></i>` : `SN: Click to set <i class="ph ph-pencil-simple"></i>`;
                const hasSN = !!sns[device.key];
                
                let statusClass = 'online';
                if (status === 'Having Issues') statusClass = 'warning';
                else if (status === 'Broken/Unusable') statusClass = 'error';
                
                const cardHtml = `
                    <div class="card glass-panel device-card dynamic-card" id="card-${device.key}" style="display: ${toggles[device.key] !== false ? 'flex' : 'none'}">
                        <div class="device-header">
                            <i class="ph ph-sunglasses"></i>
                            <div>
                                <h3>${device.model}</h3>
                                <p><span class="text-sm" style="cursor: pointer; color: var(--primary);" onclick="app.dashboard.editSN('${device.key}', '${device.model}')" id="sn-display-${device.key}">${sn}</span></p>
                            </div>
                        </div>
                        <div class="device-status">
                            <span class="status-indicator ${statusClass}" id="status-${device.key}">${status}</span>
                        </div>
                        <div style="margin-top: 10px; width: 100%;">
                            <button id="report-btn-${device.key}" class="btn secondary full-width" style="padding: 10px; font-size: 13px;${hasSN ? '' : ' opacity: 0.45; cursor: not-allowed;'}" title="${hasSN ? '' : 'Set your serial number first'}" onclick="${hasSN ? `app.dashboard.openReportModal('${device.model}', '${device.model}', 'status-${device.key}')` : ''}">
                                Report Status
                            </button>
                        </div>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHtml);
            });
            
            app.intake.populateDeviceSelect();
        },

        editSN: function(key, deviceName) {
            const currentSN = (app.auth.currentUser.sns && app.auth.currentUser.sns[key]) ? app.auth.currentUser.sns[key] : "";
            const newSN = prompt(`Enter Serial Number for ${deviceName}:`, currentSN);
            
            if (newSN !== null && newSN.trim() !== currentSN) {
                if (!app.auth.currentUser.sns) app.auth.currentUser.sns = {};
                app.auth.currentUser.sns[key] = newSN.trim();
                
                // Save to cloud
                app.auth._saveCurrentUser();
                
                app.logDeviceHealth(newSN.trim(), 'Assigned', 'SN Assigned');
                
                this.loadDashboardState();
            }
        },

        openAddDeviceModal: function() {
            document.getElementById('add-device-modal').classList.remove('hidden');
        },

        closeAddDeviceModal: function() {
            document.getElementById('add-device-modal').classList.add('hidden');
        },

        addDynamicGlasses: function() {
            const model = document.getElementById('new-glasses-model').value;
            const key = 'dyn_' + Date.now();
            
            if (!app.auth.currentUser.dynamicDevices) app.auth.currentUser.dynamicDevices = [];
            
            app.auth.currentUser.dynamicDevices.push({
                key: key,
                type: 'Smart Glasses',
                model: model
            });
            
            app.auth._saveCurrentUser();
            
            this.loadDashboardState();
            this.closeAddDeviceModal();
        },

        openCustomizeModal: function() {
            const toggles = app.auth.currentUser.toggles || { vr: true, vr3s: true, glasses: true, tablet: true, demo: true };
            document.getElementById('toggle-vr').checked = toggles.vr !== false;
            document.getElementById('toggle-vr3s').checked = toggles.vr3s !== false;
            document.getElementById('toggle-glasses').checked = toggles.glasses !== false;
            document.getElementById('toggle-tablet').checked = toggles.tablet !== false;
            document.getElementById('toggle-demo').checked = toggles.demo !== false;
            
            const dynContainer = document.getElementById('dynamic-toggles-container');
            dynContainer.innerHTML = '';
            
            const dynDevices = app.auth.currentUser.dynamicDevices || [];
            dynDevices.forEach(device => {
                const isChecked = toggles[device.key] !== false;
                const toggleHtml = `
                    <div class="form-group mb-10" style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="margin: 0; font-weight: 500;">${device.model}</label>
                        <label class="toggle-switch"><input type="checkbox" id="toggle-${device.key}" ${isChecked ? 'checked' : ''}><span class="toggle-slider"></span></label>
                    </div>
                `;
                dynContainer.insertAdjacentHTML('beforeend', toggleHtml);
            });

            const demoGroup = document.getElementById('demo-toggle-group');
            if (dynDevices.length > 0) {
                 demoGroup.classList.replace('mb-20', 'mb-10');
                 dynContainer.lastElementChild.classList.replace('mb-10', 'mb-20');
            } else {
                 demoGroup.classList.replace('mb-10', 'mb-20');
            }

            document.getElementById('customize-modal').classList.remove('hidden');
        },

        closeCustomizeModal: function() {
            document.getElementById('customize-modal').classList.add('hidden');
        },

        saveCustomizations: function() {
            app.auth.currentUser.toggles = {
                vr: document.getElementById('toggle-vr').checked,
                vr3s: document.getElementById('toggle-vr3s').checked,
                glasses: document.getElementById('toggle-glasses').checked,
                tablet: document.getElementById('toggle-tablet').checked,
                demo: document.getElementById('toggle-demo').checked
            };
            
            const dynDevices = app.auth.currentUser.dynamicDevices || [];
            dynDevices.forEach(device => {
                app.auth.currentUser.toggles[device.key] = document.getElementById(`toggle-${device.key}`).checked;
            });
            
            app.auth._saveCurrentUser();
            
            this.loadDashboardState();
            this.closeCustomizeModal();
        },

        openReportModal: function(deviceType, modelName, statusElementId) {
            // SN Gate: require a serial number before allowing a status report
            const key = statusElementId.replace('status-', '');
            const sns = app.auth.currentUser.sns || {};
            if (!sns[key]) {
                this.editSN(key, modelName);
                return;
            }
            this.currentDevice = { type: deviceType, model: modelName, elementId: statusElementId };
            document.getElementById('modal-device-name').innerText = `${deviceType} - ${modelName}`;
            document.getElementById('report-notes').value = "";
            document.getElementById('report-modal').classList.remove('hidden');
        },

        closeReportModal: function() {
            document.getElementById('report-modal').classList.add('hidden');
        },

        submitReport: function() {
            const status = document.getElementById('report-status-select').value;
            const notes = document.getElementById('report-notes').value;
            const category = document.getElementById('report-category').value;
            const store = document.getElementById('report-store').value || 'N/A';
            
            const repName = app.auth.currentUser ? `${app.auth.currentUser.first} ${app.auth.currentUser.last}` : "Unknown Rep";
            
            db.collection('reports').add({
                date: new Date().toISOString(),
                repId: repName,
                repEmail: app.auth.currentUser ? app.auth.currentUser.email : 'unknown',
                device: this.currentDevice.type,
                model: this.currentDevice.model,
                status: status,
                category: category,
                store: store,
                notes: notes
            });

            // Save status to user profile locally
            if (!app.auth.currentUser.statuses) app.auth.currentUser.statuses = {};
            const key = this.currentDevice.elementId.replace('status-', '');
            app.auth.currentUser.statuses[key] = status;
            
            app.auth._saveCurrentUser();
            
            const sn = (app.auth.currentUser.sns && app.auth.currentUser.sns[key]) ? app.auth.currentUser.sns[key] : 'Unknown';
            app.logDeviceHealth(sn, status, 'Report Submitted');
            
            try {
                const sendSecureEmail = firebase.app().functions('us-central1').httpsCallable('sendSecureEmail');
                sendSecureEmail({
                    ticketType: "Standard Report",
                    details: `Device: ${this.currentDevice.type} (${this.currentDevice.model})\nStatus: ${status}\nNotes: ${notes}`
                }).catch(e => console.error("Secure email dispatch failed:", e));
            } catch (e) {
                console.error("Secure email dispatch failed:", e);
            }

            this.loadDashboardState();
            this.closeReportModal();
            alert("Status reported successfully!");
        }
    },

    // --- Intake Form Logic Tree ---
    intake: {
        data: { deviceType: null, photoAttached: false },

        loadFaqs: function() {
            db.collection('faqs').onSnapshot((snapshot) => {
                const faqs = [];
                snapshot.forEach(doc => faqs.push({ id: doc.id, ...doc.data() }));
                faqs.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                this.renderFaqs(faqs);
            });
        },

        renderFaqs: function(faqs) {
            const container = document.getElementById('rep-faq-list');
            if (!container) return;
            
            if (faqs.length === 0) {
                container.innerHTML = '<div class="text-muted text-sm">No FAQs available at this time.</div>';
                return;
            }

            let html = '';
            faqs.forEach(f => {
                const imgHtml = f.imageUrl ? `<img src="${f.imageUrl}" style="width: 100%; border-radius: var(--radius-md); margin-top: 12px; border: 1px solid var(--border);">` : '';
                html += `
                    <details class="glass-panel" style="margin-bottom: 0px; padding: 14px 16px; border-radius: var(--radius-md);">
                        <summary style="font-weight: 600; cursor: pointer; outline: none; font-size: 15px; color: var(--text-main);">${f.question}</summary>
                        ${imgHtml}
                        <p style="margin-top: 10px; color: var(--text-muted); font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${f.answer}</p>
                    </details>
                `;
            });
            container.innerHTML = html;
        },

        validateSN: function() {
            const deviceSelect = document.getElementById('diagnostic-device-select').value;
            const errorEl = document.getElementById('sn-error');
            if (!deviceSelect) { errorEl.textContent = "Please select a device to continue."; return; }
            errorEl.textContent = "";
            this.data.deviceType = deviceSelect;
            
            if (deviceSelect.includes('Samsung')) {
                this.loadNode('tablet_start');
            } else if (deviceSelect.includes('Meta Quest')) {
                this.loadNode('start');
            } else {
                this.loadNode('glasses_start');
            }
        },
        loadNode: function(nodeId) {
            const node = logicTreeNodes[nodeId];
            if (!node) return;
            if (node.resolution) { this.showResolution(node); return; }
            const container = document.getElementById('logic-tree-container');
            let html = `<div class="logic-node"><div class="logic-question">${node.question}</div><div class="options-grid multi">`;
            node.options.forEach(opt => {
                const action = opt.next ? `app.intake.loadNode('${opt.next}')` : `app.intake.showResolutionFromOption('${opt.resolution}', '${opt.type || 'success'}')`;
                html += `<div class="option-card" onclick="${action}"><i class="ph ${opt.icon || 'ph-arrow-right'}"></i><span>${opt.label}</span></div>`;
            });
            html += `</div></div>`;
            container.innerHTML = html;
            this._goToStep('step-logic');
        },
        showResolutionFromOption: function(resolutionText, type) { this.showResolution({ resolution: resolutionText, type: type }); },
        showResolution: function(nodeData) {
            const resTitle = document.getElementById('resolution-title');
            const resContent = document.getElementById('resolution-content');
            resTitle.innerText = "Resolution / Next Steps";
            resContent.innerHTML = `<strong>Action:</strong> ${nodeData.resolution}`;
            
            if (nodeData.type === 'error' || nodeData.type === 'warning') {
                resContent.innerHTML += `<br><br><div style="margin-top:15px; padding:12px; background:rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); border-radius: var(--radius-sm); color: var(--danger); font-weight: 500;"><i class="ph ph-warning-circle"></i> This issue requires escalation. Completing this diagnostic will submit an Escalation Request to the Admin Dashboard.</div>`;
            }

            resContent.className = 'resolution-box';
            if (nodeData.type === 'error') resContent.classList.add('error');
            this.data.resolutionText = nodeData.resolution;
            this.data.resolutionType = nodeData.type || 'success';
            this._goToStep('step-resolution');
        },

        populateDeviceSelect: function() {
            const deviceSelect = document.getElementById('diagnostic-device-select');
            if (!deviceSelect) return;
            let optionsHtml = '<option value="">Select a device...</option>';
            if (app.auth.currentUser) {
                const toggles = app.auth.currentUser.toggles || {};
                const dynDevices = app.auth.currentUser.dynamicDevices || [];
                
                for (const [key, name] of Object.entries(deviceMappings)) {
                    if (toggles[key] !== false) {
                        optionsHtml += `<option value="${name}">${name}</option>`;
                    }
                }
                dynDevices.forEach(d => {
                    if (toggles[d.key] !== false) {
                        optionsHtml += `<option value="${d.model}">${d.model}</option>`;
                    }
                });
            }
            deviceSelect.innerHTML = optionsHtml;
        },
        reset: function() {
            this.data = { deviceType: null, resolutionText: null, resolutionType: null };
            const deviceSelect = document.getElementById('diagnostic-device-select');
            if (deviceSelect) deviceSelect.value = "";
            const categorySelect = document.getElementById('diag-category');
            if (categorySelect) categorySelect.value = "N/A";
            const storeInput = document.getElementById('diag-store');
            if (storeInput) storeInput.value = "";
            document.getElementById('sn-error').textContent = "";
            this._goToStep('step-sn');
        },
        complete: function() {
            const category = document.getElementById('diag-category') ? document.getElementById('diag-category').value : 'N/A';
            const store = document.getElementById('diag-store') ? document.getElementById('diag-store').value : '';
            
            const repName = app.auth.currentUser ? `${app.auth.currentUser.first} ${app.auth.currentUser.last}` : "Unknown Rep";
            let reportStatus = 'Resolved Locally';
            let eventType = 'Diagnostic Report';
            
            if (this.data.resolutionType === 'error') {
                reportStatus = 'Replacement Required';
                eventType = 'Escalation - Replacement';
            } else if (this.data.resolutionType === 'warning') {
                reportStatus = 'Escalation Request';
                eventType = 'Escalation - Support';
            }

            // Push to reports collection
            db.collection('reports').add({
                date: new Date().toISOString(),
                repId: repName,
                repEmail: app.auth.currentUser ? app.auth.currentUser.email : 'unknown',
                device: this.data.deviceType || 'Unknown Device',
                model: 'Diagnostic Run',
                status: reportStatus,
                category: category,
                store: store || 'N/A',
                notes: `Diagnostic Wizard Completed. Resolution: ${this.data.resolutionText}`
            });

            try {
                const sendSecureEmail = firebase.app().functions('us-central1').httpsCallable('sendSecureEmail');
                sendSecureEmail({
                    ticketType: "Diagnostic Escalation",
                    details: `Device: ${this.data.deviceType}\nResolution: ${this.data.resolutionText}\nCategory: ${category}\nStore: ${store}`
                }).catch(e => console.error("Secure email dispatch failed:", e));
            } catch (e) {
                console.error("Secure email dispatch failed:", e);
            }

            // Find SN and push to device_health_logs
            let sn = 'Unknown';
            let deviceKey = null;
            
            // Look up deviceKey from mappings
            for (const [key, name] of Object.entries(deviceMappings)) {
                if (name === this.data.deviceType) {
                    deviceKey = key;
                    break;
                }
            }
            if (!deviceKey && app.auth.currentUser && app.auth.currentUser.dynamicDevices) {
                app.auth.currentUser.dynamicDevices.forEach(d => {
                    if (d.model === this.data.deviceType) {
                        deviceKey = d.key;
                    }
                });
            }

            // If user has saved serial numbers, get it
            if (deviceKey && app.auth.currentUser && app.auth.currentUser.sns) {
                sn = app.auth.currentUser.sns[deviceKey] || 'Unknown';
            }

            if (deviceKey && app.auth.currentUser) {
                if (!app.auth.currentUser.statuses) app.auth.currentUser.statuses = {};
                if (this.data.resolutionType === 'error') {
                    app.auth.currentUser.statuses[deviceKey] = 'Broken/Unusable';
                } else if (this.data.resolutionType === 'warning') {
                    app.auth.currentUser.statuses[deviceKey] = 'Having Issues';
                } else {
                    app.auth.currentUser.statuses[deviceKey] = 'Operational';
                }
                app.auth._saveCurrentUser();
            }

            app.logDeviceHealth(sn, reportStatus, eventType);

            alert(`Diagnostic Logged!\nStatus: ${reportStatus}\nSuccessfully submitted to Admin Dashboard.`);
            this.reset();
            app.dashboard.loadDashboardState();
            app.nav.goTo('dashboard');
        },
        _goToStep: function(stepId) {
            document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
            document.getElementById(stepId).classList.add('active');
        }
    },

    // --- Credential Request ---
    credentials: {
        loadMetaCredentials: async function() {
            const loading = document.getElementById('meta-ai-creds-loading');
            const content = document.getElementById('meta-ai-creds-content');
            const error = document.getElementById('meta-ai-creds-error');
            const emailSpan = document.getElementById('my-meta-email');
            const passSpan = document.getElementById('my-meta-pass');
            
            if(!loading) return; // Not on the page yet
            
            // Check cache first for secure instant load
            let cached = null;
            if (window.encryptionService && encryptionService.hasSessionKey()) {
                cached = await encryptionService.getDecrypted('meta_ai_cached_creds');
            } else {
                // Backward-compatible fallback (e.g. if key isn't derived yet during initialization)
                try {
                    const raw = localStorage.getItem('meta_ai_cached_creds');
                    if (raw && !raw.includes('.')) {
                        cached = JSON.parse(raw);
                    }
                } catch (e) {
                    console.warn("[Security] Failed to parse raw cached credentials", e);
                }
            }

            if (cached && cached.user === app.auth.currentUser.email) {
                emailSpan.innerText = cached.metaEmail;
                passSpan.innerText = cached.metaPass;
                content.style.display = 'block';
                loading.style.display = 'none';
            } else {
                loading.style.display = 'block';
                content.style.display = 'none';
            }
            
            error.style.display = 'none';

            try {
                // 1. Try fetching directly and securely from Firestore `/credentials/{email}`
                const myEmail = app.auth.currentUser.email.toLowerCase();
                const credDoc = await db.collection('credentials').doc(myEmail).get();
                
                if (credDoc.exists) {
                    const data = credDoc.data();
                    emailSpan.innerText = data.metaEmail;
                    passSpan.innerText = data.metaPass;
                    
                    const credData = {
                        user: app.auth.currentUser.email,
                        metaEmail: data.metaEmail,
                        metaPass: data.metaPass
                    };
                    if (window.encryptionService && encryptionService.hasSessionKey()) {
                        await encryptionService.storeEncrypted('meta_ai_cached_creds', credData);
                    } else {
                        localStorage.setItem('meta_ai_cached_creds', JSON.stringify(credData));
                    }
                    
                    loading.style.display = 'none';
                    content.style.display = 'block';
                    return; // Successfully loaded from Firestore!
                }
                
                // 2. Self-Healing Fallback: Document doesn't exist, call Cloud Function selfHealMyCredential
                console.log("[Self-Healing] Credentials doc not found in Firestore. Calling selfHealMyCredential Cloud Function...");
                const selfHealFunc = firebase.app().functions('us-central1').httpsCallable('selfHealMyCredential');
                const result = await selfHealFunc();
                
                const { success, metaEmail, metaPass } = result.data;
                
                if (success && metaEmail && metaPass) {
                    console.log("[Self-Healing] Successfully self-healed credentials via Cloud Function.");
                    
                    emailSpan.innerText = metaEmail;
                    passSpan.innerText = metaPass;
                    
                    const credData = {
                        user: app.auth.currentUser.email,
                        metaEmail: metaEmail,
                        metaPass: metaPass
                    };
                    if (window.encryptionService && encryptionService.hasSessionKey()) {
                        await encryptionService.storeEncrypted('meta_ai_cached_creds', credData);
                    } else {
                        localStorage.setItem('meta_ai_cached_creds', JSON.stringify(credData));
                    }
                    
                    loading.style.display = 'none';
                    content.style.display = 'block';
                } else {
                    throw new Error("Self-healing returned an invalid response.");
                }
            } catch (err) {
                loading.style.display = 'none';
                console.error("[Credentials Lookup Error]", err);
                if (!cached || cached.user !== app.auth.currentUser.email) {
                    error.innerText = "Failed to load credentials from secure database. Error: " + err.message;
                    error.style.display = 'block';
                }
            }
        },

        draftEmail: function() {
            const repName = document.getElementById('rep-name').value.trim();
            const system = document.getElementById('system-select').value;
            const reason = document.getElementById('reason').value.trim();

            if (!repName || !reason) { alert("Please fill in all fields before submitting the request."); return; }

            db.collection('credential_requests').add({
                date: new Date().toISOString(),
                repName: repName,
                repEmail: app.auth.currentUser ? app.auth.currentUser.email : 'unknown',
                system: system,
                reason: reason
            });
            
            try {
                const sendSecureEmail = firebase.app().functions('us-central1').httpsCallable('sendSecureEmail');
                sendSecureEmail({
                    ticketType: "Credential Request",
                    details: `System: ${system}\nReason: ${reason}`
                }).catch(e => console.error("Secure email dispatch failed:", e));
            } catch (e) {
                console.error("Secure email dispatch failed:", e);
            }
            
            document.getElementById('reason').value = "";
            alert(`Credential Reset Request for ${system} has been submitted to the Admin Dashboard!`);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    app.auth.checkSession();
});
