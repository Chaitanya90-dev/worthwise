import { createContext, useContext } from "react";
import type { KeyStorage } from "../lib/crypto";

export type EncryptionStatus = "loading" | "locked" | "unlocked";

export type EncryptionContextValue = {
  key: CryptoKey | null;
  status: EncryptionStatus;
  isFirstTime: boolean;
  storageMode: KeyStorage | "none" | null;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => Promise<void>;
};

export const EncryptionContext = createContext<EncryptionContextValue | undefined>(
  undefined
);

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within EncryptionProvider");
  }
  return context;
};
