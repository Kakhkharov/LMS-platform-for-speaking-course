import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

const COLOR_OPTIONS = [
  { id: 'all', label: 'Barchasi', dotClass: 'bg-slate-400' },
  { id: 'green', label: 'Yashil', dotClass: 'bg-emerald-500' },
  { id: 'yellow', label: 'Sariq', dotClass: 'bg-amber-400' },
  { id: 'red', label: 'Qizil', dotClass: 'bg-rose-500' }
];

function getRowColorBadge(color) {
  if (color === 'green') {
    return {
      label: 'Yashil',
      cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
    };
  }
  if (color === 'yellow') {
    return {
      label: 'Sariq',
      cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-700'
    };
  }
  if (color === 'red') {
    return {
      label: 'Qizil',
      cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-700'
    };
  }
  return {
    label: "Bo'sh",
    cls: 'bg-surface-container text-outline border-outline-variant'
  };
}

function getChallengeCellClass(effectiveColor, dimmed = false) {
  const dimCls = dimmed ? 'opacity-25' : '';
  if (effectiveColor === 'green') {
    return `bg-emerald-500 text-white ${dimCls}`;
  }
  if (effectiveColor === 'yellow') {
    return `bg-amber-400 text-amber-950 ${dimCls}`;
  }
  if (effectiveColor === 'red') {
    return `bg-rose-500 text-white ${dimCls}`;
  }
  return `bg-white/95 dark:bg-slate-900/80 text-slate-400 ${dimCls}`;
}

function getColorLabelUz(color) {
  if (color === 'green') return 'Yashil (Muddatida)';
  if (color === 'yellow') return 'Sariq (Deadlinedan keyin)';
  if (color === 'red') return 'Qizil (Tashlanmagan)';
  return 'Belgilanmagan';
}

export default function StudentProgress({ profile = null, onPremiumRequired = null }) {
  const [activeReport, setActiveReport] = useState('homework'); // 'homework' | 'challenges'
  const [progressData, setProgressData] = useState({
    challengeDaysMeta: Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      exists: false,
      title: `Day ${i + 1}`,
      dateIso: '',
      dateDisplay: '—',
      deadlineIso: '',
      deadlineDisplay: ''
    })),
    homeworkTasksMeta: [],
    courses: [],
    totalStudents: 0,
    myStudentId: profile?.id || null,
    myHomeworkRank: null,
    myChallengesRank: null,
    homeworkReport: [],
    challengesReport: [],
    generatedAt: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const hasLoadedRef = useRef(false);
  const lastPayloadSigRef = useRef('');
  const onPremiumRequiredRef = useRef(onPremiumRequired);
  onPremiumRequiredRef.current = onPremiumRequired;

  // Search & Filter states (View mode)
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const fetchProgress = useCallback(async ({ silent = false } = {}) => {
    const isInitialLoad = !hasLoadedRef.current;
    if (!silent && isInitialLoad) {
      setLoading(true);
    } else if (!silent) {
      setRefreshing(true);
    }
    try {
      const token = localStorage.getItem('student_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/progress`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data?.code === 'PREMIUM_REQUIRED') {
        onPremiumRequiredRef.current?.('My Progress');
        setError(data.error || "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Progress ma'lumotlarini yuklashda xatolik");
      }
      const { generatedAt: _ignoredTs, ...comparable } = data || {};
      const nextSig = JSON.stringify(comparable);
      if (nextSig !== lastPayloadSigRef.current) {
        lastPayloadSigRef.current = nextSig;
        setProgressData(data);
      }
      hasLoadedRef.current = true;
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent && isInitialLoad) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProgress();
    const poll = setInterval(() => fetchProgress({ silent: true }), 10000);

    let es = null;
    try {
      es = new EventSource(`${API_BASE}/api/system/stream`);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data || '{}');
          if (
            parsed.type === 'progress_update' ||
            parsed.type === 'tasks_update' ||
            parsed.type === 'challenge_update' ||
            parsed.type === 'student_tariff_update'
          ) {
            fetchProgress({ silent: true });
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      clearInterval(poll);
      if (es) es.close();
    };
  }, [fetchProgress]);

  const myHomeworkRow = useMemo(() => {
    const rows = progressData.homeworkReport || [];
    return rows.find(r => r.isSelf || (profile?.id && String(r.userId) === String(profile.id))) || null;
  }, [progressData.homeworkReport, profile?.id]);

  const myChallengesRow = useMemo(() => {
    const rows = progressData.challengesReport || [];
    return rows.find(r => r.isSelf || (profile?.id && String(r.userId) === String(profile.id))) || null;
  }, [progressData.challengesReport, profile?.id]);

  const visibleHomeworkTasksMeta = useMemo(() => {
    const meta = Array.isArray(progressData.homeworkTasksMeta) && progressData.homeworkTasksMeta.length > 0
      ? progressData.homeworkTasksMeta
      : Array.from({ length: 6 }, (_, i) => ({
          id: `hw_${i + 1}`,
          index: i + 1,
          title: `Homework ${i + 1}`,
          label: `HW ${i + 1}`,
          dateDisplay: '—'
        }));
    if (!dateFilter) return meta;
    return meta.filter(m => m.dateIso === dateFilter || m.deadlineIso === dateFilter);
  }, [progressData.homeworkTasksMeta, dateFilter]);

  const filteredHomeworkRows = useMemo(() => {
    const rows = Array.isArray(progressData.homeworkReport) ? progressData.homeworkReport : [];
    const q = searchQuery.trim().toLowerCase();
    const visibleTaskIdSet = new Set(visibleHomeworkTasksMeta.map(m => String(m.id || m.index)));

    return rows.filter(row => {
      if (q) {
        const matchName = (row.fullName || '').toLowerCase().includes(q);
        const matchEmail = (row.email || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      if (courseFilter !== 'all') {
        const rowCourses = Array.isArray(row.courses) && row.courses.length > 0
          ? row.courses
          : String(row.courseName || '').split(',').map(x => x.trim());
        if (!rowCourses.some(c => c.toLowerCase() === courseFilter.toLowerCase())) return false;
      }
      if (colorFilter !== 'all') {
        const cells = Array.isArray(row.taskCells) ? row.taskCells : (Array.isArray(row.days) ? row.days : []);
        const hasMatch = cells.some(
          d => (!dateFilter || visibleTaskIdSet.has(String(d.taskId || d.index))) && d.effectiveColor === colorFilter
        );
        if (!hasMatch && row.rowColor !== colorFilter) return false;
      }
      if (dateFilter) {
        const dates = [
          ...(Array.isArray(row.homeworkDateIsos) ? row.homeworkDateIsos : []),
          row.homeworkDateIso
        ].filter(Boolean);
        if (dates.length > 0 && !dates.includes(dateFilter)) return false;
      }
      return true;
    });
  }, [progressData.homeworkReport, visibleHomeworkTasksMeta, searchQuery, courseFilter, colorFilter, dateFilter]);

  const visibleChallengeDaysMeta = useMemo(() => {
    const meta = Array.isArray(progressData.challengeDaysMeta) ? progressData.challengeDaysMeta : [];
    if (!dateFilter) return meta;
    return meta.filter(m => m.dateIso === dateFilter || m.deadlineIso === dateFilter);
  }, [progressData.challengeDaysMeta, dateFilter]);

  const filteredChallengesRows = useMemo(() => {
    const rows = Array.isArray(progressData.challengesReport) ? progressData.challengesReport : [];
    const q = searchQuery.trim().toLowerCase();
    const visibleDaySet = new Set(visibleChallengeDaysMeta.map(m => Number(m.day)));

    return rows.filter(row => {
      if (q) {
        const matchName = (row.fullName || '').toLowerCase().includes(q);
        const matchEmail = (row.email || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      if (courseFilter !== 'all') {
        const rowCourses = Array.isArray(row.courses) && row.courses.length > 0
          ? row.courses
          : String(row.courseName || '').split(',').map(x => x.trim());
        if (!rowCourses.some(c => c.toLowerCase() === courseFilter.toLowerCase())) return false;
      }
      if (colorFilter !== 'all') {
        const hasMatch = (row.days || []).some(
          d => (!dateFilter || visibleDaySet.has(Number(d.day))) && d.effectiveColor === colorFilter
        );
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [progressData.challengesReport, visibleChallengeDaysMeta, searchQuery, courseFilter, colorFilter, dateFilter]);

  const hasActiveFilter = Boolean(searchQuery.trim() || colorFilter !== 'all' || courseFilter !== 'all' || dateFilter);

  const clearAllFilters = () => {
    setSearchQuery('');
    setColorFilter('all');
    setCourseFilter('all');
    setDateFilter('');
  };

  const myHwRank = progressData.myHomeworkRank || myHomeworkRow?.rank || null;
  const myChRank = progressData.myChallengesRank || myChallengesRow?.rank || null;
  const totalStudents = progressData.totalStudents || (progressData.homeworkReport || []).length;

  return (
    <div className="space-y-5 animate-fade-in pb-14 font-sans" data-testid="student-my-progress-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/70">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-outfit text-2xl sm:text-3xl font-black text-on-surface tracking-tight flex items-center gap-2">
              <span>My Progress</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-black border border-emerald-500/25">
                View
              </span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-outline mt-1 font-medium">
            Topshiriqlar, uyga vazifalar va 30 kunlik Challenges natijalaringiz jadvali
          </p>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => fetchProgress()}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-surface border border-outline-variant hover:border-primary/50 text-xs font-bold text-on-surface flex items-center gap-2 cursor-pointer shadow-2xs transition-colors disabled:opacity-70"
        >
          <span className={`material-symbols-outlined text-[16px] text-primary ${refreshing ? 'animate-spin' : ''}`}>sync</span>
          <span>{refreshing ? 'Yangilanmoqda...' : 'Yangilash'}</span>
        </button>
      </div>

      {/* Standing Rank Cards in Both Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => setActiveReport('homework')}
          data-testid="student-rank-card-homework"
          className={`dashboard-subcard text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
            activeReport === 'homework'
              ? 'bg-surface border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-surface border-outline-variant hover:border-emerald-500/40'
          }`}
        >
          <div className="space-y-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-outline">
              Homework Report o'rningiz
            </div>
            <div className="font-outfit text-2xl font-black text-on-surface flex items-baseline gap-2">
              <span>{myHwRank ? `${myHwRank}-o'rin` : '—'}</span>
              {totalStudents > 0 && (
                <span className="text-xs font-bold text-outline">/ {totalStudents} talaba</span>
              )}
            </div>
            {myHomeworkRow && (
              <div className="text-[11px] font-bold text-outline">
                Bajarilgan: <strong className="text-on-surface">{myHomeworkRow.totalCompleted}</strong> ta (Topshiriq: {myHomeworkRow.homeworkDone}, Challenge: {myHomeworkRow.challengeDone})
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#1F4E37] text-white font-outfit font-black text-lg flex items-center justify-center shrink-0 shadow-sm">
            #{myHwRank || '—'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveReport('challenges')}
          data-testid="student-rank-card-challenges"
          className={`dashboard-subcard text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
            activeReport === 'challenges'
              ? 'bg-surface border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-surface border-outline-variant hover:border-emerald-500/40'
          }`}
        >
          <div className="space-y-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-outline">
              Challenges Report o'rningiz
            </div>
            <div className="font-outfit text-2xl font-black text-on-surface flex items-baseline gap-2">
              <span>{myChRank ? `${myChRank}-o'rin` : '—'}</span>
              {totalStudents > 0 && (
                <span className="text-xs font-bold text-outline">/ {totalStudents} talaba</span>
              )}
            </div>
            {myChallengesRow && (
              <div className="text-[11px] font-bold text-outline">
                🟢 {myChallengesRow.greenCount} · 🟡 {myChallengesRow.yellowCount} · 🔴 {myChallengesRow.redCount}
              </div>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#1F4E37] text-white font-outfit font-black text-lg flex items-center justify-center shrink-0 shadow-sm">
            #{myChRank || '—'}
          </div>
        </button>
      </div>

      {/* Category Switcher Buttons */}
      <div className="inline-flex p-1.5 rounded-2xl bg-surface-container border border-outline-variant gap-1.5">
        <button
          type="button"
          data-testid="student-tab-homework"
          onClick={() => setActiveReport('homework')}
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeReport === 'homework'
              ? 'bg-[#1F4E37] text-white shadow-sm'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          Homework Report
        </button>
        <button
          type="button"
          data-testid="student-tab-challenges"
          onClick={() => setActiveReport('challenges')}
          className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeReport === 'challenges'
              ? 'bg-[#1F4E37] text-white shadow-sm'
              : 'text-outline hover:text-on-surface'
          }`}
        >
          Challenges Report (30 kun)
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-surface rounded-2xl border border-outline-variant p-4 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 relative">
            <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              data-testid="student-progress-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Talaba ismi yoki gmail..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-semibold text-on-surface outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              data-testid="student-progress-course-filter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">Barcha kurslar</option>
              {(progressData.courses || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              data-testid="student-progress-date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface outline-none focus:border-primary"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="px-2.5 py-2 rounded-xl bg-surface-container border border-outline-variant text-outline hover:text-on-surface text-xs font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <select
              data-testid="student-progress-color-filter"
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-on-surface outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">Barcha ranglar</option>
              <option value="green">🟢 Yashil</option>
              <option value="yellow">🟡 Sariq</option>
              <option value="red">🔴 Qizil</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-outline-variant/50">
          <div className="flex flex-wrap items-center gap-1.5">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setColorFilter(opt.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  colorFilter === opt.id
                    ? 'bg-primary text-on-primary border-primary shadow-2xs'
                    : 'bg-surface-container text-outline border-outline-variant hover:text-on-surface'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${opt.dotClass}`} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
            >
              Filtrlarni tozalash
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-surface rounded-2xl border border-outline-variant p-12 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-outline">Progress ma'lumotlari yuklanmoqda...</p>
        </div>
      ) : activeReport === 'homework' ? (
        /* ==================== STUDENT HOMEWORK REPORT (VIEW MODE) ==================== */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] font-bold text-outline">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
              <span>Deadline ichida — Yashil</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block" />
              <span>Deadlinedan keyin — Sariq</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500 inline-block" />
              <span>Tashlanmagan — Qizil</span>
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs min-w-[1380px]" data-testid="student-homework-table">
                <thead>
                  <tr className="bg-[#163b29] text-emerald-100 text-[10px] font-bold">
                    <th className="px-2.5 py-1.5 border border-[#123021] text-center sticky left-0 z-20 bg-[#163b29] w-12">
                      Sana
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] sticky left-12 z-20 bg-[#163b29] min-w-[190px]">
                      Homework Tasks
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] min-w-[180px]">
                      Aloqa
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] min-w-[170px]">
                      Yo'nalish
                    </th>
                    {visibleHomeworkTasksMeta.map(meta => (
                      <th
                        key={`hw_date_${meta.id || meta.index}`}
                        className="px-1.5 py-1.5 border border-[#123021] text-center whitespace-nowrap font-mono min-w-[66px]"
                        title={meta.title}
                      >
                        {meta.dateDisplay}
                      </th>
                    ))}
                  </tr>

                  <tr className="bg-[#1F4E37] text-white font-bold">
                    <th className="px-2.5 py-2.5 border border-[#173c2a] text-center sticky left-0 z-20 bg-[#1F4E37] w-12">
                      #
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] sticky left-12 z-20 bg-[#1F4E37] min-w-[190px]">
                      Full name
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] min-w-[180px]">
                      Gmail pochtasi
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] min-w-[170px]">
                      Kurs nomi
                    </th>
                    {visibleHomeworkTasksMeta.map(meta => (
                      <th
                        key={`hw_col_${meta.id || meta.index}`}
                        className="px-2 py-2.5 border border-[#173c2a] text-center whitespace-nowrap min-w-[66px]"
                        title={meta.title}
                      >
                        {meta.label || `HW ${meta.index}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHomeworkRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4 + visibleHomeworkTasksMeta.length}
                        className="px-4 py-10 text-center text-outline font-semibold"
                      >
                        Ma'lumot topilmadi.
                      </td>
                    </tr>
                  ) : (
                    filteredHomeworkRows.map(row => {
                      const isSelf = row.isSelf || (profile?.id && String(row.userId) === String(profile.id));
                      return (
                        <tr
                          key={row.userId}
                          data-testid={isSelf ? 'student-homework-self-row' : undefined}
                          className={isSelf ? 'bg-amber-500/15' : ''}
                        >
                          <td className={`px-2.5 py-2.5 border border-outline-variant text-center font-black sticky left-0 z-10 text-on-surface bg-surface ${isSelf ? 'shadow-[inset_0_0_0_9999px_rgba(245,158,11,0.16)]' : ''}`}>
                            {row.rank}
                          </td>
                          <td className={`px-3 py-2.5 border border-outline-variant font-bold sticky left-12 z-10 text-on-surface whitespace-nowrap bg-surface ${isSelf ? 'shadow-[inset_0_0_0_9999px_rgba(245,158,11,0.16)]' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span>{row.fullName}</span>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black">
                                  SIZ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border border-outline-variant text-outline font-medium whitespace-nowrap">
                            {row.email}
                          </td>
                          <td className="px-3 py-2.5 border border-outline-variant text-on-surface font-semibold">
                            {row.courseName}
                          </td>
                          {visibleHomeworkTasksMeta.map(meta => {
                            const cell = (row.taskCells || row.days || []).find(d => String(d.taskId) === String(meta.id) || Number(d.index) === Number(meta.index)) || {
                              effectiveColor: 'none'
                            };
                            const dimmed = colorFilter !== 'all' && cell.effectiveColor !== colorFilter;
                            return (
                              <td
                                key={`${row.userId}_${meta.id || meta.index}`}
                                data-testid={`student-hw-cell-${row.userId}-${meta.index}`}
                                title={`${row.fullName} · ${meta.title} (${meta.dateDisplay}) — ${getColorLabelUz(cell.effectiveColor)}`}
                                className={`border border-outline-variant p-0 h-9 min-w-[66px] ${getChallengeCellClass(cell.effectiveColor, dimmed)}`}
                              />
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== STUDENT 30-DAY CHALLENGES REPORT (VIEW MODE) ==================== */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] font-bold text-outline">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
              <span>Deadline ichida — Yashil</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-400 inline-block" />
              <span>Deadlinedan keyin — Sariq</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500 inline-block" />
              <span>Tashlanmagan — Qizil</span>
            </span>
          </div>

          <div className="bg-surface rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs min-w-[1380px]" data-testid="student-challenges-table">
                <thead>
                  <tr className="bg-[#163b29] text-emerald-100 text-[10px] font-bold">
                    <th className="px-2.5 py-1.5 border border-[#123021] text-center sticky left-0 z-20 bg-[#163b29] w-12">
                      Sana
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] sticky left-12 z-20 bg-[#163b29] min-w-[190px]">
                      30 Day Challenge
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] min-w-[180px]">
                      Aloqa
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] min-w-[170px]">
                      Yo'nalish
                    </th>
                    {visibleChallengeDaysMeta.map(meta => (
                      <th
                        key={`st_date_${meta.day}`}
                        className="px-1.5 py-1.5 border border-[#123021] text-center whitespace-nowrap font-mono min-w-[66px]"
                        title={meta.title}
                      >
                        {meta.dateDisplay}
                      </th>
                    ))}
                  </tr>

                  <tr className="bg-[#1F4E37] text-white font-bold">
                    <th className="px-2.5 py-2.5 border border-[#173c2a] text-center sticky left-0 z-20 bg-[#1F4E37] w-12">
                      #
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] sticky left-12 z-20 bg-[#1F4E37] min-w-[190px]">
                      Full name
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] min-w-[180px]">
                      Gmail pochtasi
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] min-w-[170px]">
                      Kurs nomi
                    </th>
                    {visibleChallengeDaysMeta.map(meta => (
                      <th
                        key={`st_day_${meta.day}`}
                        className="px-2 py-2.5 border border-[#173c2a] text-center whitespace-nowrap min-w-[66px]"
                      >
                        Day {meta.day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredChallengesRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4 + visibleChallengeDaysMeta.length}
                        className="px-4 py-10 text-center text-outline font-semibold"
                      >
                        Ma'lumot topilmadi.
                      </td>
                    </tr>
                  ) : (
                    filteredChallengesRows.map(row => {
                      const isSelf = row.isSelf || (profile?.id && String(row.userId) === String(profile.id));
                      return (
                        <tr
                          key={row.userId}
                          data-testid={isSelf ? 'student-challenges-self-row' : undefined}
                          className={isSelf ? 'bg-amber-500/15' : ''}
                        >
                          <td className={`px-2.5 py-2.5 border border-outline-variant text-center font-black sticky left-0 z-10 text-on-surface bg-surface ${isSelf ? 'shadow-[inset_0_0_0_9999px_rgba(245,158,11,0.16)]' : ''}`}>
                            {row.rank}
                          </td>
                          <td className={`px-3 py-2.5 border border-outline-variant font-bold sticky left-12 z-10 text-on-surface whitespace-nowrap bg-surface ${isSelf ? 'shadow-[inset_0_0_0_9999px_rgba(245,158,11,0.16)]' : ''}`}>
                            <div className="flex items-center gap-2">
                              <span>{row.fullName}</span>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black">
                                  SIZ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border border-outline-variant text-outline font-medium whitespace-nowrap">
                            {row.email}
                          </td>
                          <td className="px-3 py-2.5 border border-outline-variant text-on-surface font-semibold">
                            {row.courseName}
                          </td>
                          {visibleChallengeDaysMeta.map(meta => {
                            const cell = (row.days || []).find(d => Number(d.day) === Number(meta.day)) || {
                              day: meta.day,
                              effectiveColor: 'none'
                            };
                            const dimmed = colorFilter !== 'all' && cell.effectiveColor !== colorFilter;
                            return (
                              <td
                                key={`${row.userId}_${meta.day}`}
                                data-testid={`student-challenge-cell-${row.userId}-${meta.day}`}
                                title={`${row.fullName} · Day ${meta.day} (${meta.dateDisplay}) — ${getColorLabelUz(cell.effectiveColor)}`}
                                className={`border border-outline-variant p-0 h-9 min-w-[66px] ${getChallengeCellClass(cell.effectiveColor, dimmed)}`}
                              />
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
