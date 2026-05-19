# GitHub CoPilot Prompts for Sentinel-APP Security Remediation

**Last Updated:** 2026-05-19  
**Total Prompts:** 40+  
**Organized By:** Security Category A-H  

---

## 🎯 How to Use This Document

1. **Find your task** in the category list below
2. **Copy the entire prompt** (includes full context)
3. **Open GitHub CoPilot**: `Ctrl+I` (VS Code) or `Cmd+I` (Mac)
4. **Paste the prompt** → CoPilot generates response
5. **Ask follow-ups** as needed (CoPilot remembers context)

### Pro Tips:
- ✅ **Safe to use:** All prompts below are security-focused and won't expose secrets
- 📌 **Bookmark:** Save this file in your repo
- 🔄 **Iterate:** Ask CoPilot to refine/adjust code
- 🧪 **Verify:** Always test generated code before deploying
- 💬 **Add context:** Reference your repo URL when asking questions

---

## Category A: Credential Management & Revocation

### [A1] Firebase Credential Revocation

**When to use:** First thing on Day 1 - immediately revoke exposed credentials

```
I need to revoke an exposed Firebase API key because it was committed to a public GitHub 
repository and deployed to GitHub Pages.

Repository: Seand266/Sentinel-APP
Exposed Key: AIzaSyBE8yKvBzEYUhF9qkXxDHK533rJlXHR6KA
Project: sentinel-f77ba

Please provide:
1. Step-by-step instructions to access Firebase Console and delete this specific key
2. How to create a new Web API key with proper restrictions
3. How to restrict the new key to only my domain (https://seand266.github.io/Sentinel-APP)
4. How to restrict the key to only needed APIs (Firestore, Auth)
5. Verification steps to confirm the old key is disabled
6. Timeline for when the old key stops working

Provide exact menu paths and buttons to click in Firebase Console.
```

**Expected Output:** Step-by-step console navigation, new key creation, verification commands

---

### [A2] EmailJS Credential Revocation

**When to use:** Immediately after revoking Firebase credentials

```
I need to revoke an exposed EmailJS public key from my web application because it was 
committed to source code in a public GitHub repository.

Current Situation:
- Public Key Exposed: OSnwHaVORnAhqi4rp
- Used in: index.html for sending emails
- Potential Risk: Attackers can send emails impersonating my app

Please provide:
1. Step-by-step instructions to delete this public key from EmailJS dashboard
2. How to create a new public key with domain restrictions
3. How to restrict the new key to only my domains
4. List of services that will be affected by this change
5. Verification that old key is disabled
6. Temporary workarounds if keys take time to propagate

Also explain what an attacker could do with this exposed public key.
```

**Expected Output:** EmailJS dashboard navigation, new key creation, security implications

---

### [A3] Google Sheets Credential Exposure

**When to use:** After Firebase/EmailJS - secure the Google Sheets with credentials

```
I have a Google Sheets spreadsheet containing Meta AI login credentials that is being 
accessed via a CORS proxy from my public web application. This is a critical security risk.

Spreadsheet ID: 1SSgl60xVl_i-7nx23ch4jADCq9wZQmUR1ObRVDXDEpk
Current Access: Public (anyone with link can view)
Content: Meta AI email addresses and passwords for representatives

Please provide:
1. Immediate steps to restrict sharing on this Google Sheets
2. How to change sharing from "Anyone with link" to "Restricted"
3. Should I delete all credentials from this sheet? Why/why not?
4. How to migrate this data to a secure credential management system
5. How to audit who has accessed this sheet
6. How to prevent similar exposure in the future

Also explain the security risks of storing credentials in shared spreadsheets.
```

**Expected Output:** Google Sheets security steps, credential migration strategy

---

## Category B: Cloud Functions & Backend Security

### [B1] Firebase Cloud Functions Setup

**When to use:** Week 2 - Moving sensitive logic to backend

```
I need to migrate sensitive operations from client-side JavaScript to Firebase Cloud Functions 
to improve security. Currently, EmailJS calls and credential lookups are happening in the browser.

Current Architecture:
- Frontend: HTML/CSS/JavaScript (GitHub Pages)
- Backend: Firebase (Firestore, Auth)
- External Service: EmailJS for emails

Operations to Move:
1. Sending credential reset emails
2. Sending device status report emails
3. Fetching Meta AI credentials (currently from Google Sheets)
4. Submitting replacement requests

Please provide:
1. Complete setup steps for Firebase Cloud Functions using TypeScript
2. Project structure for organizing multiple functions
3. How to structure an Express app within Cloud Functions
4. Authentication middleware to validate user tokens
5. Error handling and logging best practices
6. How to call these functions from the frontend
7. Local testing with Firebase Emulator
8. Deployment steps

Show complete, production-ready code examples with comments.
```

**Expected Output:** Cloud Functions setup guide, Express middleware, TypeScript examples

---

### [B2] Secure Email Function Implementation

**When to use:** Implementing backend email service

```
I'm creating a Firebase Cloud Function to handle sending emails securely. This function 
should replace client-side EmailJS calls.

Requirements:
1. Validate user is authenticated before sending
2. Validate email content doesn't contain malicious code
3. Only allow specific email templates (status reports, credential resets)
4. Log all email attempts for audit trail
5. Rate limit to prevent abuse (max 5 emails per user per hour)
6. Handle failures gracefully
7. Return only success/failure status to client (not error details)

Credentials Storage:
- EmailJS service ID: service_syb4oto
- Templates: template_0tx65cr (reports), template_jbkqwyx (credentials)
- Public Key: Will be stored in Cloud Function environment variables

Please provide:
1. Complete Cloud Function implementation in TypeScript
2. Input validation logic
3. Rate limiting implementation
4. Error handling without exposing secrets
5. Audit logging structure
6. Unit test examples
7. Environment variable setup

Show production-ready code with extensive comments explaining security measures.
```

**Expected Output:** Complete TypeScript Cloud Function, validation logic, testing examples

---

### [B3] Cloud Functions Authentication Middleware

**When to use:** Securing all Cloud Functions

```
I'm building an authentication middleware for Firebase Cloud Functions to validate that 
all requests are from authenticated users and have proper authorization.

Requirements:
1. Verify Firebase authentication token
2. Check user's role/custom claims (admin vs regular user)
3. Validate request comes from my allowed domains
4. Rate limiting per user
5. Audit logging of all access attempts
6. Handle token expiration gracefully
7. Return appropriate error codes for failures

My Users:
- Regular representatives: @2020companies.com email
- Admins: Specific list, marked with custom claim "role: admin"

Please provide:
1. Complete middleware implementation in TypeScript/Express
2. Custom Claims validation logic
3. Domain whitelist checking
4. Rate limiting per user per hour
5. Audit logging implementation
6. Error responses with appropriate HTTP status codes
7. Testing examples
8. How to apply middleware to specific routes

Show production-ready code with comments explaining each security decision.
```

**Expected Output:** Express middleware, token validation, rate limiting, testing

---

## Category C: Firestore Security Rules

### [C1] Firestore Rules Design

**When to use:** Week 2 - Implementing data access control

```
I need to design and implement comprehensive Firestore security rules for my application. 
Currently, there are no meaningful restrictions on who can read/write data.

Current Data Collections:
- users/{email} - User profiles with device assignments and credentials
- reports/{reportId} - Device status reports from field representatives  
- device_health_logs/{logId} - Device health history and issues
- faqs/{faqId} - FAQ articles for support
- admins/{email} - Admin account records
- credential_requests/{requestId} - Requests for credential resets
- reset_requests/{requestId} - Requests for account resets
- replacement_requests/{requestId} - Requests for device replacements
- view_logs/{logId} - Application usage logs
- security_logs/{logId} - Security audit trail

User Roles:
- Regular User: @2020companies.com email, can access own data
- Admin: Specific list, can access all data and perform administrative actions
- Public: Unauthenticated users (should have limited/no access)

Requirements:
1. Users can only read/write their own documents
2. Admins can read everything, write to limited collections
3. FAQs should be public-readable, admin-only writable
4. Logs should be write-once (append-only) for security
5. Credential data should be heavily restricted
6. Validate data structure on write
7. Prevent unauthorized updates to admin collections

Please provide:
1. Complete Firestore Rules file with detailed comments
2. Security patterns for each collection (user-scoped, admin-only, public, etc.)
3. How to validate email domain in rules
4. Explanation of why each rule is structured this way
5. Common security pitfalls to avoid
6. How to test rules with Rules Simulator
7. Deployment instructions

Show production-ready rules with extensive security explanations.
```

**Expected Output:** Complete Firestore Rules file, security patterns, testing guide

---

### [C2] Firestore Rules Testing

**When to use:** Validating Rules implementation

```
I've created Firestore Rules to restrict data access, and I need to test them thoroughly 
before deploying to production.

Rules to Test:
- User can read only their own document
- Admin can read all users
- Unauthenticated users cannot read anything
- Users can write to reports collection
- Only admins can delete users
- FAQs are publicly readable

Please provide:
1. Step-by-step guide to test Rules using Firebase Console Rules Simulator
2. Test cases for each permission scenario
3. Positive test cases (should succeed)
4. Negative test cases (should fail)
5. How to test with mock authentication data
6. Common false positives in rule testing
7. Automated testing approach for CI/CD

Also provide example test cases formatted for easy copy-paste into Rules Simulator.
```

**Expected Output:** Rules Simulator guide, test cases, CI/CD testing strategy

---

## Category D: Authentication & Authorization

### [D1] Firebase Custom Claims for RBAC

**When to use:** Week 3 - Implementing role-based access control

```
I need to implement role-based access control (RBAC) using Firebase Custom Claims. 
Currently, there's no way to distinguish admin users from regular users.

User Types:
1. Regular Representatives - can access own data, submit reports, request credentials
2. Admins - can manage users, delete records, override settings, view audit logs

Current Problem:
- No role differentiation
- Anyone with an @2020companies.com email can create account
- No way to restrict admin functions

Solution Approach:
- Use Firebase Custom Claims to store role
- Implement role checks in Cloud Functions
- Implement role checks in Firestore Rules
- Implement role checks in frontend UI

Please provide:
1. How to structure Custom Claims for roles
2. Cloud Function to set/update custom claims (admin only)
3. How to add custom claims to new admin accounts
4. How to migrate existing admin users to include custom claims
5. How to verify custom claims in Cloud Functions
6. How to use custom claims in Firestore Rules
7. Frontend code to check user role and show/hide admin UI
8. Error handling for missing/invalid claims

Show complete, production-ready implementation with comments.
```

**Expected Output:** Custom Claims structure, admin provisioning function, verification code

---

### [D2] RBAC-Protected Cloud Functions

**When to use:** Securing all admin operations

```
I have several Cloud Functions that should only be accessible to administrators. I need to 
implement proper authorization checks.

Admin-Only Functions:
- createAdmin - Create new admin account
- deleteUser - Delete user account and all data
- updateDeviceStatus - Manually override device status
- deleteReport - Remove submitted reports
- manageFaqs - Create/update/delete FAQ articles
- manageCredentials - Reset credentials for users
- viewAuditLogs - Access security and audit logs

Please provide:
1. Authorization middleware to check admin role
2. Implementation for each admin function with proper checks
3. How to handle authorization failures (return appropriate errors)
4. Audit logging for all admin actions (who did what, when)
5. Rate limiting for sensitive operations
6. Email notification when admin actions are performed
7. Rollback/undo functionality for critical operations
8. Testing strategy for authorization

Show production-ready TypeScript/Express code with extensive comments about security decisions.
```

**Expected Output:** RBAC middleware, admin functions, audit logging, testing

---

## Category E: Encryption & Data Protection

### [E1] Client-Side Encryption for Credentials

**When to use:** Week 3 - Protecting stored credentials

```
I'm currently storing Meta AI credentials in plain text in browser localStorage, which is 
a security risk. I need to implement client-side encryption before storing locally.

Current Situation:
localStorage.setItem('meta_ai_cached_creds', JSON.stringify({
  user: 'email@2020companies.com',
  metaEmail: 'meta@company.com',
  metaPass: 'password123'
}));

Requirements:
1. Encrypt credentials with strong encryption (AES-256 or equivalent)
2. Use a key derived from user's Firebase credentials
3. Make encryption/decryption transparent to app logic
4. Support key rotation
5. Securely clear credentials on logout
6. Handle decryption failures gracefully
7. Good performance (no noticeable slowdown)

Please provide:
1. Recommendation for encryption library (comparing pros/cons)
2. Key derivation strategy (how to generate encryption key)
3. Complete encryption/decryption utility class
4. Integration with app.js credentials storage
5. Logout procedure that securely clears encrypted data
6. Key rotation procedure
7. Testing examples
8. Performance considerations

Show production-ready JavaScript code with comments explaining each security decision.
```

**Expected Output:** Encryption library recommendation, utility class, integration guide

---

### [E2] End-to-End Encryption for Sensitive Data

**When to use:** Advanced - encrypting data in Firestore

```
I want to implement end-to-end encryption so sensitive data in Firestore is encrypted at 
rest and only the owning user can decrypt it.

Data to Encrypt:
- Meta AI credentials
- System credentials
- Personal notes with sensitive information

Architecture:
- User has an encryption key (derived from password/ID)
- Data encrypted before sending to Firestore
- Encrypted data stored in Firestore
- Only user can decrypt with their key
- Admins see encrypted data only (no bypass)

Requirements:
1. User-specific encryption keys
2. Key never leaves client (unless user chooses to share)
3. Support for sharing encrypted data with other users
4. Key recovery procedures (if user forgets password)
5. Admin emergency access procedure (with audit trail)
6. Key rotation support

Please provide:
1. Encryption architecture design
2. Key derivation strategy
3. Client-side encryption/decryption implementation
4. How to store encrypted data in Firestore
5. Sharing mechanism (encrypt with user's public key)
6. Recovery procedures
7. Admin emergency access (with audit logging)
8. Performance and usability considerations

Explain the cryptographic model and security implications.
```

**Expected Output:** E2E encryption architecture, implementation, key management

---

## Category F: Secure Deployment & CI/CD

### [F1] GitHub Actions Security Workflow

**When to use:** Week 4 - Setting up secure deployment pipeline

```
I need to create a GitHub Actions workflow that:
1. Automatically injects secrets from GitHub Secrets into the build
2. Runs security checks before deployment
3. Scans dependencies for vulnerabilities
4. Validates Firestore Rules
5. Runs tests
6. Deploys to GitHub Pages safely

Repository: Seand266/Sentinel-APP
Deployment Target: GitHub Pages
Secrets to Inject:
- FIREBASE_API_KEY
- FIREBASE_CONFIG (JSON)
- EMAILJS_PUBLIC_KEY
- EMAILJS_SERVICE_ID
- EMAILJS_TEMPLATE_IDS (JSON)

Requirements:
1. Never expose secrets in logs or build artifacts
2. Run security scanning (SAST, dependency check, secrets detection)
3. Validate Firestore Rules with emulator
4. Run unit/integration tests
5. Generate security report
6. Require approval for production deployment
7. Automatic rollback if deployment fails

Please provide:
1. Complete GitHub Actions workflow YAML file
2. Step-by-step explanations of each job
3. How to set up GitHub Secrets
4. How to inject secrets into HTML at build time
5. Security scanning tools to integrate (free options preferred)
6. Approval gate implementation
7. Rollback procedures
8. Monitoring and alerting setup

Show production-ready configuration with extensive comments.
```

**Expected Output:** GitHub Actions workflow YAML, setup guide, secrets injection strategy

---

### [F2] SAST & Dependency Scanning

**When to use:** Setting up automated security scanning

```
I need to set up automated security scanning in my GitHub Actions pipeline to catch:
1. Common code vulnerabilities (SAST)
2. Dependency vulnerabilities
3. Accidentally committed secrets
4. Infrastructure as Code issues (Firestore Rules)

Please provide:
1. GitHub CodeQL setup and configuration
2. npm audit integration
3. Snyk vulnerability scanning setup
4. Gitleaks for secrets detection
5. Firestore Rules validation in CI/CD
6. How to handle false positives
7. How to generate security reports
8. Integration with GitHub Security tab

Recommend free tools first, enterprise options secondary.

Also provide:
- How to suppress false positives
- Remediation workflow for findings
- Escalation procedures for critical vulnerabilities
- Dashboard for security metrics
```

**Expected Output:** Security scanning tools, GitHub Actions configuration, remediation workflow

---

## Category G: Monitoring, Logging & Incident Response

### [G1] Security Audit Logging

**When to use:** Week 4 - Implementing audit trails

```
I need to implement comprehensive security audit logging to track all access to sensitive 
operations and data.

Events to Log:
1. Authentication - login success/failure, account creation, password reset
2. Authorization - admin actions, role changes, access denials
3. Data Access - who accessed what data, when
4. Configuration Changes - security rule updates, credential rotations
5. Suspicious Activity - failed authorization, unusual access patterns
6. Administrative Actions - user deletion, report deletion, FAQ management

Logging Requirements:
1. Immutable logs (append-only, no delete)
2. Include timestamp, user, action, result, IP address (if available)
3. Don't log sensitive data (passwords, credentials)
4. Accessible only to admins
5. Retention policy (keep for 1 year)
6. Searchable/queryable for incident investigation

Please provide:
1. Firestore collection schema for security logs
2. Cloud Function implementation for logging
3. Logging at each layer (Auth, Firestore Rules, Functions)
4. How to make logs immutable (prevent tampering)
5. Retention and archival policy
6. Dashboard/query examples for common investigations
7. SIEM integration (if applicable)
8. Performance considerations

Show complete implementation with code examples and schema.
```

**Expected Output:** Audit log schema, logging functions, retention policy, query examples

---

### [G2] Incident Response Procedures

**When to use:** Week 4 - Documenting emergency procedures

```
I need to create incident response procedures for security incidents in my web application.

Incident Types to Plan For:
1. Suspected data breach
2. Unauthorized access attempt
3. Compromised credential/token
4. Application vulnerability discovered
5. DDoS attack
6. Malware/ransomware attack

Please provide:
1. Incident classification system (Critical/High/Medium/Low)
2. Incident detection strategies
3. Step-by-step response procedures for each type
4. Escalation procedures and contact list
5. Evidence preservation guidelines
6. Communication templates (user notification, legal, public)
7. Post-incident review process
8. Runbooks for common scenarios

For each incident type, include:
- Detection indicators
- Immediate response (0-15 min)
- Containment (15-60 min)
- Investigation (1-24 hours)
- Recovery
- Communication
- Prevention measures

Format as runbooks that can be followed during an actual incident (be specific, not vague).
```

**Expected Output:** Incident response plan, runbooks, communication templates

---

## Category H: Code Review & Vulnerability Analysis

### [H1] Security Code Review Request

**When to use:** Any time you want CoPilot to review code for security issues

```
I'm going to paste a code section and I need you to review it for security vulnerabilities.

Context:
- This is for: [describe purpose]
- Used by: [who uses it - admins, all users, public, etc.]
- Handles: [what sensitive data/operations]

Please analyze for:
1. Authentication/authorization flaws
2. Injection vulnerabilities (SQL, NoSQL, XSS, etc.)
3. Credential exposure
4. Improper error handling
5. Insecure data storage
6. OWASP Top 10 vulnerabilities
7. Cryptography issues
8. Input validation gaps

For each vulnerability found, provide:
1. Severity (Critical/High/Medium/Low)
2. CVSS score estimate
3. Technical explanation
4. Proof of concept (if applicable)
5. Remediation steps
6. Secure code example

[PASTE CODE HERE]
```

**Expected Output:** Vulnerability analysis, severity ratings, remediation guidance

---

### [H2] Firestore Rules Security Review

**When to use:** Reviewing security rules for issues

```
I'm going to paste my Firestore Rules and need a security review.

Context:
- My user types: [admin, user, public, etc.]
- Sensitive data in: [list collections]
- Expected access patterns: [describe who accesses what]

Please review for:
1. Over-permissive rules
2. Missing authentication checks
3. Missing data validation
4. Bypass opportunities
5. Data exposure risks
6. Missing audit logging hooks
7. Rate limiting gaps
8. Compliance issues

For each issue, provide:
1. Description of the problem
2. How it could be exploited
3. CVSS severity estimate
4. Specific remediation
5. Corrected rule syntax

[PASTE FIRESTORE RULES HERE]
```

**Expected Output:** Rules security analysis, vulnerability identification, corrections

---

## Category I: Compliance & Documentation

### [I1] Security Documentation Generator

**When to use:** Creating security documentation for your team

```
I need to create security documentation for my development team. This is a web application 
that handles:
- User authentication and authorization
- Device management and reporting
- Credential storage and management
- Administrative functions

Please provide templates for:
1. SECURITY.md for the repository (vulnerability reporting, responsible disclosure)
2. Developer Security Onboarding Guide
   - How to run the app securely locally
   - How to access production safely
   - Credential handling procedures
   - Common security mistakes to avoid
3. Secure Coding Guidelines
   - JavaScript/Firebase specific
   - Common vulnerabilities in our stack
   - Best practices with code examples
4. Emergency Access Procedures (for break-glass scenarios)
5. Credential Rotation Procedures
6. Post-Incident Review Template

For each document:
- Make it practical and actionable
- Include step-by-step procedures
- Add real examples from our codebase
- Format for easy printing/distribution

Target audience: Developers (not necessarily security experts)
```

**Expected Output:** Security documentation templates, ready to customize

---

## Category J: Quick Fixes & Follow-ups

### [J1] Prompt for Specific Error

**Use when:** You encounter a specific error during remediation

```
I'm getting this error while [describe what you're doing]:

[PASTE ERROR MESSAGE/STACK TRACE]

Context:
- Framework: [Firebase/Node/React/etc.]
- What I'm trying to do: [describe goal]
- What I've already tried: [list attempts]

Please:
1. Explain what's causing this error
2. Provide step-by-step fix
3. Explain why this fix works
4. How to prevent this error in future

Also check if this error indicates a security issue.
```

---

### [J2] Performance Verification

**Use when:** You want to verify security changes don't impact performance

```
I've implemented [describe security changes]:
[PASTE CODE SNIPPET]

I'm concerned about performance impact. Please:
1. Identify potential performance bottlenecks
2. Estimate performance impact (negligible/minor/significant)
3. Optimization recommendations
4. Monitoring/metrics to track
5. Acceptable performance thresholds

Context:
- Expected users: [number]
- Sensitive operations frequency: [e.g., 100 per hour]
- Acceptable latency: [e.g., 500ms]
```

---

## 💡 Pro Tips for Using CoPilot

### ✅ DO:
- Include full context in prompts
- Ask for code examples with comments
- Request explanation of security reasoning
- Ask for testing strategies
- Request multiple solutions, then discuss trade-offs
- Verify generated code before deploying

### ❌ DON'T:
- Paste sensitive data or actual credentials
- Ask CoPilot to generate passwords/secrets
- Skip testing generated code
- Use generated code without understanding it
- Copy code without reviewing for your specific needs
- Ask CoPilot to bypass security measures

### 🔄 Follow-Up Questions:

After CoPilot responds, you can ask:
```
"Can you explain why you chose [approach] over [alternative]?"
"Can you make this more efficient?"
"How would I test this implementation?"
"What are the security implications of this approach?"
"How does this handle [specific edge case]?"
```

---

## 📊 Using Prompts in Team Environment

**For Team Members:**
1. Each person gets a copy of this document
2. Search for their assigned task
3. Copy the prompt
4. Use CoPilot to implement
5. Ask technical questions as needed

**For Code Reviews:**
```
"Review this code from CoPilot against our security requirements."
"Does this implementation follow our security guidelines?"
"Are there any edge cases we should handle?"
```

---

## 📞 Getting Help

**If a prompt doesn't work:**
1. Add more context to the prompt
2. Include code/configs you're working with
3. Describe what went wrong
4. Ask a follow-up question

**If CoPilot's suggestion seems wrong:**
1. Ask it to explain its reasoning
2. Request an alternative approach
3. Ask what could go wrong with this approach
4. Verify with official documentation

---

## Checklist: Using CoPilot for Security Remediation

- [ ] Opened the SECURITY_REMEDIATION_PLAN.md
- [ ] Found your task in the implementation timeline
- [ ] Located corresponding prompt in this document
- [ ] Copied full prompt (with context)
- [ ] Opened CoPilot Chat
- [ ] Pasted prompt
- [ ] Reviewed generated code/guidance
- [ ] Asked follow-up questions if needed
- [ ] Tested implementation before deploying
- [ ] Documented what you learned

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-19  
**Next Update:** After first remediation cycle  
**Questions?** Ask in #security-incident Slack channel
