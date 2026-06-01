"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = exports.selfHealMyClaims = exports.migrateCustomClaims = exports.registerUser = exports.requestVerificationCode = exports.selfHealMyCredential = exports.syncSpreadsheetCredentials = exports.sendSecureEmail = void 0;
exports.withRequiredRole = withRequiredRole;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const googleapis_1 = require("googleapis");
// Initialize the Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
/**
 * SECURE GOOGLE SHEETS CLIENT RETRIEVAL
 * Fetches the credentials spreadsheet using Application Default Credentials (ADC) securely.
 */
async function fetchSpreadsheetRows() {
    try {
        const auth = new googleapis_1.google.auth.GoogleAuth({
            scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
        });
        const sheets = googleapis_1.google.sheets({ version: "v4", auth });
        const spreadsheetId = "1SSgl60xVl_i-7nx23ch4jADCq9wZQmUR1ObRVDXDEpk";
        const range = "A:L"; // Fetches first sheet columns A to L
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return response.data.values || [];
    }
    catch (err) {
        functions.logger.error("Google Sheets API retrieval failed:", err);
        throw new functions.https.HttpsError("internal", "Failed to access the secure credentials spreadsheet: " + err.message);
    }
}
// In-memory rate limiting map for email dispatching
const emailRateLimitCache = new Map();
const RATE_LIMIT_MAX = 5; // Max 5 emails per window
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
/**
 * 1. SECURE SERVER-SIDE EMAIL DISPATCHER (EmailJS REST Wrapper)
 * Injects EmailJS Private Key, Service ID, and Public Key securely from Secret Manager
 */
exports.sendSecureEmail = functions
    .runWith({
    secrets: ["EMAILJS_PRIVATE_KEY", "EMAILJS_SERVICE_ID", "EMAILJS_PUBLIC_KEY"],
    timeoutSeconds: 15,
    memory: "256MB",
})
    .https.onCall(async (data, context) => {
    const { ticketType, details, repName } = data;
    if (!ticketType || typeof ticketType !== "string" || ticketType.length > 50) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid or empty ticketType parameter.");
    }
    if (!details || typeof details !== "string" || details.length > 3000) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid or too long details parameter.");
    }
    const isResetRequest = ticketType === "Account Reset Request" ||
        ticketType === "Admin Account Reset Request";
    // A. ENFORCE AUTHENTICATION (except for password resets)
    if (!context.auth && !isResetRequest) {
        throw new functions.https.HttpsError("unauthenticated", "You must be authenticated to send notifications.");
    }
    // Determine identity for logging and rate limiting
    const uid = context.auth ? context.auth.uid : `ip_${context.rawRequest?.ip || "unknown"}`;
    let userEmail = context.auth ? (context.auth.token.email || "unknown@domain.com") : (repName || "unknown@domain.com");
    // If it is a password reset request, perform strict checks and write to Firestore
    if (isResetRequest) {
        if (!userEmail || typeof userEmail !== "string" || !userEmail.includes("@")) {
            throw new functions.https.HttpsError("invalid-argument", "A valid email address is required for password resets.");
        }
        const sanitizedEmail = userEmail.trim().toLowerCase();
        const ALLOWED_DOMAINS = ["@2020companies.com", "@gmail.com"];
        const hasAllowedDomain = ALLOWED_DOMAINS.some(domain => sanitizedEmail.endsWith(domain));
        if (!hasAllowedDomain) {
            functions.logger.warn(`Security Event: Blocked reset request for unauthorized domain: ${sanitizedEmail}`);
            throw new functions.https.HttpsError("permission-denied", `Only ${ALLOWED_DOMAINS.join(" or ")} email accounts can request password resets.`);
        }
        // Check if user exists in Firestore users or allowlist collection
        const userProfileRef = db.collection("users").doc(sanitizedEmail);
        const allowlistRef = db.collection("allowlist").doc(sanitizedEmail);
        const [profileDoc, allowlistDoc] = await Promise.all([
            userProfileRef.get(),
            allowlistRef.get()
        ]);
        if (!profileDoc.exists && !allowlistDoc.exists) {
            functions.logger.warn(`Security Event: Blocked reset request for unregistered email: ${sanitizedEmail}`);
            throw new functions.https.HttpsError("not-found", "This email address is not registered in our system.");
        }
        // Add to reset_requests collection securely on the server
        await db.collection("reset_requests").add({
            email: sanitizedEmail,
            date: new Date().toISOString()
        });
        functions.logger.info(`Security Event: Registered password reset request for: ${sanitizedEmail}`);
        userEmail = sanitizedEmail; // Use the sanitized corporate email for rate limiting and emailing
    }
    // B. ENFORCE RATE LIMITS
    const now = Date.now();
    const userLimit = emailRateLimitCache.get(uid) || { count: 0, lastReset: now };
    if (now - userLimit.lastReset > RATE_LIMIT_WINDOW_MS) {
        userLimit.count = 0;
        userLimit.lastReset = now;
    }
    if (userLimit.count >= RATE_LIMIT_MAX) {
        functions.logger.warn(`Rate limit exceeded for UID/IP: ${uid} (${userEmail})`);
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Please wait 1 minute before sending another status report.");
    }
    userLimit.count++;
    emailRateLimitCache.set(uid, userLimit);
    // C. SECURE EXTERNAL DISPATCH VIA EMAILJS REST API
    const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
    const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
    const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
    // Explicitly whitelist and map template IDs securely on the server
    let templateId = "template_0tx65cr"; // Standard Report Template
    if (ticketType === "Credential Request") {
        templateId = "template_jbkqwyx"; // Credential Request Template
    }
    if (!privateKey || !serviceId || !publicKey) {
        functions.logger.error("Missing EmailJS environment secrets inside Cloud Secret Manager");
        throw new functions.https.HttpsError("failed-precondition", "Server configuration error. Contact admin.");
    }
    try {
        functions.logger.info(`Securely dispatching email for ${userEmail}. Ticket: ${ticketType}`);
        const response = await axios_1.default.post("https://api.emailjs.com/api/v1.0/email/send", {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
                ticket_type: ticketType,
                rep_name: userEmail,
                details: details,
            },
        }, {
            headers: { "Content-Type": "application/json" },
        });
        return {
            success: true,
            message: "Secure email dispatched.",
            status: response.status,
        };
    }
    catch (error) {
        functions.logger.error("EmailJS Secure Dispatch Failed:", error.response?.data || error.message);
        throw new functions.https.HttpsError("internal", "Secure notification delivery failed.");
    }
});
/**
 * 2. SECURE GOOGLE SHEETS SYNCHRONIZER (ADMIN PORTAL ONLY)
 * Pulls all records from Google Sheets securely, matches users, and persists to Firestore.
 * No sensitive plaintext credentials ever escape to the admin's browser interface.
 */
exports.syncSpreadsheetCredentials = functions
    .runWith({
    timeoutSeconds: 60,
    memory: "512MB",
})
    .https.onCall(withRequiredRole("admin", async (data, context) => {
    try {
        // B. SECURE SERVER-SIDE SPREADSHEET RETRIEVAL VIA GOOGLE SHEETS API
        const rows = await fetchSpreadsheetRows();
        // C. FETCH REGISTERED FIRESTORE REPRESENTATIVES
        const usersSnapshot = await db.collection("users").get();
        const activeReps = {};
        usersSnapshot.forEach((doc) => {
            const u = doc.data();
            if (u.first && u.last) {
                activeReps[doc.id.toLowerCase()] = {
                    first: u.first.toLowerCase(),
                    last: u.last.toLowerCase(),
                };
            }
        });
        let migratedCount = 0;
        let skippedCount = 0;
        const batch = db.batch();
        // D. PARSE AND MATCH RECORDS
        for (let i = 1; i < rows.length; i++) {
            const p = rows[i];
            if (p && p.length > 10) {
                const first = (p[1] || "").replace(/"/g, "").trim().toLowerCase();
                const last = (p[2] || "").replace(/"/g, "").trim().toLowerCase();
                const metaEmail = (p[6] || "").replace(/"/g, "").trim();
                const metaPass = (p[10] || "").replace(/"/g, "").trim();
                if (!first || !last || !metaEmail || !metaPass) {
                    skippedCount++;
                    continue;
                }
                // Lookup matching registered user profile
                let matchedEmail = null;
                for (const email of Object.keys(activeReps)) {
                    const rep = activeReps[email];
                    if (rep.first === first && rep.last === last) {
                        matchedEmail = email;
                        break;
                    }
                }
                if (matchedEmail) {
                    const credentialRef = db.collection("credentials").doc(matchedEmail);
                    batch.set(credentialRef, {
                        metaEmail: metaEmail,
                        metaPass: metaPass,
                        migratedAt: new Date().toISOString(),
                        migratedBy: "admin-bulk-sync",
                    });
                    migratedCount++;
                }
                else {
                    skippedCount++;
                }
            }
            else {
                skippedCount++;
            }
        }
        // E. COMMIT BATCH WRITES SECURELY
        if (migratedCount > 0) {
            await batch.commit();
        }
        functions.logger.info(`Credentials synchronization completed. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
        return {
            success: true,
            migratedCount: migratedCount,
            skippedCount: skippedCount,
        };
    }
    catch (err) {
        functions.logger.error("Spreadsheet credential synchronization failed:", err);
        throw new functions.https.HttpsError("internal", "Failed to synchronize spreadsheet credentials securely: " + err.message);
    }
}));
/**
 * 3. SECURE REPRESENTATIVE CREDENTIAL SELF-HEALING
 * Allows active logged-in reps to securely fetch their personal Meta AI credentials
 * directly from the sheets registry on-demand without exposing database passwords.
 */
exports.selfHealMyCredential = functions
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
})
    .https.onCall(async (data, context) => {
    // A. ENFORCE AUTHENTICATION
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to self-heal your credentials.");
    }
    const userEmail = context.auth.token.email?.toLowerCase();
    if (!userEmail) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid account user session. Missing email.");
    }
    try {
        // B. RESOLVE CALLER'S FIRST AND LAST NAME FROM FIRESTORE PROFILE
        const userDoc = await db.collection("users").doc(userEmail).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Representative user profile was not found in Firestore.");
        }
        const userData = userDoc.data() || {};
        const myFirst = userData.first?.toLowerCase().trim();
        const myLast = userData.last?.toLowerCase().trim();
        if (!myFirst || !myLast) {
            throw new functions.https.HttpsError("failed-precondition", "Your user profile is missing first/last name information.");
        }
        // C. SECURELY PARSE SPREADSHEET TO MATCH CREDENTIAL RECORD VIA GOOGLE SHEETS API
        const rows = await fetchSpreadsheetRows();
        let foundMetaEmail = "";
        let foundMetaPass = "";
        let found = false;
        for (let i = 1; i < rows.length; i++) {
            const p = rows[i];
            if (p && p.length > 10) {
                const first = (p[1] || "").replace(/"/g, "").trim().toLowerCase();
                const last = (p[2] || "").replace(/"/g, "").trim().toLowerCase();
                if (first === myFirst && last === myLast) {
                    foundMetaEmail = (p[6] || "").replace(/"/g, "").trim();
                    foundMetaPass = (p[10] || "").replace(/"/g, "").trim();
                    found = true;
                    break;
                }
            }
        }
        // D. PERSIST TO FIRESTORE AND RETURN MATCHED PAYLOAD ONLY
        if (found) {
            const credentialRef = db.collection("credentials").doc(userEmail);
            const credData = {
                metaEmail: foundMetaEmail,
                metaPass: foundMetaPass,
                migratedAt: new Date().toISOString(),
                migratedBy: "self-healing",
            };
            await credentialRef.set(credData);
            functions.logger.info(`Successfully self-healed Meta AI credentials for ${userEmail}`);
            return {
                success: true,
                metaEmail: foundMetaEmail,
                metaPass: foundMetaPass,
            };
        }
        else {
            functions.logger.warn(`No spreadsheet record found for Representative: ${myFirst} ${myLast}`);
            throw new functions.https.HttpsError("not-found", `No registry record matching '${myFirst} ${myLast}' was found in the Google Sheets database.`);
        }
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        functions.logger.error("Self-healing operation aborted with error:", err);
        throw new functions.https.HttpsError("internal", "An unexpected error occurred during self-healing validation.");
    }
});
/**
 * Cloud Functions Authentication & Custom Claims Authorization Wrapper
 */
function withRequiredRole(requiredRole, handler) {
    return async (data, context) => {
        // 1. Verify standard session token
        if (!context.auth) {
            functions.logger.warn("Security Event: Anonymous attempt to invoke a secure function.");
            throw new functions.https.HttpsError("unauthenticated", "Authentication is required to access this endpoint.");
        }
        const { uid, token } = context.auth;
        const userEmail = token.email || "unknown";
        // 2. Extract and match custom claims
        const userRole = token.role;
        const isAdmin = token.admin === true;
        // Rules hierarchy:
        // - If resource requires "admin", user must be explicitly marked as admin.
        // - If resource requires "user", both "user" and "admin" roles are granted access.
        const isAuthorized = (requiredRole === "admin" && isAdmin) ||
            (requiredRole === "user" && (userRole === "user" || isAdmin));
        if (!isAuthorized) {
            functions.logger.error(`Security Event: Unauthorized access attempt blocked. ` +
                `UID: ${uid} (${userEmail}) tried to access a privileged path requiring '${requiredRole}'. ` +
                `Current claims: { role: ${userRole}, admin: ${isAdmin} }`);
            throw new functions.https.HttpsError("permission-denied", "Access denied. You do not possess the required privilege level.");
        }
        return handler(data, context);
    };
}
/**
 * SECURE SERVER-SIDE EMAIL VERIFICATION CODE GENERATION & DISPATCH
 */
exports.requestVerificationCode = functions
    .runWith({
    secrets: ["EMAILJS_PRIVATE_KEY", "EMAILJS_SERVICE_ID", "EMAILJS_PUBLIC_KEY"],
    timeoutSeconds: 20,
    memory: "256MB",
})
    .https.onCall(async (data, context) => {
    const { email, firstName, lastName } = data;
    // 1. INPUT VALIDATION & SANITIZATION
    if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid email address is required.");
    }
    const sanitizedEmail = email.trim().toLowerCase();
    if (!firstName || typeof firstName !== "string" || firstName.length > 50 || firstName.trim() === "") {
        throw new functions.https.HttpsError("invalid-argument", "First name is invalid or too long.");
    }
    if (!lastName || typeof lastName !== "string" || lastName.length > 50 || lastName.trim() === "") {
        throw new functions.https.HttpsError("invalid-argument", "Last name is invalid or too long.");
    }
    // 2. DOMAIN ENFORCEMENT
    const ALLOWED_DOMAINS = ["@2020companies.com", "@gmail.com"];
    const hasAllowedDomain = ALLOWED_DOMAINS.some(domain => sanitizedEmail.endsWith(domain));
    if (!hasAllowedDomain) {
        functions.logger.warn(`Security Event: Blocked verification code request from unauthorized domain: ${sanitizedEmail}`);
        throw new functions.https.HttpsError("permission-denied", `Only ${ALLOWED_DOMAINS.join(" or ")} email accounts are authorized to register.`);
    }
    // 3. CHECK IF EMAIL ALREADY REGISTERED IN ALLOWLIST
    const allowlistRef = db.collection("allowlist").doc(sanitizedEmail);
    const allowlistDoc = await allowlistRef.get();
    if (allowlistDoc.exists && allowlistDoc.data()?.status === "registered") {
        throw new functions.https.HttpsError("already-exists", "This email address has already been registered.");
    }
    // 4. VERIFY REGISTRATION ELIGIBILITY (ALLOWLIST OR SPREADSHEET MATCH OR GMAIL TEST)
    let isEligible = false;
    if (sanitizedEmail.endsWith("@gmail.com")) {
        isEligible = true;
    }
    else if (allowlistDoc.exists) {
        isEligible = true;
    }
    else {
        // Dynamic spreadsheet match check
        try {
            functions.logger.info(`Verification Check: Inspecting spreadsheet registry for ${sanitizedEmail}`);
            const rows = await fetchSpreadsheetRows();
            for (let i = 1; i < rows.length; i++) {
                const p = rows[i];
                if (p && p.length > 6) {
                    const sheetFirst = (p[1] || "").replace(/"/g, "").trim().toLowerCase();
                    const sheetLast = (p[2] || "").replace(/"/g, "").trim().toLowerCase();
                    const sheetEmail = (p[6] || "").replace(/"/g, "").trim().toLowerCase();
                    if (sheetEmail === sanitizedEmail ||
                        (sheetFirst === firstName.trim().toLowerCase() && sheetLast === lastName.trim().toLowerCase())) {
                        isEligible = true;
                        break;
                    }
                }
            }
        }
        catch (sheetErr) {
            functions.logger.error("Verification spreadsheet lookup failed:", sheetErr);
        }
    }
    if (!isEligible) {
        functions.logger.warn(`Security Event: Blocked verification request from unallowed email: ${sanitizedEmail}`);
        throw new functions.https.HttpsError("permission-denied", "This email is not authorized for registration. Please contact an administrator.");
    }
    // 5. GENERATE AND STORE 6-DIGIT VERIFICATION CODE
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60000); // 10 minutes from now
    await db.collection("verification_codes").doc(sanitizedEmail).set({
        code: code,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        attempts: 0,
    });
    // 6. SECURE EXTERNAL DISPATCH VIA EMAILJS REST API
    const privateKey = process.env.EMAILJS_PRIVATE_KEY?.trim();
    const serviceId = process.env.EMAILJS_SERVICE_ID?.trim();
    const publicKey = process.env.EMAILJS_PUBLIC_KEY?.trim();
    const templateId = "template_0tx65cr"; // Standard Report Template
    if (!privateKey || !serviceId || !publicKey) {
        functions.logger.error("Missing EmailJS environment secrets inside Cloud Secret Manager");
        throw new functions.https.HttpsError("failed-precondition", "Server configuration error. Contact admin.");
    }
    try {
        functions.logger.info(`Sending account verification code email to ${sanitizedEmail}`);
        const response = await axios_1.default.post("https://api.emailjs.com/api/v1.0/email/send", {
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
                ticket_type: "Account Verification Code",
                rep_name: `${firstName} ${lastName}`,
                details: `Your 6-digit Sentinel account verification code is: ${code}\n\nThis code will expire in 10 minutes. If you did not request this, please ignore this email.`,
            },
        }, {
            headers: { "Content-Type": "application/json" },
        });
        return {
            success: true,
            message: "Verification code sent.",
            status: response.status,
        };
    }
    catch (error) {
        functions.logger.error("Verification code EmailJS Secure Dispatch Failed:", error.response?.data || error.message);
        throw new functions.https.HttpsError("internal", "Verification code delivery failed.");
    }
});
/**
 * SECURE SERVER-SIDE USER REGISTRATION AND CLAIMS PROVISIONING
 */
exports.registerUser = functions
    .runWith({
    timeoutSeconds: 20,
    memory: "256MB",
})
    .https.onCall(async (data, context) => {
    const { email, password, firstName, lastName, retailer, code } = data;
    // 1. INPUT VALIDATION & SANITIZATION
    if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid email address is required.");
    }
    const sanitizedEmail = email.trim().toLowerCase();
    if (!firstName || typeof firstName !== "string" || firstName.length > 50) {
        throw new functions.https.HttpsError("invalid-argument", "First name is invalid or too long.");
    }
    if (!lastName || typeof lastName !== "string" || lastName.length > 50) {
        throw new functions.https.HttpsError("invalid-argument", "Last name is invalid or too long.");
    }
    if (!retailer || typeof retailer !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "Retailer is invalid or missing.");
    }
    if (!code || typeof code !== "string" || code.trim().length !== 6) {
        throw new functions.https.HttpsError("invalid-argument", "A valid 6-digit verification code is required.");
    }
    // 1a. VERIFY THE VERIFICATION CODE SECURELY
    const verificationRef = db.collection("verification_codes").doc(sanitizedEmail);
    const verificationDoc = await verificationRef.get();
    if (!verificationDoc.exists) {
        throw new functions.https.HttpsError("invalid-argument", "No verification code found. Please request one first.");
    }
    const verificationData = verificationDoc.data();
    const nowISO = new Date().toISOString();
    if (nowISO > (verificationData?.expiresAt || "")) {
        await verificationRef.delete();
        throw new functions.https.HttpsError("deadline-exceeded", "The verification code has expired. Please request a new code.");
    }
    if ((verificationData?.attempts || 0) >= 3) {
        throw new functions.https.HttpsError("permission-denied", "Too many failed verification attempts. Please request a new code.");
    }
    if (verificationData?.code !== code.trim()) {
        await verificationRef.update({
            attempts: admin.firestore.FieldValue.increment(1)
        });
        throw new functions.https.HttpsError("invalid-argument", "Invalid verification code. Please try again.");
    }
    // 2. DOMAIN ENFORCEMENT
    const ALLOWED_DOMAINS = ["@2020companies.com", "@gmail.com"];
    const hasAllowedDomain = ALLOWED_DOMAINS.some(domain => sanitizedEmail.endsWith(domain));
    if (!hasAllowedDomain) {
        functions.logger.warn(`Security Event: Blocked registration attempt from unauthorized domain: ${sanitizedEmail}`);
        throw new functions.https.HttpsError("permission-denied", `Only ${ALLOWED_DOMAINS.join(" or ")} email accounts are authorized to register.`);
    }
    // 3. ALLOWLIST AND TRANSACTION VALIDATION
    const allowlistRef = db.collection("allowlist").doc(sanitizedEmail);
    const userProfileRef = db.collection("users").doc(sanitizedEmail);
    let allowlistDoc = await allowlistRef.get();
    // DYNAMIC SHEET-BASED OR GMAIL-TEST ALLOWLIST VERIFICATION
    if (!allowlistDoc.exists) {
        if (sanitizedEmail.endsWith("@gmail.com")) {
            functions.logger.info(`Gmail Test: Automatically adding representative ${sanitizedEmail} to allowlist`);
            await allowlistRef.set({
                role: "user",
                status: "pending",
                addedBy: "gmail-testing-allowlist",
                addedAt: new Date().toISOString()
            });
            allowlistDoc = await allowlistRef.get();
        }
        else {
            try {
                functions.logger.info(`Dynamic Allowlist: Inspecting spreadsheet registry for ${sanitizedEmail}`);
                const rows = await fetchSpreadsheetRows();
                let isMatched = false;
                for (let i = 1; i < rows.length; i++) {
                    const p = rows[i];
                    if (p && p.length > 6) {
                        const sheetFirst = (p[1] || "").replace(/"/g, "").trim().toLowerCase();
                        const sheetLast = (p[2] || "").replace(/"/g, "").trim().toLowerCase();
                        const sheetEmail = (p[6] || "").replace(/"/g, "").trim().toLowerCase();
                        // Check if entered email matches sheet metaEmail, or first and last names match
                        if (sheetEmail === sanitizedEmail ||
                            (sheetFirst === firstName.trim().toLowerCase() && sheetLast === lastName.trim().toLowerCase())) {
                            isMatched = true;
                            break;
                        }
                    }
                }
                if (isMatched) {
                    functions.logger.info(`Dynamic Allowlist: Automatically adding representative ${sanitizedEmail} from spreadsheet`);
                    await allowlistRef.set({
                        role: "user",
                        status: "pending",
                        addedBy: "system-dynamic-spreadsheet",
                        addedAt: new Date().toISOString()
                    });
                    // Re-fetch the newly created allowlist document
                    allowlistDoc = await allowlistRef.get();
                }
            }
            catch (sheetErr) {
                functions.logger.error("Dynamic allowlist spreadsheet lookup failed:", sheetErr);
            }
        }
    }
    try {
        return await db.runTransaction(async (transaction) => {
            // Read the allowlistDoc within the transaction securely
            const transAllowlistDoc = await transaction.get(allowlistRef);
            if (!transAllowlistDoc.exists) {
                functions.logger.warn(`Security Event: Blocked registration attempt from unallowed email: ${sanitizedEmail}`);
                throw new functions.https.HttpsError("permission-denied", "This email is not authorized for registration. Please contact an administrator.");
            }
            const allowlistData = transAllowlistDoc.data();
            if (allowlistData?.status === "registered") {
                throw new functions.https.HttpsError("already-exists", "This email address has already been registered.");
            }
            const assignedRole = allowlistData?.role || "user";
            // 4. FIREBASE AUTH CREATION
            let authUser;
            try {
                authUser = await admin.auth().createUser({
                    email: sanitizedEmail,
                    password: password,
                    displayName: `${firstName} ${lastName}`,
                    emailVerified: true,
                });
            }
            catch (authError) {
                if (authError.code === "auth/email-already-exists") {
                    throw new functions.https.HttpsError("already-exists", "An authentication account already exists for this email.");
                }
                throw authError;
            }
            // 5. PROVISION CUSTOM CLAIMS
            await admin.auth().setCustomUserClaims(authUser.uid, {
                role: assignedRole,
                admin: assignedRole === "admin",
            });
            // 6. DB TRANSACTION WRITES
            let toggles = {};
            if (retailer === "Best Buy" || retailer === "Best Buy CA") {
                toggles = { vr: true, vr3s: false, glasses: true, tablet: true, demo: true };
            }
            else if (retailer === "NFM") {
                toggles = { vr: true, vr3s: false, glasses: false, tablet: true, demo: false };
            }
            transaction.set(userProfileRef, {
                first: firstName,
                last: lastName,
                retailer: retailer,
                toggles: toggles,
                role: assignedRole,
                registeredAt: new Date().toISOString(),
                status: "active",
            });
            transaction.update(allowlistRef, {
                status: "registered",
                registeredUid: authUser.uid,
                registeredAt: new Date().toISOString(),
            });
            // Atomic cleanup of the verification code
            transaction.delete(verificationRef);
            functions.logger.info(`Security Event: Successfully created user ${sanitizedEmail} (UID: ${authUser.uid}) with role '${assignedRole}'`);
            return {
                success: true,
                uid: authUser.uid,
                role: assignedRole,
            };
        });
    }
    catch (transactionError) {
        if (transactionError instanceof functions.https.HttpsError) {
            throw transactionError;
        }
        functions.logger.error(`Critical: Transaction failed during user registration for ${sanitizedEmail}`, transactionError);
        throw new functions.https.HttpsError("internal", "An unexpected error occurred during account provisioning. Please try again.");
    }
});
/**
 * ONE-TIME SECURITY MIGRATION ENDPOINT (ADMIN ONLY)
 */
exports.migrateCustomClaims = functions
    .runWith({
    timeoutSeconds: 300,
    memory: "512MB",
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        functions.logger.warn("Security Event: Anonymous attempt to invoke migrateCustomClaims.");
        throw new functions.https.HttpsError("unauthenticated", "Authentication is required.");
    }
    const { uid, token } = context.auth;
    const userEmail = token.email?.toLowerCase().trim();
    const isAdmin = token.admin === true;
    let isLegacyAdmin = false;
    if (userEmail) {
        const legacyAdminDoc = await db.collection("admins").doc(userEmail).get();
        if (legacyAdminDoc.exists) {
            isLegacyAdmin = true;
        }
    }
    if (!isAdmin && !isLegacyAdmin) {
        functions.logger.error(`Security Event: Unauthorized attempt to run migration. ` +
            `UID: ${uid} (${userEmail})`);
        throw new functions.https.HttpsError("permission-denied", "Access denied. You do not possess the required privilege level.");
    }
    functions.logger.info(`Security Event: User migration triggered by Admin: ${uid} (${userEmail})`);
    let processedAdmins = 0;
    let processedUsers = 0;
    let errorsCount = 0;
    try {
        // 1. Migrate Administrators
        const adminsSnapshot = await db.collection("admins").get();
        for (const doc of adminsSnapshot.docs) {
            const adminEmail = doc.id.toLowerCase().trim();
            try {
                const authUser = await admin.auth().getUserByEmail(adminEmail);
                await admin.auth().setCustomUserClaims(authUser.uid, {
                    role: "admin",
                    admin: true,
                });
                await db.collection("allowlist").doc(adminEmail).set({
                    role: "admin",
                    status: "registered",
                    registeredUid: authUser.uid,
                    migratedAt: new Date().toISOString(),
                    source: "migration",
                }, { merge: true });
                processedAdmins++;
            }
            catch (err) {
                errorsCount++;
                functions.logger.error(`Error migrating Admin ${adminEmail}:`, err.message);
            }
        }
        // 2. Migrate Standard Representatives (Users)
        let lastDoc = null;
        const PAGE_SIZE = 100;
        let hasMore = true;
        while (hasMore) {
            let query = db.collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            const usersSnapshot = await query.get();
            if (usersSnapshot.empty) {
                hasMore = false;
                break;
            }
            for (const doc of usersSnapshot.docs) {
                const userEmail = doc.id.toLowerCase().trim();
                const isAdminCheck = adminsSnapshot.docs.some(a => a.id.toLowerCase().trim() === userEmail);
                if (isAdminCheck)
                    continue;
                try {
                    const authUser = await admin.auth().getUserByEmail(userEmail);
                    await admin.auth().setCustomUserClaims(authUser.uid, {
                        role: "user",
                        admin: false,
                    });
                    await db.collection("allowlist").doc(userEmail).set({
                        role: "user",
                        status: "registered",
                        registeredUid: authUser.uid,
                        migratedAt: new Date().toISOString(),
                        source: "migration",
                    }, { merge: true });
                    processedUsers++;
                }
                catch (err) {
                    errorsCount++;
                    functions.logger.error(`Error migrating Representative ${userEmail}:`, err.message);
                }
            }
            lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
            if (usersSnapshot.docs.length < PAGE_SIZE) {
                hasMore = false;
            }
        }
        functions.logger.info(`Migration completed successfully. Admins: ${processedAdmins}, Users: ${processedUsers}, Errors: ${errorsCount}`);
        return {
            success: true,
            processedAdmins,
            processedUsers,
            errorsCount,
        };
    }
    catch (globalError) {
        functions.logger.error("Migration failed critically:", globalError.message);
        throw new functions.https.HttpsError("internal", "Migration failed critically: " + globalError.message);
    }
});
/**
 * 4. SECURE SELF-HEALING OF USER CUSTOM CLAIMS
 * Allows any logged-in user to securely request their own claims to be set
 * based on the allowlist or legacy databases.
 */
exports.selfHealMyClaims = functions
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
})
    .https.onCall(async (data, context) => {
    // A. ENFORCE AUTHENTICATION
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to heal your custom claims.");
    }
    const { uid, token } = context.auth;
    const userEmail = token.email?.toLowerCase().trim();
    if (!userEmail) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid account user session. Missing email.");
    }
    try {
        // 1. Check Allowlist first
        const allowlistRef = db.collection("allowlist").doc(userEmail);
        const allowlistDoc = await allowlistRef.get();
        let role = null;
        if (allowlistDoc.exists) {
            const alData = allowlistDoc.data();
            role = alData?.role || "user";
            // Ensure status and registeredUid are set in allowlist
            await allowlistRef.set({
                status: "registered",
                registeredUid: uid,
                healedAt: new Date().toISOString(),
            }, { merge: true });
        }
        else {
            // 2. Fallback to legacy check
            const legacyAdminDoc = await db.collection("admins").doc(userEmail).get();
            if (legacyAdminDoc.exists) {
                role = "admin";
                // Backfill allowlist securely
                await allowlistRef.set({
                    role: "admin",
                    status: "registered",
                    registeredUid: uid,
                    migratedAt: new Date().toISOString(),
                    source: "self-healing-legacy-admin",
                }, { merge: true });
            }
            else {
                const legacyUserDoc = await db.collection("users").doc(userEmail).get();
                if (legacyUserDoc.exists) {
                    role = "user";
                    // Backfill allowlist securely
                    await allowlistRef.set({
                        role: "user",
                        status: "registered",
                        registeredUid: uid,
                        migratedAt: new Date().toISOString(),
                        source: "self-healing-legacy-user",
                    }, { merge: true });
                }
            }
        }
        if (!role) {
            functions.logger.warn(`Security Event: Blocked claims self-healing for un-allowlisted user: ${userEmail}`);
            throw new functions.https.HttpsError("permission-denied", "Your email address is not authorized in the database. Please contact an administrator.");
        }
        // 3. Set custom user claims
        await admin.auth().setCustomUserClaims(uid, {
            role: role,
            admin: role === "admin",
        });
        functions.logger.info(`Security Event: Successfully healed custom claims for ${userEmail} as role '${role}'`);
        return {
            success: true,
            role: role,
        };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        functions.logger.error("Self-healing claims operation failed:", err);
        throw new functions.https.HttpsError("internal", "An unexpected error occurred during claims self-healing validation.");
    }
});
/**
 * SECURE SERVER-SIDE USER ACCOUNT DELETION (ADMIN ONLY)
 * Permanently deletes a user from Firebase Authentication, Firestore users, and Firestore allowlist.
 */
exports.deleteUserAccount = functions
    .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
})
    .https.onCall(withRequiredRole("admin", async (data, context) => {
    const { email } = data;
    if (!email || typeof email !== "string" || !email.includes("@")) {
        throw new functions.https.HttpsError("invalid-argument", "A valid email address is required for deletion.");
    }
    const sanitizedEmail = email.trim().toLowerCase();
    // Prevent admins from deleting themselves accidentally
    const callerEmail = context.auth?.token.email?.toLowerCase().trim();
    if (sanitizedEmail === callerEmail) {
        throw new functions.https.HttpsError("failed-precondition", "You cannot delete your own admin account from this dashboard.");
    }
    try {
        functions.logger.info(`Admin ${callerEmail} is deleting account: ${sanitizedEmail}`);
        // 1. Find and delete from Firebase Auth
        let authUserDeleted = false;
        try {
            const authUser = await admin.auth().getUserByEmail(sanitizedEmail);
            await admin.auth().deleteUser(authUser.uid);
            authUserDeleted = true;
            functions.logger.info(`Successfully deleted Auth user: ${sanitizedEmail} (UID: ${authUser.uid})`);
        }
        catch (authErr) {
            if (authErr.code === "auth/user-not-found") {
                functions.logger.warn(`User ${sanitizedEmail} not found in Firebase Auth, proceeding with DB cleanup.`);
            }
            else {
                throw authErr;
            }
        }
        // 2. Delete Firestore collections atomically (using batch)
        const batch = db.batch();
        const userRef = db.collection("users").doc(sanitizedEmail);
        const allowlistRef = db.collection("allowlist").doc(sanitizedEmail);
        const verificationRef = db.collection("verification_codes").doc(sanitizedEmail);
        const credentialsRef = db.collection("credentials").doc(sanitizedEmail);
        batch.delete(userRef);
        batch.delete(allowlistRef);
        batch.delete(verificationRef);
        batch.delete(credentialsRef);
        await batch.commit();
        functions.logger.info(`Successfully wiped Firestore records for ${sanitizedEmail}`);
        return {
            success: true,
            message: "User account and Firestore profiles successfully deleted.",
            authDeleted: authUserDeleted
        };
    }
    catch (err) {
        functions.logger.error(`Critical error deleting user account for ${sanitizedEmail}:`, err);
        throw new functions.https.HttpsError("internal", "Failed to completely delete user account: " + err.message);
    }
}));
//# sourceMappingURL=index.js.map