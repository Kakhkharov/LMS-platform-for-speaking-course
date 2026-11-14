import React, { useState, useEffect, useCallback } from 'react';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

const speakEnglishPreview = (text, onEnd) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    if (onEnd) onEnd();
    return;
  }
  try {
    const clean = String(text).replace(/_{2,}/g, ' blank ').replace(/\s+/g, ' ').trim();
    if (!clean) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'en-US';
    u.rate = 0.94;
    const voices = window.speechSynthesis.getVoices() || [];
    const enVoice = voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
    if (enVoice) u.voice = enVoice;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (onEnd) onEnd();
    };
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, 8000);
    window.speechSynthesis.speak(u);
  } catch (e) {
    if (onEnd) onEnd();
  }
};

const EMPTY_FORM = {
  question: '',
  answer: '',
  hint: '',
  category: 'IELTS Speaking',
  xp: 15,
  coins: 10
};

export default function AdminPractise() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', text }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('token') || '';

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/practise/questions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      }
    } catch (e) {
      console.error('Admin practise load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
    };
  }, [loadQuestions]);

  const showBanner = (type, text) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEditForm = (q) => {
    setEditingId(q.id);
    setForm({
      question: q.question || '',
      answer: q.answer || '',
      hint: q.hint || '',
      category: q.category || 'Speaking Practise',
      xp: Number(q.xp) ?? 15,
      coins: Number(q.coins) ?? 10
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const token = getToken();
      const url = editingId
        ? `${API_BASE}/api/practise/questions/${editingId}`
        : `${API_BASE}/api/practise/questions`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          question: form.question,
          answer: form.answer,
          hint: form.hint,
          category: form.category,
          xp: Number(form.xp) || 0,
          coins: Number(form.coins) || 0
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Saqlashda xatolik yuz berdi.');
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadQuestions();
      showBanner('success', editingId ? "Speaking savoli muvaffaqiyatli yangilandi!" : "Yangi Speaking savoli qo'shildi!");
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/practise/questions/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "O'chirishda xatolik");
      }
      setConfirmDeleteId(null);
      await loadQuestions();
      showBanner('success', "Savol o'chirildi.");
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  const previewWords = String(form.answer || '')
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean);

  const filteredQuestions = questions.filter((q) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      String(q.question || '').toLowerCase().includes(query) ||
      String(q.answer || '').toLowerCase().includes(query) ||
      String(q.category || '').toLowerCase().includes(query)
    );
  });

  const totalXpPool = questions.reduce((acc, q) => acc + (Number(q.xp) || 0), 0);
  const totalCoinPool = questions.reduce((acc, q) => acc + (Number(q.coins) || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-500/12 text-indigo-500 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </span>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Speaking Practise Boshqaruvi</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Student paneldagi Speaking practise bo'limi savollari, katakchali javoblari, Coin va XP mukofotlarini boshqaring
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="px-4 py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-indigo-600 text-white text-xs font-black shadow-md shadow-indigo-500/25 flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span>Yangi savol qo'shish</span>
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="modern-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Jami savollar</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">{questions.length} ta</p>
          </div>
        </div>
        <div className="modern-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 1.5 2.5 2 2.5 2s2.5.5 2.5 2a2.5 2.5 0 0 1-5 0" />
              <path d="M12 7v10" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Jami ajratilgan Coin</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">+{totalCoinPool} Coin</p>
          </div>
        </div>
        <div className="modern-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase">Jami ajratilgan XP</p>
            <p className="text-xl font-black text-slate-900 dark:text-white">+{totalXpPool} XP</p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Create / Edit Form Card */}
      {formOpen && (
        <form onSubmit={handleSubmit} className="modern-card p-6 space-y-4 border-2 border-indigo-500/30 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {editingId ? 'Speaking savolini tahrirlash' : 'Yangi Speaking savoli qo\'shish'}
            </h3>
            <button
              type="button"
              onClick={() => { setFormOpen(false); setEditingId(null); }}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              Bekor qilish ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Ingliz tilida savol matni (bo'sh o'rin uchun _____ ishlating)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSpeakingId('preview');
                    speakEnglishPreview(form.question, () => setSpeakingId(null));
                  }}
                  className="text-[11px] font-bold text-indigo-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                  <span>{speakingId === 'preview' ? 'O\'qilmoqda...' : 'Audio tinglab ko\'rish'}</span>
                </button>
              </div>
              <textarea
                required
                rows={2}
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Masalan: Speaking English smoothly without long pauses is called _____."
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                To'g'ri javob (Katakchalar shu harflar soniga mos yaratiladi)
              </label>
              <input
                required
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value.toUpperCase() })}
                placeholder="Masalan: FLUENCY"
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-black uppercase text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Kategoriya / Mavzu</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Masalan: IELTS Speaking"
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Maslahat / Hint (ixtiyoriy)</label>
              <input
                value={form.hint}
                onChange={(e) => setForm({ ...form, hint: e.target.value })}
                placeholder="Masalan: Starts with F (7 letters)"
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">XP mukofoti</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.xp}
                  onChange={(e) => setForm({ ...form, xp: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Coin mukofoti</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={form.coins}
                  onChange={(e) => setForm({ ...form, coins: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Live Letter Boxes Preview */}
          {previewWords.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                Talabaga ko'rinadigan katakchalar ko'rinishi ({previewWords.reduce((a, w) => a + w.length, 0)} ta harf):
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {previewWords.map((word, wIdx) => (
                  <div key={wIdx} className="flex flex-wrap gap-1.5">
                    {word.split('').map((ch, cIdx) => (
                      <div
                        key={cIdx}
                        className="w-8 h-9 rounded-lg border-2 border-indigo-400/60 bg-white dark:bg-slate-900 flex items-center justify-center font-mono font-black text-sm text-indigo-600 dark:text-indigo-300"
                      >
                        {ch}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setFormOpen(false); setEditingId(null); }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-indigo-600 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saqlanmoqda...' : (editingId ? 'O\'zgarishlarni saqlash' : 'Savolni qo\'shish')}
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Savol, javob yoki kategoriya bo'yicha qidirish..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="modern-card p-10 text-center text-xs font-bold text-slate-400">
          Savollar yuklanmoqda...
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="modern-card p-10 text-center space-y-2">
          <p className="text-sm font-black text-slate-700 dark:text-slate-200">Speaking practise savollari topilmadi</p>
          <p className="text-xs text-slate-400">Yangi savol qo'shish uchun yuqoridagi "Yangi savol qo'shish" tugmasini bosing.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredQuestions.map((q, idx) => (
            <div key={q.id} className="modern-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-slate-200/80 dark:border-slate-800">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">
                    #{idx + 1}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                    {q.category || 'Speaking Practise'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                    +{q.xp} XP
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black">
                    +{q.coins} Coin
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSpeakingId(q.id);
                      speakEnglishPreview(q.question, () => setSpeakingId(null));
                    }}
                    title="Ingliz tilida tinglash"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                      speakingId === q.id
                        ? 'bg-emerald-500 text-white animate-pulse'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  </button>
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{q.question}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[11px] font-bold text-slate-400">Javob ({q.letterCount} harf):</span>
                  <div className="flex flex-wrap gap-1">
                    {String(q.answer || '').replace(/\s+/g, '').split('').map((ch, cIdx) => (
                      <span
                        key={cIdx}
                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-black text-[11px] text-slate-900 dark:text-white flex items-center justify-center"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                  {q.hint && (
                    <span className="text-[11px] text-slate-400 italic ml-2">💡 {q.hint}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditForm(q)}
                  className="px-3 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500 text-indigo-600 dark:text-indigo-400 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span>Tahrirlash</span>
                </button>

                {confirmDeleteId === q.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer"
                    >
                      O'chirish
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 cursor-pointer"
                    >
                      Bekor
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(q.id)}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>O'chirish</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
