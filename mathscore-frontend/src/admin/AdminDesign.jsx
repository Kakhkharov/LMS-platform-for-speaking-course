import React, { useState, useEffect } from 'react';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:5000'
  : 'https://api.mathscore.uz';

const PRESET_LIST = [
  {
    id: 'original',
    title: 'Original (Hozirgi ko\'rinish)',
    subtitle: 'Standart platforma rejimi (Light / Dark)',
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    font: '#09090B',
    button: '#4F46E5',
    muted: '#64748B',
    border: '#E2E8F0',
    badge: 'Standart'
  },
  {
    id: 'burnt-orange',
    title: 'Burnt orange',
    subtitle: 'Issiq krem fon, Ink black shrift va Burnt orange tugmalar',
    bg: '#F3EEE3',
    surface: '#FAF7F0',
    font: '#111111',
    button: '#D9641E',
    muted: '#4A443A',
    border: '#D9CFC0',
    badge: 'Warm Editorial'
  },
  {
    id: 'hot-pink',
    title: 'Hot pink',
    subtitle: 'To\'q ko\'k fon (#0F183D), oq shrift (#FFFFFF) va Hot pink tugmalar',
    bg: '#0F183D',
    surface: '#172457',
    font: '#FFFFFF',
    button: '#FF3D8B',
    muted: '#C7D2FE',
    border: 'rgba(255,255,255,0.2)',
    badge: 'Night Neon'
  },
  {
    id: 'electric-blue',
    title: 'Electric blue',
    subtitle: 'To\'q ko\'mir fon (#1E1E1C), qum shrift (#D8CBB3) va Electric blue tugmalar',
    bg: '#1E1E1C',
    surface: '#272724',
    font: '#D8CBB3',
    button: '#2F6BFF',
    muted: '#AFA28A',
    border: 'rgba(216,203,179,0.22)',
    badge: 'Studio Dark'
  }
];

export default function AdminDesign() {
  const [activePreset, setActivePreset] = useState('original');
  const [previewPresetId, setPreviewPresetId] = useState('original');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('token') || '';

  useEffect(() => {
    fetch(`${API_BASE}/api/design`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preset) {
          setActivePreset(data.preset);
          setPreviewPresetId(data.preset);
          setUpdatedAt(data.updatedAt || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApplyPreset = async (presetId) => {
    setSavingId(presetId);
    setFeedback(null);
    setPreviewPresetId(presetId);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/design`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ preset: presetId })
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Dizayn mavzusini saqlashda xatolik yuz berdi.' });
      } else {
        setActivePreset(data.preset || presetId);
        setUpdatedAt(data.updatedAt || new Date().toISOString());
        const chosen = PRESET_LIST.find((p) => p.id === presetId);
        setFeedback({
          type: 'success',
          text: `"${chosen?.title || presetId}" mavzusi barcha student panellariga real vaqtda qo'llanildi!`
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: 'Server bilan ulanishda xatolik yuz berdi.' });
    } finally {
      setSavingId(null);
    }
  };

  const previewTheme = PRESET_LIST.find((p) => p.id === previewPresetId) || PRESET_LIST[0];

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#5B5FEF] text-[28px]">palette</span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Design — Student Panel Ranglarini Boshqarish
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quyidagi rang palitralaridan birini tanlang — u darhol barcha talabalar panelida jonli yangilanadi.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 self-start sm:self-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Faol mavzu: {PRESET_LIST.find((p) => p.id === activePreset)?.title || activePreset}</span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-300'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {feedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{feedback.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs font-bold text-slate-400">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* 4 Preset Theme Cards */}
          <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRESET_LIST.map((preset) => {
              const isActive = activePreset === preset.id;
              const isSaving = savingId === preset.id;
              return (
                <div
                  key={preset.id}
                  onMouseEnter={() => setPreviewPresetId(preset.id)}
                  onClick={() => setPreviewPresetId(preset.id)}
                  className={`rounded-2xl border-2 p-5 transition-all cursor-pointer flex flex-col justify-between gap-4 bg-white dark:bg-slate-900 shadow-xs ${
                    isActive
                      ? 'border-[#5B5FEF] ring-2 ring-[#5B5FEF]/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {preset.badge}
                        </span>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                          {preset.title}
                        </h3>
                      </div>
                      {isActive && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black shrink-0">
                          Faol ✓
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {preset.subtitle}
                    </p>

                    {/* Color swatches */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 text-center">
                        <span
                          className="w-6 h-6 rounded-lg mx-auto block border border-black/15 shadow-2xs"
                          style={{ backgroundColor: preset.bg }}
                        />
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mt-1">Bg</span>
                        <span className="text-[10px] font-mono font-black text-slate-800 dark:text-slate-200">{preset.bg}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 text-center">
                        <span
                          className="w-6 h-6 rounded-lg mx-auto block border border-black/15 shadow-2xs"
                          style={{ backgroundColor: preset.font }}
                        />
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mt-1">Shrift</span>
                        <span className="text-[10px] font-mono font-black text-slate-800 dark:text-slate-200">{preset.font}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 text-center">
                        <span
                          className="w-6 h-6 rounded-lg mx-auto block border border-black/15 shadow-2xs"
                          style={{ backgroundColor: preset.button }}
                        />
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mt-1">Tugma</span>
                        <span className="text-[10px] font-mono font-black text-slate-800 dark:text-slate-200">{preset.button}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyPreset(preset.id);
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-white shadow-sm hover:opacity-90'
                    }`}
                    style={isActive ? undefined : { backgroundColor: preset.button }}
                  >
                    {isSaving ? 'Saqlanmoqda...' : isActive ? 'Faol Mavzu ✓' : `Qo'llash — ${preset.title.split(' ')[0]}`}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Live Student Panel Mini Preview */}
          <div className="xl:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#5B5FEF]">preview</span>
                <span>Jonli Ko'rinish: {previewTheme.title}</span>
              </h3>
              {updatedAt && (
                <span className="text-[10px] text-slate-400 font-medium">
                  Oxirgi yangilanish: {new Date(updatedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Simulated Student Shell */}
            <div
              className="rounded-2xl p-4 border transition-colors duration-300 space-y-4"
              style={{
                backgroundColor: previewTheme.bg,
                color: previewTheme.font,
                borderColor: previewTheme.border
              }}
            >
              {/* Simulated Header */}
              <div
                className="rounded-xl px-3.5 py-2.5 border flex items-center justify-between"
                style={{
                  backgroundColor: previewTheme.surface,
                  borderColor: previewTheme.border
                }}
              >
                <span className="font-black text-xs tracking-tight" style={{ color: previewTheme.font }}>
                  Practise Student
                </span>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span style={{ color: previewTheme.muted }}>🪙 120</span>
                  <span style={{ color: previewTheme.button }}>⚡ 450 XP</span>
                </div>
              </div>

              {/* Simulated Card */}
              <div
                className="rounded-xl p-4 border space-y-3"
                style={{
                  backgroundColor: previewTheme.surface,
                  borderColor: previewTheme.border
                }}
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: previewTheme.button }}>
                    30 Day Challenge
                  </span>
                  <h4 className="text-sm font-black" style={{ color: previewTheme.font }}>
                    Day 1 — Confident Introductions
                  </h4>
                  <p className="text-[11px] leading-relaxed" style={{ color: previewTheme.muted }}>
                    Talaba interfeysidagi matnlar shrift rangi ({previewTheme.font}), fon ({previewTheme.bg}) va tugmalar ({previewTheme.button}) ko'rinishi.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(previewTheme.id)}
                    className="px-4 py-2 rounded-xl text-[11px] font-black text-white shadow-sm cursor-pointer transition-transform active:scale-95"
                    style={{ backgroundColor: previewTheme.button }}
                  >
                    Continue learning →
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(previewTheme.id)}
                    className="px-3 py-2 rounded-xl text-[11px] font-bold border cursor-pointer"
                    style={{
                      borderColor: previewTheme.border,
                      color: previewTheme.font,
                      backgroundColor: 'transparent'
                    }}
                  >
                    Batafsil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
