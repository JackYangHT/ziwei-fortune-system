'use client';

import type { BirthInfo, ZiweiChart } from './ziwei/types';
import type { BaziChart } from './bazi/types';
import type { BirthFormState } from '@/components/BirthForm';

export interface ProfileMessage {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
  createdAt?: number;
}

export interface ProfileBirthInfo extends BirthInfo {
  /** 可选：完整表单快照（省份/城市/原始钟表时间等），仅保存在本机浏览器 */
  formSnapshot?: BirthFormState;
}

export interface Profile {
  /** 唯一识别码 */
  id: string;
  /** 档案名称（用户输入的名字） */
  name: string;
  /** 出生信息（年月日时、性别、经纬度等） */
  birthInfo: ProfileBirthInfo;
  /** 生成的紫微命盘 */
  chartData: ZiweiChart;
  /** 生成的四柱八字盘 */
  baziData: BaziChart;
  /** 该档案对应的所有 AI 问诊与对话历史 */
  messages: ProfileMessage[];
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = 'ziwei_local_profiles_db';
const DB_VERSION = 1;
const STORE_NAME = 'profiles';
const FALLBACK_STORAGE_KEY = 'ziwei_local_profiles_v1';
const ACTIVE_PROFILE_KEY = 'ziwei_active_profile_name';
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

// ─── localStorage 降级实现（当隐私模式禁用 IndexedDB 时自动启用） ─────

function readFallbackProfiles(): Profile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Profile[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackProfiles(profiles: Profile[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // 忽略容量上限错误，避免阻塞主流程
  }
}

// ─── 原生 IndexedDB 封装（纯浏览器端本地持久化，零外部依赖） ─────────

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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by_name', 'name', { unique: false });
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

function sortByUpdatedDesc(list: Profile[]): Profile[] {
  return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * 获取本地保存的所有档案列表（按最近更新时间倒序）
 */
export async function getAllProfiles(): Promise<Profile[]> {
  if (!isBrowser()) return [];

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      const items = await new Promise<Profile[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as Profile[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      return sortByUpdatedDesc(items);
    } catch {
      // 自动降级至 localStorage
    }
  }

  return sortByUpdatedDesc(readFallbackProfiles());
}

/**
 * 按档案名称加载特定档案
 */
export async function loadProfile(name: string): Promise<Profile | null> {
  const target = normalizeName(name);
  if (!target) return null;
  const all = await getAllProfiles();
  return all.find(p => normalizeName(p.name) === target) ?? null;
}

/**
 * 按唯一 ID 加载特定档案
 */
export async function loadProfileById(id: string): Promise<Profile | null> {
  if (!id) return null;
  const all = await getAllProfiles();
  return all.find(p => p.id === id) ?? null;
}

/**
 * 保存或更新档案（同名档案将复用其 id 或覆盖更新，纯本机存储）
 */
export async function saveProfile(profile: Profile): Promise<Profile> {
  const cleanName = normalizeName(profile.name);
  if (!cleanName) {
    throw new Error('档案名称不能为空');
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

  // 若存在同名但不同 id 的旧记录，先清理避免重复
  if (existing && existing.id !== record.id) {
    await deleteProfileById(existing.id);
  }

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      emitProfilesChanged();
      return record;
    } catch {
      // 自动降级至 localStorage
    }
  }

  const list = readFallbackProfiles().filter(
    p => p.id !== record.id && normalizeName(p.name) !== cleanName,
  );
  writeFallbackProfiles([record, ...list]);
  emitProfilesChanged();
  return record;
}

async function deleteProfileById(id: string): Promise<boolean> {
  if (!isBrowser() || !id) return false;

  if (hasIndexedDb()) {
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch {
      // 降级
    }
  }

  const prev = readFallbackProfiles();
  const next = prev.filter(p => p.id !== id);
  writeFallbackProfiles(next);
  return next.length !== prev.length;
}

/**
 * 按档案名称删除特定档案
 */
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

/** 记录/读取最近打开的档案名（仅本机 sessionStorage，用于跨页跳转衔接） */
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
