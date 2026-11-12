import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:5000'
  : 'https://api.mathscore.uz';

const getInitialsAvatar = (fullName = 'Student') => {
  const parts = String(fullName || 'S').trim().split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'ST';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#0ea5e9"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-weight="700" font-size="28">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const awardStudentActivity = async ({ type, eventKey, xp = 0, coins = 0, meta = null, allowDuplicate = false }) => {
  const token = localStorage.getItem('student_token');
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/gamification/award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type, eventKey, xp, coins, meta, allowDuplicate })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Gamification award failed:', e);
  }
  return null;
};

// ==================== 1. GRAMMAR VIEW ====================
export function GrammarView({ onBack, onStatsUpdate }) {
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [completedTopics, setCompletedTopics] = useState([]);
  const [grammarToast, setGrammarToast] = useState('');
  const [isAwarding, setIsAwarding] = useState(false);

  const topics = [
    { id: 1, title: 'Subject-Verb Agreement in Speech', level: 'Core Rule', lessons: '8 dars', desc: 'Og\'zaki nutqda birlik va ko\'plik otlarning fe\'llar bilan tabiiy moslashuvi.', icon: 'rule' },
    { id: 2, title: 'Verb Tenses & Consistency in Conversation', level: 'Advanced', lessons: '6 dars', desc: 'Present Perfect, Past Simple va zamonlar izchilligini erkin qo\'llash.', icon: 'schedule' },
    { id: 3, title: 'Pronoun Antecedent Agreement', level: 'Intermediate', lessons: '5 dars', desc: 'Olmoshlarning o\'zidan oldingi so\'zlarga to\'g\'ri va aniq bog\'lanishi.', icon: 'person' },
    { id: 4, title: 'Sentence Connectors & Fillers', level: 'Fluency', lessons: '7 dars', desc: 'Nutqni to\'xtovsiz va ravon qilish uchun bog\'lovchi so\'zlar va frazalar.', icon: 'swap_horiz' },
    { id: 5, title: 'Parallel Structure & Conjunctions', level: 'Mastery', lessons: '6 dars', desc: 'Not only... but also, either... or kabi murakkab gap qurilmalarini nutqda qo\'llash.', icon: 'format_align_left' },
    { id: 6, title: 'Phrasal Verbs in Everyday English', level: 'Core Rule', lessons: '9 dars', desc: 'Jonli suhbatlarda eng ko\'p ishlatiladigan 100 ta fe\'lli ibora.', icon: 'horizontal_rule' }
  ];

  const handleCompleteTopic = async () => {
    if (!selectedTopic) return;
    setIsAwarding(true);
    const topic = selectedTopic;
    const data = await awardStudentActivity({
      type: 'grammar',
      eventKey: `grammar_topic_${topic.id}`,
      xp: 15,
      coins: 5,
      meta: { topicId: topic.id, title: topic.title }
    });
    setCompletedTopics(prev => (prev.includes(topic.id) ? prev : [...prev, topic.id]));
    if (data?.userStats) {
      onStatsUpdate?.(data.userStats, data.alreadyAwarded ? null : data.awarded, topic.title);
    }
    setGrammarToast(
      data?.alreadyAwarded
        ? `"${topic.title}" mavzusi takrorlandi!`
        : `"${topic.title}" yakunlandi! +15 XP va +5 Coin qo'shildi.`
    );
    setTimeout(() => setGrammarToast(''), 3500);
    setIsAwarding(false);
    setSelectedTopic(null);
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="font-outfit text-3xl font-black text-on-surface tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-500 text-[32px]">spellcheck</span>
            <span>English Grammar for Speaking Masterclass</span>
          </h1>
          <p className="text-xs text-outline mt-1 font-medium">
            Ingliz tili speaking va to'g'ri so'zlashuv uchun eng muhim grammatik qoidalar va mashqlar
          </p>
        </div>
        {grammarToast && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            {grammarToast}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {topics.map(t => {
          const isDone = completedTopics.includes(t.id);
          return (
          <div
            key={t.id}
            onClick={() => setSelectedTopic(t)}
            className="rounded-3xl p-5 border border-outline-variant bg-surface hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">{t.icon}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isDone && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      ✓ O'zlashtirildi
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface-container text-outline">
                    {t.level}
                  </span>
                </div>
              </div>
              <div>
                <h3 className="font-outfit font-black text-base text-on-surface group-hover:text-amber-600 transition-colors">
                  {t.title}
                </h3>
                <p className="text-xs text-outline mt-1 leading-relaxed line-clamp-2">
                  {t.desc}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-outline-variant/50 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>{t.lessons} · +15 XP</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </div>
          );
        })}
      </div>

      {selectedTopic && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-outline-variant rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-outfit font-black text-lg text-on-surface">{selectedTopic.title}</h3>
              <button onClick={() => setSelectedTopic(null)} className="text-slate-400 hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <p className="text-xs text-outline leading-relaxed">{selectedTopic.desc}</p>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
              <h4 className="font-bold text-amber-900 dark:text-amber-200">Asosiy Qoida:</h4>
              <p className="text-amber-800 dark:text-amber-300">
                A singular subject takes a singular verb, whereas a plural subject takes a plural verb. Intervening prepositional phrases do not affect the verb number.
              </p>
              <div className="pt-2 font-mono text-[11px] text-amber-950 dark:text-amber-100 bg-white/60 dark:bg-black/30 p-2 rounded-lg">
                ❌ The box of chocolates are empty.<br />
                ✅ The box of chocolates <b>is</b> empty.
              </div>
            </div>
            <button
              onClick={handleCompleteTopic}
              disabled={isAwarding}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
            >
              {isAwarding ? 'Saqlanmoqda...' : 'Mashqni yakunlash (+15 XP · +5 Coin)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 2. SPEAKING PRACTISE VIEW ====================
const speakSpeakingQuestion = (text, onEnd) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
    if (onEnd) onEnd();
    return;
  }
  try {
    const cleanText = String(text)
      .replace(/_{2,}/g, ' blank ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices() || [];
    const enVoice = voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
    if (enVoice) utterance.voice = enVoice;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (onEnd) onEnd();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    setTimeout(finish, 8000);
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    if (onEnd) onEnd();
  }
};

export function PractiseView({ onStatsUpdate, refreshKey = 0 }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [letters, setLetters] = useState([]);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionCoins, setSessionCoins] = useState(0);
  const [checkState, setCheckState] = useState(null); // { status: 'correct'|'wrong', text: string, alreadyCompleted?: boolean }
  const [submitting, setSubmitting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const boxRefs = useRef([]);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('student_token');
      const res = await fetch(`${API_BASE}/api/practise/questions`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.questions) ? data.questions : [];
        setQuestions(list);
        setCurrentIdx(prev => (list.length === 0 ? 0 : Math.min(prev, list.length - 1)));
      }
    } catch (e) {
      console.error('Speaking practise load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions, refreshKey]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
    };
  }, []);

  const currentQ = questions[currentIdx] || null;

  useEffect(() => {
    if (!currentQ) {
      setLetters([]);
      setCheckState(null);
      setShowHint(false);
      return;
    }
    const count = Number(currentQ.letterCount) || 0;
    const solvedClean = String(currentQ.solvedAnswer || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (currentQ.completed && solvedClean.length === count) {
      setLetters(solvedClean.split(''));
    } else {
      setLetters(Array(count).fill(''));
    }
    setCheckState(null);
    setShowHint(false);
    boxRefs.current = [];
  }, [currentQ?.id, currentQ?.letterCount]);

  const wordLengths = Array.isArray(currentQ?.wordLengths) && currentQ.wordLengths.length > 0
    ? currentQ.wordLengths
    : (currentQ?.letterCount ? [currentQ.letterCount] : []);

  const handleBoxChange = (flatIdx, rawValue) => {
    const cleaned = String(rawValue || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const char = cleaned.slice(-1);
    setCheckState(null);
    setLetters(prev => {
      const next = [...prev];
      next[flatIdx] = char;
      return next;
    });
    if (char && flatIdx + 1 < letters.length) {
      const nextEl = boxRefs.current[flatIdx + 1];
      if (nextEl) nextEl.focus();
    }
  };

  const handleBoxKeyDown = (flatIdx, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      setCheckState(null);
      if (letters[flatIdx]) {
        setLetters(prev => {
          const next = [...prev];
          next[flatIdx] = '';
          return next;
        });
      } else if (flatIdx > 0) {
        setLetters(prev => {
          const next = [...prev];
          next[flatIdx - 1] = '';
          return next;
        });
        const prevEl = boxRefs.current[flatIdx - 1];
        if (prevEl) prevEl.focus();
      }
    } else if (e.key === 'ArrowLeft' && flatIdx > 0) {
      e.preventDefault();
      boxRefs.current[flatIdx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && flatIdx + 1 < letters.length) {
      e.preventDefault();
      boxRefs.current[flatIdx + 1]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleCheckAnswer(e);
    }
  };

  const handleBoxPaste = (flatIdx, e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData('text') || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!pasted) return;
    setCheckState(null);
    setLetters(prev => {
      const next = [...prev];
      for (let i = 0; i < pasted.length && flatIdx + i < next.length; i++) {
        next[flatIdx + i] = pasted[i];
      }
      return next;
    });
    const jumpIdx = Math.min(letters.length - 1, flatIdx + pasted.length);
    boxRefs.current[jumpIdx]?.focus();
  };

  const handleClearBoxes = () => {
    setLetters(Array(Number(currentQ?.letterCount) || 0).fill(''));
    setCheckState(null);
    setTimeout(() => boxRefs.current[0]?.focus(), 20);
  };

  const handleSpeakQuestion = () => {
    if (!currentQ?.question) return;
    setIsSpeaking(true);
    speakSpeakingQuestion(currentQ.question, () => setIsSpeaking(false));
  };

  const handleCheckAnswer = async (e) => {
    if (e) e.preventDefault();
    if (!currentQ || submitting) return;
    const joined = letters.join('').trim();
    if (joined.length < (Number(currentQ.letterCount) || 1)) {
      setCheckState({
        status: 'wrong',
        text: "Barcha katakchalarni harflar bilan to'ldiring!"
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('student_token');
      const res = await fetch(`${API_BASE}/api/practise/questions/${currentQ.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ letters, answer: joined })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Tekshirishda xatolik yuz berdi.');
      }

      if (data.correct) {
        const gainedXp = Number(data.awardedXp) || 0;
        const gainedCoins = Number(data.awardedCoins) || 0;
        if (gainedXp > 0) setSessionXp(s => s + gainedXp);
        if (gainedCoins > 0) setSessionCoins(c => c + gainedCoins);

        setQuestions(prev => prev.map((item, idx) =>
          item.id === currentQ.id
            ? { ...item, completed: true, solvedAnswer: data.solvedAnswer || joined }
            : item
        ));

        setCheckState({
          status: 'correct',
          alreadyCompleted: Boolean(data.alreadyCompleted),
          text: data.message || `Barakalla! +${gainedXp} XP va +${gainedCoins} Coin berildi!`
        });

        if (data.userStats) {
          onStatsUpdate?.(
            data.userStats,
            (gainedXp > 0 || gainedCoins > 0) ? { xp: gainedXp, coins: gainedCoins } : null,
            'Speaking practise'
          );
        }
      } else {
        setCheckState({
          status: 'wrong',
          text: data.message || "Noto'g'ri! Harflarni tekshirib qayta urinib ko'ring."
        });
      }
    } catch (err) {
      setCheckState({
        status: 'wrong',
        text: err.message || 'Server bilan aloqada xatolik.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const completedCount = questions.filter(q => q.completed).length;

  let globalSlotOffset = 0;

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2.5">
        <h1 className="font-outfit text-3xl font-black text-on-surface tracking-tight flex items-center justify-center gap-2.5">
          <span className="w-10 h-10 rounded-2xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </span>
          <span>Speaking practise</span>
        </h1>
        <p className="text-xs text-outline font-medium">
          Ingliz tilidagi speaking savollarini tinglang va mos katakchalarga javob harflarini yozing.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-outfit font-black text-xs border border-primary/20">
            <span>Sessiya: +{sessionXp} XP</span>
            <span>·</span>
            <span>+{sessionCoins} Coin</span>
          </div>
          {questions.length > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-outfit font-bold text-xs">
              <span>Bajarildi: {completedCount} / {questions.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Question Selector Pills */}
      {questions.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIdx;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIdx(idx)}
                className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  isCurrent
                    ? 'bg-primary text-white border-primary shadow-sm scale-105'
                    : q.completed
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                      : 'bg-surface border-outline-variant text-outline hover:text-on-surface hover:border-primary/40'
                }`}
                title={`Savol ${idx + 1}${q.completed ? ' (Bajarilgan)' : ''}`}
              >
                {q.completed && !isCurrent ? '✓' : idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Speaking Practise Card */}
      {loading ? (
        <div className="dashboard-card-surface bg-surface border border-outline-variant rounded-3xl p-10 text-center text-sm font-bold text-outline">
          Speaking savollari yuklanmoqda...
        </div>
      ) : !currentQ ? (
        <div className="dashboard-card-surface bg-surface border border-outline-variant rounded-3xl p-10 text-center space-y-2">
          <p className="font-outfit font-bold text-base text-on-surface">Hozircha Speaking practise savollari qo'shilmagan.</p>
          <p className="text-xs text-outline">Admin yangi savol qo'shishi bilan shu yerda paydo bo'ladi.</p>
        </div>
      ) : (
        <div className="dashboard-card-surface bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-lg space-y-6">
          {/* Top Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[11px] font-black uppercase tracking-wider">
                Savol {currentIdx + 1} / {questions.length}
              </span>
              {currentQ.category && (
                <span className="px-2.5 py-1 rounded-lg bg-surface-container text-outline text-[11px] font-bold border border-outline-variant/60">
                  {currentQ.category}
                </span>
              )}
              {currentQ.completed && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-black">
                  ✓ Bajarilgan
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-black">
                +{currentQ.xp} XP
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-300 border border-amber-500/25 text-[11px] font-black">
                +{currentQ.coins} Coin
              </span>
            </div>
          </div>

          {/* English Question Text + Speaker Icon beside it */}
          <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-surface-container/80 border border-outline-variant/70">
            <p className="font-outfit text-lg sm:text-xl font-extrabold text-on-surface leading-snug text-left flex-1">
              {currentQ.question}
            </p>
            <button
              type="button"
              onClick={handleSpeakQuestion}
              aria-label="Listen to question"
              title="Savolni ingliz tilida tinglash"
              className={`design-btn-primary w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md active:scale-95 ${
                isSpeaking
                  ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/25 animate-pulse'
                  : 'bg-primary text-white hover:opacity-90'
              }`}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.15" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>
          </div>

          {/* Hint toggle if available */}
          {currentQ.hint && (
            <div className="flex items-center justify-center">
              {!showHint ? (
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>💡 Maslahatni ko'rish ({currentQ.letterCount} ta harf)</span>
                </button>
              ) : (
                <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-xs font-semibold">
                  💡 {currentQ.hint}
                </div>
              )}
            </div>
          )}

          {/* Letter Boxes Form (Katakchalar) */}
          <form onSubmit={handleCheckAnswer} className="space-y-5">
            <div className="space-y-2 text-center">
              <div className="text-[11px] font-bold text-outline uppercase tracking-wider">
                Javob harflarini katakchalarga yozing ({currentQ.letterCount} ta harf)
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 pt-1">
                {wordLengths.map((wordLen, wIdx) => {
                  const wordStart = globalSlotOffset;
                  globalSlotOffset += wordLen;
                  return (
                    <div key={wIdx} className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                      {Array.from({ length: wordLen }).map((_, cIdx) => {
                        const flatIdx = wordStart + cIdx;
                        const val = letters[flatIdx] || '';
                        const stateStyle =
                          checkState?.status === 'correct'
                            ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                            : checkState?.status === 'wrong'
                              ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : val
                                ? 'border-primary bg-primary/8 text-on-surface shadow-xs'
                                : 'border-outline-variant bg-surface-container text-on-surface';
                        return (
                          <input
                            key={flatIdx}
                            ref={(el) => { boxRefs.current[flatIdx] = el; }}
                            type="text"
                            inputMode="text"
                            autoComplete="off"
                            spellCheck={false}
                            maxLength={2}
                            value={val}
                            aria-label={`Harf ${flatIdx + 1}`}
                            onChange={(e) => handleBoxChange(flatIdx, e.target.value)}
                            onKeyDown={(e) => handleBoxKeyDown(flatIdx, e)}
                            onPaste={(e) => handleBoxPaste(flatIdx, e)}
                            onFocus={(e) => e.target.select()}
                            className={`practise-letter-box w-10 h-12 sm:w-12 sm:h-14 text-center font-outfit text-xl sm:text-2xl font-black uppercase rounded-xl border-2 focus:border-primary focus:outline-hidden transition-all ${stateStyle}`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {checkState && (
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm font-bold text-center border animate-fade-in ${
                  checkState.status === 'correct'
                    ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/12 border-rose-500/35 text-rose-600 dark:text-rose-400'
                }`}
              >
                {checkState.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-w-[160px] py-3 px-5 rounded-2xl bg-primary hover:bg-primary/95 text-white font-bold text-sm shadow-md shadow-primary/25 cursor-pointer transition-all active:scale-95 disabled:opacity-60"
              >
                {submitting ? 'Tekshirilmoqda...' : 'Tekshirish (Enter)'}
              </button>

              <button
                type="button"
                onClick={handleClearBoxes}
                className="py-3 px-4 rounded-2xl bg-surface-container border border-outline-variant text-xs font-bold text-outline hover:text-on-surface cursor-pointer transition-colors"
                title="Katakchalarni tozalash"
              >
                Tozalash
              </button>

              {checkState?.status === 'correct' && questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((currentIdx + 1) % questions.length)}
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer transition-colors shadow-sm"
                >
                  Keyingi savol →
                </button>
              )}
            </div>

            {/* Bottom Prev / Next navigation */}
            {questions.length > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant/60 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCurrentIdx((currentIdx - 1 + questions.length) % questions.length)}
                  className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-outline hover:text-on-surface cursor-pointer"
                >
                  ← Oldingi
                </button>
                <span className="text-[11px] text-outline">{currentIdx + 1} / {questions.length}</span>
                <button
                  type="button"
                  onClick={() => setCurrentIdx((currentIdx + 1) % questions.length)}
                  className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-outline hover:text-on-surface cursor-pointer"
                >
                  Keyingi →
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

const speakEnglish = (text) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  try {
    const cleanText = String(text)
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/^"+|"+$/g, '')
      .trim();
    if (!cleanText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    utterance.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices() || [];
    const enVoice = voices.find((v) => /en[-_]US/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
    if (enVoice) utterance.voice = enVoice;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
};

// ==================== 3. GAMES VIEW ====================
export function GamesView({ onStatsUpdate }) {
  const flashcardDeck = [
    { id: 'fc1', word: 'Eloquent', phonetic: '/ˈel.ə.kwənt/', pos: 'adjective', meaning: 'Ravon, ta\'sirchan va go\'zal so\'zlaydigan', example: 'She delivered an eloquent speech about education.' },
    { id: 'fc2', word: 'Resilient', phonetic: '/rɪˈzɪl.i.ənt/', pos: 'adjective', meaning: 'Qiyinchilikdan tez tiklanadigan, chidamli', example: 'Successful speakers remain resilient after mistakes.' },
    { id: 'fc3', word: 'Emit', phonetic: '/iˈmɪt/', pos: 'verb', meaning: 'Chiqarmoq, tarqatmoq (signal, yorug\'lik, hid)', example: 'Plants emit a subtle chemical signal when stressed.' },
    { id: 'fc4', word: 'Concise', phonetic: '/kənˈsaɪs/', pos: 'adjective', meaning: 'Qisqa, lo\'nda va mazmunli', example: 'Keep your IELTS Part 1 answers clear and concise.' },
    { id: 'fc5', word: 'Break the ice', phonetic: '/breɪk ði aɪs/', pos: 'idiom', meaning: 'Suhbat boshidagi noqulaylikni yo\'qotish', example: 'He told a quick joke to break the ice.' },
    { id: 'fc6', word: 'Articulate', phonetic: '/ɑːˈtɪk.jə.lət/', pos: 'adjective', meaning: 'Fikrini aniq va tushunarli bayon qiluvchi', example: 'Regular practice helps you become more articulate.' },
    { id: 'fc7', word: 'Get across', phonetic: '/ɡet əˈkrɒs/', pos: 'phrasal verb', meaning: 'Fikrni suhbatdoshga yetkazib bera olish', example: 'Examples help get your main message across.' },
    { id: 'fc8', word: 'Subtle', phonetic: '/ˈsʌt.əl/', pos: 'adjective', meaning: 'Nozik, sezilar-sezilmas, nafis', example: 'There is a subtle difference between these two idioms.' }
  ];

  const multipleChoiceDeck = [
    { prompt: '"Ravon va erkin so\'zlaydigan" ma\'nosidagi inglizcha so\'zni tanlang:', options: ['Fluent', 'Silent', 'Hesitant', 'Awkward'], correct: 0, tip: 'Fluent — tilni erkin va ravon bilish' },
    { prompt: '"Ta\'sirchan va chiroyli nutq so\'zlovchi" ma\'nosidagi so\'z qaysi?', options: ['Boring', 'Eloquent', 'Mumbled', 'Careless'], correct: 1, tip: 'Eloquent — notiqlik mahoratiga ega' },
    { prompt: '"Qiyinchiliklarga chidamli va tez o\'zini tiklaydigan" so\'zi:', options: ['Fragile', 'Stubborn', 'Resilient', 'Anxious'], correct: 2, tip: 'Resilient — matonatli, bardoshli' },
    { prompt: '"Suhbatdagi noqulay sukunatni yo\'qotish" idiomasi:', options: ['Break the ice', 'Miss the train', 'Catch a cold', 'Drop the ball'], correct: 0, tip: 'Break the ice — iliq suhbat boshlash' },
    { prompt: '"Qisqa, aniq va lo\'nda" so\'zini belgilang:', options: ['Confusing', 'Endless', 'Vague', 'Concise'], correct: 3, tip: 'Concise — ortiqcha so\'zsiz, aniq' },
    { prompt: '"Fikrni suhbatdoshga aniq yetkazish" phrasal verbi:', options: ['Put off', 'Get across', 'Turn down', 'Look away'], correct: 1, tip: 'Get across — fikrni yetkazish' }
  ];

  const matchingPairsData = [
    { id: 1, word: 'Fluent', meaning: 'Ravon so\'zlaydigan' },
    { id: 2, word: 'Emit', meaning: 'Signal chiqarmoq' },
    { id: 3, word: 'Concise', meaning: 'Lo\'nda va qisqa' },
    { id: 4, word: 'Resilient', meaning: 'Chidamli, matonatli' },
    { id: 5, word: 'Eloquent', meaning: 'Ta\'sirchan notiq' },
    { id: 6, word: 'Subtle', meaning: 'Nozik, nafis' }
  ];

  const fillGapDeck = [
    { before: 'Plants', after: 'a subtle chemical signal when insects attack them.', options: ['emit', 'ignore', 'borrow', 'repair'], correct: 0, hint: 'Chiqarmoq / tarqatmoq' },
    { before: 'To sound natural in IELTS Speaking, try to keep your answers', after: 'and focused.', options: ['confused', 'concise', 'fragile', 'silent'], correct: 1, hint: 'Lo\'nda va mazmunli' },
    { before: 'A friendly smile is the fastest way to', after: 'when meeting someone new.', options: ['miss the mark', 'sleep over', 'break the ice', 'call it off'], correct: 2, hint: 'Suhbat boshidagi noqulaylikni yo\'qotish' },
    { before: 'Use real-life stories to', after: 'your main idea clearly to the listener.', options: ['get across', 'turn off', 'run into', 'fall apart'], correct: 0, hint: 'Fikrni yetkazmoq' },
    { before: 'Despite failing once, she remained', after: 'and practiced speaking every day.', options: ['lazy', 'resilient', 'careless', 'shy'], correct: 1, hint: 'Qiyinchilikka chidamli' }
  ];

  const wordRushBank = [
    { q: '"Fluent" so\'zining ma\'nosi?', options: ['Ravon', 'Sekin', 'Jim'], correct: 0 },
    { q: '"Emit" nimani bildiradi?', options: ['Berkitmoq', 'Chiqarmoq', 'Buzmoq'], correct: 1 },
    { q: '"Piece of cake" ma\'nosi?', options: ['Juda qiyin', 'Juda oson', 'Shirin ovqat'], correct: 1 },
    { q: '"Concise" nimani anglatadi?', options: ['Uzun va zerikarli', 'Qisqa va lo\'nda', 'Xato gap'], correct: 1 },
    { q: '"Eloquent" sinonimi:', options: ['Articulate', 'Silent', 'Dull'], correct: 0 },
    { q: '"Subtle" tarjimasi:', options: ['Qo\'pol', 'Nozik / nafis', 'Katta'], correct: 1 },
    { q: '"Break the ice" qachon aytiladi?', options: ['Suhbatni iliq boshlashda', 'Janjalda', 'Yugurishda'], correct: 0 },
    { q: '"Resilient" so\'zi ma\'nosi:', options: ['Chidamli', 'Qo\'rqoq', 'Dangasa'], correct: 0 },
    { q: '"Once in a blue moon" nimani bildiradi?', options: ['Har kun', 'Kamdan-kam', 'Doimo'], correct: 1 },
    { q: '"Articulate" so\'zi ma\'nosi:', options: ['Fikrini aniq aytuvchi', 'Tushunarsiz', 'Jimjit'], correct: 0 }
  ];

  const typingRaceDeck = [
    { meaning: 'juda mazali', definition: 'extremely tasty', answer: 'scrumptious' },
    { meaning: 'qayta orttirmoq', definition: 'to get back something that you had lost', answer: 'regain' },
    { meaning: 'ravon va erkin so\'zlaydigan', definition: 'able to speak a language easily and smoothly', answer: 'fluent' },
    { meaning: 'signal yoki nur chiqarmoq', definition: 'to send out light, heat, sound, or a signal', answer: 'emit' },
    { meaning: 'qisqa va lo\'nda', definition: 'giving clear information in just a few words', answer: 'concise' },
    { meaning: 'chidamli va tez tiklanadigan', definition: 'able to recover quickly from difficulties', answer: 'resilient' },
    { meaning: 'nozik, sezilar-sezilmas', definition: 'delicate and not immediately obvious', answer: 'subtle' }
  ];

  const sentenceBuilderDeck = [
    {
      translation: 'O\'simliklar shikastlanganda nozik signal chiqaradi.',
      words: ['plants', 'emit', 'a', 'subtle', 'signal'],
      promptHint: 'O\'zingiz ham "signal" yoki "emit" so\'zi bilan bitta gap yozing:'
    },
    {
      translation: 'Kundalik mashq ingliz tilini ravon gapirishga yordam beradi.',
      words: ['daily', 'practice', 'makes', 'your', 'english', 'fluent'],
      promptHint: 'O\'zingiz ham "fluent" so\'zini qo\'llab bitta gap tuzing:'
    },
    {
      translation: 'Tabassum yangi uchrashuvda noqulaylikni yo\'qotishga yordam beradi.',
      words: ['a', 'warm', 'smile', 'helps', 'break', 'the', 'ice'],
      promptHint: 'O\'zingiz "break the ice" bilan qisqa gap yozing:'
    }
  ];

  const quizGames = [
    {
      id: 'vocab-blitz',
      title: 'Speed Vocabulary Blitz',
      desc: '60 soniya ichida inglizcha speaking so\'zlarini tanlang — har bir bosilgan so\'z ingliz tilida talaffuz qilinadi!',
      icon: 'timer',
      color: 'from-blue-500 to-indigo-600',
      players: '1,420 talaba',
      questions: [
        { q: '"Ravon, erkin so\'zlaydigan" so\'zining inglizchasi:', options: ['Fluent', 'Silent', 'Hesitant'], correct: 0 },
        { q: '"Eloquent" so\'ziga eng yaqin inglizcha sinonim:', options: ['Boring', 'Articulate', 'Dull'], correct: 1 },
        { q: '"Fikrni aniq yetkazish" phrasal verbi:', options: ['Get across', 'Turn off', 'Walk away'], correct: 0 }
      ]
    },
    {
      id: 'idiom-matcher',
      title: 'Idiom & Slang Matcher',
      desc: 'Iboralarni tanlang, inglizcha talaffuzini tinglang va XP yuting.',
      icon: 'extension',
      color: 'from-emerald-500 to-teal-600',
      players: '890 talaba',
      questions: [
        { q: 'Suhbatdagi noqulaylikni yo\'qotish iborasi:', options: ['Chase clouds', 'Break the ice', 'Sleep tight'], correct: 1 },
        { q: '"Juda oson ish" ma\'nosidagi inglizcha idioma:', options: ['Piece of cake', 'Hard rock', 'Heavy rain'], correct: 0 },
        { q: 'Aynan to\'g\'ri fikrni topib aytganda qaysi idioma ishlatiladi?', options: ['Lose the plot', 'Hit the nail on the head', 'Miss the boat'], correct: 1 }
      ]
    },
    {
      id: 'word-scramble',
      title: 'Word Scramble Speaking',
      desc: 'Aralash harflardan akademik va jonli inglizcha so\'zlarni toping.',
      icon: 'spellcheck',
      color: 'from-amber-500 to-orange-600',
      players: '2,100 talaba',
      questions: [
        { q: 'Harflardan to\'g\'ri so\'z tuzing: C - O - N - F - I - D - E - N - T', options: ['Confident', 'Conflict', 'Condition'], correct: 0 },
        { q: 'Harflardan to\'g\'ri so\'z tuzing: P - R - O - N - U - N - C - I - A - T - I - O - N', options: ['Pronounce', 'Pronunciation', 'Production'], correct: 1 },
        { q: 'Harflardan to\'g\'ri so\'z tuzing: D - I - A - L - O - G - U - E', options: ['Dialogue', 'Diagram', 'Dialect'], correct: 0 }
      ]
    },
    {
      id: 'accent-quiz',
      title: 'Pronunciation & Accent Quiz',
      desc: 'Minimal juftliklar va inglizcha talaffuz bo\'yicha tezkor musobaqa.',
      icon: 'record_voice_over',
      color: 'from-purple-500 to-rose-600',
      players: '750 talaba',
      questions: [
        { q: 'Qaysi so\'zda "th" tovushi jarangli (voiced /ð/) aytiladi?', options: ['Think', 'This', 'Three'], correct: 1 },
        { q: '"Confidence" so\'zi bilan bog\'liq to\'g\'ri so\'zni tanlang:', options: ['Confident', 'Confusion', 'Conclude'], correct: 0 },
        { q: 'Silent letter ("t" o\'qilmaydigan) so\'z qaysi?', options: ['Speak', 'Listen', 'Start'], correct: 1 }
      ]
    }
  ];

  // Saved personal best times (Image 3 style)
  const [bestMatchTime, setBestMatchTime] = useState(() => {
    try { return localStorage.getItem('games_best_matching_sec') || '19.9s'; } catch (e) { return '19.9s'; }
  });
  const [bestTypingTime, setBestTypingTime] = useState(() => {
    try { return localStorage.getItem('games_best_typing_sec') || '35.7s'; } catch (e) { return '35.7s'; }
  });

  // Active Mode State: null | 'flashcards' | 'multiple-choice' | 'matching-pairs' | 'fill-gap' | 'word-rush' | 'typing-race' | 'sentence-builder' | 'quiz'
  const [activeMode, setActiveMode] = useState(null);
  const [activeQuizGame, setActiveQuizGame] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [submittingGame, setSubmittingGame] = useState(false);

  // Flashcards states
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcKnown, setFcKnown] = useState(0);
  const [fcLearning, setFcLearning] = useState(0);
  const [fcDragX, setFcDragX] = useState(0);
  const [fcDragStartX, setFcDragStartX] = useState(null);

  // Multiple choice / Quiz states (with Right/Wrong badge + automatic English speech!)
  const [mcqIndex, setMcqIndex] = useState(0);
  const [mcqCorrectCount, setMcqCorrectCount] = useState(0);
  const [mcqFeedback, setMcqFeedback] = useState(null); // { selectedIdx, isCorrect, spokenWord }

  // Matching pairs states
  const [matchLeftIdx, setMatchLeftIdx] = useState(null);
  const [matchRightPool, setMatchRightPool] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [matchErrorPair, setMatchErrorPair] = useState(null);
  const [matchStartMs, setMatchStartMs] = useState(0);
  const [matchElapsed, setMatchElapsed] = useState(0);

  // Fill the gap states
  const [gapIndex, setGapIndex] = useState(0);
  const [gapCorrect, setGapCorrect] = useState(0);
  const [gapFeedback, setGapFeedback] = useState(null);

  // Word Rush states (60s timer, +1s right, -3s wrong)
  const [rushTimeLeft, setRushTimeLeft] = useState(60);
  const [rushIdx, setRushIdx] = useState(0);
  const [rushCorrect, setRushCorrect] = useState(0);
  const [rushTotal, setRushTotal] = useState(0);
  const [rushFlash, setRushFlash] = useState(null);

  // Typing race states
  const [typeIdx, setTypeIdx] = useState(0);
  const [typeInput, setTypeInput] = useState('');
  const [typeFeedback, setTypeFeedback] = useState(null);
  const [typeCorrect, setTypeCorrect] = useState(0);
  const [typeStartMs, setTypeStartMs] = useState(0);
  const [typeElapsed, setTypeElapsed] = useState(0);
  const [typeShake, setTypeShake] = useState(false);
  const typingInputRef = useRef(null);
  const typeAdvanceTimerRef = useRef(null);

  // Sentence builder states
  const [sbIdx, setSbIdx] = useState(0);
  const [sbBank, setSbBank] = useState([]);
  const [sbSelected, setSbSelected] = useState([]);
  const [sbFeedback, setSbFeedback] = useState(null);
  const [sbOwnSentence, setSbOwnSentence] = useState('');
  const [sbCorrectCount, setSbCorrectCount] = useState(0);

  const finishAndAward = async ({ gameKey, title, score, total, extraLabel = '' }) => {
    setSubmittingGame(true);
    if (gameKey === 'typing_race' && score <= 0 && total > 0) {
      setGameResult({
        title,
        score,
        total,
        extraLabel,
        xp: 0,
        coins: 0
      });
      setSubmittingGame(false);
      return;
    }
    const ratio = total > 0 ? score / total : 1;
    const earnedXp = ratio >= 0.7 ? 35 : ratio >= 0.4 ? 25 : 15;
    const earnedCoins = ratio >= 0.7 ? 15 : ratio >= 0.4 ? 10 : 5;
    const data = await awardStudentActivity({
      type: 'games',
      eventKey: `game_${gameKey}_${Date.now()}`,
      xp: earnedXp,
      coins: earnedCoins,
      allowDuplicate: true,
      meta: { game: title, score, total }
    });
    if (data?.userStats) {
      onStatsUpdate?.(data.userStats, data.awarded || { xp: earnedXp, coins: earnedCoins }, title);
    }
    setGameResult({
      title,
      score,
      total,
      extraLabel,
      xp: data?.awarded?.xp ?? earnedXp,
      coins: data?.awarded?.coins ?? earnedCoins
    });
    setSubmittingGame(false);
  };

  useEffect(() => {
    return () => {
      if (typeAdvanceTimerRef.current) clearTimeout(typeAdvanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeMode === 'typing-race' && !gameResult) {
      const focusTimer = setTimeout(() => {
        typingInputRef.current?.focus();
      }, 40);
      return () => clearTimeout(focusTimer);
    }
  }, [activeMode, gameResult, typeIdx]);

  // Timers for Matching Pairs, Typing Race, Word Rush
  useEffect(() => {
    if (activeMode === 'matching-pairs' && !gameResult && matchStartMs > 0) {
      const iv = setInterval(() => setMatchElapsed(((Date.now() - matchStartMs) / 1000)), 100);
      return () => clearInterval(iv);
    }
    if (activeMode === 'typing-race' && !gameResult && typeStartMs > 0) {
      const iv = setInterval(() => setTypeElapsed(((Date.now() - typeStartMs) / 1000)), 100);
      return () => clearInterval(iv);
    }
  }, [activeMode, gameResult, matchStartMs, typeStartMs]);

  useEffect(() => {
    if (activeMode !== 'word-rush' || gameResult) return;
    if (rushTimeLeft <= 0) {
      finishAndAward({ gameKey: 'word_rush', title: 'Word Rush', score: rushCorrect, total: Math.max(1, rushTotal), extraLabel: `60 soniyalik marafon tugadi!` });
      return;
    }
    const timer = setTimeout(() => setRushTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(timer);
  }, [activeMode, gameResult, rushTimeLeft]);

  const shuffleArray = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const launchMode = (mode, quizGame = null) => {
    if (typeAdvanceTimerRef.current) clearTimeout(typeAdvanceTimerRef.current);
    setActiveMode(mode);
    setActiveQuizGame(quizGame);
    setGameResult(null);
    setSubmittingGame(false);

    if (mode === 'flashcards') {
      setFcIndex(0);
      setFcFlipped(false);
      setFcKnown(0);
      setFcLearning(0);
      setFcDragX(0);
      speakEnglish(flashcardDeck[0].word);
    } else if (mode === 'multiple-choice' || mode === 'quiz') {
      setMcqIndex(0);
      setMcqCorrectCount(0);
      setMcqFeedback(null);
    } else if (mode === 'matching-pairs') {
      setMatchLeftIdx(null);
      setMatchedIds([]);
      setMatchErrorPair(null);
      setMatchRightPool(shuffleArray(matchingPairsData));
      setMatchStartMs(Date.now());
      setMatchElapsed(0);
    } else if (mode === 'fill-gap') {
      setGapIndex(0);
      setGapCorrect(0);
      setGapFeedback(null);
    } else if (mode === 'word-rush') {
      setRushTimeLeft(60);
      setRushIdx(0);
      setRushCorrect(0);
      setRushTotal(0);
      setRushFlash(null);
    } else if (mode === 'typing-race') {
      setTypeIdx(0);
      setTypeInput('');
      setTypeFeedback(null);
      setTypeCorrect(0);
      setTypeShake(false);
      setTypeStartMs(Date.now());
      setTypeElapsed(0);
    } else if (mode === 'sentence-builder') {
      setSbIdx(0);
      setSbBank(shuffleArray(sentenceBuilderDeck[0].words.map((w, idx) => ({ id: `${w}_${idx}`, word: w }))));
      setSbSelected([]);
      setSbFeedback(null);
      setSbOwnSentence('');
      setSbCorrectCount(0);
    }
  };

  // Flashcard advance handler
  const handleFlashcardSwipe = (knewIt) => {
    const nextKnown = fcKnown + (knewIt ? 1 : 0);
    const nextLearning = fcLearning + (knewIt ? 0 : 1);
    setFcKnown(nextKnown);
    setFcLearning(nextLearning);
    setFcDragX(0);
    setFcFlipped(false);

    if (fcIndex + 1 < flashcardDeck.length) {
      const nextIdx = fcIndex + 1;
      setFcIndex(nextIdx);
      speakEnglish(flashcardDeck[nextIdx].word);
    } else {
      finishAndAward({
        gameKey: 'flashcards',
        title: 'Flashcards',
        score: nextKnown,
        total: flashcardDeck.length,
        extraLabel: `Bilaman: ${nextKnown} · O'rganyapman: ${nextLearning}`
      });
    }
  };

  // MCQ / Quiz Answer Handler: ALWAYS speaks selected English option & displays green Right / red Wrong
  const handleMcqSelect = (optIdx) => {
    if (mcqFeedback || submittingGame) return;
    const questions = activeMode === 'multiple-choice' ? multipleChoiceDeck : (activeQuizGame?.questions || []);
    const currentQ = questions[mcqIndex];
    if (!currentQ) return;

    const chosenText = currentQ.options[optIdx];
    speakEnglish(chosenText);

    const isCorrect = optIdx === currentQ.correct;
    const nextScore = mcqCorrectCount + (isCorrect ? 1 : 0);
    setMcqCorrectCount(nextScore);
    setMcqFeedback({
      selectedIdx: optIdx,
      correctIdx: currentQ.correct,
      isCorrect,
      spokenWord: chosenText
    });

    setTimeout(() => {
      setMcqFeedback(null);
      if (mcqIndex + 1 < questions.length) {
        setMcqIndex(mcqIndex + 1);
      } else {
        finishAndAward({
          gameKey: activeMode === 'multiple-choice' ? 'multiple_choice' : activeQuizGame.id,
          title: activeMode === 'multiple-choice' ? 'Multiple choice' : activeQuizGame.title,
          score: nextScore,
          total: questions.length
        });
      }
    }, 1150);
  };

  // Matching Pairs Handler
  const handleRightMatchClick = (rightItem) => {
    if (matchLeftIdx === null || matchedIds.includes(rightItem.id)) return;
    const leftItem = matchingPairsData[matchLeftIdx];
    if (leftItem.id === rightItem.id) {
      const nextMatched = [...matchedIds, leftItem.id];
      setMatchedIds(nextMatched);
      setMatchLeftIdx(null);
      if (nextMatched.length === matchingPairsData.length) {
        const finalSec = Number(((Date.now() - matchStartMs) / 1000).toFixed(1));
        const prevBestNum = parseFloat(bestMatchTime) || 999;
        if (finalSec < prevBestNum) {
          const formatted = `${finalSec}s`;
          setBestMatchTime(formatted);
          try { localStorage.setItem('games_best_matching_sec', formatted); } catch (e) {}
        }
        finishAndAward({
          gameKey: 'matching_pairs',
          title: 'Matching pairs',
          score: matchingPairsData.length,
          total: matchingPairsData.length,
          extraLabel: `Sarflangan vaqt: ${finalSec}s`
        });
      }
    } else {
      setMatchErrorPair({ leftId: leftItem.id, rightId: rightItem.id });
      setTimeout(() => {
        setMatchErrorPair(null);
        setMatchLeftIdx(null);
      }, 650);
    }
  };

  const featuredSevenGames = [
    {
      id: 'flashcards',
      title: 'Flashcards',
      desc: 'Tap to flip. Swipe right if you know it, left if you are still learning.',
      footer: '👈 swipe',
      gradient: 'from-[#5246E5] via-[#4651EC] to-[#2563EB]',
      badgeBg: 'bg-white/20',
      iconSvg: (
        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="3" width="13" height="17" rx="2.5" fill="white" fillOpacity="0.2" />
          <path d="M17 7h1.5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-1" />
          <polygon points="10.5 9 13 11.5 10.5 14 8 11.5" fill="white" />
        </svg>
      )
    },
    {
      id: 'multiple-choice',
      title: 'Multiple choice',
      desc: 'See the word, pick its meaning — or the other way round.',
      footer: 'A · B · C · D',
      gradient: 'from-[#0684D6] via-[#0274BE] to-[#1E40AF]',
      badgeBg: 'bg-emerald-500',
      iconSvg: (
        <div className="w-8 h-8 rounded-lg bg-emerald-500 shadow-md flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )
    },
    {
      id: 'matching-pairs',
      title: 'Matching pairs',
      desc: 'Six words, six meanings. Match them as fast as you can.',
      footer: `⏱ best ${bestMatchTime}`,
      gradient: 'from-[#10B981] via-[#059669] to-[#15803D]',
      badgeBg: 'bg-white/20',
      iconSvg: (
        <svg className="w-7 h-7 text-lime-200" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7s2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z" />
        </svg>
      )
    },
    {
      id: 'fill-gap',
      title: 'Fill the gap',
      desc: 'The real sentence you met the word in — with the word missing.',
      footer: '"... a ___ signal"',
      gradient: 'from-[#F59E0B] via-[#EA580C] to-[#C2410C]',
      badgeBg: 'bg-white/20',
      iconSvg: (
        <svg className="w-7 h-7 text-amber-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" fill="white" fillOpacity="0.22" />
        </svg>
      )
    },
    {
      id: 'word-rush',
      title: 'Word Rush',
      desc: '60 seconds. Every right answer adds a second, every wrong one costs three.',
      footer: '⏱ 60s · +1s',
      gradient: 'from-[#E11D48] via-[#DC2626] to-[#9F1239]',
      badgeBg: 'bg-white/20',
      iconSvg: (
        <svg className="w-7 h-7 text-amber-300" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      )
    },
    {
      id: 'typing-race',
      title: 'Typing race',
      desc: 'See the meaning, type the English word — against the clock.',
      footer: `🏁 best ${bestTypingTime}`,
      gradient: 'from-[#8B5CF6] via-[#7C3AED] to-[#4338CA]',
      badgeBg: 'bg-white/20',
      iconSvg: (
        <svg className="w-8 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2.5" fill="white" fillOpacity="0.22" />
          <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
        </svg>
      )
    },
    {
      id: 'sentence-builder',
      title: 'Sentence builder',
      desc: 'Put the real sentence back in order, then write one of your own.',
      footer: 'plants · emit · ...',
      gradient: 'from-[#EC4899] via-[#DB2777] to-[#BE185D]',
      badgeBg: 'bg-white/20',
      iconSvg: (
        <svg className="w-7 h-7 text-amber-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 2 7l10 5 10-5-10-5z" fill="white" fillOpacity="0.3" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in font-sans pb-16">
      <div className="border-b border-outline-variant/60 pb-4">
        <h1 className="font-outfit text-3xl font-black text-on-surface tracking-tight flex items-center gap-2.5">
          <svg className="w-8 h-8 text-purple-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" /><circle cx="15" cy="13" r="0.8" fill="currentColor" /><circle cx="18" cy="11" r="0.8" fill="currentColor" /><rect x="2" y="6" width="20" height="12" rx="4" />
          </svg>
          <span>Educational English Speaking Games</span>
        </h1>
        <p className="text-xs text-outline mt-1 font-medium">
          7 ta interaktiv o'yin va speaking mashqlari orqali so'z boyligingiz va inglizcha talaffuzingizni oshiring, XP va coinlar yuting!
        </p>
      </div>

      {/* 3-RASMDAGI 7 TA INTERAKTIV O'YIN CARDLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {featuredSevenGames.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => launchMode(card.id)}
            className={`game-gradient-card group text-left rounded-2xl p-5 bg-gradient-to-br ${card.gradient} text-white shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 flex flex-col justify-between min-h-[215px] cursor-pointer relative overflow-hidden`}
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="space-y-3 relative z-10">
              <div className="h-9 flex items-center">{card.iconSvg}</div>
              <div>
                <h3 className="font-outfit font-extrabold text-lg leading-tight text-white">
                  {card.title}
                </h3>
                <p className="text-[12px] text-white/85 mt-1.5 leading-snug font-medium">
                  {card.desc}
                </p>
              </div>
            </div>
            <div className="pt-4 mt-2 flex items-center justify-between text-[11px] font-bold text-white/95 relative z-10">
              <span>{card.footer}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">Boshlash →</span>
            </div>
          </button>
        ))}
      </div>

      {/* Qo'shimcha Speaking & Vocabulary Quiz Cardlari */}
      <div className="space-y-4 pt-2">
        <h2 className="font-outfit text-lg font-black text-on-surface flex items-center gap-2">
          <span>🎙️</span>
          <span>Speaking & Pronunciation Viktorinalari</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {quizGames.map((g) => (
            <div
              key={g.id}
              className="rounded-3xl p-6 bg-surface border border-outline-variant hover:border-purple-400 hover:shadow-lg transition-all flex flex-col justify-between gap-4 group"
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${g.color} text-white flex items-center justify-center shrink-0 shadow-md`}>
                  <span className="material-symbols-outlined text-[28px]">{g.icon}</span>
                </div>
                <div>
                  <h3 className="font-outfit font-black text-lg text-on-surface">{g.title}</h3>
                  <p className="text-xs text-outline mt-1 leading-relaxed">{g.desc}</p>
                  <span className="text-[10px] font-bold text-slate-400 mt-2 block">{g.players} · +35 XP gacha · Auto English Speech 🔊</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => launchMode('quiz', g)}
                className="w-full py-2.5 rounded-xl bg-primary hover:opacity-95 text-white font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95"
              >
                O'yinni boshlash ▶
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* INTERACTIVE GAME MODAL */}
      {activeMode && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className={`bg-surface border border-outline-variant rounded-3xl w-full ${activeMode === 'typing-race' ? 'max-w-2xl' : 'max-w-xl'} p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <h3 className="font-outfit font-black text-lg text-on-surface">
                  {activeMode === 'flashcards' ? '🃏 Flashcards (Speech & Swipe)'
                    : activeMode === 'multiple-choice' ? '✅ Multiple choice (English Speech)'
                    : activeMode === 'matching-pairs' ? '🧩 Matching pairs'
                    : activeMode === 'fill-gap' ? '✏️ Fill the gap'
                    : activeMode === 'word-rush' ? '⚡ Word Rush (60s)'
                    : activeMode === 'typing-race' ? '⌨️ Typing race'
                    : activeMode === 'sentence-builder' ? '🧱 Sentence builder'
                    : activeQuizGame?.title}
                </h3>
                {activeMode === 'word-rush' && !gameResult && (
                  <p className="text-xs font-extrabold text-rose-500">⏱ Qolgan vaqt: {rushTimeLeft}s · To'g'ri: {rushCorrect}</p>
                )}
                {activeMode === 'matching-pairs' && !gameResult && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">⏱ Vaqt: {matchElapsed.toFixed(1)}s · Juftlangan: {matchedIds.length}/{matchingPairsData.length}</p>
                )}
                {activeMode === 'typing-race' && !gameResult && (
                  <p className="text-xs font-bold text-purple-500">⏱ Vaqt: {typeElapsed.toFixed(1)}s · So'z {typeIdx + 1}/{typingRaceDeck.length}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (typeAdvanceTimerRef.current) clearTimeout(typeAdvanceTimerRef.current);
                  setActiveMode(null);
                  setGameResult(null);
                }}
                aria-label="Yopish"
                className="w-8 h-8 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* RESULT SCREEN */}
            {gameResult ? (
              <div className="text-center space-y-4 py-3">
                <div className="text-5xl">🏆</div>
                <h4 className="font-outfit font-black text-2xl text-on-surface">
                  Natija: {gameResult.score} / {gameResult.total}
                </h4>
                {gameResult.extraLabel && (
                  <p className="text-xs font-bold text-outline">{gameResult.extraLabel}</p>
                )}
                <p className="text-sm font-medium text-on-surface">
                  Yutug'ingiz: <span className="font-black text-primary">+{gameResult.xp} XP</span> va <span className="font-black text-amber-500">+{gameResult.coins} Coin 🪙</span>
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => launchMode(activeMode, activeQuizGame)}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-xs cursor-pointer hover:opacity-95"
                  >
                    Qayta o'ynash
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveMode(null); setGameResult(null); }}
                    className="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs cursor-pointer"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            ) : activeMode === 'flashcards' ? (
              /* MODE 1: FLASHCARDS WITH SPEECH & SWIPE */
              (() => {
                const card = flashcardDeck[fcIndex];
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-outline">
                      <span>Karta {fcIndex + 1} / {flashcardDeck.length}</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Bilaman: {fcKnown} · O'rganyapman: {fcLearning}</span>
                    </div>

                    <div
                      onPointerDown={(e) => setFcDragStartX(e.clientX)}
                      onPointerMove={(e) => {
                        if (fcDragStartX !== null) setFcDragX(e.clientX - fcDragStartX);
                      }}
                      onPointerUp={() => {
                        if (fcDragX > 70) handleFlashcardSwipe(true);
                        else if (fcDragX < -70) handleFlashcardSwipe(false);
                        else if (Math.abs(fcDragX) < 10) setFcFlipped((f) => !f);
                        setFcDragStartX(null);
                        setFcDragX(0);
                      }}
                      style={{ transform: `translateX(${fcDragX}px) rotate(${fcDragX * 0.04}deg)` }}
                      className="select-none cursor-pointer rounded-3xl p-7 min-h-[210px] bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl flex flex-col items-center justify-center text-center gap-3 transition-transform"
                    >
                      {!fcFlipped ? (
                        <>
                          <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/15 font-bold">
                            {card.pos}
                          </span>
                          <h4 className="font-outfit text-3xl font-black tracking-tight">{card.word}</h4>
                          <p className="text-xs font-mono text-white/80">{card.phonetic}</p>
                          <p className="text-[11px] text-white/75 mt-2">Ma'nosini ko'rish uchun ustiga bosing (Tap to flip)</p>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-400/25 text-emerald-100 font-bold">
                            Tarjima va misol
                          </span>
                          <h4 className="font-outfit text-xl font-black">{card.meaning}</h4>
                          <p className="text-xs italic text-white/90 max-w-sm">"{card.example}"</p>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => speakEnglish(card.word)}
                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/25 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-primary/15"
                      >
                        <span>🔊</span>
                        <span>So'zni eshitish ({card.word})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => speakEnglish(card.example)}
                        className="px-4 py-2 rounded-xl bg-surface-container text-on-surface border border-outline-variant font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-surface-container-high"
                      >
                        <span>🎙️</span>
                        <span>Misol gapni eshitish</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleFlashcardSwipe(false)}
                        className="py-3 rounded-2xl border border-amber-400/50 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs cursor-pointer"
                      >
                        ← Hali o'rganyapman (Left)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlashcardSwipe(true)}
                        className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md cursor-pointer"
                      >
                        Bilaman ✓ (Right) →
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (activeMode === 'multiple-choice' || activeMode === 'quiz') ? (
              /* MODE 2: MULTIPLE CHOICE & SPEAKING QUIZ WITH AUTOMATIC ENGLISH SPEECH + RIGHT / WRONG */
              (() => {
                const questions = activeMode === 'multiple-choice' ? multipleChoiceDeck : (activeQuizGame?.questions || []);
                const currentQ = questions[mcqIndex];
                if (!currentQ) return null;
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-outline">
                      <span>Savol {mcqIndex + 1} / {questions.length}</span>
                      <span>To'g'ri: {mcqCorrectCount}</span>
                    </div>
                    <p className="font-outfit font-bold text-base text-on-surface leading-snug">
                      {currentQ.prompt || currentQ.q}
                    </p>
                    <div className="space-y-2.5">
                      {currentQ.options.map((opt, idx) => {
                        const isPicked = mcqFeedback?.selectedIdx === idx;
                        const isCorrectOpt = idx === currentQ.correct;
                        let btnStyle = 'border-outline-variant bg-surface-container hover:border-primary hover:bg-primary/10 text-on-surface';
                        if (mcqFeedback) {
                          if (isPicked && mcqFeedback.isCorrect) {
                            btnStyle = 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/40';
                          } else if (isPicked && !mcqFeedback.isCorrect) {
                            btnStyle = 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/40';
                          } else if (isCorrectOpt) {
                            btnStyle = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
                          }
                        }
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={Boolean(mcqFeedback) || submittingGame}
                            onClick={() => handleMcqSelect(idx)}
                            className={`w-full p-3.5 text-left rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-2 ${btnStyle}`}
                          >
                            <span>{String.fromCharCode(65 + idx)}. {opt}</span>
                            <span className="text-[11px] opacity-70 shrink-0">🔊</span>
                          </button>
                        );
                      })}
                    </div>

                    {mcqFeedback && (
                      <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 animate-fade-in ${
                        mcqFeedback.isCorrect
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300'
                      }`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`px-3 py-1 rounded-full text-xs font-black text-white uppercase tracking-wide ${
                            mcqFeedback.isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}>
                            {mcqFeedback.isCorrect ? 'Right' : 'Wrong'}
                          </span>
                          <span className="text-xs font-bold">
                            🔊 Spoken: "{mcqFeedback.spokenWord}"
                            {!mcqFeedback.isCorrect && ` · To'g'risi: ${currentQ.options[mcqFeedback.correctIdx]}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : activeMode === 'matching-pairs' ? (
              /* MODE 3: MATCHING PAIRS (6 WORDS, 6 MEANINGS) */
              <div className="space-y-4">
                <p className="text-xs text-outline font-medium">
                  Chap ustundagi inglizcha so'zni tanlang, so'ngra o'ng ustundagi o'zbekcha ma'nosi bilan juftlang.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    {matchingPairsData.map((item, idx) => {
                      const done = matchedIds.includes(item.id);
                      const selected = matchLeftIdx === idx;
                      const isErr = matchErrorPair?.leftId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={done}
                          onClick={() => {
                            setMatchLeftIdx(idx);
                            speakEnglish(item.word);
                          }}
                          className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                            done
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 opacity-70'
                              : isErr
                                ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                                : selected
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'bg-surface-container border-outline-variant text-on-surface hover:border-primary'
                          }`}
                        >
                          <span>{item.word}</span>
                          <span>{done ? '✓' : '🔊'}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="space-y-2">
                    {matchRightPool.map((item) => {
                      const done = matchedIds.includes(item.id);
                      const isErr = matchErrorPair?.rightId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={done}
                          onClick={() => handleRightMatchClick(item)}
                          className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                            done
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 opacity-70'
                              : isErr
                                ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400'
                                : 'bg-surface-container border-outline-variant text-on-surface hover:border-emerald-500'
                          }`}
                        >
                          {item.meaning}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : activeMode === 'fill-gap' ? (
              /* MODE 4: FILL THE GAP */
              (() => {
                const q = fillGapDeck[gapIndex];
                if (!q) return null;
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold text-outline">
                      <span>Gap {gapIndex + 1} / {fillGapDeck.length}</span>
                      <span>Ma'nosi: {q.hint}</span>
                    </div>
                    <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant text-base font-bold text-on-surface leading-relaxed">
                      {q.before}{' '}
                      <span className="px-3 py-0.5 mx-1 rounded-lg border-2 border-dashed border-amber-500 text-amber-600 dark:text-amber-400">
                        {gapFeedback ? q.options[q.correct] : '______'}
                      </span>{' '}
                      {q.after}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      {q.options.map((opt, idx) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={Boolean(gapFeedback)}
                          onClick={() => {
                            const ok = idx === q.correct;
                            speakEnglish(`${q.before} ${opt} ${q.after}`);
                            const nextOk = gapCorrect + (ok ? 1 : 0);
                            setGapCorrect(nextOk);
                            setGapFeedback({ ok, picked: opt, rightWord: q.options[q.correct] });
                            setTimeout(() => {
                              setGapFeedback(null);
                              if (gapIndex + 1 < fillGapDeck.length) {
                                setGapIndex(gapIndex + 1);
                              } else {
                                finishAndAward({ gameKey: 'fill_gap', title: 'Fill the gap', score: nextOk, total: fillGapDeck.length });
                              }
                            }, 1200);
                          }}
                          className="p-3.5 rounded-xl border border-outline-variant bg-surface hover:border-amber-500 text-xs font-bold text-on-surface cursor-pointer"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {gapFeedback && (
                      <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        gapFeedback.ok ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-300'
                      }`}>
                        <span className={`px-2.5 py-0.5 rounded-full text-white ${gapFeedback.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                          {gapFeedback.ok ? 'Right' : 'Wrong'}
                        </span>
                        <span>{gapFeedback.ok ? 'Zo\'r! To\'g\'ri so\'z tanlandi.' : `To'g'ri so'z: ${gapFeedback.rightWord}`}</span>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : activeMode === 'word-rush' ? (
              /* MODE 5: WORD RUSH (60s, +1s RIGHT, -3s WRONG) */
              (() => {
                const q = wordRushBank[rushIdx % wordRushBank.length];
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25">
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        To'g'ri: +1s ⚡ | Xato: -3s
                      </span>
                      <div className="flex items-center gap-2">
                        {rushFlash && (
                          <span className={`text-xs font-black px-2 py-0.5 rounded ${rushFlash.ok ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                            {rushFlash.ok ? 'Right +1s' : 'Wrong -3s'}
                          </span>
                        )}
                        <span className="font-outfit font-black text-xl text-rose-600 dark:text-rose-400">{rushTimeLeft}s</span>
                      </div>
                    </div>
                    <h4 className="font-outfit font-bold text-lg text-on-surface">{q.q}</h4>
                    <div className="space-y-2">
                      {q.options.map((opt, idx) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const ok = idx === q.correct;
                            speakEnglish(opt);
                            setRushTotal((n) => n + 1);
                            if (ok) {
                              setRushCorrect((n) => n + 1);
                              setRushTimeLeft((t) => t + 1);
                            } else {
                              setRushTimeLeft((t) => Math.max(0, t - 3));
                            }
                            setRushFlash({ ok });
                            setRushIdx((n) => n + 1);
                          }}
                          className="w-full p-3.5 text-left rounded-2xl border border-outline-variant bg-surface-container hover:border-rose-500 text-xs font-bold text-on-surface cursor-pointer"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : activeMode === 'typing-race' ? (
              /* MODE 6: TYPING RACE (LETTER TILES: GREEN ON CORRECT LETTER, RED ON WRONG LETTER) */
              (() => {
                const item = typingRaceDeck[typeIdx];
                if (!item) return null;
                const letters = item.answer.split('');
                const completedProgress = ((typeIdx + (typeFeedback?.ok ? 1 : 0)) / typingRaceDeck.length) * 100;

                const finishTypingGame = (finalScore) => {
                  const finalSec = Number(((Date.now() - typeStartMs) / 1000).toFixed(1));
                  const prevBest = parseFloat(bestTypingTime) || 999;
                  if (finalScore >= Math.ceil(typingRaceDeck.length / 2) && finalSec < prevBest) {
                    const formatted = `${finalSec}s`;
                    setBestTypingTime(formatted);
                    try { localStorage.setItem('games_best_typing_sec', formatted); } catch (err) {}
                  }
                  finishAndAward({
                    gameKey: 'typing_race',
                    title: 'Typing race',
                    score: finalScore,
                    total: typingRaceDeck.length,
                    extraLabel: `Vaqt: ${finalSec}s · To'g'ri yozilgan: ${finalScore}/${typingRaceDeck.length}`
                  });
                };

                const handleTypingInputChange = (e) => {
                  if (typeFeedback || submittingGame) return;
                  const target = item.answer;
                  const sanitized = e.target.value.replace(/\s+/g, '').slice(0, target.length);
                  setTypeInput(sanitized);

                  if (sanitized.length === target.length && sanitized.toLowerCase() === target.toLowerCase()) {
                    const nextOk = typeCorrect + 1;
                    setTypeCorrect(nextOk);
                    setTypeFeedback({ ok: true, answer: target });
                    speakEnglish(target);
                    if (typeAdvanceTimerRef.current) clearTimeout(typeAdvanceTimerRef.current);
                    typeAdvanceTimerRef.current = setTimeout(() => {
                      setTypeFeedback(null);
                      setTypeInput('');
                      if (typeIdx + 1 < typingRaceDeck.length) {
                        setTypeIdx((idx) => idx + 1);
                      } else {
                        finishTypingGame(nextOk);
                      }
                    }, 550);
                  }
                };

                const handleTypingSkip = () => {
                  if (typeFeedback || submittingGame) return;
                  if (typeAdvanceTimerRef.current) clearTimeout(typeAdvanceTimerRef.current);
                  setTypeInput('');
                  setTypeFeedback(null);
                  if (typeIdx + 1 < typingRaceDeck.length) {
                    setTypeIdx((idx) => idx + 1);
                  } else {
                    finishTypingGame(typeCorrect);
                  }
                };

                return (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (typeFeedback) return;
                      if (typeInput.trim().toLowerCase() !== item.answer.toLowerCase()) {
                        setTypeShake(true);
                        setTimeout(() => setTypeShake(false), 380);
                        typingInputRef.current?.focus();
                      }
                    }}
                    className="space-y-4"
                  >
                    {/* Top Progress Bar */}
                    <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.max(8, Math.round(completedProgress))}%` }}
                      />
                    </div>

                    {/* Centered Word Card (Images 1 & 2 layout) */}
                    <div
                      onClick={() => typingInputRef.current?.focus()}
                      className="dashboard-card-surface rounded-3xl border border-outline-variant/80 bg-surface dark:bg-slate-900/80 shadow-sm px-4 py-7 sm:px-8 sm:py-9 flex flex-col items-center text-center gap-5"
                    >
                      <div className="space-y-1.5 max-w-md">
                        <p className="text-xs sm:text-sm font-medium text-outline">
                          Type the English word for
                        </p>
                        <h4 className="typing-race-target-meaning font-outfit font-black text-2xl sm:text-3xl tracking-tight text-indigo-600 dark:text-indigo-400">
                          {item.meaning}
                        </h4>
                        <p className="text-xs sm:text-sm font-medium text-outline">
                          {item.definition}
                        </p>
                      </div>

                      {/* Letter Boxes Row */}
                      <div className={`flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 ${typeShake ? 'animate-pulse' : ''}`}>
                        {letters.map((targetChar, idx) => {
                          const typedChar = typeInput[idx] || '';
                          const hasTyped = idx < typeInput.length;
                          const isCorrectChar = hasTyped && typedChar.toLowerCase() === targetChar.toLowerCase();
                          const isWrongChar = hasTyped && !isCorrectChar;
                          return (
                            <div
                              key={idx}
                              aria-label={`Katak ${idx + 1}`}
                              className={`typing-race-tile w-9 h-10 sm:w-10 sm:h-11 rounded-xl border-2 flex items-center justify-center font-outfit font-bold text-base sm:text-lg lowercase transition-all duration-150 select-none ${
                                isCorrectChar
                                  ? 'typing-tile-correct border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                                  : isWrongChar
                                    ? 'typing-tile-wrong border-rose-500 bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 ring-2 ring-rose-500/20'
                                    : 'typing-tile-empty border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/75 text-transparent'
                              }`}
                            >
                              {hasTyped ? typedChar.toLowerCase() : ''}
                            </div>
                          );
                        })}
                      </div>

                      {/* Centered Input Field */}
                      <div className="w-full max-w-sm">
                        <input
                          ref={typingInputRef}
                          type="text"
                          autoFocus
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          readOnly={Boolean(typeFeedback)}
                          value={typeInput}
                          onChange={handleTypingInputChange}
                          aria-label="Inglizcha so'zni yozing"
                          className={`typing-race-input w-full h-11 sm:h-12 px-4 rounded-xl text-center font-outfit font-bold text-base sm:text-lg text-on-surface bg-surface-container/75 border-2 transition-all focus:outline-hidden ${
                            typeFeedback?.ok
                              ? 'typing-input-complete border-emerald-500/75'
                              : 'border-blue-600/80 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/15'
                          }`}
                        />
                      </div>

                      {/* Skip -> Button */}
                      <button
                        type="button"
                        disabled={Boolean(typeFeedback) || submittingGame}
                        onClick={handleTypingSkip}
                        className="typing-race-skip-btn px-5 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/80 text-on-surface font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        Skip →
                      </button>
                    </div>
                  </form>
                );
              })()
            ) : activeMode === 'sentence-builder' ? (
              /* MODE 7: SENTENCE BUILDER */
              (() => {
                const cur = sentenceBuilderDeck[sbIdx];
                if (!cur) return null;
                return (
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs font-bold text-outline">
                      <span>Gap {sbIdx + 1} / {sentenceBuilderDeck.length}</span>
                      <span>Tarjimasi: {cur.translation}</span>
                    </div>

                    {/* Built sentence tray */}
                    <div className="min-h-[60px] p-3 rounded-2xl bg-surface-container border-2 border-dashed border-outline-variant flex flex-wrap gap-2 items-center">
                      {sbSelected.length === 0 ? (
                        <span className="text-xs text-outline">Pastdagi so'zlarni to'g'ri tartibda bosing...</span>
                      ) : (
                        sbSelected.map((tok) => (
                          <button
                            key={tok.id}
                            type="button"
                            onClick={() => {
                              setSbSelected((prev) => prev.filter((x) => x.id !== tok.id));
                              setSbBank((prev) => [...prev, tok]);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer"
                          >
                            {tok.word} ×
                          </button>
                        ))
                      )}
                    </div>

                    {/* Word bank */}
                    <div className="flex flex-wrap gap-2">
                      {sbBank.map((tok) => (
                        <button
                          key={tok.id}
                          type="button"
                          onClick={() => {
                            speakEnglish(tok.word);
                            setSbBank((prev) => prev.filter((x) => x.id !== tok.id));
                            setSbSelected((prev) => [...prev, tok]);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-surface border border-outline-variant hover:border-pink-500 text-xs font-bold text-on-surface cursor-pointer"
                        >
                          {tok.word}
                        </button>
                      ))}
                    </div>

                    {/* Write one of your own */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-outline block">{cur.promptHint}</label>
                      <input
                        type="text"
                        value={sbOwnSentence}
                        onChange={(e) => setSbOwnSentence(e.target.value)}
                        placeholder="Masalan: Plants emit a subtle signal..."
                        className="w-full px-3.5 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-on-surface"
                      />
                    </div>

                    {sbFeedback && (
                      <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        sbFeedback.ok ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-300'
                      }`}>
                        <span className={`px-2.5 py-0.5 rounded-full text-white ${sbFeedback.ok ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                          {sbFeedback.ok ? 'Right' : 'Wrong'}
                        </span>
                        <span>To'g'ri gap: "{cur.words.join(' ')}"</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={sbSelected.length === 0 || Boolean(sbFeedback)}
                      onClick={() => {
                        const targetStr = cur.words.join(' ').toLowerCase();
                        const builtStr = sbSelected.map((x) => x.word).join(' ').toLowerCase();
                        const ok = builtStr === targetStr;
                        speakEnglish(cur.words.join(' '));
                        const nextScore = sbCorrectCount + (ok ? 1 : 0);
                        setSbCorrectCount(nextScore);
                        setSbFeedback({ ok });
                        setTimeout(() => {
                          setSbFeedback(null);
                          setSbOwnSentence('');
                          if (sbIdx + 1 < sentenceBuilderDeck.length) {
                            const nextI = sbIdx + 1;
                            setSbIdx(nextI);
                            setSbBank(shuffleArray(sentenceBuilderDeck[nextI].words.map((w, idx) => ({ id: `${w}_${idx}`, word: w }))));
                            setSbSelected([]);
                          } else {
                            finishAndAward({ gameKey: 'sentence_builder', title: 'Sentence builder', score: nextScore, total: sentenceBuilderDeck.length });
                          }
                        }, 1300);
                      }}
                      className="w-full py-3 rounded-xl bg-primary text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                    >
                      Gapni tekshirish
                    </button>
                  </div>
                );
              })()
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 4. BATTLE VIEW (Real 2-Player Live Matchmaking + Push + 5 MCQ + Coins) ====================
export function BattleView({ profile, onStatsUpdate, focusBattleId, onClearFocusBattle }) {
  const [battleData, setBattleData] = useState({
    opponents: [],
    activeBattle: null,
    incomingInvites: [],
    outgoingPending: null,
    latestCompleted: null,
    history: []
  });
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState('');
  const [statusError, setStatusError] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState(null); // { qIndex, selectedIdx, correctIdx, isCorrect, coins }
  const [viewedCompletedBattle, setViewedCompletedBattle] = useState(null);
  const [watchedBattleId, setWatchedBattleId] = useState(focusBattleId || null);
  const watchedBattleIdRef = useRef(focusBattleId || null);
  useEffect(() => {
    watchedBattleIdRef.current = watchedBattleId;
  }, [watchedBattleId]);

  const authHeaders = () => {
    const token = localStorage.getItem('student_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const fetchBattles = useCallback(async (silent = false) => {
    const token = localStorage.getItem('student_token');
    if (!token) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/battle/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBattleData({
          opponents: Array.isArray(data.opponents) ? data.opponents : [],
          activeBattle: data.activeBattle || null,
          incomingInvites: Array.isArray(data.incomingInvites) ? data.incomingInvites : [],
          outgoingPending: data.outgoingPending || null,
          latestCompleted: data.latestCompleted || null,
          history: Array.isArray(data.history) ? data.history : []
        });

        // If user was watching an active battle that just completed, open its result card automatically
        const activeOrWatchedId = watchedBattleIdRef.current || data.activeBattle?.id;
        if (activeOrWatchedId && !data.activeBattle) {
          const justFinished = (data.history || []).find((b) => b.id === activeOrWatchedId && b.status === 'completed');
          if (justFinished) {
            setViewedCompletedBattle(justFinished);
          }
        }
        if (data.activeBattle?.id && watchedBattleIdRef.current !== data.activeBattle.id) {
          setWatchedBattleId(data.activeBattle.id);
        }
      }
    } catch (e) {
      console.warn('Battle fetch error:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focusBattleId) {
      watchedBattleIdRef.current = focusBattleId;
      setWatchedBattleId(focusBattleId);
      setViewedCompletedBattle(null);
      fetchBattles(true);
      onClearFocusBattle?.();
    }
  }, [focusBattleId, fetchBattles, onClearFocusBattle]);

  useEffect(() => {
    fetchBattles(false);
    const poll = setInterval(() => fetchBattles(true), 2000);

    let es = null;
    try {
      es = new EventSource(`${API_BASE}/api/system/stream`);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data || '{}');
          if (parsed.type === 'battle_invite' || parsed.type === 'battle_update') {
            fetchBattles(true);
          }
        } catch (err) {}
      };
    } catch (err) {}

    return () => {
      clearInterval(poll);
      if (es) es.close();
    };
  }, [fetchBattles]);

  const handleFindOpponent = async () => {
    setFinding(true);
    setStatusError('');
    setStatusNotice('');
    setViewedCompletedBattle(null);
    setAnswerFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/battle/find`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(selectedOpponentId ? { opponentId: selectedOpponentId } : {})
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || 'Raqib topishda xatolik yuz berdi.');
      } else {
        const b = data.battle;
        if (b?.id) {
          watchedBattleIdRef.current = b.id;
          setWatchedBattleId(b.id);
        }
        setStatusNotice(
          data.alreadyActive
            ? 'Sizda allaqachon faol battle mavjud!'
            : `Raqib topildi: ${b?.opponentName || 'Talaba'}! Uning paneliga jangni tasdiqlash uchun push bildirishnoma yuborildi.`
        );
        await fetchBattles(true);
      }
    } catch (err) {
      setStatusError('Server bilan ulanishda xatolik yuz berdi.');
    } finally {
      setFinding(false);
    }
  };

  const handleRespondInvite = async (battleId, action) => {
    setRespondingId(battleId);
    setStatusError('');
    setStatusNotice('');
    setViewedCompletedBattle(null);
    setAnswerFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/battle/${battleId}/respond`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || 'Javob yuborishda xatolik.');
      } else {
        if (action === 'accept' && data.battle?.id) {
          watchedBattleIdRef.current = data.battle.id;
          setWatchedBattleId(data.battle.id);
          setStatusNotice('Jang qabul qilindi! Ikkala talaba uchun 5 ta MCQ savol boshlandi.');
        } else {
          setStatusNotice('Jang taklifi rad etildi.');
        }
        await fetchBattles(true);
      }
    } catch (err) {
      setStatusError('Server bilan bog\'lanishda xatolik.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleCancelPending = async (battleId) => {
    try {
      await fetch(`${API_BASE}/api/battle/${battleId}/cancel`, {
        method: 'POST',
        headers: authHeaders()
      });
      setStatusNotice('Yuborilgan jang taklifi bekor qilindi.');
      setWatchedBattleId(null);
      await fetchBattles(true);
    } catch (err) {}
  };

  const handleSubmitBattleAnswer = async (battle, qIndex, selectedIdx) => {
    if (submittingAnswer || answerFeedback) return;
    const questionObj = battle.questions?.[qIndex];
    if (questionObj?.options?.[selectedIdx]) {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const text = String(questionObj.options[selectedIdx]).trim();
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'en-US';
          u.rate = 0.96;
          window.speechSynthesis.speak(u);
        }
      } catch (err) {}
    }

    setSubmittingAnswer(true);
    setStatusError('');
    try {
      const res = await fetch(`${API_BASE}/api/battle/${battle.id}/answer`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ qIndex, selectedIdx })
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || 'Javobni saqlashda xatolik.');
        setSubmittingAnswer(false);
        return;
      }

      const ok = Boolean(data.isCorrect);
      setAnswerFeedback({
        qIndex,
        selectedIdx,
        correctIdx: Number(data.correctIdx),
        isCorrect: ok,
        coins: data.awarded?.coins ?? (ok ? battle.coinPerCorrect ?? 10 : 0)
      });

      if (data.battle) {
        if (data.battle.status === 'active') {
          setBattleData((prev) => ({
            ...prev,
            activeBattle: data.battle
          }));
        } else if (data.battle.status === 'completed') {
          setViewedCompletedBattle(data.battle);
        }
      }

      if (data.userStats) {
        onStatsUpdate?.(
          data.userStats,
          data.awarded || (ok ? { xp: 10, coins: 10 } : { xp: 0, coins: 0 }),
          ok ? `⚔️ Battle to'g'ri javob (+${data.awarded?.coins ?? 10} Coin)` : ''
        );
      }

      setTimeout(async () => {
        if (data.battle?.status === 'completed') {
          setViewedCompletedBattle(data.battle);
          setBattleData((prev) => ({ ...prev, activeBattle: null }));
        } else if (data.battle) {
          setBattleData((prev) => ({ ...prev, activeBattle: data.battle }));
        }
        setAnswerFeedback(null);
        setSubmittingAnswer(false);
        await fetchBattles(true);
      }, 1150);
    } catch (err) {
      setStatusError('Javob yuborishda tarmoq xatosi.');
      setSubmittingAnswer(false);
    }
  };

  const myId = profile?.id;
  const activeBattle = battleData.activeBattle;
  const outgoingPending = battleData.outgoingPending;
  const incomingInvites = battleData.incomingInvites || [];

  const renderCompletedResults = (battle) => {
    const isChallenger = myId && battle.challengerId === myId;
    const myScore = isChallenger ? battle.challengerScore : battle.opponentScore;
    const oppScore = isChallenger ? battle.opponentScore : battle.challengerScore;
    const oppName = isChallenger ? battle.opponentName : battle.challengerName;
    const oppAvatar = isChallenger ? battle.opponentAvatar : battle.challengerAvatar;
    const myCoins = isChallenger ? battle.challengerCoinsEarned : battle.opponentCoinsEarned;
    const oppCoins = isChallenger ? battle.opponentCoinsEarned : battle.challengerCoinsEarned;
    const myAnswers = isChallenger ? (battle.challengerAnswers || []) : (battle.opponentAnswers || []);
    const oppAnswers = isChallenger ? (battle.opponentAnswers || []) : (battle.challengerAnswers || []);
    const totalQ = battle.totalQuestions || battle.questions?.length || 5;
    const isDraw = battle.winnerId === 'draw';
    const didWin = myId && battle.winnerId === myId;

    return (
      <div className="bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 animate-fade-in">
        <div className="text-center space-y-2">
          <div className="text-4xl">{isDraw ? '🤝' : didWin ? '🏆' : '⚔️'}</div>
          <span className={`inline-flex px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
            isDraw
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : didWin
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
          }`}>
            {isDraw ? 'Durang natija' : didWin ? "G'alaba!" : 'Bellashuv yakunlandi'}
          </span>
          <h2 className="font-outfit text-2xl font-black text-on-surface">
            {isDraw
              ? 'Ikkala ishtirokchi teng natija qayd etdi!'
              : didWin
                ? "Tabriklaymiz! Siz ushbu battle g'olibisiz!"
                : `${oppName} ushbu raundda g'olib bo'ldi`}
          </h2>
        </div>

        {/* Both participants scoreboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 rounded-2xl border-2 ${didWin ? 'border-emerald-500 bg-emerald-500/10' : 'border-primary/40 bg-surface-container'}`}>
            <div className="flex items-center gap-3">
              <img
                src={profile?.avatar || getInitialsAvatar(`${profile?.firstName || 'Siz'} ${profile?.lastName || ''}`)}
                alt="Siz"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(profile?.firstName || 'Siz'); }}
                className="w-12 h-12 rounded-2xl object-cover border border-outline-variant"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase text-primary">Siz (Ishtirokchi)</div>
                <h4 className="font-outfit font-black text-sm text-on-surface truncate">
                  {profile?.firstName || 'Siz'} {profile?.lastName || ''}
                </h4>
              </div>
              {didWin && <span className="text-xl" title="G'olib">👑</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-outline-variant/60 text-center">
              <div className="p-2 rounded-xl bg-surface">
                <span className="text-[10px] text-outline font-bold block">To'g'ri javob</span>
                <span className="font-outfit font-black text-lg text-on-surface">{myScore} / {totalQ}</span>
              </div>
              <div className="p-2 rounded-xl bg-surface">
                <span className="text-[10px] text-outline font-bold block">Yutilgan Coin</span>
                <span className="font-outfit font-black text-lg text-amber-500">+{myCoins} 🪙</span>
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border-2 ${!isDraw && !didWin ? 'border-emerald-500 bg-emerald-500/10' : 'border-outline-variant bg-surface-container'}`}>
            <div className="flex items-center gap-3">
              <img
                src={oppAvatar || getInitialsAvatar(oppName)}
                alt={oppName}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(oppName); }}
                className="w-12 h-12 rounded-2xl object-cover border border-outline-variant"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase text-amber-500">Raqib</div>
                <h4 className="font-outfit font-black text-sm text-on-surface truncate">{oppName}</h4>
              </div>
              {!isDraw && !didWin && <span className="text-xl" title="G'olib">👑</span>}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-outline-variant/60 text-center">
              <div className="p-2 rounded-xl bg-surface">
                <span className="text-[10px] text-outline font-bold block">To'g'ri javob</span>
                <span className="font-outfit font-black text-lg text-on-surface">{oppScore} / {totalQ}</span>
              </div>
              <div className="p-2 rounded-xl bg-surface">
                <span className="text-[10px] text-outline font-bold block">Yutilgan Coin</span>
                <span className="font-outfit font-black text-lg text-amber-500">+{oppCoins} 🪙</span>
              </div>
            </div>
          </div>
        </div>

        {/* 5 MCQ Questions Breakdown */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-outline">5 ta MCQ savol tahlili</h3>
          <div className="space-y-2">
            {(battle.questions || []).map((q, idx) => {
              const myAns = myAnswers.find((a) => Number(a.qIndex) === idx);
              const oppAns = oppAnswers.find((a) => Number(a.qIndex) === idx);
              return (
                <div key={q.id || idx} className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/80 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-bold text-on-surface">
                      <span className="text-primary mr-1.5">{idx + 1}.</span>{q.q}
                    </p>
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    To'g'ri javob: {q.options?.[q.correct]}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold pt-1">
                    <span className={myAns?.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                      Siz: {myAns ? `${myAns.isCorrect ? 'Right' : 'Wrong'} (${q.options?.[myAns.selectedIdx] || '—'})` : 'Javob berilmagan'}
                    </span>
                    <span className="text-outline">·</span>
                    <span className={oppAns?.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                      {oppName}: {oppAns ? (oppAns.isCorrect ? 'Right (+10 Coin)' : 'Wrong') : 'Kutilmoqda'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setViewedCompletedBattle(null);
              setWatchedBattleId(null);
            }}
            className="px-6 py-2.5 rounded-full bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container-high cursor-pointer"
          >
            Lobbyga qaytish
          </button>
          <button
            type="button"
            onClick={handleFindOpponent}
            disabled={finding}
            className="px-8 py-2.5 rounded-full bg-primary text-on-primary text-xs font-black shadow-lg hover:bg-primary/90 cursor-pointer"
          >
            {finding ? 'Raqib qidirilmoqda...' : '⚔️ Yana Raqib Topish'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
          <span>1v1 Live MCQ Arena</span>
        </div>
        <h1 className="font-outfit text-3xl font-black text-on-surface tracking-tight">
          English Speaking &amp; Vocabulary Battle
        </h1>
        <p className="text-xs text-outline">
          Haqiqiy talaba bilan 5 ta MCQ savolda bellashing! Har bir to'g'ri javob uchun +10 Coin va +10 XP beriladi.
        </p>
      </div>

      {statusError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-600 dark:text-rose-300 text-xs font-bold text-center">
          {statusError}
        </div>
      )}
      {statusNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold text-center">
          {statusNotice}
        </div>
      )}

      {/* INCOMING BATTLE INVITES (Accept / Decline) */}
      {!activeBattle && incomingInvites.length > 0 && (
        <div className="space-y-3">
          {incomingInvites.map((inv) => (
            <div key={inv.id} className="bg-surface border-2 border-amber-500/70 rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3.5">
                <img
                  src={inv.challengerAvatar || getInitialsAvatar(inv.challengerName)}
                  alt={inv.challengerName}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(inv.challengerName); }}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-500 shrink-0"
                />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    ⚔️ Yangi Battle Taklifi!
                  </span>
                  <h4 className="font-outfit font-black text-sm text-on-surface">
                    {inv.challengerName} sizni 1v1 bellashuvga chaqirdi!
                  </h4>
                  <p className="text-[11px] text-outline">
                    5 ta MCQ savol · Har bir to'g'ri javobga +{inv.coinPerCorrect || 10} Coin 🪙
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={respondingId === inv.id}
                  onClick={() => handleRespondInvite(inv.id, 'accept')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-60"
                >
                  {respondingId === inv.id ? 'Boshlanmoqda...' : '✅ Jangni qabul qilish'}
                </button>
                <button
                  type="button"
                  disabled={respondingId === inv.id}
                  onClick={() => handleRespondInvite(inv.id, 'decline')}
                  className="px-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant hover:bg-rose-500/15 hover:text-rose-600 text-xs font-bold text-on-surface cursor-pointer"
                >
                  Rad etish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MAIN ARENA BODY */}
      {loading ? (
        <div className="bg-surface border border-outline-variant rounded-3xl p-10 text-center text-xs font-bold text-outline">
          Battle ma'lumotlari yuklanmoqda...
        </div>
      ) : viewedCompletedBattle && !activeBattle ? (
        renderCompletedResults(viewedCompletedBattle)
      ) : activeBattle ? (
        /* ==================== ACTIVE LIVE 2-PLAYER 5-MCQ BATTLE ==================== */
        (() => {
          const isChallenger = myId && activeBattle.challengerId === myId;
          const myName = isChallenger ? activeBattle.challengerName : activeBattle.opponentName;
          const oppName = isChallenger ? activeBattle.opponentName : activeBattle.challengerName;
          const myAvatar = isChallenger ? activeBattle.challengerAvatar : activeBattle.opponentAvatar;
          const oppAvatar = isChallenger ? activeBattle.opponentAvatar : activeBattle.challengerAvatar;
          const myScore = isChallenger ? activeBattle.challengerScore : activeBattle.opponentScore;
          const oppScore = isChallenger ? activeBattle.opponentScore : activeBattle.challengerScore;
          const myCoins = isChallenger ? activeBattle.challengerCoinsEarned : activeBattle.opponentCoinsEarned;
          const myAnswers = isChallenger ? (activeBattle.challengerAnswers || []) : (activeBattle.opponentAnswers || []);
          const oppAnsweredCount = isChallenger ? activeBattle.opponentAnsweredCount : activeBattle.challengerAnsweredCount;
          const totalQ = activeBattle.questions?.length || 5;

          const answeredIndices = new Set(myAnswers.map((a) => Number(a.qIndex)));
          const nextQIdx = answerFeedback
            ? answerFeedback.qIndex
            : activeBattle.questions.findIndex((_, idx) => !answeredIndices.has(idx));
          const allAnsweredByMe = nextQIdx === -1;
          const currentQ = !allAnsweredByMe ? activeBattle.questions[nextQIdx] : null;

          return (
            <div className="bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              {/* Live VS Header */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-center pb-5 border-b border-outline-variant">
                <div className="space-y-1.5">
                  <img
                    src={myAvatar || getInitialsAvatar(myName)}
                    alt={myName}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(myName); }}
                    className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-primary shadow-md"
                  />
                  <h4 className="font-outfit font-black text-sm text-on-surface truncate">{myName} (Siz)</h4>
                  <div className="flex items-center justify-center gap-2 text-xs font-black">
                    <span className="text-emerald-600 dark:text-emerald-400">Ball: {myScore}/{totalQ}</span>
                    <span className="text-amber-500">+{myCoins} 🪙</span>
                  </div>
                  <div className="flex justify-center gap-1 pt-0.5">
                    {Array.from({ length: totalQ }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${
                          i < myAnswers.length
                            ? (myAnswers[i]?.isCorrect ? 'bg-emerald-500' : 'bg-rose-500')
                            : 'bg-outline-variant'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-outfit font-black text-3xl text-rose-500 tracking-wider">VS</span>
                  <p className="text-[11px] font-bold text-primary uppercase">
                    Jonli Bellashuv · {totalQ} ta MCQ
                  </p>
                </div>

                <div className="space-y-1.5">
                  <img
                    src={oppAvatar || getInitialsAvatar(oppName)}
                    alt={oppName}
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(oppName); }}
                    className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-amber-500 shadow-md"
                  />
                  <h4 className="font-outfit font-black text-sm text-on-surface truncate">{oppName}</h4>
                  <div className="text-xs font-black text-amber-500">
                    Ball: {oppScore}/{totalQ} · ({oppAnsweredCount}/{totalQ} javob)
                  </div>
                  <div className="flex justify-center gap-1 pt-0.5">
                    {Array.from({ length: totalQ }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${i < oppAnsweredCount ? 'bg-amber-500' : 'bg-outline-variant'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {allAnsweredByMe ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-primary/15 text-primary flex items-center justify-center animate-pulse">
                    ⏳
                  </div>
                  <h3 className="font-outfit font-black text-lg text-on-surface">
                    Siz barcha {totalQ} ta savolga javob berdingiz!
                  </h3>
                  <p className="text-xs text-outline max-w-md mx-auto">
                    Raqibingiz ({oppName}) hozir {oppAnsweredCount}/{totalQ} ta savolni bajardi. Raqib yakunlashi bilan ikkala ishtirokchining natijalari avtomatik ko'rsatiladi!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-outline">
                    <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      Savol {nextQIdx + 1} / {totalQ}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      To'g'ri javob: +{activeBattle.coinPerCorrect || 10} Coin 🪙
                    </span>
                  </div>

                  <h3 className="font-outfit font-black text-lg text-on-surface leading-snug">
                    {currentQ?.q}
                  </h3>

                  <div className="space-y-2.5">
                    {(currentQ?.options || []).map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isPicked = answerFeedback && answerFeedback.selectedIdx === idx;
                      const isRightOpt = answerFeedback && answerFeedback.correctIdx === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={submittingAnswer || Boolean(answerFeedback)}
                          onClick={() => handleSubmitBattleAnswer(activeBattle, nextQIdx, idx)}
                          className={`w-full p-3.5 text-left rounded-2xl border-2 text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            answerFeedback
                              ? isRightOpt
                                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                : isPicked
                                  ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300'
                                  : 'border-outline-variant bg-surface-container/60 text-outline opacity-60'
                              : 'border-outline-variant bg-surface-container hover:border-primary hover:bg-primary/5 text-on-surface'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-surface border border-outline-variant flex items-center justify-center font-black text-xs shrink-0">
                              {letter}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {answerFeedback && isPicked && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black text-white shrink-0 ${
                              answerFeedback.isCorrect ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}>
                              {answerFeedback.isCorrect ? `Right +${answerFeedback.coins} Coin` : 'Wrong'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : outgoingPending ? (
        /* ==================== OUTGOING PENDING INVITE WAITING ROOM ==================== */
        <div className="bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="space-y-2">
              <img
                src={outgoingPending.challengerAvatar || getInitialsAvatar(outgoingPending.challengerName)}
                alt="Siz"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(outgoingPending.challengerName); }}
                className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-primary shadow-md"
              />
              <h4 className="font-outfit font-black text-sm text-on-surface">{outgoingPending.challengerName}</h4>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Tayyor ✓</span>
            </div>

            <div className="space-y-1">
              <span className="font-outfit font-black text-3xl text-rose-500">VS</span>
              <div className="text-[11px] font-bold text-amber-500 animate-pulse">Raqib kutilmoqda...</div>
            </div>

            <div className="space-y-2">
              <img
                src={outgoingPending.opponentAvatar || getInitialsAvatar(outgoingPending.opponentName)}
                alt={outgoingPending.opponentName}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(outgoingPending.opponentName); }}
                className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-amber-500 shadow-md"
              />
              <h4 className="font-outfit font-black text-sm text-on-surface">{outgoingPending.opponentName}</h4>
              <span className="text-[11px] font-bold text-amber-500">Push yuborildi 🔔</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-on-surface space-y-1">
            <p className="font-bold">
              {outgoingPending.opponentName} paneliga jangni qabul qilish uchun push bildirishnoma yuborildi!
            </p>
            <p className="text-outline">
              Raqib "Jangni qabul qilish" tugmasini bosgan zahoti bellashuv avtomatik boshlanadi.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleCancelPending(outgoingPending.id)}
            className="px-6 py-2.5 rounded-full bg-surface-container border border-outline-variant text-xs font-bold text-outline hover:text-rose-600 cursor-pointer"
          >
            Taklifni bekor qilish
          </button>
        </div>
      ) : (
        /* ==================== IDLE / MATCHMAKING LOBBY ==================== */
        <div className="bg-surface border border-outline-variant rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-center">
            <div className="space-y-2">
              <img
                src={profile?.avatar || getInitialsAvatar(`${profile?.firstName || 'Siz'} ${profile?.lastName || ''}`)}
                alt="Siz"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(profile?.firstName || 'Siz'); }}
                className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-primary shadow-md"
              />
              <h4 className="font-outfit font-black text-sm text-on-surface">{profile?.firstName || 'Siz'}</h4>
              <span className="text-xs text-primary font-bold">{Number(profile?.xp ?? 0).toLocaleString()} XP</span>
            </div>

            <div className="space-y-1">
              <span className="font-outfit font-black text-3xl text-rose-500 tracking-wider">VS</span>
              <p className="text-[11px] text-outline font-bold uppercase">5 ta MCQ · +10 Coin / savol</p>
            </div>

            <div className="space-y-2">
              {(() => {
                const picked = (battleData.opponents || []).find((o) => o.id === selectedOpponentId);
                return picked ? (
                  <>
                    <img
                      src={picked.avatar || getInitialsAvatar(picked.name)}
                      alt={picked.name}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getInitialsAvatar(picked.name); }}
                      className="w-16 h-16 rounded-2xl mx-auto object-cover border-2 border-amber-500 shadow-md"
                    />
                    <h4 className="font-outfit font-black text-sm text-on-surface truncate">{picked.name}</h4>
                    <span className="text-xs text-amber-500 font-bold">{Number(picked.xp ?? 0).toLocaleString()} XP</span>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl mx-auto border-2 border-dashed border-amber-500/70 bg-amber-500/10 flex items-center justify-center text-2xl">
                      🎯
                    </div>
                    <h4 className="font-outfit font-black text-sm text-on-surface">Haqiqiy Raqib</h4>
                    <span className="text-xs text-amber-500 font-bold">Avtomatik topiladi</span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Optional classmate picker */}
          {battleData.opponents?.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-outline-variant">
              <label className="text-xs font-bold text-outline block">
                Raqib tanlash (ixtiyoriy — bo'sh qoldirsangiz avtomatik topiladi):
              </label>
              <select
                value={selectedOpponentId}
                onChange={(e) => setSelectedOpponentId(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
              >
                <option value="">🎲 Avtomatik tasodifiy raqib topish ({battleData.opponents.length} ta talaba)</option>
                {battleData.opponents.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    {opp.name} — {Number(opp.xp || 0).toLocaleString()} XP · 🪙 {opp.coins || 0} Coin
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="pt-2 text-center space-y-3">
            <button
              type="button"
              onClick={handleFindOpponent}
              disabled={finding}
              className="w-full sm:w-auto px-10 py-3.5 rounded-full bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-outfit font-black text-sm shadow-lg shadow-rose-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {finding ? 'Raqib qidirilmoqda...' : '⚔️ Battle — Raqib Topish va Chaqirish'}
            </button>
            <p className="text-[11px] text-outline">
              Tugmani bosganingizda raqibga avtomatik push bildirishnoma boradi va u tasdiqlagach 5 ta MCQ savol boshlanadi.
            </p>
          </div>
        </div>
      )}

      {/* COMPLETED BATTLES HISTORY */}
      {(battleData.history || []).length > 0 && !activeBattle && (
        <div className="bg-surface border border-outline-variant rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
          <h3 className="font-outfit font-black text-sm text-on-surface flex items-center gap-2">
            <span>🏅</span>
            <span>So'nggi Battlelar Natijalari</span>
          </h3>
          <div className="space-y-2">
            {battleData.history.slice(0, 6).map((b) => {
              const amChallenger = myId && b.challengerId === myId;
              const myS = amChallenger ? b.challengerScore : b.opponentScore;
              const oppS = amChallenger ? b.opponentScore : b.challengerScore;
              const oppN = amChallenger ? b.opponentName : b.challengerName;
              const won = myId && b.winnerId === myId;
              const draw = b.winnerId === 'draw';
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setViewedCompletedBattle(b)}
                  className="w-full p-3 rounded-2xl bg-surface-container hover:bg-surface-container-high border border-outline-variant flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{draw ? '🤝' : won ? '🏆' : '⚔️'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-on-surface truncate">vs {oppN}</div>
                      <div className="text-[10px] text-outline">
                        Natija: {myS} : {oppS} · +{amChallenger ? b.challengerCoinsEarned : b.opponentCoinsEarned} Coin 🪙
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                    draw
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      : won
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}>
                    {draw ? 'Durang' : won ? 'G\'alaba' : 'Mag\'lubiyat'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 5. LEADERBOARD VIEW ====================
export function LeaderboardView({ profile }) {
  const [filter, setFilter] = useState('all'); // 'daily' | 'weekly' | 'monthly' | 'all'
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async (period = filter) => {
    try {
      const token = localStorage.getItem('student_token');
      const res = await fetch(`${API_BASE}/api/leaderboard?period=${encodeURIComponent(period)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setLeaders(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      }
    } catch (e) {
      console.error('Leaderboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    loadLeaderboard(filter);
    const timer = setInterval(() => loadLeaderboard(filter), 10000);
    return () => clearInterval(timer);
  }, [filter, loadLeaderboard]);

  const myEmail = (profile?.email || '').toLowerCase();

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="font-outfit text-3xl font-black text-on-surface tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-500 text-[32px]">leaderboard</span>
            <span>Talabalar Reytingi</span>
          </h1>
          <p className="text-xs text-outline mt-1 font-medium">
            Talabalarning real XP ballari, streaklari va coinlari asosida jonli reyting
          </p>
        </div>

        <div className="flex bg-surface-container p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'daily', label: 'Kunlik' },
            { id: 'weekly', label: 'Haftalik' },
            { id: 'monthly', label: 'Oylik' },
            { id: 'all', label: 'Barchasi' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filter === tab.id ? 'bg-primary text-white shadow-xs' : 'text-outline hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-3xl overflow-hidden shadow-xs divide-y divide-outline-variant/50">
        {loading ? (
          <div className="p-8 text-center text-xs text-outline font-semibold">Reyting yuklanmoqda...</div>
        ) : leaders.length === 0 ? (
          <div className="p-8 text-center text-xs text-outline font-semibold">Hozircha reyting ma'lumotlari mavjud emas.</div>
        ) : (
          leaders.map((u) => {
            const isSelf = Boolean(u.isYou || (profile?.id && u.id === profile.id) || (myEmail && u.email?.toLowerCase() === myEmail));
            const shownXp = Number(filter === 'all' ? (u.xp ?? u.displayXp ?? 0) : (u.displayXp ?? 0));
            return (
              <div
                key={u.id || u.rank}
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  isSelf ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className={`w-6 font-outfit font-black text-sm text-center shrink-0 ${
                    u.rank === 1 ? 'text-amber-500 text-base' : u.rank === 2 ? 'text-slate-400' : u.rank === 3 ? 'text-amber-700' : 'text-outline'
                  }`}>
                    {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : u.rank}
                  </span>
                  <img
                    src={u.avatar || getInitialsAvatar(u.name)}
                    alt={u.name}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getInitialsAvatar(u.name);
                    }}
                    className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0 bg-slate-100"
                  />
                  <div className="min-w-0">
                    <h4 className={`font-outfit text-sm truncate flex items-center gap-1.5 ${isSelf ? 'font-black text-primary' : 'font-bold text-on-surface'}`}>
                      <span className="truncate">{u.name}</span>
                      {isSelf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary text-white font-bold shrink-0">Siz</span>
                      )}
                    </h4>
                    <div className="flex items-center gap-2.5 text-[11px] text-outline font-medium mt-0.5">
                      <span>🔥 {u.streak || 0} kun streak</span>
                      <span>·</span>
                      <span>🪙 {(u.coins || 0).toLocaleString()} coin</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-outfit font-black text-sm text-on-surface">
                    {shownXp.toLocaleString()} XP
                  </div>
                  {filter !== 'all' && (
                    <span className="text-[10px] font-semibold text-outline">
                      Jami: {Number(u.xp || 0).toLocaleString()} XP
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== 6. VOCABULARY VIEW ====================
const VOCABULARY_HTML_LESSONS = [
  {
    id: 'family',
    file: 'family_relationships_ielts_lesson.html',
    title: 'Family & Relationships',
    badge: 'IELTS Band 7–8',
    modules: '5 Modul',
    xpPotential: '600+ XP',
    icon: '👨‍👩‍👧‍👦',
    accentBg: 'from-amber-500/20 to-orange-500/10 border-amber-500/30',
    desc: 'Oila a\'zolari, avlodlar o\'rtasidagi munosabatlar va shaxsiy bog\'liqliklar uchun kuchli IELTS iboralari.'
  },
  {
    id: 'cities_transport',
    file: 'ielts_cities_transport_vocabulary_masterclass.html',
    title: 'Cities & Transport',
    badge: 'IELTS Band 7–8',
    modules: '5 Modul',
    xpPotential: '600+ XP',
    icon: '🏙️',
    accentBg: 'from-sky-500/20 to-blue-600/10 border-sky-500/30',
    desc: 'Shahar infratuzilmasi, jamoat transporti, tirbandliklar va zamonaviy urbanizatsiyaga oid kollokatsiyalar.'
  },
  {
    id: 'education',
    file: 'ielts_education_vocabulary_master.html',
    title: 'Education Vocabulary',
    badge: 'IELTS Speaking',
    modules: '4 Bosqich',
    xpPotential: '500+ XP',
    icon: '🎓',
    accentBg: 'from-violet-500/20 to-indigo-600/10 border-violet-500/30',
    desc: 'Ta\'lim jarayoni, universitet hayoti, ilmiy ko\'nikmalar va o\'qish strategiyalariga oid boy lug\'at.'
  },
  {
    id: 'environment',
    file: 'ielts_speaking_environment_master.html',
    title: 'Environment & Climate',
    badge: 'IELTS Band 8+',
    modules: '5 Modul',
    xpPotential: '650+ XP',
    icon: '🌿',
    accentBg: 'from-emerald-500/20 to-teal-600/10 border-emerald-500/30',
    desc: 'Ekologiya, iqlim o\'zgarishi, qayta tiklanuvchi energiya va tabiatni asrash bo\'yicha yuqori balli iboralar.'
  },
  {
    id: 'health_fitness',
    file: 'ielts_speaking_health_master.html',
    title: 'Health & Fitness',
    badge: 'IELTS Band 8+',
    modules: '5 Modul',
    xpPotential: '650+ XP',
    icon: '💪',
    accentBg: 'from-rose-500/20 to-red-600/10 border-rose-500/30',
    desc: 'Sog\'lom turmush tarzi, to\'g\'ri ovqatlanish, jismoniy mashqlar va ruhiy salomatlikka oid so\'z birikmalari.'
  },
  {
    id: 'technology',
    file: 'ielts_speaking_technology_vocabulary_master (2).html',
    title: 'Technology',
    badge: 'IELTS Speaking',
    modules: '4 Modul',
    xpPotential: '500+ XP',
    icon: '💻',
    accentBg: 'from-cyan-500/20 to-blue-600/10 border-cyan-500/30',
    desc: 'Raqamli texnologiyalar, sun\'iy intellekt, avtomatlashtirish va zamonaviy gadjetlar mavzusi.'
  },
  {
    id: 'work_career',
    file: 'ielts_speaking_work_career.html',
    title: 'Work & Career',
    badge: 'IELTS Speaking',
    modules: '4 Bosqich',
    xpPotential: '500+ XP',
    icon: '💼',
    accentBg: 'from-amber-600/20 to-yellow-600/10 border-amber-600/30',
    desc: 'Karyera o\'sishi, ish joyi dinamikasi, ish-hayot muvozanati va kasbiy maqsadlar lug\'ati.'
  },
  {
    id: 'travel',
    file: 'ielts_travel_vocabulary_masterclass_html.html',
    title: 'Travel & Tourism',
    badge: 'IELTS Band 8',
    modules: '5 Modul',
    xpPotential: '650+ XP',
    icon: '✈️',
    accentBg: 'from-teal-500/20 to-cyan-600/10 border-teal-500/30',
    desc: 'Sayohat madaniyati, turizmning ta\'siri va unutilmas safar taassurotlarini tasvirlash iboralari.'
  },
  {
    id: 'food_lifestyle',
    file: 'ielts_vocabulary_masterclass.html',
    title: 'Food & Lifestyle',
    badge: 'IELTS 8.0+',
    modules: '5 Modul',
    xpPotential: '600+ XP',
    icon: '🍽️',
    accentBg: 'from-orange-500/20 to-pink-600/10 border-orange-500/30',
    desc: 'Ovqatlanish odatlari, kundalik tartib, tezkor taomlar va muvozanatli hayot tarzi bo\'yicha masterklass.'
  },
  {
    id: 'hobbies_entertainment',
    file: 'ielts_vocabulary_master_hobbies_entertainment.html',
    title: 'Hobbies & Entertainment',
    badge: 'IELTS Masterclass',
    modules: '5 Modul',
    xpPotential: '650+ XP',
    icon: '🎭',
    accentBg: 'from-fuchsia-500/20 to-purple-600/10 border-fuchsia-500/30',
    desc: 'Bo\'sh vaqt, san\'at, musiqa, ijodiy mashg\'ulotlar va hordiq chiqarishga doir C1/C2 iboralar.'
  }
];

export function VocabularyView({ profile, onStatsUpdate, designPreset = 'original', darkMode = false }) {
  const [activeLesson, setActiveLesson] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lessonXpMap, setLessonXpMap] = useState({});
  const [lessonTasksMap, setLessonTasksMap] = useState({});
  const [totalVocabXp, setTotalVocabXp] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [vocabToast, setVocabToast] = useState('');
  const [lessonThemeSeed, setLessonThemeSeed] = useState({
    design: designPreset || 'original',
    dark: Boolean(darkMode)
  });
  const toastTimerRef = useRef(null);
  const awardQueueRef = useRef(Promise.resolve());
  const eventSeqRef = useRef(0);
  const iframeRef = useRef(null);
  const lessonContainerRef = useRef(null);
  const nativeFsActiveRef = useRef(false);

  const loadProgress = useCallback(async () => {
    const token = localStorage.getItem('student_token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/vocabulary/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLessonXpMap(data.lessonXpMap && typeof data.lessonXpMap === 'object' ? data.lessonXpMap : {});
        setLessonTasksMap(data.lessonTasksMap && typeof data.lessonTasksMap === 'object' ? data.lessonTasksMap : {});
        setTotalVocabXp(Number(data.earnedXp) || 0);
      }
    } catch (e) {
      console.warn('Vocabulary progress load error:', e);
    }
  }, []);

  useEffect(() => {
    loadProgress();
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [loadProgress]);

  const showToast = useCallback((msg) => {
    setVocabToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setVocabToast(''), 3800);
  }, []);

  const syncIframeAppearance = useCallback((fsState = isFullscreen) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      const targetOrigin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '*';
      win.postMessage({
        type: 'PRACTISE_THEME_SYNC',
        design: designPreset || 'original',
        darkMode: Boolean(darkMode)
      }, targetOrigin);
      win.postMessage({
        type: 'PRACTISE_LAYOUT_SYNC',
        embedded: true,
        fullscreen: Boolean(fsState)
      }, targetOrigin);
    } catch (e) {}
  }, [designPreset, darkMode, isFullscreen]);

  useEffect(() => {
    if (activeLesson) {
      syncIframeAppearance(isFullscreen);
    }
  }, [activeLesson, designPreset, darkMode, isFullscreen, syncIframeAppearance]);

  const exitLessonFullscreen = useCallback(() => {
    nativeFsActiveRef.current = false;
    setIsFullscreen(false);
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch (e) {}
  }, []);

  const toggleLessonFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitLessonFullscreen();
      return;
    }
    setIsFullscreen(true);
    try {
      const el = lessonContainerRef.current;
      const req = el?.requestFullscreen || el?.webkitRequestFullscreen;
      if (typeof req === 'function') {
        const res = req.call(el);
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch (e) {}
  }, [isFullscreen, exitLessonFullscreen]);

  useEffect(() => {
    const handleFsChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl && fsEl === lessonContainerRef.current) {
        nativeFsActiveRef.current = true;
        setIsFullscreen(true);
      } else if (nativeFsActiveRef.current && !fsEl) {
        nativeFsActiveRef.current = false;
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitLessonFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, exitLessonFullscreen]);

  useEffect(() => {
    return () => {
      try {
        if (document.fullscreenElement === lessonContainerRef.current) {
          document.exitFullscreen?.().catch(() => {});
        }
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      if (typeof window === 'undefined') return;
      if (event.origin && event.origin !== 'null' && event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload) return;

      if (payload.type === 'PRACTISE_EXIT_FULLSCREEN') {
        exitLessonFullscreen();
        return;
      }

      if (payload.type !== 'PRACTISE_VOCAB_XP') return;

      const amount = Math.round(Number(payload.amount) || 0);
      if (amount <= 0) return;

      const knownLesson = VOCABULARY_HTML_LESSONS.find(l => l.id === payload.lessonId) || activeLesson;
      const lessonId = knownLesson?.id || String(payload.lessonId || 'vocabulary');
      const lessonTitle = knownLesson?.title || 'Vocabulary';
      const seq = ++eventSeqRef.current;

      awardQueueRef.current = awardQueueRef.current
        .catch(() => {})
        .then(async () => {
          const data = await awardStudentActivity({
            type: 'vocabulary',
            eventKey: `vocab_html_${lessonId}_${Date.now()}_${seq}`,
            xp: amount,
            coins: 0,
            meta: {
              lessonId,
              lessonTitle,
              source: 'html_vocab'
            },
            allowDuplicate: true
          });
          if (data?.success && data?.awarded) {
            const addedXp = Number(data.awarded.xp) || amount;
            setLessonXpMap(prev => ({ ...prev, [lessonId]: (prev[lessonId] || 0) + addedXp }));
            setLessonTasksMap(prev => ({ ...prev, [lessonId]: (prev[lessonId] || 0) + 1 }));
            setTotalVocabXp(prev => prev + addedXp);
            setSessionXp(prev => prev + addedXp);
            if (data.userStats) {
              onStatsUpdate?.(data.userStats, { xp: addedXp, coins: 0 }, lessonTitle);
            }
            showToast(`${lessonTitle}: +${addedXp} XP Student Panelga qo'shildi!`);
          }
        });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeLesson, onStatsUpdate, showToast, exitLessonFullscreen]);

  const openVocabularyLesson = useCallback((lesson) => {
    setSessionXp(0);
    setIsFullscreen(false);
    setLessonThemeSeed({
      design: designPreset || 'original',
      dark: Boolean(darkMode)
    });
    setActiveLesson(lesson);
  }, [designPreset, darkMode]);

  const studentDisplayName = (profile?.name || profile?.firstName || 'Student').trim() || 'Student';
  const studentUid = profile?.id ? String(profile.id) : '';

  const iframeUrl = useMemo(() => {
    if (!activeLesson) return '';
    return `/vocabulary/${encodeURIComponent(activeLesson.file)}?studentName=${encodeURIComponent(studentDisplayName)}&uid=${encodeURIComponent(studentUid)}&embedded=1&design=${encodeURIComponent(lessonThemeSeed.design || 'original')}&dark=${lessonThemeSeed.dark ? '1' : '0'}`;
  }, [activeLesson, studentDisplayName, studentUid, lessonThemeSeed]);

  const filteredLessons = VOCABULARY_HTML_LESSONS.filter((lesson) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      lesson.title.toLowerCase().includes(q) ||
      lesson.badge.toLowerCase().includes(q) ||
      lesson.desc.toLowerCase().includes(q)
    );
  });

  if (activeLesson) {
    const activeLessonEarned = Number(lessonXpMap[activeLesson.id]) || 0;

    return (
      <div
        ref={lessonContainerRef}
        className={`font-sans flex flex-col ${
          isFullscreen
            ? 'fixed inset-0 z-[9995] w-screen h-dvh bg-background p-0 gap-0 overflow-hidden'
            : 'h-[calc(100dvh-82px)] min-h-[430px] gap-2.5 relative'
        }`}
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-2 bg-surface border border-outline-variant shadow-xs shrink-0 ${
            isFullscreen
              ? 'rounded-none border-x-0 border-t-0 px-4 py-2'
              : 'rounded-2xl px-3.5 py-2'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                exitLessonFullscreen();
                setActiveLesson(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-on-surface hover:border-primary/50 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
            >
              <span>← Barcha mavzular</span>
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">{activeLesson.icon}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-outfit font-black text-sm sm:text-base text-on-surface truncate">
                    {activeLesson.title}
                  </h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/12 text-primary uppercase shrink-0">
                    {activeLesson.badge}
                  </span>
                </div>
                {!isFullscreen && (
                  <p className="text-[11px] text-outline truncate hidden sm:block">
                    Topshiriqlarni bajaring — XP ballar avtomatik Student Panelga qo'shiladi.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/12 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-black flex items-center gap-1.5">
              <span>⭐</span>
              <span>Ushbu darsdan: +{activeLessonEarned} XP</span>
              {sessionXp > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                  Hozir +{sessionXp}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={toggleLessonFullscreen}
              className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface hover:border-primary/50 cursor-pointer flex items-center gap-1.5 transition-all"
              title={isFullscreen ? "Oddiy o'lchamga qaytish (Esc)" : "To'liq ekranda ochish"}
            >
              {isFullscreen ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                  <span>Kichraytirish</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                  <span>To'liq ekran</span>
                </>
              )}
            </button>
          </div>
        </div>

        {vocabToast && (
          <div className="pointer-events-none absolute top-14 right-4 z-30 px-4 py-2 rounded-2xl bg-emerald-600 text-white shadow-lg text-xs font-bold flex items-center gap-2">
            <span>✓</span>
            <span>{vocabToast}</span>
          </div>
        )}

        <div
          className={`relative flex-1 min-h-0 w-full overflow-hidden bg-background ${
            isFullscreen
              ? 'rounded-none border-0 shadow-none'
              : 'rounded-2xl border border-outline-variant shadow-md'
          }`}
        >
          <iframe
            ref={iframeRef}
            key={activeLesson.id}
            title={activeLesson.title}
            src={iframeUrl}
            onLoad={() => syncIframeAppearance(isFullscreen)}
            allowFullScreen
            className="w-full h-full border-0 block"
            allow="autoplay; fullscreen"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16">
      {/* Header & Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div className="space-y-1">
          <h1 className="font-outfit text-2xl sm:text-3xl font-black text-on-surface tracking-tight flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 8 6 6" />
                <path d="m4 14 6-6 2-3" />
                <path d="M2 5h12" />
                <path d="M7 2h1" />
                <path d="m22 22-5-10-5 10" />
                <path d="M14 18h6" />
              </svg>
            </span>
            <span>Vocabulary Masterclasses</span>
          </h1>
          <p className="text-xs text-outline font-medium">
            IELTS Speaking va kundalik muloqot uchun 10 ta interaktiv lug'at darsi. Har bir vazifani bajarganingizda XP ballar Student Panelingizga qo'shiladi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant shadow-xs">
            <span className="text-xs font-bold text-outline">Darslar:</span>
            <span className="font-outfit font-black text-sm text-primary">{VOCABULARY_HTML_LESSONS.length} ta</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-surface border border-outline-variant shadow-xs">
            <span className="text-xs font-bold text-outline">Jami Vocabulary XP:</span>
            <span className="font-outfit font-black text-sm text-amber-500">⭐ {totalVocabXp} XP</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mavzuni qidiring (masalan: Travel, Environment, Work)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface border border-outline-variant text-xs font-semibold text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
        </div>
        {vocabToast && (
          <div className="px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            {vocabToast}
          </div>
        )}
      </div>

      {/* 10 Lesson Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredLessons.map((lesson, idx) => {
          const earned = Number(lessonXpMap[lesson.id]) || 0;
          const completedTasks = Number(lessonTasksMap[lesson.id]) || 0;

          return (
            <div
              key={lesson.id}
              onClick={() => openVocabularyLesson(lesson)}
              className="group relative flex flex-col justify-between p-5 rounded-3xl bg-surface border border-outline-variant hover:border-primary/60 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${lesson.accentBg} border flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform`}>
                    {lesson.icon}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-surface-container border border-outline-variant text-outline">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-primary/12 text-primary uppercase">
                      {lesson.badge}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-surface-container text-outline">
                      {lesson.modules}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-outfit font-black text-lg text-on-surface group-hover:text-primary transition-colors">
                    {lesson.title}
                  </h3>
                  <p className="text-xs text-outline leading-relaxed line-clamp-2">
                    {lesson.desc}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {earned > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-black">
                      <span>⭐ +{earned} XP</span>
                      {completedTasks > 0 && <span className="opacity-75">({completedTasks})</span>}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                      <span>🏆 {lesson.xpPotential}</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openVocabularyLesson(lesson);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-black shadow-xs group-hover:opacity-95 transition-opacity cursor-pointer"
                >
                  {earned > 0 ? 'Davom etish →' : 'Boshlash →'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
