'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteHemingRecord,
  deleteProfile,
  getAllHemingRecords,
  getAllProfiles,
  PROFILES_CHANGED_EVENT,
  setActiveHemingId,
  setActiveProfileName,
  type HemingRecord,
  type Profile,
} from '@/lib/profile-storage';

interface ProfileLibraryDropdownProps {
  /** 目前正在查看的個人檔案名（高亮顯示） */
  activeProfileName?: string | null;
  /** 目前正在查看的合盤紀錄 ID（高亮顯示） */
  activeHemingId?: string | null;
  /** 選中某個個人檔案時的回調（未傳時自動跳轉 /chart） */
  onSelectProfile?: (profile: Profile) => void;
  /** 選中某個合盤紀錄時的回調（未傳時自動跳轉 /heming） */
  onSelectHeming?: (record: HemingRecord) => void;
  /** 刪除個人檔案後的可選回調 */
  onDeletedProfile?: (deletedName: string) => void;
  /** 刪除合盤紀錄後的可選回調 */
  onDeletedHeming?: (deletedId: string) => void;
  /** 預設顯示分頁 */
  defaultTab?: 'personal' | 'heming';
  /** 緊湊樣式（適配導覽列） */
  compact?: boolean;
}

export default function ProfileLibraryDropdown({
  activeProfileName,
  activeHemingId,
  onSelectProfile,
  onSelectHeming,
  onDeletedProfile,
  onDeletedHeming,
  defaultTab = 'personal',
  compact = false,
}: ProfileLibraryDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'personal' | 'heming'>(defaultTab);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hemingRecords, setHemingRecords] = useState<HemingRecord[]>([]);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const [pList, hList] = await Promise.all([getAllProfiles(), getAllHemingRecords()]);
    setProfiles(pList);
    setHemingRecords(hList);
  };

  useEffect(() => {
    refresh();
    const onChanged = () => {
      refresh();
    };
    window.addEventListener(PROFILES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROFILES_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDeleteKey(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const handleSelectProfile = (p: Profile) => {
    setOpen(false);
    setConfirmDeleteKey(null);
    if (onSelectProfile) {
      onSelectProfile(p);
    } else {
      setActiveProfileName(p.name);
      router.push(`/chart?profile=${encodeURIComponent(p.name)}`);
    }
  };

  const handleSelectHeming = (r: HemingRecord) => {
    setOpen(false);
    setConfirmDeleteKey(null);
    if (onSelectHeming) {
      onSelectHeming(r);
    } else {
      setActiveHemingId(r.id);
      router.push(`/heming?record=${encodeURIComponent(r.id)}`);
    }
  };

  const handleDeletePersonal = async (name: string) => {
    await deleteProfile(name);
    setConfirmDeleteKey(null);
    await refresh();
    onDeletedProfile?.(name);
  };

  const handleDeleteHeming = async (id: string) => {
    await deleteHemingRecord(id);
    setConfirmDeleteKey(null);
    await refresh();
    onDeletedHeming?.(id);
  };

  const totalCount = profiles.length + hemingRecords.length;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen(prev => !prev);
          if (!open) refresh();
        }}
        className={
          compact
            ? 'flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all duration-200 cursor-pointer whitespace-nowrap'
            : 'flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap'
        }
        style={{
          border: '1px solid rgba(212,168,67,0.35)',
          background: open ? 'rgba(212,168,67,0.16)' : 'rgba(212,168,67,0.08)',
          color: 'var(--ac, #d4a843)',
        }}
        title="查看保存在本機瀏覽器的個人命盤與合盤對話紀錄"
      >
        <span>檔案庫</span>
        <span className="hidden sm:inline">· 我的命盤庫</span>
        {totalCount > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
            style={{
              background: 'rgba(212,168,67,0.2)',
              color: 'var(--ac, #d4a843)',
            }}
          >
            {totalCount}
          </span>
        )}
        <span className="text-[9px] opacity-70">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl shadow-xl z-[80] overflow-hidden"
          style={{
            background: 'var(--bg-0, #0c1220)',
            border: '1px solid var(--bdr-heavy, rgba(212,168,67,0.25))',
            boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
          }}
        >
          {/* 分頁切換：個人命盤 / 合盤紀錄 */}
          <div
            className="p-2 grid grid-cols-2 gap-1.5"
            style={{
              background: 'var(--bg-1, rgba(255,255,255,0.03))',
              borderBottom: '1px solid var(--bdr, rgba(255,255,255,0.08))',
            }}
          >
            <button
              type="button"
              onClick={() => { setTab('personal'); setConfirmDeleteKey(null); }}
              className="py-1.5 px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all"
              style={{
                background: tab === 'personal' ? 'rgba(212,168,67,0.16)' : 'transparent',
                border: `1px solid ${tab === 'personal' ? 'rgba(212,168,67,0.38)' : 'transparent'}`,
                color: tab === 'personal' ? 'var(--ac)' : 'var(--tx-2)',
              }}
            >
              個人命盤 ({profiles.length})
            </button>
            <button
              type="button"
              onClick={() => { setTab('heming'); setConfirmDeleteKey(null); }}
              className="py-1.5 px-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all"
              style={{
                background: tab === 'heming' ? 'rgba(212,168,67,0.16)' : 'transparent',
                border: `1px solid ${tab === 'heming' ? 'rgba(212,168,67,0.38)' : 'transparent'}`,
                color: tab === 'heming' ? 'var(--ac)' : 'var(--tx-2)',
              }}
            >
              合盤紀錄 ({hemingRecords.length})
            </button>
          </div>

          {/* 個人命盤列表 */}
          {tab === 'personal' && (
            <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--bdr)' }}>
              {profiles.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs leading-relaxed" style={{ color: 'var(--tx-3)' }}>
                  暫無保存的個人命盤檔案。<br />
                  起盤後系統會自動將命盤與 AI 對話私密保存在本機瀏覽器中。
                </div>
              ) : (
                profiles.map(p => {
                  const isActive = activeProfileName === p.name;
                  const visibleMsgCount = p.messages.filter(m => !m.hidden).length;
                  const birthSummary = `${p.birthInfo.year}/${p.birthInfo.month}/${p.birthInfo.day} · ${
                    p.birthInfo.gender === 'male' ? '男' : '女'
                  }`;
                  const delKey = `p:${p.id}`;
                  const isConfirming = confirmDeleteKey === delKey;

                  return (
                    <div
                      key={p.id}
                      className="px-3.5 py-2.5 flex items-center gap-2 transition-colors"
                      style={{
                        background: isActive ? 'rgba(212,168,67,0.10)' : 'transparent',
                        borderBottom: '1px solid var(--bdr)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectProfile(p)}
                        className="flex-1 text-left min-w-0 cursor-pointer bg-transparent border-none p-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-semibold truncate"
                            style={{ color: isActive ? 'var(--ac)' : 'var(--tx-0)' }}
                          >
                            {p.name}
                          </span>
                          {isActive && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(212,168,67,0.2)', color: 'var(--ac)' }}
                            >
                              目前
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--tx-3)' }}>
                          <span>{birthSummary}</span>
                          <span>·</span>
                          <span>{visibleMsgCount > 0 ? `${visibleMsgCount} 則對話` : '尚無對話'}</span>
                        </div>
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeletePersonal(p.name)}
                            className="text-[10px] px-2 py-1 rounded cursor-pointer border-none"
                            style={{ background: '#dc2626', color: '#fff' }}
                          >
                            確認刪
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="text-[10px] px-1.5 py-1 rounded cursor-pointer"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--bdr-med)',
                              color: 'var(--tx-3)',
                            }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(delKey)}
                          className="text-[10px] px-2 py-1 rounded cursor-pointer flex-shrink-0 transition-opacity opacity-65 hover:opacity-100"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--bdr-med)',
                            color: 'var(--tx-3)',
                          }}
                          title={`刪除「${p.name}」的本機檔案`}
                        >
                          刪除
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 多維合盤列表 */}
          {tab === 'heming' && (
            <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--bdr)' }}>
              {hemingRecords.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs leading-relaxed" style={{ color: 'var(--tx-3)' }}>
                  暫無保存的合盤紀錄。<br />
                  完成任何類型的合盤分析後，系統將自動依關係命名並保存在本機瀏覽器（例如「甲和乙的感情」、「甲和乙的合夥問題」）。
                </div>
              ) : (
                hemingRecords.map(r => {
                  const isActive = activeHemingId === r.id;
                  const visibleMsgCount = r.messages.filter(m => !m.hidden).length;
                  const delKey = `h:${r.id}`;
                  const isConfirming = confirmDeleteKey === delKey;

                  return (
                    <div
                      key={r.id}
                      className="px-3.5 py-2.5 flex items-center gap-2 transition-colors"
                      style={{
                        background: isActive ? 'rgba(212,168,67,0.10)' : 'transparent',
                        borderBottom: '1px solid var(--bdr)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectHeming(r)}
                        className="flex-1 text-left min-w-0 cursor-pointer bg-transparent border-none p-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xs font-semibold truncate"
                            style={{ color: isActive ? 'var(--ac)' : 'var(--tx-0)' }}
                          >
                            {r.title}
                          </span>
                          {isActive && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: 'rgba(212,168,67,0.2)', color: 'var(--ac)' }}
                            >
                              目前
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--tx-3)' }}>
                          <span
                            className="px-1.5 py-0.2 rounded"
                            style={{
                              background: 'rgba(212,168,67,0.1)',
                              color: 'var(--ac)',
                            }}
                          >
                            {r.relationType}
                          </span>
                          <span>·</span>
                          <span>{visibleMsgCount} 則對話</span>
                        </div>
                      </button>

                      {isConfirming ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteHeming(r.id)}
                            className="text-[10px] px-2 py-1 rounded cursor-pointer border-none"
                            style={{ background: '#dc2626', color: '#fff' }}
                          >
                            確認刪
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="text-[10px] px-1.5 py-1 rounded cursor-pointer"
                            style={{
                              background: 'transparent',
                              border: '1px solid var(--bdr-med)',
                              color: 'var(--tx-3)',
                            }}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(delKey)}
                          className="text-[10px] px-2 py-1 rounded cursor-pointer flex-shrink-0 transition-opacity opacity-65 hover:opacity-100"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--bdr-med)',
                            color: 'var(--tx-3)',
                          }}
                          title={`刪除「${r.title}」的本機合盤紀錄`}
                        >
                          刪除
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div
            className="px-3.5 py-2 text-[10px] flex items-center gap-1.5"
            style={{
              background: 'var(--bg-1, rgba(255,255,255,0.02))',
              borderTop: '1px solid var(--bdr)',
              color: 'var(--tx-3)',
            }}
          >
            <span>🔒</span>
            <span>所有個人命盤、合盤與對話僅保存在本機瀏覽器，絕不上傳伺服器</span>
          </div>
        </div>
      )}
    </div>
  );
}
