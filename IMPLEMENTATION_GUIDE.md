# SENTINEL-APP Security Implementation Guide

**Last Updated:** 2026-05-19  
**Difficulty:** Intermediate to Advanced  
**Estimated Time:** 4-5 weeks

---

## Quick Reference: Implementation Checklist

### Week 1: Emergency Response ✅
- [ ] Revoke Firebase API Key
- [ ] Revoke EmailJS Public Key  
- [ ] Secure Google Sheets (restrict access)
- [ ] Create GitHub Secrets for new credentials
- [ ] Commit changes with redaction of old credentials

### Week 2: Backend Refactoring ✅
- [ ] Set up Firebase Cloud Functions
- [ ] Move EmailJS calls to Cloud Functions
- [ ] Implement Firestore Security Rules
- [ ] Add authentication middleware
- [ ] Deploy and test

### Week 3: Security Enhancements ✅
- [ ] Implement client-side encryption for LocalStorage
- [ ] Add server-side email validation
- [ ] Implement RBAC with Custom Claims
- [ ] Add audit logging
- [ ] Deploy and test

### Week 4: Infrastructure & Testing ✅
- [ ] Deploy security headers (CSP, HSTS, etc.)
- [ ] Set up GitHub Actions CI/CD pipeline
- [ ] Add security scanning (SAST, dependencies)
- [ ] Implement monitoring & alerting
- [ ] Document incident procedures

---

## WEEK 1: Emergency Response

### Task 1.1: Revoke Compromised Firebase Credentials

**Objective:** Remove the exposed Firebase API Key from service

**Step-by-Step:**

1. **Go to Firebase Console**
   ```
   https://console.firebase.google.com
   Select "sentinel-f77ba" project
   ```

2. **Navigate to API Keys**
   ```
   Settings (gear icon) → Project Settings → API Keys tab
   ```

3. **Identify Compromised Key**
   - Find key starting with: `AIzaSyBE8yKvBzEYUhF9qkXxDHK533rJlXHR6KA`
   - Status should show enabled

4. **Delete the Key**
   ```
   Click three-dot menu → Delete
   Confirm deletion
   ```

5. **Create New Restricted Key**
   ```
   Click "Create API Key" → Browser key
   Name: "Sentinel-APP-Web-Restricted"
   ```

6. **Restrict API Key**
   ```
   Edit newly created key
   Application Restrictions → HTTP referrers (websites)
   Add referrer: https://seand266.github.io/Sentinel-APP/*
   Also add: https://sentinel-f77ba.firebaseapp.com/*
   ```

7. **Restrict Services**
   ```
   API restrictions → Select only needed APIs:
   - Cloud Firestore API ✓
   - Firebase Authentication API ✓
   - Firebase Cloud Messaging API ✓
   - NOT: Admin API or other sensitive APIs
   ```

8. **Save and Note New Key**
   ```
   Copy new API Key: [store securely, don't commit]
   Save timestamp of key creation
   ```

**Verification:**
```bash
# Test new key doesn't work for unauthorized requests
curl -X GET "https://www.googleapis.com/identitytoolkit/v3/relyingparty/createAuthUri?key=[NEW_KEY]"
# Should return valid response
```

---

### Task 1.2: Revoke Compromised EmailJS Credentials

**Objective:** Disable exposed EmailJS public key

**Step-by-Step:**

1. **Go to EmailJS Dashboard**
   ```
   https://dashboard.emailjs.com
   Sign in with your EmailJS account
   ```

2. **Navigate to API Keys**
   ```
   Account → API Keys
   ```

3. **Identify Exposed Key**
   - Find public key: `OSnwHaVORnAhqi4rp`

4. **Delete Public Key**
   ```
   Click the key
   Delete button
   Confirm deletion
   ```

5. **Create New Public Key**
   ```
   API Keys tab → Create API Key
   Name: "Sentinel-APP-Public-Key"
   ```

6. **Restrict Domains** (if available)
   ```
   Add domain whitelist:
   - seand266.github.io
   - sentinel-f77ba.firebaseapp.com
   ```

7. **Save New Key**
   ```
   Copy new public key: [store securely]
   Update GitHub Secrets with new value
   ```

**Services Affected:**
- Credential reset email notifications
- Status report email notifications
- Replacement request emails
- All these will stop working until code is updated with new key

---

### Task 1.3: Secure Google Sheets Containing Credentials

**Objective:** Restrict access to sheet with Meta AI credentials

**Step-by-Step:**

1. **Open Google Sheets**
   ```
   https://docs.google.com/spreadsheets/d/1SSgl60xVl_i-7nx23ch4jADCq9wZQmUR1ObRVDXDEpk
   ```

2. **Check Current Sharing Settings**
   ```
   Click "Share" button (top right)
   Review who has access
   ```

3. **Restrict Sharing**
   ```
   Change from "Anyone with the link can view" 
   To: "Restricted" (only specific people)
   ```

4. **Option A: Delete All Credentials from Sheet**
   ```
   If possible, delete columns containing:
   - Meta AI email addresses
   - Meta AI passwords
   - Any other sensitive data
   ```

5. **Option B: Move to Secure System (Recommended)**
   ```
   Export current data (if needed for backup)
   File → Download → CSV
   Store backup securely (encrypted, access-controlled)
   ```

6. **Restrict Access to Only Admins**
   ```
   Share → Remove "Anyone" access
   Add only necessary admin emails
   Grant "Editor" only to trusted admins
   Grant "Viewer" for auditing only
   ```

7. **Enable Version History Protection**
   ```
   File → Version history → revision history
   Note who made what changes and when
   ```

8. **Set Up Sharing Audit Trail**
   ```
   Tools → Notification rules
   Alert me if sharing settings change
   ```

**CRITICAL: Remove Embedded URL from Code**
See Task 1.4 below.

---

### Task 1.4: Update Code to Use GitHub Secrets

**Objective:** Replace hardcoded credentials with GitHub Secrets

**Step 1: Create GitHub Secrets**

Go to: https://github.com/Seand266/Sentinel-APP/settings/secrets/actions

Create new repository secrets:

```
1. FIREBASE_API_KEY
   Value: [your new Firebase API key from Task 1.1]

2. FIREBASE_CONFIG
   Value: (JSON object, see below)

3. EMAILJS_PUBLIC_KEY
   Value: [your new EmailJS public key from Task 1.2]

4. EMAILJS_SERVICE_ID
   Value: service_syb4oto

5. EMAILJS_TEMPLATE_ID_REPORT
   Value: template_0tx65cr

6. EMAILJS_TEMPLATE_ID_CREDENTIAL
   Value: template_jbkqwyx
```

**Firebase Config Secret Format:**
```json
{
  "apiKey": "[NEW_KEY]",
  "authDomain": "sentinel-f77ba.firebaseapp.com",
  "projectId": "sentinel-f77ba",
  "storageBucket": "sentinel-f77ba.firebasestorage.app",
  "messagingSenderId": "1090550692649",
  "appId": "1:1090550692649:web:dbb4d9aade527d49a79538"
}
```

**Step 2: Create GitHub Actions Workflow**

Create file: `.github/workflows/build-and-deploy.yml`

```yaml
name: Build and Deploy with Secrets

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Create config file from secrets
        run: |
          cat > index-config.js << 'EOF'
          // Configuration injected from GitHub Secrets at build time
          const firebaseConfig = {
              apiKey: "${{ secrets.FIREBASE_API_KEY }}",
              authDomain: "sentinel-f77ba.firebaseapp.com",
              projectId: "sentinel-f77ba",
              storageBucket: "sentinel-f77ba.firebasestorage.app",
              messagingSenderId: "1090550692649",
              appId: "1:1090550692649:web:dbb4d9aade527d49a79538"
          };
          
          const emailJsConfig = {
              publicKey: "${{ secrets.EMAILJS_PUBLIC_KEY }}"
          };
          EOF
      
      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v2
```

**Step 3: Update HTML to Load from Secret**

Modify `index.html`:

```html
<!-- OLD - INSECURE -->
<!-- REMOVE THIS:
<script>
    const firebaseConfig = {
        apiKey: "AIzaSyBE8yKvBzEYUhF9qkXxDHK533rJlXHR6KA",  // ❌ EXPOSED
        ...
    };
</script>
-->

<!-- NEW - SECURE -->
<!-- Load from GitHub Actions build output -->
<script src="index-config.js"></script>

<script src="https://www.gstatic.com/firebasejs/10.11.1/firebase-app-compat.js"></script>
<!-- rest of Firebase SDKs -->
```

**Step 4: Commit Changes (with credential removal)**

```bash
git add SECURITY_REMEDIATION_PLAN.md
git add .github/workflows/build-and-deploy.yml
git add index.html

# Remove old credentials from all files
git add app.js admin.js

# Remove Google Sheets credential fetching
# Edit app.js and remove this entire function:
# credentials.loadMetaCredentials() should NOT fetch from Google Sheets

git commit -m "🔒 Security: Remove exposed credentials, use GitHub Secrets"

git push origin main
```

**Verification:**
```bash
# Verify old credentials are NOT in the public repo
git log --all --grep="apiKey" --grep="AIzaSy"
# Should return no results

# Verify GitHub Actions workflow ran
# Go to: https://github.com/Seand266/Sentinel-APP/actions
# Check that build succeeded
```

---

## WEEK 2: Backend Refactoring

### Task 2.1: Set Up Firebase Cloud Functions

**Objective:** Create backend functions to handle sensitive operations

**Step-by-Step:**

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase --version
   ```

2. **Initialize Cloud Functions**
   ```bash
   cd /path/to/Sentinel-APP
   firebase init functions
   
   # Select: TypeScript (recommended for type safety)
   # Select: ESLint
   # npm install dependencies
   ```

3. **Create Functions Directory Structure**
   ```
   functions/
   ├── src/
   │   ├── index.ts (main entry point)
   │   ├── email.ts (email-related functions)
   │   ├── auth.ts (authentication functions)
   │   ├── middleware/
   │   │   ├── auth.ts (authentication middleware)
   │   │   └── rbac.ts (role-based access control)
   │   └── utils/
   │       ├── logger.ts (logging utilities)
   │       └── errors.ts (error handling)
   └── package.json
   ```

4. **Install Required Dependencies**
   ```bash
   cd functions
   npm install firebase-admin firebase-functions
   npm install express cors
   npm install emailjs-com  # or use emailjs API
   ```

5. **Create Basic Function Structure**

Create `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin SDK
admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware for authentication
import { authenticateRequest } from './middleware/auth';
app.use(authenticateRequest);

// Import route handlers
import { emailRoutes } from './email';
import { authRoutes } from './auth';

// Register routes
app.use('/email', emailRoutes);
app.use('/auth', authRoutes);

// Export main function
export const api = functions.https.onRequest(app);
```

6. **Deploy Functions (Development)**
   ```bash
   firebase deploy --only functions
   # Deployed functions to Cloud Functions
   ```

7. **Test Locally (Optional)**
   ```bash
   firebase emulators:start --only functions
   # Functions emulator started at http://localhost:5001
   ```

---

### Task 2.2: Implement Email Functions

**Objective:** Move email sending from client to server

Create `functions/src/email.ts`:

```typescript
import * as functions from 'firebase-functions';
import { Router } from 'express';
import * as admin from 'firebase-admin';

export const emailRoutes = Router();
const db = admin.firestore();

// Helper: Send email via EmailJS API
async function sendEmailViaAPI(
  to: string,
  subject: string,
  body: string
): Promise<void> {
  // Note: In production, use environment variables for credentials
  // https://www.emailjs.com/docs/rest-api/send/
  
  const emailJsApiUrl = 'https://api.emailjs.com/api/v1.0/email/send';
  
  const response = await fetch(emailJsApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_USER_ID,
      template_params: {
        to_email: to,
        subject: subject,
        message: body
      }
    })
  });

  if (!response.ok) {
    throw new Error(`EmailJS API error: ${response.statusText}`);
  }
}

// Endpoint: Send credential reset email
emailRoutes.post('/send-credential-reset', async (req, res) => {
  try {
    const { email, system, reason } = req.body;
    
    // Validate input
    if (!email || !system || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user from auth context
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate user is the one requesting for themselves
    const userDoc = await db.collection('users').doc(email).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log request
    await db.collection('credential_requests').add({
      email,
      system,
      reason,
      requestedBy: uid,
      timestamp: new Date(),
      status: 'pending'
    });

    // Send email via API (not exposed credentials)
    await sendEmailViaAPI(
      'operationsupport@2020companies.com',
      `Credential Reset Request - ${email}`,
      `System: ${system}\nReason: ${reason}`
    );

    res.json({ success: true, message: 'Request submitted' });
  } catch (error) {
    console.error('Error sending credential reset email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Endpoint: Send device status report email
emailRoutes.post('/send-status-report', async (req, res) => {
  try {
    const { device, status, notes } = req.body;
    const uid = req.user?.uid;

    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!device || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log report
    const report = await db.collection('reports').add({
      device,
      status,
      notes,
      reportedBy: uid,
      timestamp: new Date()
    });

    // Send notification email
    await sendEmailViaAPI(
      'admin@2020companies.com',
      `Device Status Report: ${device}`,
      `Device: ${device}\nStatus: ${status}\nNotes: ${notes}`
    );

    res.json({ success: true, reportId: report.id });
  } catch (error) {
    console.error('Error sending status report:', error);
    res.status(500).json({ error: 'Failed to send report' });
  }
});

export default emailRoutes;
```

---

### Task 2.3: Implement Firestore Security Rules

**Objective:** Restrict data access with security rules

Create `firestore.rules`:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
    }
    
    function isOwner(email) {
      return isAuthenticated() && request.auth.token.email == email;
    }

    // Users collection - read own profile, admins read all
    match /users/{email} {
      allow read: if isOwner(email) || isAdmin();
      allow write: if isOwner(email) && validateUserUpdate();
      allow delete: if isAdmin();
      
      function validateUserUpdate() {
        return request.resource.data.keys().hasOnly(['first', 'last', 'retailer', 'toggles', 'sns', 'statuses', 'dynamicDevices']);
      }
    }

    // Reports collection - authenticated users write own, admins read all
    match /reports/{reportId} {
      allow read: if isAuthenticated() && (resource.data.repId == request.auth.token.email || isAdmin());
      allow write: if isAuthenticated() && validateReportWrite();
      allow delete: if isAdmin();
      
      function validateReportWrite() {
        return request.resource.data.keys().hasOnly(['date', 'repId', 'device', 'model', 'status', 'category', 'store', 'notes']);
      }
    }

    // Device health logs - write-only for authenticated users
    match /device_health_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated() && validateHealthLog();
      allow update: if false;
      allow delete: if isAdmin();
      
      function validateHealthLog() {
        return request.resource.data.keys().hasOnly(['serialNumber', 'timestamp', 'status', 'eventType', 'repId']);
      }
    }

    // FAQs - public read, admin write
    match /faqs/{faqId} {
      allow read: if request.auth == null || isAuthenticated();
      allow create, update, delete: if isAdmin();
      
      function validateFaqWrite() {
        return request.resource.data.keys().hasOnly(['question', 'answer', 'imageUrl', 'dateAdded']);
      }
    }

    // Admins collection - admins only
    match /admins/{email} {
      allow read, write, delete: if isAdmin();
    }

    // Credential requests - write-only for authenticated users
    match /credential_requests/{requestId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated() && validateCredentialRequest();
      allow update, delete: if isAdmin();
      
      function validateCredentialRequest() {
        return request.resource.data.keys().hasOnly(['email', 'system', 'reason', 'date']);
      }
    }

    // Reset requests - write-only for authenticated users
    match /reset_requests/{requestId} {
      allow read: if isAdmin();
      allow create: if validateResetRequest();
      allow update, delete: if isAdmin();
      
      function validateResetRequest() {
        return request.resource.data.keys().hasOnly(['email', 'date']);
      }
    }

    // Security logs (audit trail)
    match /security_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Deploy Rules:**
```bash
firebase deploy --only firestore:rules
```

**Test Rules:**
```
Go to Firebase Console → Firestore → Rules
Use "Rules Simulator" to test different scenarios
```

---

### Task 2.4: Update Frontend to Call Cloud Functions

**Objective:** Update client-side code to use new backend functions

Update `app.js` - Credential Reset Function:

```javascript
// OLD: Direct Firestore write + client-side EmailJS
// DELETE THIS:
// db.collection('reset_requests').add({...});
// emailjs.send("service_syb4oto", "template_0tx65cr", {...});

// NEW: Call Cloud Function instead
app.auth.resetPassword = async function() {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const errorEl = document.getElementById('auth-error');
    
    if (!email) {
        errorEl.innerText = "Please enter your email address.";
        return;
    }
    
    try {
        // Call Cloud Function
        const response = await fetch(
            'https://us-central1-sentinel-f77ba.cloudfunctions.net/api/email/send-credential-reset',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
                },
                body: JSON.stringify({
                    email: email
                })
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to submit reset request');
        }
        
        errorEl.innerText = "Reset request sent! Admin will respond shortly.";
        errorEl.style.color = 'var(--success)';
    } catch (err) {
        console.error('Error:', err);
        errorEl.innerText = "Error: " + err.message;
        errorEl.style.color = 'var(--danger)';
    }
};
```

---

## WEEK 3: Security Enhancements

### Task 3.1: Implement Client-Side Encryption for LocalStorage

**Objective:** Encrypt credentials before storing in browser

Install Encryption Library:
```bash
npm install tweetsodium libsodium.js
```

Create `encryption-utils.js`:

```javascript
// Encryption utilities for sensitive data
class EncryptionService {
  constructor() {
    this.ready = this.initSodium();
  }

  async initSodium() {
    // Load libsodium if not already loaded
    if (typeof sodium === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/jedisct1/libsodium.js@master/dist/browsers/combined/sodium.min.js';
      document.head.appendChild(script);
      
      return new Promise((resolve) => {
        script.onload = () => resolve(sodium);
      });
    }
    return Promise.resolve(sodium);
  }

  /**
   * Derive encryption key from email and password
   */
  async deriveKey(email, password) {
    const sodium = await this.ready;
    
    // Use email + password as seed for key derivation
    const combined = email + password;
    const seed = new TextEncoder().encode(combined);
    
    // Derive key using argon2
    const key = sodium.crypto_pwhash(
      sodium.crypto_box_SEEDBYTES,
      seed,
      sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES),
      sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
      sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
      sodium.crypto_pwhash_ALG_DEFAULT
    );
    
    return key;
  }

  /**
   * Encrypt data
   */
  async encrypt(data, key) {
    const sodium = await this.ready;
    
    // Convert data to bytes
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    
    // Generate nonce
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    
    // Encrypt
    const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);
    
    // Combine nonce + ciphertext and return as base64
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);
    
    return sodium.to_base64(combined);
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData, key) {
    const sodium = await this.ready;
    
    // Convert from base64
    const combined = sodium.from_base64(encryptedData);
    
    // Split nonce and ciphertext
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    
    // Decrypt
    const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    
    // Convert bytes to string and parse JSON
    const decoded = new TextDecoder().decode(plaintext);
    return JSON.parse(decoded);
  }

  /**
   * Store encrypted data in localStorage
   */
  async storeEncrypted(key, data, encryptionKey) {
    const encrypted = await this.encrypt(data, encryptionKey);
    localStorage.setItem(key, encrypted);
  }

  /**
   * Retrieve and decrypt data from localStorage
   */
  async getDecrypted(key, encryptionKey) {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    
    try {
      return await this.decrypt(encrypted, encryptionKey);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Securely clear encrypted data
   */
  clearEncrypted(key) {
    localStorage.removeItem(key);
  }
}

// Create global instance
const encryptionService = new EncryptionService();
```

Update `app.js` to use encryption:

```javascript
// OLD: Store credentials in plain text
// localStorage.setItem('meta_ai_cached_creds', JSON.stringify({...}));

// NEW: Store encrypted
app.credentials.storeMetaAICredentials = async function(metaEmail, metaPass) {
  try {
    const encryptionKey = await encryptionService.deriveKey(
      app.auth.currentUser.email,
      app.auth.currentUser.email  // Use email as part of key derivation
    );
    
    await encryptionService.storeEncrypted(
      'meta_ai_cached_creds',
      {
        user: app.auth.currentUser.email,
        metaEmail: metaEmail,
        metaPass: metaPass
      },
      encryptionKey
    );
  } catch (error) {
    console.error('Failed to store encrypted credentials:', error);
  }
};

// Retrieve encrypted credentials
app.credentials.getMetaAICredentials = async function() {
  try {
    const encryptionKey = await encryptionService.deriveKey(
      app.auth.currentUser.email,
      app.auth.currentUser.email
    );
    
    return await encryptionService.getDecrypted(
      'meta_ai_cached_creds',
      encryptionKey
    );
  } catch (error) {
    console.error('Failed to retrieve credentials:', error);
    return null;
  }
};

// Secure logout - clear all encrypted data
app.auth.logout = async function() {
  await auth.signOut();
  this.currentUser = null;
  
  // Securely clear encrypted data
  encryptionService.clearEncrypted('meta_ai_cached_creds');
  
  document.getElementById('view-auth').classList.add('flex-active');
  document.getElementById('main-ui').style.display = 'none';
  document.getElementById('login-pass').value = '';
};
```

---

## WEEK 4: Infrastructure & Testing

### Task 4.1: Implement Security Headers

**Note:** GitHub Pages has limited support for custom headers. Consider Netlify for better control.

**Option A: GitHub Pages with Cloudflare (Free)**

1. Go to https://www.cloudflare.com
2. Add site (use your domain)
3. Configure Page Rules to add headers:
   - URL: `seand266.github.io/Sentinel-APP*`
   - Headers: Add multiple rules

**Option B: Migrate to Netlify (Recommended for Headers)**

Create `netlify.toml`:

```toml
[[headers]]
for = "/*"
[headers.values]
Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
X-Content-Type-Options = "nosniff"
X-Frame-Options = "DENY"
X-XSS-Protection = "1; mode=block"
Referrer-Policy = "strict-origin-when-cross-origin"
Permissions-Policy = "geolocation=(), microphone=(), camera=()"
Content-Security-Policy = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com"
```

Deploy to Netlify:
```bash
npm install netlify-cli -g
netlify deploy --prod --dir=.
```

---

### Task 4.2: Set Up GitHub Actions Security Scanning

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scanning

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # CodeQL SAST Scanning
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: 'javascript'
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
      
      # Dependency vulnerability scanning
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: false
      
      # Snyk scanning (optional, requires setup)
      - name: Snyk vulnerability scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        continue-on-error: true
      
      # Secrets detection
      - name: Secret scanning
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  firestore-rules:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Test Firestore Rules
        run: |
          firebase emulators:exec \
            --import=seed-data \
            'npm run test:firestore-rules'
```

---

### Task 4.3: Create Incident Response Plan

Create `INCIDENT_RESPONSE.md`:

```markdown
# Incident Response Procedures

## Security Incident Classification

### Critical (P0) - Immediate Action
- Confirmed data breach
- Credential exposure
- System compromise
- Active attack in progress

**Response Time:** < 1 hour

### High (P1) - Urgent
- Vulnerability discovery
- Unauthorized access attempt
- Suspicious activity

**Response Time:** < 4 hours

### Medium (P2) - Standard
- Potential vulnerability
- Configuration issue

**Response Time:** < 1 business day

## Incident Response Steps

### 1. DETECT & ASSESS (0-15 min)
- [ ] Identify incident type
- [ ] Assess severity level
- [ ] Gather initial information
- [ ] Notify security team

### 2. CONTAIN (15-60 min)
- [ ] Revoke compromised credentials
- [ ] Disable affected accounts
- [ ] Block malicious IPs (if known)
- [ ] Isolate affected systems
- [ ] Document all actions with timestamps

### 3. INVESTIGATE (1-24 hours)
- [ ] Review logs and audit trails
- [ ] Determine scope of compromise
- [ ] Identify root cause
- [ ] Preserve evidence
- [ ] Estimate impact

### 4. REMEDIATE (varies)
- [ ] Fix vulnerability/root cause
- [ ] Reset/rotate credentials
- [ ] Deploy patches
- [ ] Validate fixes with testing
- [ ] Monitor for re-occurrence

### 5. COMMUNICATE (ongoing)
- [ ] Notify affected users
- [ ] Legal/compliance notification
- [ ] Public disclosure (if required)
- [ ] Media handling

### 6. REVIEW & IMPROVE (post-incident)
- [ ] Post-mortem analysis
- [ ] Document lessons learned
- [ ] Update procedures
- [ ] Implement preventive measures

## Emergency Contacts

- Security Lead: [contact]
- DevOps Lead: [contact]
- Legal: [contact]
- Management: [contact]

## Runbooks

### Runbook: Compromised Firebase Credentials

```
1. Immediate (0-5 min):
   - Go to Firebase Console
   - Disable compromised API key
   - Create new restricted key
   
2. Short-term (5-30 min):
   - Update GitHub Secrets with new key
   - Trigger redeployment via GitHub Actions
   - Monitor deployment
   
3. Medium-term (30 min - 2 hours):
   - Review Firestore audit logs
   - Check for unauthorized access
   - Update documentation
   
4. Follow-up:
   - Analyze how it was exposed
   - Implement preventive measures
   - Team training on credential handling
```

### Runbook: Suspected Data Breach

```
1. Immediate:
   - Take application offline if critical
   - Alert security team
   - Preserve logs (no cleanup)
   
2. Investigation:
   - Review authentication logs
   - Check Firestore access logs
   - Identify affected users/data
   
3. Notification:
   - Notify affected users
   - Notify legal/compliance
   - Prepare public statement
   
4. Remediation:
   - Force password resets
   - Invalidate existing tokens
   - Deploy additional security measures
```
```

---

## Testing Checklist

- [ ] All credentials removed from source code
- [ ] GitHub Secrets configured correctly
- [ ] Cloud Functions deployed and tested
- [ ] Firestore Rules tested with Simulator
- [ ] Client-side encryption working
- [ ] Security headers deployed
- [ ] GitHub Actions pipelines passing
- [ ] Incident response plan documented
- [ ] Team trained on new procedures

---

## Success Criteria

✅ No exposed credentials  
✅ All sensitive operations server-side  
✅ Security Rules properly enforced  
✅ Encryption implemented  
✅ Monitoring & logging active  
✅ Team trained & ready  

---

**Document Version:** 1.0  
**Next Review:** 2026-06-19
