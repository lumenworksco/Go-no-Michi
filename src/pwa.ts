// サービスワーカーの登録と、あたらしいバージョンのお知らせ。
// 自動で入れかえると、遊んでいる最中に古い画面のファイル（AI のワーカーなど）が消えてしまうので、
// あたらしいバージョンは「待機」させておき、ホームで「こうしん」を押したときに入れかえる。
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let needRefresh = false;
let update: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

const HOUR = 60 * 60 * 1000;

export function initPwa() {
  try {
    update = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh = true;
        listeners.forEach((l) => l());
      },
      // ずっと開いたままの画面でも、1 時間ごとにあたらしいバージョンがないか確かめる
      onRegisteredSW(_url, reg) {
        if (reg) setInterval(() => void reg.update().catch(() => {}), HOUR);
      },
    });
  } catch {
    /* サービスワーカーが使えなくても、アプリはふつうに動く */
  }
}

export function applyUpdate() {
  void update?.(true);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useUpdateAvailable = () =>
  useSyncExternalStore(
    subscribe,
    () => needRefresh,
    () => false,
  );
