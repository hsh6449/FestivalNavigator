export type UserStateStorageMode = 'local-only';

export type UserStateStorageInfo = {
  mode: UserStateStorageMode;
  storageKey: string;
  futureRemoteTable: string | null;
  isRemoteSyncEnabled: boolean;
};

type CreateLocalFirstCollectionStoreOptions<T> = {
  storageKey: string;
  futureRemoteTable?: string;
  isItem: (value: unknown) => value is T;
  sortItems?: (items: T[]) => T[];
  onReadError?: (error: unknown) => void;
  onWriteError?: (error: unknown) => void;
};

const cloneItems = <T>(items: T[]) => items.slice();

export const createLocalFirstCollectionStore = <T>({
  storageKey,
  futureRemoteTable,
  isItem,
  sortItems,
  onReadError,
  onWriteError,
}: CreateLocalFirstCollectionStoreOptions<T>) => {
  const normalizeItems = (items: T[]) => {
    const safeItems = cloneItems(items);
    return sortItems ? sortItems(safeItems) : safeItems;
  };

  const storageInfo: UserStateStorageInfo = {
    mode: 'local-only',
    storageKey,
    futureRemoteTable: futureRemoteTable ?? null,
    isRemoteSyncEnabled: false,
  };

  const getAll = (): T[] => {
    if (typeof window === 'undefined') return [];

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      return normalizeItems(parsed.filter((item): item is T => isItem(item)));
    } catch (error) {
      onReadError?.(error);
      return [];
    }
  };

  const setAll = (items: T[]) => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(normalizeItems(items)));
    } catch (error) {
      onWriteError?.(error);
    }
  };

  const replaceAll = (items: T[]) => {
    const normalized = normalizeItems(items);
    setAll(normalized);
    return normalized;
  };

  const updateAll = (updater: (current: T[]) => T[]) => {
    const next = normalizeItems(updater(getAll()));
    setAll(next);
    return next;
  };

  const clear = () => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      onWriteError?.(error);
    }
  };

  return {
    storageInfo,
    getAll,
    setAll,
    replaceAll,
    updateAll,
    clear,
  };
};
