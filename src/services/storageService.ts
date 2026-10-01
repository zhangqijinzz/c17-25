export const DOCUMENT_STORAGE_KEY = 'story-architect.document.v1';

export interface StorageService {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export class BrowserStorageService implements StorageService {
  read(key: string): string | null {
    return window.localStorage.getItem(key);
  }

  write(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }
}

export class MemoryStorageService implements StorageService {
  private readonly values = new Map<string, string>();

  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.values.set(key, value);
  }
}
