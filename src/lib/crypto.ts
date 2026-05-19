import { del, get, set } from "idb-keyval";

const KEY_PREFIX = "sanchay:key";
const KEY_FALLBACK_PREFIX = "sanchay:key:local";
const SALT_PREFIX = "sanchay:salt";
const ITERATIONS = 120000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const memorySalts = new Map<string, Uint8Array>();

const toBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const fromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

const getSaltKey = (userId: string) => `${SALT_PREFIX}:${userId}`;
const getStoredKey = (userId: string) => `${KEY_PREFIX}:${userId}`;
const getFallbackKey = (userId: string) => `${KEY_FALLBACK_PREFIX}:${userId}`;

export const getOrCreateSalt = (userId: string) => {
  const key = getSaltKey(userId);
  let stored: string | null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    throw new Error("Browser storage is blocked. Enable local storage to continue.");
  }
  if (stored) {
    return fromBase64(stored);
  }
  const existing = memorySalts.get(userId);
  if (existing) {
    return existing;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  try {
    localStorage.setItem(key, toBase64(salt));
  } catch {
    memorySalts.set(userId, salt);
  }
  return salt;
};

export const hasSalt = (userId: string) => {
  try {
    return Boolean(localStorage.getItem(getSaltKey(userId)));
  } catch {
    return memorySalts.has(userId);
  }
};

export const deriveKeyFromPassphrase = async (
  passphrase: string,
  salt: Uint8Array
) => {
  const saltBuffer: ArrayBuffer = new Uint8Array(salt).buffer;
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export type KeyStorage = "idb" | "localStorage" | "memory";

const importStoredKey = (stored: string) =>
  crypto.subtle.importKey("raw", fromBase64(stored), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);

export const saveKey = async (
  userId: string,
  key: CryptoKey
): Promise<KeyStorage> => {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const encoded = toBase64(raw);
  try {
    await set(getStoredKey(userId), encoded);
    return "idb";
  } catch {
    // fall back to localStorage
  }
  try {
    localStorage.setItem(getFallbackKey(userId), encoded);
    return "localStorage";
  } catch {
    return "memory";
  }
};

export const loadKey = async (
  userId: string
): Promise<{ key: CryptoKey | null; storage: KeyStorage | "none" }> => {
  try {
    const stored = await get<string>(getStoredKey(userId));
    if (stored) {
      return { key: await importStoredKey(stored), storage: "idb" };
    }
  } catch {
    // ignore and try fallback
  }

  try {
    const stored = localStorage.getItem(getFallbackKey(userId));
    if (stored) {
      return { key: await importStoredKey(stored), storage: "localStorage" };
    }
  } catch {
    // ignore and return none
  }

  return { key: null, storage: "none" };
};

export const clearKey = async (userId: string) => {
  try {
    await del(getStoredKey(userId));
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(getFallbackKey(userId));
  } catch {
    // ignore
  }
};

export const encryptText = async (plain: string, key: CryptoKey) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(plain)
    )
  );
  return `${toBase64(iv)}:${toBase64(cipher)}`;
};

export const decryptText = async (payload: string, key: CryptoKey) => {
  const [ivPart, dataPart] = payload.split(":");
  if (!ivPart || !dataPart) {
    return null;
  }
  const iv = fromBase64(ivPart);
  const data = fromBase64(dataPart);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return decoder.decode(plain);
};
