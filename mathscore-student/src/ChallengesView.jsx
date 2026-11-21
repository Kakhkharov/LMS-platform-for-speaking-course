import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : 'https://marvelous-nourishment-production-c87958d0.up.railway.app');

const resolveChallengeImageUrl = (url) => {
  if (!url) return '';
  let str = String(url).trim();
  if (str.includes('localhost:5000') || str.includes('127.0.0.1:5000')) {
    const idx = str.indexOf('/uploads/');
    if (idx !== -1) {
      str = str.substring(idx);
    }
  }
  if (str.startsWith('/uploads/') || str.startsWith('uploads/')) {
    const cleanPath = str.startsWith('/') ? str : `/${str}`;
    return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
  }
  return str;
};

const getRelativeUploadPath = (url) => {
  if (!url) return '';
  const str = String(url).trim();
  const idx = str.indexOf('/uploads/');
  if (idx !== -1) {
    return str.substring(idx);
  }
  return '';
};

const cleanDisplayText = (str) =>
  String(str || '')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

const normalizeChallengeItem = (ch) =>
  ch && typeof ch === 'object'
    ? {
        ...ch,
        title: cleanDisplayText(ch.title),
        description: cleanDisplayText(ch.description),
        tasks: Array.isArray(ch.tasks) ? ch.tasks.map(cleanDisplayText) : []
      }
    : ch;

const CoinIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block text-sky-400`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L4.5 7.5v9L12 22l7.5-5.5v-9L12 2zm0 2.3l5.3 3.9L12 12 6.7 8.2 12 4.3zm-5.5 5.4l4.5 3.3v6.2l-4.5-3.3V9.7zm6.5 9.5V13l4.5-3.3v6.2L13 19.2z" />
  </svg>
);

const TrophyIcon = ({ className = 'w-6 h-6' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const GridIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const ClockIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ArrowRightIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const CheckIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

function computeClientBonusEval(ch, nowMs) {
  if (!ch || !ch.deadline) {
    return { status: 'on_time', bonusPercent: 100, remainingMs: null };
  }
  const deadlineMs = new Date(ch.deadline).getTime();
  if (isNaN(deadlineMs)) {
    return { status: 'on_time', bonusPercent: 100, remainingMs: null };
  }
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) {
    return { status: 'expired', bonusPercent: 0, remainingMs: 0 };
  }
  const requestedUrgentMs = Math.max(1, Number(ch.urgentWindowMinutes || 120)) * 60 * 1000;
  const createdMs = ch.createdAt ? new Date(ch.createdAt).getTime() : NaN;
  const totalWindowMs = !isNaN(createdMs) && deadlineMs > createdMs ? deadlineMs - createdMs : requestedUrgentMs * 4;
  const effectiveUrgentMs = Math.min(requestedUrgentMs, Math.max(60 * 1000, Math.floor(totalWindowMs * 0.25)));

  if (remainingMs <= effectiveUrgentMs) {
    return { status: 'urgent', bonusPercent: 50, remainingMs };
  }
  return { status: 'on_time', bonusPercent: 100, remainingMs };
}

function formatRemainingShort(ms) {
  if (ms === null || ms === undefined) return 'Muddatsiz';
  if (ms <= 0) return 'Muddati tugadi';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}k ${String(h).padStart(2, '0')}s ${String(m).padStart(2, '0')}d`;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ChallengesView({ currentUser, darkMode, onStatsUpdate, onPremiumRequired = null }) {
  const [challenges, setChallenges] = useState([]);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [completingDay, setCompletingDay] = useState(null);
  const [studentNote, setStudentNote] = useState('');
  const [completeError, setCompleteError] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());

  const fetchChallenges = async () => {
    try {
      const token = localStorage.getItem('student_token');
      const res = await fetch(`${API_BASE}/api/challenges`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).map(normalizeChallengeItem);
        setChallenges(list);
        setSelectedChallenge(prev => {
          if (!prev) return null;
          return list.find(item => Number(item.day) === Number(prev.day)) || prev;
        });
      }
    } catch (e) {
      console.error('Fetch challenges error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
    const poll = setInterval(fetchChallenges, 5000);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);

    let es = null;
    try {
      es = new EventSource(`${API_BASE}/api/system/stream`);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data || '{}');
          if (parsed.type === 'challenge_update') {
            fetchChallenges();
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      clearInterval(poll);
      clearInterval(tick);
      if (es) es.close();
    };
  }, []);

  const handleOpenDay = (ch) => {
    setCompleteError('');
    setStudentNote(ch.mySubmission?.note || '');
    setSelectedChallenge(ch);
  };

  const handleCompleteDay = async (dayNum) => {
    setCompletingDay(dayNum);
    setCompleteError('');
    try {
      const token = localStorage.getItem('student_token');
      const fullName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.name || '';
      const res = await fetch(`${API_BASE}/api/challenges/${dayNum}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          studentId: currentUser?.id || null,
          studentEmail: currentUser?.email || '',
          studentName: fullName,
          note: studentNote.trim()
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.code === 'PREMIUM_REQUIRED') {
        onPremiumRequired?.('Challenges');
        setCompleteError(data.error || "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.");
        return;
      }
      if (!res.ok) {
        setCompleteError(data.error || "Topshirishda xatolik yuz berdi.");
        return;
      }

      const updatedList = challenges.map(c =>
        Number(c.day) === Number(dayNum) ? { ...c, ...(data.challenge || {}), completed: true } : c
      );
      setChallenges(updatedList);
      if (selectedChallenge && Number(selectedChallenge.day) === Number(dayNum)) {
        setSelectedChallenge(prev => ({ ...prev, ...(data.challenge || {}), completed: true }));
      }
      if (data?.userStats) {
        const tierLabel = data.late || data.bonusPercent === 0
          ? 'Kech topshirildi (0% bonus)'
          : data.bonusPercent === 50
          ? '50% Bonus (Kam vaqt)'
          : '100% Bonus';
        onStatsUpdate?.(data.userStats, data.awarded, `30 day Challenge • Day ${dayNum} (${tierLabel})`);
      }
    } catch (e) {
      setCompleteError('Xatolik: ' + e.message);
    } finally {
      setCompletingDay(null);
    }
  };

  const completedCount = challenges.filter(c => c.completed).length;
  const totalCount = challenges.length || 30;
  const progressPct = challenges.length > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16">
      {/* Header & Progress Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-6 sm:p-8 shadow-md">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <span className="text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                30 day Challenge
              </span>
            </div>
            <h1 className="font-outfit text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              30 day Challenge
            </h1>
            <p className="text-xs sm:text-sm text-white/90 max-w-xl font-medium leading-relaxed">
              O‘z muddatida bajarsangiz 100%, muddati juda kam qolganda topshirsangiz 50% miqdorida Coin, Streak va XP ballarga ega bo‘lasiz!
            </p>
          </div>

          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 flex items-center gap-4 shrink-0">
            <div className="text-center">
              <div className="font-outfit text-2xl sm:text-3xl font-black">
                {completedCount} / {challenges.length}
              </div>
              <div className="text-[11px] font-bold text-white/85">Bajarildi ({progressPct}%)</div>
            </div>
            <div className="w-16 h-2.5 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid Section: 5 cards per row, up to 6 rows (30 cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-outfit text-lg font-black text-on-surface flex items-center gap-2">
            <GridIcon className="w-5 h-5 text-amber-500" />
            <span>Challenge Kunlari ({challenges.length} / 30)</span>
          </h2>
          <span className="text-xs text-outline font-bold">5 ta card · qatorma-qator</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-outline text-xs font-bold flex flex-col items-center">
            <div className="w-7 h-7 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="mt-2">Challenge kunlari yuklanmoqda...</p>
          </div>
        ) : challenges.length === 0 ? (
          <div className="bg-surface rounded-3xl p-10 border border-dashed border-outline-variant text-center space-y-2.5 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <TrophyIcon className="w-7 h-7" />
            </div>
            <h3 className="font-outfit font-bold text-base text-on-surface">
              Hozircha challenge kunlari qo‘shilmagan
            </h3>
            <p className="text-xs text-outline max-w-md mx-auto leading-relaxed">
              Admin tomonidan 30 day Challenge doirasida kunlik kartalar qo‘shilishi bilan shu yerda 5 tadan qator ko‘rinishida paydo bo‘ladi.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
            {challenges.map((ch) => {
              const isCompleted = ch.completed;
              const liveEval = computeClientBonusEval(ch, nowMs);
              const timerLabel = formatRemainingShort(liveEval.remainingMs);

              return (
                <div
                  key={ch.day}
                  onClick={() => handleOpenDay(ch)}
                  className={`rounded-2xl overflow-hidden border transition-all duration-300 flex flex-col justify-between cursor-pointer group shadow-2xs hover:shadow-md ${
                    isCompleted
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-500'
                      : liveEval.status === 'urgent'
                      ? 'border-orange-300 dark:border-orange-700 bg-surface hover:border-orange-500 hover:-translate-y-0.5'
                      : liveEval.status === 'expired'
                      ? 'border-outline-variant bg-surface-container/60 opacity-80'
                      : 'border-amber-300/80 dark:border-amber-800/70 bg-surface hover:border-amber-500 hover:-translate-y-0.5'
                  }`}
                >
                  {/* Card cover image (Admin uploaded) */}
                  <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                    {ch.image ? (
                      <img
                        src={resolveChallengeImageUrl(ch.image)}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          const rel = getRelativeUploadPath(ch.image);
                          if (rel && !e.currentTarget.src.endsWith(rel)) {
                            e.currentTarget.src = rel;
                            return;
                          }
                          e.currentTarget.style.display = 'none';
                          const fb = e.currentTarget.nextElementSibling;
                          if (fb) fb.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full items-center justify-center bg-gradient-to-br from-amber-500/20 to-indigo-500/20 ${
                        ch.image ? 'hidden' : 'flex'
                      }`}
                    >
                      <TrophyIcon className="w-8 h-8 text-amber-500" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />

                    {/* Day Number */}
                    <div className="absolute top-2 left-2 z-10">
                      <span className="px-2.5 py-0.5 rounded-lg bg-black/65 backdrop-blur-md text-white font-outfit font-black text-[11px] border border-white/20">
                        Day {ch.day}
                      </span>
                    </div>

                    {/* Status / Bonus Tier Badge */}
                    <div className="absolute top-2 right-2 z-10">
                      {isCompleted ? (
                        <span className={`px-2 py-0.5 rounded-full text-white font-bold text-[10px] flex items-center gap-0.5 shadow-xs ${
                          (ch.mySubmission?.bonusPercent ?? 100) === 0 || ch.mySubmission?.late
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}>
                          <CheckIcon className="w-3 h-3" />
                          <span>{ch.mySubmission?.bonusPercent ?? 100}%</span>
                        </span>
                      ) : liveEval.status === 'urgent' ? (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white font-black text-[10px] animate-pulse shadow-xs">
                          50% Bonus
                        </span>
                      ) : liveEval.status === 'expired' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold text-[10px]">
                          Kech (0%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px] shadow-xs">
                          100% Bonus
                        </span>
                      )}
                    </div>

                    {/* Bonuses preview bar */}
                    <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-white font-bold">
                      <span>⚡ {ch.xp || 0}</span>
                      <span className="flex items-center gap-0.5"><CoinIcon className="w-3 h-3" /> {ch.coins || 0}</span>
                      <span>🔥 +{ch.streakBonus ?? 2}</span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <h4 className="font-outfit font-extrabold text-xs text-on-surface line-clamp-2 leading-tight">
                        {ch.title}
                      </h4>
                      {ch.deadline && (
                        <p className="text-[10px] text-outline mt-1 font-mono flex items-center gap-1">
                          <ClockIcon className="w-3 h-3 text-outline" />
                          <span className="truncate">{timerLabel}</span>
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      data-testid={`open-day-${ch.day}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDay(ch);
                      }}
                      className={`w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <span>Ochish</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== CHALLENGE DAY DETAILS MODAL (OCHISH) ==================== */}
      {selectedChallenge &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-surface border border-outline-variant rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] my-auto">
              {/* Hero Cover */}
              <div className="relative h-44 sm:h-52 w-full overflow-hidden shrink-0 bg-slate-800">
                {selectedChallenge.image ? (
                  <img
                    src={resolveChallengeImageUrl(selectedChallenge.image)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const rel = getRelativeUploadPath(selectedChallenge.image);
                      if (rel && !e.currentTarget.src.endsWith(rel)) {
                        e.currentTarget.src = rel;
                        return;
                      }
                      e.currentTarget.style.display = 'none';
                      const fb = e.currentTarget.nextElementSibling;
                      if (fb) fb.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className={`w-full h-full items-center justify-center bg-gradient-to-r from-amber-500 to-orange-600 ${
                    selectedChallenge.image ? 'hidden' : 'flex'
                  }`}
                >
                  <TrophyIcon className="w-12 h-12 text-white" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/25 pointer-events-none" />

                <button
                  type="button"
                  onClick={() => setSelectedChallenge(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer transition-colors z-20"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>

                <div className="absolute bottom-4 left-4 right-4 z-10 text-white space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-500 font-black font-outfit text-xs text-white uppercase">
                      Day {selectedChallenge.day}
                    </span>
                    {selectedChallenge.completed && (
                      <span className={`px-2.5 py-0.5 rounded-md font-bold text-xs text-white flex items-center gap-1 ${
                        (selectedChallenge.mySubmission?.bonusPercent ?? 100) === 0 || selectedChallenge.mySubmission?.late
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}>
                        <CheckIcon className="w-3.5 h-3.5" />
                        Bajarilgan ({selectedChallenge.mySubmission?.bonusPercent ?? 100}% bonus)
                      </span>
                    )}
                    {selectedChallenge.deadline && (
                      <span className="px-2.5 py-0.5 rounded-md bg-black/55 font-mono text-[11px] font-bold flex items-center gap-1">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{formatRemainingShort(computeClientBonusEval(selectedChallenge, nowMs).remainingMs)}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-outfit font-black text-xl sm:text-2xl leading-tight">
                    {selectedChallenge.title}
                  </h3>
                </div>
              </div>

              {/* Body: Info, Tasks, Images, 100%/50% Bonus Calculation */}
              {(() => {
                const liveEval = computeClientBonusEval(selectedChallenge, nowMs);
                const mult = selectedChallenge.completed
                  ? (selectedChallenge.mySubmission?.bonusPercent ?? 100) / 100
                  : liveEval.bonusPercent / 100;
                const previewXp = Math.round((Number(selectedChallenge.xp) || 0) * mult);
                const previewCoins = Math.round((Number(selectedChallenge.coins) || 0) * mult);
                const rawStreak = Number(selectedChallenge.streakBonus ?? 2) || 0;
                const previewStreak = rawStreak > 0 && mult > 0 ? Math.max(1, Math.round(rawStreak * mult)) : 0;

                const gallery = Array.isArray(selectedChallenge.images) && selectedChallenge.images.length > 0
                  ? selectedChallenge.images
                  : (selectedChallenge.image ? [selectedChallenge.image] : []);

                return (
                  <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Bonus Tier Status Banner */}
                    <div
                      className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        selectedChallenge.completed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                          : liveEval.status === 'urgent'
                          ? 'bg-orange-500/10 border-orange-500/35 text-orange-800 dark:text-orange-200'
                          : liveEval.status === 'expired'
                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                          : 'bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <TrophyIcon className="w-4 h-4 shrink-0" />
                          <span>
                            {selectedChallenge.completed
                              ? `Olgan mukofotingiz (${selectedChallenge.mySubmission?.bonusPercent ?? 100}%):`
                              : liveEval.status === 'urgent'
                              ? 'Muddati juda kam qoldi! Hozir topshirsangiz 50% bonus beriladi:'
                              : liveEval.status === 'expired'
                              ? 'Topshirish muddati o‘tgan — kech topshirish mumkin (0% bonus, sariq holat):'
                              : 'O‘z muddatida topshirish — 100% to‘liq bonus:'}
                          </span>
                        </div>
                        <p className="text-[11px] opacity-80">
                          Bazaviy bonus: +{selectedChallenge.coins || 0} Coin, +{rawStreak} Streak, +{selectedChallenge.xp || 0} XP
                        </p>
                      </div>

                      <div className="flex items-center gap-2 font-outfit font-black text-xs shrink-0 flex-wrap">
                        <span className="dashboard-subcard px-2.5 py-1 rounded-xl bg-white/80 dark:bg-slate-900/60 flex items-center gap-1">
                          <CoinIcon className="w-3.5 h-3.5" /> +{previewCoins} Coin
                        </span>
                        <span className="dashboard-subcard px-2.5 py-1 rounded-xl bg-white/80 dark:bg-slate-900/60">🔥 +{previewStreak} Streak</span>
                        <span className="dashboard-subcard px-2.5 py-1 rounded-xl bg-white/80 dark:bg-slate-900/60">⚡ +{previewXp} XP</span>
                      </div>
                    </div>

                    {/* Ma'lumotlar */}
                    <div>
                      <h4 className="text-xs font-bold text-outline uppercase tracking-wider mb-1.5">
                        Ma'lumotlar
                      </h4>
                      <p className="text-xs sm:text-sm text-on-surface leading-relaxed font-medium">
                        {selectedChallenge.description || "Bugungi kun uchun belgilangan topshiriqlarni bajarib bonuslarga ega bo'ling."}
                      </p>
                    </div>

                    {/* Vazifalar */}
                    {(selectedChallenge.tasks || []).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-outline uppercase tracking-wider">
                          Vazifalar ({selectedChallenge.tasks.length} ta)
                        </h4>
                        <div className="space-y-2">
                          {selectedChallenge.tasks.map((t, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-on-surface flex items-start gap-2.5"
                            >
                              <CheckCircleIcon className="w-4 h-4 text-amber-500 mt-0.5" />
                              <span>{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Rasmlar galereyasi */}
                    {gallery.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-outline uppercase tracking-wider">
                          Rasmlar ({gallery.length} ta)
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                          {gallery.map((imgUrl, idx) => {
                            const fullUrl = resolveChallengeImageUrl(imgUrl);
                            const relUrl = getRelativeUploadPath(imgUrl);
                            return (
                              <div
                                key={idx}
                                onClick={() => setLightboxUrl(fullUrl)}
                                className="relative h-28 rounded-2xl overflow-hidden border border-outline-variant cursor-zoom-in group bg-slate-100 dark:bg-slate-800"
                              >
                                <img
                                  src={fullUrl}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => {
                                    if (relUrl && !e.currentTarget.src.endsWith(relUrl)) {
                                      e.currentTarget.src = relUrl;
                                      return;
                                    }
                                    e.currentTarget.parentElement.style.display = 'none';
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Student completion note */}
                    {!selectedChallenge.completed && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-outline block">
                          Izoh / hisobot (ixtiyoriy):
                        </label>
                        <textarea
                          rows={2}
                          value={studentNote}
                          onChange={(e) => setStudentNote(e.target.value)}
                          placeholder="Bugungi vazifani qanday bajarganingiz haqida qisqacha yozing..."
                          className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-xs text-on-surface outline-none focus:border-primary resize-none"
                        />
                      </div>
                    )}

                    {completeError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold">
                        {completeError}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Modal Footer */}
              <div className="p-4 sm:px-6 bg-surface border-t border-outline-variant flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedChallenge(null)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-outline hover:text-on-surface cursor-pointer"
                >
                  Yopish
                </button>
                {!selectedChallenge.completed ? (() => {
                  const isLateNow = computeClientBonusEval(selectedChallenge, nowMs).status === 'expired';
                  return (
                    <button
                      type="button"
                      onClick={() => handleCompleteDay(selectedChallenge.day)}
                      disabled={completingDay === selectedChallenge.day}
                      className={`px-6 py-2.5 rounded-full text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-45 ${
                        isLateNow
                          ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
                          : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/25'
                      }`}
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      <span>
                        {completingDay === selectedChallenge.day
                          ? 'Saqlanmoqda...'
                          : isLateNow
                          ? 'Kech topshirish (0% bonus)'
                          : 'Vazifani yakunlash (Bajarildi)'}
                      </span>
                    </button>
                  );
                })() : (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircleIcon className="w-4 h-4" />
                    Vazifa yakunlangan
                  </span>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Lightbox for internal gallery images */}
      {lightboxUrl &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setLightboxUrl('')}
            className="fixed inset-0 z-[100000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          >
            <img
              src={resolveChallengeImageUrl(lightboxUrl)}
              alt="Full preview"
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
              onError={(e) => {
                const rel = getRelativeUploadPath(lightboxUrl);
                if (rel && !e.currentTarget.src.endsWith(rel)) {
                  e.currentTarget.src = rel;
                }
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
