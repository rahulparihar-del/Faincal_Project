export interface StorageProvider {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.error("Storage Provider Write Failure:", e);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  }
}
