'use client';

import { useEffect, useRef, useState } from 'react';
import {
  deleteProfile,
  getAllProfiles,
  PROFILES_CHANGED_EVENT,
  type Profile,
} from '@/lib/profile-storage';

interface ProfileLibraryDropdownProps {
  /** 当前正在查看的档案名（高亮显示） */
  activeProfileName?: string | null;
  /** 选中某个档案时的回调 */
  onSelectProfile: (profile: Profile) => void;
  /** 删除某个档案后的可选回调 */
  onDeletedProfile?: (deletedName: string) => void;
  /** 紧凑样式（适配导航栏） */
  compact?: boolean;
}

export default function ProfileLibraryDropdown({
  activeProfileName,
  onSelectProfile,
  onDeletedProfile,
  compact = false,
}: ProfileLibraryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const list = await getAllProfiles();
    setProfiles(list);
  };

  useEffect(() => {
    refresh();
    const onChanged = () => {
      refresh();
    };
    window.addEventListener(PROFILES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PROFILES_CHANGED_EVENT, onChanged);
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDeleteName(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const handleDelete = async (name: string) => {
    await deleteProfile(name);
    setConfirmDeleteName(null);
    await refresh();
    onDeletedProfile?.(name);
  };

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
        title="查看保存在本機瀏覽器的命盤檔案與歷史對話"
      >
        <span>檔案庫</span>
        <span className="hidden sm:inline">· 我的命盤庫</span>
        {profiles.length > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.2 rounded-full font-mono"
            style={{
              background: 'rgba(212,168,67,0.2)',
              color: 'var(--ac, #d4a843)',
            }}
          >
            {profiles.length}
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
          <div
            className="px-3.5 py-2.5 flex items-center justify-between"
            style={{
              background: 'var(--bg-1, rgba(255,255,255,0.03))',
              borderBottom: '1px solid var(--bdr, rgba(255,255,255,0.08))',
            }}
          >
            <span className="text-xs font-semibold" style={{ color: 'var(--tx-0)' }}>
              我的命盤庫（本機私密檔案）
            </span>
            <span className="text-[10px]" style={{ color: 'var(--tx-3)' }}>
              共 {profiles.length} 份
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: 'var(--bdr)' }}>
            {profiles.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs leading-relaxed" style={{ color: 'var(--tx-3)' }}>
                暫無保存的命盤檔案。<br />
                在起盤表單中填入「姓名」並起盤，系統將自動保存在本機瀏覽器中。
              </div>
            ) : (
              profiles.map(p => {
                const isActive = activeProfileName === p.name;
                const visibleMsgCount = p.messages.filter(m => !m.hidden).length;
                const birthSummary = `${p.birthInfo.year}/${p.birthInfo.month}/${p.birthInfo.day} · ${
                  p.birthInfo.gender === 'male' ? '男' : '女'
                }`;
                const isConfirming = confirmDeleteName === p.name;

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
                      onClick={() => {
                        setOpen(false);
                        setConfirmDeleteName(null);
                        onSelectProfile(p);
                      }}
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
                            style={{
                              background: 'rgba(212,168,67,0.2)',
                              color: 'var(--ac)',
                            }}
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
                          onClick={() => handleDelete(p.name)}
                          className="text-[10px] px-2 py-1 rounded cursor-pointer border-none"
                          style={{ background: '#dc2626', color: '#fff' }}
                        >
                          確認刪
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteName(null)}
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
                        onClick={() => setConfirmDeleteName(p.name)}
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

          <div
            className="px-3.5 py-2 text-[10px] flex items-center gap-1.5"
            style={{
              background: 'var(--bg-1, rgba(255,255,255,0.02))',
              borderTop: '1px solid var(--bdr)',
              color: 'var(--tx-3)',
            }}
          >
            <span>🔒</span>
            <span>所有姓名、命盤與對話僅保存在本機瀏覽器，絕不上傳伺服器</span>
          </div>
        </div>
      )}
    </div>
  );
}
