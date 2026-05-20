/**
 * Advanced Client-Side Encryption Service using the native Web Cryptography API.
 * Employs AES-GCM 256-bit for authenticated encryption and PBKDF2 for key derivation.
 */
class EncryptionService {
    constructor() {
        this._inMemoryKey = null;
    }

    /**
     * Set the derived key in memory for the active session.
     * @param {CryptoKey} key 
     */
    setSessionKey(key) {
        if (!(key instanceof CryptoKey)) {
            throw new TypeError("Invalid key type. Expected a CryptoKey instance.");
        }
        this._inMemoryKey = key;
    }

    /**
     * Clear the key from memory.
     */
    clearSessionKey() {
        this._inMemoryKey = null;
    }

    /**
     * Check if the session key is initialized.
     * @returns {boolean}
     */
    hasSessionKey() {
        return this._inMemoryKey !== null;
    }

    /**
     * Derive a highly secure 256-bit AES key from a user-specific secret (e.g., Firebase UID).
     * Uses PBKDF2 with 100,000 iterations of SHA-256.
     * 
     * @param {string} passwordOrSecret - User-specific secret input
     * @param {string} saltString - Unique salt (e.g., user email)
     * @returns {Promise<CryptoKey>} Derived non-exportable CryptoKey
     */
    async deriveKey(passwordOrSecret, saltString) {
        try {
            const encoder = new TextEncoder();
            const passwordBytes = encoder.encode(passwordOrSecret);
            const saltBytes = encoder.encode(saltString);

            // Import the raw password as a base key for PBKDF2 derivation
            const baseKey = await window.crypto.subtle.importKey(
                "raw",
                passwordBytes,
                { name: "PBKDF2" },
                false,
                ["deriveBits", "deriveKey"]
            );

            // Derive a 256-bit AES-GCM key
            const derivedKey = await window.crypto.subtle.deriveKey(
                {
                    name: "PBKDF2",
                    salt: saltBytes,
                    iterations: 100000,
                    hash: "SHA-256"
                },
                baseKey,
                { name: "AES-GCM", length: 256 },
                false, // Set extractable to false so JavaScript cannot read the raw key bytes
                ["encrypt", "decrypt"]
            );

            return derivedKey;
        } catch (error) {
            console.error("[EncryptionService] Key derivation failed:", error);
            throw new Error("Failed to derive secure cryptographic key.");
        }
    }

    /**
     * Encrypt any serializable data using AES-GCM 256-bit.
     * 
     * @param {any} data - The plain object or string to encrypt
     * @param {CryptoKey} [key] - Optional encryption key (falls back to session key)
     * @returns {Promise<string>} Encrypted string in format: salt_or_iv.ciphertext (Base64)
     */
    async encrypt(data, key = this._inMemoryKey) {
        if (!key) {
            throw new Error("Encryption key not initialized. Please log in first.");
        }

        try {
            const encoder = new TextEncoder();
            const plaintextBytes = encoder.encode(JSON.stringify(data));

            // Generate a cryptographically strong 12-byte initialization vector (IV)
            // 12 bytes is the standard recommended size for AES-GCM to prevent collisions
            const iv = window.crypto.getRandomValues(new Uint8Array(12));

            // Perform the encryption
            const ciphertextBuffer = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                plaintextBytes
            );

            // Convert IV and Ciphertext to Base64 for safe transport/storage
            const ivBase64 = this._arrayBufferToBase64(iv);
            const ciphertextBase64 = this._arrayBufferToBase64(ciphertextBuffer);

            // Return payload as a concatenated string delimited by a dot
            return `${ivBase64}.${ciphertextBase64}`;
        } catch (error) {
            console.error("[EncryptionService] Encryption failed:", error);
            throw new Error("Encryption failed.");
        }
    }

    /**
     * Decrypt AES-GCM 256-bit encrypted data.
     * 
     * @param {string} encryptedString - Delimited Base64 string (iv.ciphertext)
     * @param {CryptoKey} [key] - Optional decryption key (falls back to session key)
     * @returns {Promise<any>} Decrypted JavaScript object or string
     */
    async decrypt(encryptedString, key = this._inMemoryKey) {
        if (!key) {
            throw new Error("Decryption key not initialized. Please log in first.");
        }

        try {
            const parts = encryptedString.split(".");
            if (parts.length !== 2) {
                throw new Error("Invalid encrypted payload format.");
            }

            const iv = this._base64ToArrayBuffer(parts[0]);
            const ciphertext = this._base64ToArrayBuffer(parts[1]);

            // Perform the decryption
            const decryptedBuffer = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                ciphertext
            );

            const decoder = new TextDecoder();
            const decryptedString = decoder.decode(decryptedBuffer);

            return JSON.parse(decryptedString);
        } catch (error) {
            console.error("[EncryptionService] Decryption failed:", error);
            throw new Error("Decryption failed. Data may be corrupted or key is incorrect.");
        }
    }

    /**
     * Encrypt and store data transparently in localStorage.
     */
    async storeEncrypted(storageKey, data, key = this._inMemoryKey) {
        try {
            const encryptedValue = await this.encrypt(data, key);
            localStorage.setItem(storageKey, encryptedValue);
            return true;
        } catch (error) {
            console.error(`[EncryptionService] Failed to store key '${storageKey}':`, error);
            return false;
        }
    }

    /**
     * Retrieve and decrypt data transparently from localStorage.
     */
    async getDecrypted(storageKey, key = this._inMemoryKey) {
        const encryptedValue = localStorage.getItem(storageKey);
        if (!encryptedValue) return null;

        try {
            return await this.decrypt(encryptedValue, key);
        } catch (error) {
            console.warn(`[EncryptionService] Decryption failed for '${storageKey}'. Clearing corrupted data.`, error);
            this.clearEncrypted(storageKey);
            return null;
        }
    }

    /**
     * Securely remove data from localStorage.
     */
    clearEncrypted(storageKey) {
        localStorage.removeItem(storageKey);
    }

    // --- Helper Utilities ---

    _arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    _base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Export single instance globally
window.encryptionService = new EncryptionService();
