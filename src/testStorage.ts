// テスト用：localStorage の代わり（vitest は node で動くので、ブラウザの localStorage がない）。
export function installFakeStorage(): Map<string, string> {
  const data = new Map<string, string>();
  const fake = {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = fake;
  return data;
}
