import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

// Initialize the Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// In-memory rate limiting map for email dispatching
const emailRateLimitCache = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 5; // Max 5 emails per window
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window

interface EmailPayload {
  ticketType: string;
  details: string;
  repName?: string;
}

/**
 * 1. SECURE SERVER-SIDE EMAIL DISPATCHER (EmailJS REST Wrapper)
 * Injects EmailJS Private Key, Service ID, and Public Key securely from Secret Manager
 */
export const sendSecureEmail = functions
  .runWith({
    secrets: ["EMAILJS_PRIVATE_KEY", "EMAILJS_SERVICE_ID", "EMAILJS_PUBLIC_KEY"],
    timeoutSeconds: 15,
    memory: "256MB",
  })
  .https.onCall(async (data: EmailPayload, context) => {
    const { ticketType, details, repName } = data;

    if (!ticketType || typeof ticketType !== "string" || ticketType.length > 50) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid or empty ticketType parameter."
      );
    }

    if (!details || typeof details !== "string" || details.length > 3000) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid or too long details parameter."
      );
    }

    const isResetRequest = ticketType === "Account Reset Request";

    // A. ENFORCE AUTHENTICATION (except for password resets)
    if (!context.auth && !isResetRequest) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be authenticated to send notifications."
      );
    }

    // Determine identity for logging and rate limiting
    const uid = context.auth ? context.auth.uid : `ip_${context.rawRequest?.ip || "unknown"}`;
    const userEmail = context.auth ? (context.auth.token.email || "unknown@domain.com") : (repName || "unknown@domain.com");

    // B. ENFORCE RATE LIMITS
    const now = Date.now();
    const userLimit = emailRateLimitCache.get(uid) || { count: 0, lastReset: now };

    if (now - userLimit.lastReset > RATE_LIMIT_WINDOW_MS) {
      userLimit.count = 0;
      userLimit.lastReset = now;
    }

    if (userLimit.count >= RATE_LIMIT_MAX) {
      functions.logger.warn(`Rate limit exceeded for UID/IP: ${uid} (${userEmail})`);
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Too many requests. Please wait 1 minute before sending another status report."
      );
    }

    userLimit.count++;
    emailRateLimitCache.set(uid, userLimit);

    // C. SECURE EXTERNAL DISPATCH VIA EMAILJS REST API
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    
    // Explicitly whitelist and map template IDs securely on the server
    let templateId = "template_0tx65cr"; // Standard Report Template
    if (ticketType === "Credential Request") {
      templateId = "template_jbkqwyx"; // Credential Request Template
    }

    if (!privateKey || !serviceId || !publicKey) {
      functions.logger.error("Missing EmailJS environment secrets inside Cloud Secret Manager");
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Server configuration error. Contact admin."
      );
    }

    try {
      functions.logger.info(`Securely dispatching email for ${userEmail}. Ticket: ${ticketType}`);

      const response = await axios.post(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          accessToken: privateKey,
          template_params: {
            ticket_type: ticketType,
            rep_name: userEmail,
            details: details,
          },
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      return {
        success: true,
        message: "Secure email dispatched.",
        status: response.status,
      };
    } catch (error: any) {
      functions.logger.error("EmailJS Secure Dispatch Failed:", error.response?.data || error.message);
      throw new functions.https.HttpsError(
        "internal",
        "Secure notification delivery failed."
      );
    }
  });

/**
 * Parses a single CSV line securely, accommodating escaped commas and quotes.
 */
function parseCsvLine(line: string): string[] {
  const parts: string[] = [];
  let inQ = false;
  let curr = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "\"") {
      inQ = !inQ;
    } else if (c === "," && !inQ) {
      parts.push(curr);
      curr = "";
    } else {
      curr += c;
    }
  }
  parts.push(curr);
  return parts;
}

/**
 * 2. SECURE GOOGLE SHEETS SYNCHRONIZER (ADMIN PORTAL ONLY)
 * Pulls all records from Google Sheets securely, matches users, and persists to Firestore.
 * No sensitive plaintext credentials ever escape to the admin's browser interface.
 */
export const syncSpreadsheetCredentials = functions
  .runWith({
    timeoutSeconds: 60,
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    // A. ENFORCE ADMIN AUTHORIZATION
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const uid = context.auth.uid;
    const adminDoc = await db.collection("admins").doc(uid).get();
    if (!adminDoc.exists) {
      functions.logger.warn(`Unauthorized credentials sync attempt by UID: ${uid}`);
      throw new functions.https.HttpsError(
        "permission-denied",
        "Privileged access blocked. Only verified Administrators may trigger synchronization."
      );
    }

    try {
      // B. SECURE SERVER-SIDE SPREADSHEET RETRIEVAL
      const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1SSgl60xVl_i-7nx23ch4jADCq9wZQmUR1ObRVDXDEpk/export?format=csv";
      const response = await axios.get(spreadsheetUrl);
      const text = response.data;
      const lines = text.split("\n");

      // C. FETCH REGISTERED FIRESTORE REPRESENTATIVES
      const usersSnapshot = await db.collection("users").get();
      const activeReps: Record<string, { first: string; last: string }> = {};
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
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
          skippedCount++;
          continue;
        }

        const p = parseCsvLine(line);
        if (p.length > 10) {
          const first = p[1].replace(/"/g, "").trim().toLowerCase();
          const last = p[2].replace(/"/g, "").trim().toLowerCase();
          const metaEmail = p[6].replace(/"/g, "").trim();
          const metaPass = p[10].replace(/"/g, "").trim();

          if (!first || !last || !metaEmail || !metaPass) {
            skippedCount++;
            continue;
          }

          // Lookup matching registered user profile
          let matchedEmail: string | null = null;
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
          } else {
            skippedCount++;
          }
        } else {
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
    } catch (err: any) {
      functions.logger.error("Spreadsheet credential synchronization failed:", err);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to synchronize spreadsheet credentials securely: " + err.message
      );
    }
  });

/**
 * 3. SECURE REPRESENTATIVE CREDENTIAL SELF-HEALING
 * Allows active logged-in reps to securely fetch their personal Meta AI credentials
 * directly from the sheets registry on-demand without exposing database passwords.
 */
export const selfHealMyCredential = functions
  .runWith({
    timeoutSeconds: 30,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    // A. ENFORCE AUTHENTICATION
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to self-heal your credentials."
      );
    }

    const userEmail = context.auth.token.email?.toLowerCase();

    if (!userEmail) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid account user session. Missing email."
      );
    }

    try {
      // B. RESOLVE CALLER'S FIRST AND LAST NAME FROM FIRESTORE PROFILE
      const userDoc = await db.collection("users").doc(userEmail).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Representative user profile was not found in Firestore."
        );
      }

      const userData = userDoc.data() || {};
      const myFirst = userData.first?.toLowerCase().trim();
      const myLast = userData.last?.toLowerCase().trim();

      if (!myFirst || !myLast) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Your user profile is missing first/last name information."
        );
      }

      // C. SECURELY PARSE SPREADSHEET TO MATCH CREDENTIAL RECORD
      const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1SSgl60xVl_i-7nx23ch4jADCq9wZQmUR1ObRVDXDEpk/export?format=csv";
      const response = await axios.get(spreadsheetUrl);
      const text = response.data;
      const lines = text.split("\n");

      let foundMetaEmail = "";
      let foundMetaPass = "";
      let found = false;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const p = parseCsvLine(line);
        if (p.length > 10) {
          const first = p[1].replace(/"/g, "").trim().toLowerCase();
          const last = p[2].replace(/"/g, "").trim().toLowerCase();

          if (first === myFirst && last === myLast) {
            foundMetaEmail = p[6].replace(/"/g, "").trim();
            foundMetaPass = p[10].replace(/"/g, "").trim();
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
      } else {
        functions.logger.warn(`No spreadsheet record found for Representative: ${myFirst} ${myLast}`);
        throw new functions.https.HttpsError(
          "not-found",
          `No registry record matching '${myFirst} ${myLast}' was found in the Google Sheets database.`
        );
      }
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      functions.logger.error("Self-healing operation aborted with error:", err);
      throw new functions.https.HttpsError(
        "internal",
        "An unexpected error occurred during self-healing validation."
      );
    }
  });
