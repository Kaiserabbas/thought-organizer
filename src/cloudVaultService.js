/**
 * CloudVaultService
 * Provides zero-configuration, end-to-end encrypted cross-device cloud synchronization.
 * Uses Web Crypto API (AES-GCM 256-bit + PBKDF2) and cloud vault storage.
 */

const VAULT_ENDPOINT = 'https://kvdb.io/EithK3ZJksyD29L2GxV21q';
const SYNC_CODE_STORAGE_KEY = 'thought_organizer_sync_code';
const LAST_SYNCED_STORAGE_KEY = 'thought_organizer_last_synced';
const SALT = new TextEncoder().encode('thought-organizer-vault-salt-v1');

// Compute SHA-256 hex hash of a string (used to mask the sync code on the storage key)
async function hashString(str) {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(str.trim().toLowerCase()));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Derive AES-GCM 256 key from user sync code using PBKDF2
async function deriveEncryptionKey(passcode) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passcode.trim()),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 20000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt payload object into base64 string
async function encryptPayload(dataObj, passcode) {
  const key = await deriveEncryptionKey(passcode);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const plaintextBytes = enc.encode(JSON.stringify(dataObj));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );

  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);

  // Convert binary to base64
  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

// Decrypt base64 string into payload object
async function decryptPayload(base64Str, passcode) {
  const key = await deriveEncryptionKey(passcode);
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const iv = bytes.slice(0, 12);
  const cipher = bytes.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
}

export const CloudVaultService = {
  // Get currently active sync code from localStorage
  getSyncCode() {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SYNC_CODE_STORAGE_KEY) || '';
  },

  // Set or update sync code
  setSyncCode(code) {
    if (typeof window === 'undefined') return;
    const clean = (code || '').trim();
    if (clean) {
      localStorage.setItem(SYNC_CODE_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
    }
  },

  // Clear sync code (disconnect device)
  clearSyncCode() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SYNC_CODE_STORAGE_KEY);
    localStorage.removeItem(LAST_SYNCED_STORAGE_KEY);
  },

  // Check if sync code is active
  isConfigured() {
    return Boolean(this.getSyncCode());
  },

  // Generate a friendly, secure random sync code (e.g., THOUGHT-9X4K-7M2Q)
  generateSyncCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let part1 = '';
    let part2 = '';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    for (let i = 0; i < 4; i++) part1 += chars[array[i] % chars.length];
    for (let i = 4; i < 8; i++) part2 += chars[array[i] % chars.length];
    return `THOUGHT-${part1}-${part2}`;
  },

  // Fetch thoughts & categories from Cloud Vault
  async downloadSnapshot(syncCodeOverride) {
    const code = syncCodeOverride || this.getSyncCode();
    if (!code) return null;

    const storageKey = await hashString(code);
    const url = `${VAULT_ENDPOINT}/${storageKey}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain' },
    });

    if (res.status === 404) {
      // Vault does not exist yet on server
      return { isNew: true, thoughts: [], categories: [], deletedThoughtIds: [], lastSyncedAt: 0 };
    }

    if (!res.ok) {
      throw new Error(`Vault request failed (${res.status})`);
    }

    const rawData = await res.text();
    if (!rawData || !rawData.trim()) {
      return { isNew: true, thoughts: [], categories: [], deletedThoughtIds: [], lastSyncedAt: 0 };
    }

    // Try decrypting encrypted payload
    try {
      const parsed = JSON.parse(rawData);
      if (parsed?.encrypted) {
        return await decryptPayload(parsed.encrypted, code);
      }
      // If unencrypted JSON (fallback)
      return parsed;
    } catch {
      // Direct encrypted base64 payload
      try {
        return await decryptPayload(rawData.trim(), code);
      } catch {
        throw new Error('Incorrect Sync Code or corrupted data. Cannot decrypt vault.');
      }
    }
  },

  // Upload encrypted snapshot to Cloud Vault
  async uploadSnapshot(snapshot, syncCodeOverride) {
    const code = syncCodeOverride || this.getSyncCode();
    if (!code) throw new Error('No Sync Code configured.');

    const storageKey = await hashString(code);
    const url = `${VAULT_ENDPOINT}/${storageKey}`;

    const encryptedString = await encryptPayload(snapshot, code);
    const wrapper = JSON.stringify({
      encrypted: encryptedString,
      updatedAt: Date.now(),
      v: 1,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: wrapper,
    });

    if (!res.ok) {
      throw new Error(`Vault upload failed (${res.status})`);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(Date.now()));
    }

    return true;
  },
};
