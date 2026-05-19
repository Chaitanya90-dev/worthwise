import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAppSelector } from "../app/hooks";
import {
  clearKey,
  deriveKeyFromPassphrase,
  getOrCreateSalt,
  hasSalt,
  loadKey,
  saveKey,
} from "../lib/crypto";
import type { KeyStorage } from "../lib/crypto";
import { EncryptionContext } from "./encryptionContext";
import type { EncryptionStatus } from "./encryptionContext";

export const EncryptionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [status, setStatus] = useState<EncryptionStatus>("loading");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [storageMode, setStorageMode] = useState<KeyStorage | "none" | null>(
    null
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!userId) {
        setKey(null);
        setStatus("locked");
        setIsFirstTime(false);
        setStorageMode(null);
        return;
      }

      setStatus("loading");
      const { key: storedKey, storage } = await loadKey(userId);
      if (!active) {
        return;
      }
      if (storedKey) {
        setKey(storedKey);
        setStatus("unlocked");
        setIsFirstTime(false);
        setStorageMode(storage);
      } else {
        setKey(null);
        setStatus("locked");
        setIsFirstTime(!hasSalt(userId));
        setStorageMode(storage === "none" ? null : storage);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [userId]);

  const unlock = useCallback(async (passphrase: string) => {
    if (!userId) {
      return;
    }
    if (typeof window !== "undefined") {
      if (!window.isSecureContext) {
        throw new Error("Encryption requires https or localhost.");
      }
      if (!window.crypto?.subtle) {
        throw new Error("WebCrypto is unavailable in this browser.");
      }
    }
    const salt = getOrCreateSalt(userId);
    const derived = await deriveKeyFromPassphrase(passphrase, salt);
    setKey(derived);
    const mode = await saveKey(userId, derived);
    setStorageMode(mode);
    setStatus("unlocked");
  }, [userId]);

  const lock = useCallback(async () => {
    if (!userId) {
      return;
    }
    await clearKey(userId);
    setKey(null);
    setStatus("locked");
  }, [userId]);

  const value = useMemo(
    () => ({ key, status, isFirstTime, storageMode, unlock, lock }),
    [key, status, isFirstTime, storageMode, unlock, lock]
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
};
