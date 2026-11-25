'use client';

import type { BirthInfo, ZiweiChart } from './ziwei/types';
import type { BaziChart } from './bazi/types';
import type { BirthFormState } from '@/components/BirthForm';
import type { HemingRelationType } from './ai-client';

export interface ProfileMessage {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
  createdAt?: number;
}

export interface ProfileBirthInfo extends BirthInfo {
  /** 可選：完整表單快照（省份／城市／原始鐘錶時間等），僅保存在本機瀏覽器 */
  formSnapshot?: BirthFormState;
}

export interface Profile {
  /** 唯一識別碼 */
  id: string;
  /** 檔案名稱（用戶輸入的名字或自動生成） */
  name: string;
  /** 出生資訊（年月日時、性別、經緯度等） */
  birthInfo: ProfileBirthInfo;
  /** 生成的紫微命盤 */
  chartData: ZiweiChart;
  /** 生成的四柱八字盤 */
  baziData: BaziChart;
  /** 該檔案對應的所有 AI 問診與對話歷史 */
  messages: ProfileMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface HemingRecord {
  /** 唯一識別碼 */
  id: string;
  /** 自動依關係命名：如「甲和乙的感情」「甲和乙的合夥問題」 */
  title: string;
  /** 關係類型 */
  relationType: HemingRelationType;
  /** 甲方名稱（用戶本人） */
  nameA: string;
  /** 乙方名稱（對方） */
  nameB: string;
  /** 雙方生辰表單快照 */
  formA: BirthFormState;
  formB: BirthFormState;
  /** 雙方紫微命盤 */
  chartA: ZiweiChart;
  chartB: ZiweiChart;
  /** 完整多輪合盤對話紀錄 */
  messages: ProfileMessage[];
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'ziwei_local_profiles_db';
const DB_VERSION = 2;
const PROFILE_STORE = 'profiles';
const HEMING_STORE = 'heming_records';
const FALLBACK_PROFILES_KEY = 'ziwei_local_profiles_v1';
const FALLBACK_HEMING_KEY = 'ziwei_local_heming_v1';
const ACTIVE_PROFILE_KEY = 'ziwei_active_profile_name';
const ACTIVE_HEMING_KEY = 'ziwei_active_heming_id';
export const PROFILES_CHANGED_EVENT = 'ziwei-profiles-changed';

function normalizeName(name: string): string {
  return name.trim();
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function hasIndexedDb(): boolean {
  return isBrowser() && typeof window.indexedDB !== 'undefined';
}

function emitProfilesChanged(): void {
  if (!isBrowser()) return;
  try {
    window.dispatchEvent(new CustomEvent(PROFILES_CHANGED_EVENT));
  } catch {
    // ignore event errors
  }
}

export function generateProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `prof_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 依合盤關係類型自動命名：
 * - 夫妻/伴侶 → 「甲和乙的感情」
 * - 合夥人/同事 → 「甲和乙的合夥問題」
 * - 父母/長輩 → 「甲和乙的長輩關係」
 * - 兄弟姊妹 → 「甲和乙的手足關係」
 * - 朋友 → 「甲和乙的友情」
 */
export function buildHemingRecordTitle(
  rawNameA: string | undefined,
  rawNameB: string | undefined,
  relationType: HemingRelationType,
): string {
  const a = (rawNameA ?? '').trim() || '甲方';
  const b = (rawNameB ?? '').trim() || '乙方';
  switch (relationType) {
    case '夫妻/伴侶':
      return `${a}和${b}的感情`;
    case '合夥人/同事':
      return `${a}和${b}的合夥問題`;
    case '父母/長輩':
      return `${a}和${b}的長輩關係`;
    case '兄弟姊妹':
      return `${a}和${b}的手足關係`;
    case '朋友':
      return `${a}和${b}的友情`;
    default:
      return `${a}和${b}的合盤`;
  }
}

// ─── localStorage 降級與備援讀寫 ───────────────────────────────────

function readFallbackList<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackList<T>(key: string, items: T[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // 忽略容量上限錯誤，避免阻塞主流程
  }
}

// ─── 原生 IndexedDB 封裝（純瀏覽器端本地持久化，零外部依賴） ─────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PROFILE_STORE)) {
          const store = db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
          store.createIndex('by_name', 'name', { unique: false });
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(HEMING_STORE)) {
          const store = db.createObjectStore(HEMING_STORE, { keyPath: 'id' });
          store.createIndex('by_title', 'title', { unique: false });
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('Failed to open IndexedDB'));
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

function sortByUpdatedDesc<T extends { updatedAt?: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

// ============================================================================
// 個人命盤檔案 (Profile) CRUD
// ============================================================================

export async function getAllProfiles(): Promise<Profile[]> {
  if (!isBrowser()) return [];

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      const items = await new Promise<Profile[]>((resolve, reject) => {
        const tx = db.transaction(PROFILE_STORE, 'readonly');
        const store = tx.objectStore(PROFILE_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as Profile[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      return sortByUpdatedDesc(items);
    } catch {
      // 自動降級至 localStorage
    }
  }

  return sortByUpdatedDesc(readFallbackList<Profile>(FALLBACK_PROFILES_KEY));
}

export async function loadProfile(name: string): Promise<Profile | null> {
  const target = normalizeName(name);
  if (!target) return null;
  const all = await getAllProfiles();
  return all.find(p => normalizeName(p.name) === target) ?? null;
}

export async function loadProfileById(id: string): Promise<Profile | null> {
  if (!id) return null;
  const all = await getAllProfiles();
  return all.find(p => p.id === id) ?? null;
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  const cleanName = normalizeName(profile.name);
  if (!cleanName) {
    throw new Error('檔案名稱不能為空');
  }

  const now = Date.now();
  const existing = await loadProfile(cleanName);
  const record: Profile = {
    ...profile,
    id: profile.id || existing?.id || generateProfileId(),
    name: cleanName,
    createdAt: profile.createdAt || existing?.createdAt || now,
    updatedAt: now,
  };

  if (existing && existing.id !== record.id) {
    await deleteProfileById(existing.id);
  }

  // 同步寫入 IndexedDB 與 localStorage 輕量備份（確保在任何瀏覽器檢視都能穩定讀寫）
  let savedToIdb = false;
  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PROFILE_STORE, 'readwrite');
        const store = tx.objectStore(PROFILE_STORE);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      savedToIdb = true;
    } catch {
      // fallback below
    }
  }

  // 即使 IndexedDB 成功，也嘗試同步寫入 localStorage 備援（小容量上限失敗會靜默略過）
  const list = readFallbackList<Profile>(FALLBACK_PROFILES_KEY).filter(
    p => p.id !== record.id && normalizeName(p.name) !== cleanName,
  );
  writeFallbackList(FALLBACK_PROFILES_KEY, [record, ...list].slice(0, 20));

  if (!savedToIdb) {
    // 已由上方 localStorage 寫入完成
  }

  emitProfilesChanged();
  return record;
}

async function deleteProfileById(id: string): Promise<boolean> {
  if (!isBrowser() || !id) return false;

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(PROFILE_STORE, 'readwrite');
        const store = tx.objectStore(PROFILE_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // ignore
    }
  }

  const prev = readFallbackList<Profile>(FALLBACK_PROFILES_KEY);
  const next = prev.filter(p => p.id !== id);
  writeFallbackList(FALLBACK_PROFILES_KEY, next);
  return next.length !== prev.length;
}

export async function deleteProfile(name: string): Promise<boolean> {
  const target = normalizeName(name);
  if (!target) return false;
  const all = await getAllProfiles();
  const matches = all.filter(p => normalizeName(p.name) === target);
  if (matches.length === 0) return false;

  for (const m of matches) {
    await deleteProfileById(m.id);
  }
  if (getActiveProfileName() === target) {
    setActiveProfileName(null);
  }
  emitProfilesChanged();
  return true;
}

// ============================================================================
// 多維合盤紀錄 (HemingRecord) CRUD — 支援夫妻／父母／手足／合夥／朋友
// ============================================================================

export async function getAllHemingRecords(): Promise<HemingRecord[]> {
  if (!isBrowser()) return [];

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      const items = await new Promise<HemingRecord[]>((resolve, reject) => {
        const tx = db.transaction(HEMING_STORE, 'readonly');
        const store = tx.objectStore(HEMING_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as HemingRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      return sortByUpdatedDesc(items);
    } catch {
      // 自動降級至 localStorage
    }
  }

  return sortByUpdatedDesc(readFallbackList<HemingRecord>(FALLBACK_HEMING_KEY));
}

export async function loadHemingRecord(title: string): Promise<HemingRecord | null> {
  const target = normalizeName(title);
  if (!target) return null;
  const all = await getAllHemingRecords();
  return all.find(r => normalizeName(r.title) === target) ?? null;
}

export async function loadHemingRecordById(id: string): Promise<HemingRecord | null> {
  if (!id) return null;
  const all = await getAllHemingRecords();
  return all.find(r => r.id === id) ?? null;
}

export async function saveHemingRecord(recordInput: HemingRecord): Promise<HemingRecord> {
  const cleanTitle =
    normalizeName(recordInput.title) ||
    buildHemingRecordTitle(recordInput.nameA, recordInput.nameB, recordInput.relationType);

  const now = Date.now();
  const existingById = recordInput.id ? await loadHemingRecordById(recordInput.id) : null;
  const existingByTitle = existingById ?? (await loadHemingRecord(cleanTitle));

  const record: HemingRecord = {
    ...recordInput,
    id: recordInput.id || existingByTitle?.id || generateProfileId(),
    title: cleanTitle,
    nameA: normalizeName(recordInput.nameA) || '甲方',
    nameB: normalizeName(recordInput.nameB) || '乙方',
    createdAt: recordInput.createdAt || existingByTitle?.createdAt || now,
    updatedAt: now,
  };

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(HEMING_STORE, 'readwrite');
        const store = tx.objectStore(HEMING_STORE);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // fallback below
    }
  }

  const list = readFallbackList<HemingRecord>(FALLBACK_HEMING_KEY).filter(
    r => r.id !== record.id && normalizeName(r.title) !== cleanTitle,
  );
  writeFallbackList(FALLBACK_HEMING_KEY, [record, ...list].slice(0, 20));

  emitProfilesChanged();
  return record;
}

export async function deleteHemingRecord(idOrTitle: string): Promise<boolean> {
  if (!isBrowser() || !idOrTitle) return false;
  const all = await getAllHemingRecords();
  const matches = all.filter(
    r => r.id === idOrTitle || normalizeName(r.title) === normalizeName(idOrTitle),
  );
  if (matches.length === 0) return false;

  for (const m of matches) {
    if (hasIndexedDb()) {
      try {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(HEMING_STORE, 'readwrite');
          const store = tx.objectStore(HEMING_STORE);
          store.delete(m.id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // ignore
      }
    }
    if (getActiveHemingId() === m.id) {
      setActiveHemingId(null);
    }
  }

  const removeIds = new Set(matches.map(m => m.id));
  const prev = readFallbackList<HemingRecord>(FALLBACK_HEMING_KEY);
  writeFallbackList(
    FALLBACK_HEMING_KEY,
    prev.filter(r => !removeIds.has(r.id)),
  );
  emitProfilesChanged();
  return true;
}

/** 記錄／讀取最近開啟的個人檔案名與合盤 ID（僅本機 sessionStorage，用於跨頁跳轉銜接） */
export function setActiveProfileName(name: string | null): void {
  if (!isBrowser()) return;
  try {
    if (name && normalizeName(name)) {
      window.sessionStorage.setItem(ACTIVE_PROFILE_KEY, normalizeName(name));
    } else {
      window.sessionStorage.removeItem(ACTIVE_PROFILE_KEY);
    }
  } catch {
    // ignore
  }
}

export function getActiveProfileName(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function setActiveHemingId(id: string | null): void {
  if (!isBrowser()) return;
  try {
    if (id && id.trim()) {
      window.sessionStorage.setItem(ACTIVE_HEMING_KEY, id.trim());
    } else {
      window.sessionStorage.removeItem(ACTIVE_HEMING_KEY);
    }
  } catch {
    // ignore
  }
}

export function getActiveHemingId(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.sessionStorage.getItem(ACTIVE_HEMING_KEY);
  } catch {
    return null;
  }
}
