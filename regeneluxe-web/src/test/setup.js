import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }

  clear() {
    this.map.clear();
  }
}

const storage = new MemoryStorage();

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
});

if (!globalThis.window) {
  globalThis.window = globalThis;
}

Object.defineProperty(globalThis.window, "localStorage", {
  value: storage,
  configurable: true,
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});
