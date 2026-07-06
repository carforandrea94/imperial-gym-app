import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {

  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  list(prefix: string): string[] {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return keys;
    } catch {
      return [];
    }
  }

  delete(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  getJSON<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  setJSON(key: string, value: unknown): boolean {
    return this.set(key, JSON.stringify(value));
  }
}
