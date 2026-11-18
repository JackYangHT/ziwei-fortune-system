'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeProvider';
import {
  DEFAULT_DEEPINFRA_BASE_URL,
  DEFAULT_DEEPINFRA_MODEL,
  loadClientAiSettings,
  saveClientAiSettings,
} from '@/lib/ai-client';

const PRESET_PROVIDERS = [
  {
    name: 'DeepInfra（推薦）',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    model: 'deepseek-ai/DeepSeek-V4-Flash',
  },
  {
    name: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    name: 'OpenAI 官方',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
];

export default function ApiKeyModal({
  buttonClassName = '',
  buttonStyle,
}: {
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_DEEPINFRA_BASE_URL);
  const [model, setModel] = useState(DEFAULT_DEEPINFRA_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [hasConfigured, setHasConfigured] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const syncFromStorage = () => {
    const cfg = loadClientAiSettings();
    if (cfg && cfg.apiKey) {
      setApiKey(cfg.apiKey);
      setBaseUrl(cfg.baseUrl || DEFAULT_DEEPINFRA_BASE_URL);
      setModel(cfg.model || DEFAULT_DEEPINFRA_MODEL);
      setHasConfigured(true);
    } else {
      setHasConfigured(false);
    }
  };

  useEffect(() => {
    syncFromStorage();
    const handler = () => syncFromStorage();
    window.addEventListener('ziwei-ai-config-changed', handler);
    return () => window.removeEventListener('ziwei-ai-config-changed', handler);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveClientAiSettings({ apiKey, baseUrl, model });
    setHasConfigured(!!apiKey.trim());
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      setOpen(false);
    }, 650);
  };

  const handleClear = () => {
    setApiKey('');
    saveClientAiSettings({ apiKey: '', baseUrl, model });
    setHasConfigured(false);
  };

  const goldColor = isDark ? '#d4a843' : '#8b6410';
  const borderColor = isDark ? 'rgba(212,168,67,0.35)' : 'rgba(140,100,20,0.35)';

  return (
    <>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
        className={
          buttonClassName ||
          'text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full transition-all duration-300 flex items-center gap-1.5 cursor-pointer'
        }
        style={
          buttonStyle ?? {
            border: `1px solid ${hasConfigured ? 'rgba(16,185,129,0.45)' : borderColor}`,
            background: hasConfigured
              ? 'rgba(16,185,129,0.10)'
              : isDark
                ? 'rgba(212,168,67,0.08)'
                : 'rgba(255,252,242,0.85)',
            color: hasConfigured ? '#10b981' : goldColor,
          }
        }
        title="配置 AI 解讀 API Key"
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: hasConfigured ? '#10b981' : goldColor }}
        />
        <span>{hasConfigured ? 'API 已就緒' : '🔑 API 設置'}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl p-6"
              style={{
                background: isDark ? '#071124' : '#fdf9ef',
                border: `1px solid ${borderColor}`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                color: isDark ? '#e8eef6' : '#1a1d24',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold tracking-wider" style={{ color: goldColor }}>
                    ✦ AI 解讀 API 設置
                  </h3>
                  <p className="text-[11px] mt-0.5" style={{ color: isDark ? '#9db0d0' : '#5a6275' }}>
                    密鑰僅保存在您的瀏覽器本地（localStorage），支持靜態站點直連與後端代理
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-lg px-2 py-0.5 rounded-lg opacity-60 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 快捷服务商切换 */}
              <div className="mb-4">
                <div className="text-[11px] mb-1.5" style={{ color: isDark ? '#b8c6df' : '#3a3f4a' }}>
                  快捷選擇服務商：
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PROVIDERS.map(p => {
                    const active = baseUrl === p.baseUrl;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          setBaseUrl(p.baseUrl);
                          setModel(p.model);
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                        style={{
                          border: `1px solid ${active ? goldColor : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(160,120,30,0.25)'}`,
                          background: active ? 'rgba(212,168,67,0.16)' : 'transparent',
                          color: active ? goldColor : isDark ? '#b8c6df' : '#3a3f4a',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium" style={{ color: isDark ? '#b8c6df' : '#3a3f4a' }}>
                      API Key（必填）
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKey(s => !s)}
                      className="text-[10px] underline cursor-pointer"
                      style={{ color: goldColor }}
                    >
                      {showKey ? '隱藏密鑰' : '顯示密鑰'}
                    </button>
                  </div>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="輸入您的 API Key（如 DeepInfra / DeepSeek / OpenAI Key）"
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(180,140,40,0.35)'}`,
                      color: isDark ? '#e8eef6' : '#1a1d24',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: isDark ? '#b8c6df' : '#3a3f4a' }}>
                    API Base URL（OpenAI 兼容接口地址）
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder="https://api.deepinfra.com/v1/openai"
                    className="w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(180,140,40,0.35)'}`,
                      color: isDark ? '#e8eef6' : '#1a1d24',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: isDark ? '#b8c6df' : '#3a3f4a' }}>
                    模型名稱（Model）
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="deepseek-ai/DeepSeek-V4-Flash"
                    className="w-full rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(180,140,40,0.35)'}`,
                      color: isDark ? '#e8eef6' : '#1a1d24',
                    }}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 gap-2">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer"
                    style={{
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(160,120,30,0.25)'}`,
                      color: isDark ? '#9db0d0' : '#5a6275',
                      background: 'transparent',
                    }}
                  >
                    清除密鑰
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold tracking-wider transition-all cursor-pointer"
                    style={{
                      background: isDark
                        ? 'linear-gradient(135deg,#b8892a,#f0d070,#b8892a)'
                        : 'linear-gradient(135deg,#6a4206,#9a6810,#6a4206)',
                      color: isDark ? '#08080a' : '#f8f3e8',
                    }}
                  >
                    {savedToast ? '✓ 已保存並生效' : '保存 API 設置'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
