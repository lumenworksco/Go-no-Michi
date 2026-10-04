// localStorage は使えない環境（プライベートモードなど）でも、中身がこわれていても壊れないように包む。
// guard を渡すと、読んだ値が期待どおりの形のときだけ使い、そうでなければ fallback を返す。
export const PREFIX = 'gonomichi:';

export function load<T>(key: string, fallback: T, guard?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const v: unknown = JSON.parse(raw);
    if (guard && !guard(v)) return fallback;
    return v as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できなくても動作は続ける */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 消せなくても続行 */
  }
}

/** このアプリが保存したデータ（対局・設定・せいせき・つめごの進み具合・おと）をすべて消す。 */
export function clearAllData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 消せなくても続行 */
  }
}
