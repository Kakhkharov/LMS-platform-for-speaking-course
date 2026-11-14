import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';

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

const BRUSH_OPTIONS = [
  { id: 'inspect', label: 'Tanlash', icon: 'touch_app', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700' },
  { id: 'green', label: 'Yashil', icon: 'brush', cls: 'bg-emerald-500 text-white border-emerald-600' },
  { id: 'yellow', label: 'Sariq', icon: 'brush', cls: 'bg-amber-400 text-amber-950 border-amber-500' },
  { id: 'red', label: 'Qizil', icon: 'brush', cls: 'bg-rose-500 text-white border-rose-600' },
  { id: 'auto', label: 'Avto (Tozalash)', icon: 'auto_fix_high', cls: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' }
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
    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
  };
}

function getChallengeCellClass(effectiveColor, dimmed = false) {
  const dimCls = dimmed ? 'opacity-25' : '';
  if (effectiveColor === 'green') {
    return `bg-emerald-500 hover:bg-emerald-600 text-white ${dimCls}`;
  }
  if (effectiveColor === 'yellow') {
    return `bg-amber-400 hover:bg-amber-500 text-amber-950 ${dimCls}`;
  }
  if (effectiveColor === 'red') {
    return `bg-rose-500 hover:bg-rose-600 text-white ${dimCls}`;
  }
  return `bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 ${dimCls}`;
}

function getColorLabelUz(color) {
  if (color === 'green') return 'Yashil (Muddatida)';
  if (color === 'yellow') return 'Sariq (Deadlinedan keyin)';
  if (color === 'red') return 'Qizil (Tashlanmagan)';
  return 'Belgilanmagan';
}

export default function AdminProgress({ courses = [], students = [], onSessionExpired = null }) {
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
    courses: [],
    totalStudents: 0,
    homeworkReport: [],
    challengesReport: [],
    generatedAt: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const hasLoadedRef = useRef(false);
  const lastPayloadSigRef = useRef('');
  const onSessionExpiredRef = useRef(onSessionExpired);
  onSessionExpiredRef.current = onSessionExpired;

  // Filters shared across both reports
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('all'); // 'all' | 'green' | 'yellow' | 'red'
  const [courseFilter, setCourseFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Manual paint state for 30-Day Challenges Report
  const [paintBrush, setPaintBrush] = useState('inspect'); // 'inspect' | 'green' | 'yellow' | 'red' | 'auto'
  const [selectedCell, setSelectedCell] = useState(null); // { userId, fullName, day, dayMeta, cell }
  const [savingCellKey, setSavingCellKey] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = useCallback((text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(prev => (prev && prev.text === text ? null : prev));
    }, 3200);
  }, []);

  const fetchProgress = useCallback(async ({ silent = false } = {}) => {
    const isInitialLoad = !hasLoadedRef.current;
    if (!silent && isInitialLoad) {
      setLoading(true);
    } else if (!silent) {
      setRefreshing(true);
    }
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/progress`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status === 401 || res.status === 403) {
        onSessionExpiredRef.current?.();
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Progress ma\'lumotlarini yuklashda xatolik');
      }
      const data = await res.json();
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

  const availableCourses = useMemo(() => {
    const set = new Set(progressData.courses || []);
    (courses || []).forEach(c => {
      const t = typeof c === 'string' ? c : (c?.title || c?.name);
      if (t) set.add(String(t).trim());
    });
    (students || []).forEach(s => {
      if (s?.course && !['barchasi', 'all'].includes(String(s.course).toLowerCase())) {
        String(s.course)
          .split(',')
          .map(x => x.trim())
          .filter(Boolean)
          .forEach(c => set.add(c));
      }
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'uz'));
  }, [progressData.courses, courses, students]);

  // Filtered Homework rows
  const filteredHomeworkRows = useMemo(() => {
    const rows = Array.isArray(progressData.homeworkReport) ? progressData.homeworkReport : [];
    const q = searchQuery.trim().toLowerCase();
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
        const matchedCourse = rowCourses.some(c => c.toLowerCase() === courseFilter.toLowerCase());
        if (!matchedCourse) return false;
      }
      if (colorFilter !== 'all' && row.rowColor !== colorFilter) {
        return false;
      }
      if (dateFilter) {
        const dates = [
          ...(Array.isArray(row.homeworkDateIsos) ? row.homeworkDateIsos : []),
          ...(Array.isArray(row.challengeDateIsos) ? row.challengeDateIsos : []),
          row.homeworkDateIso,
          row.challengesDateIso
        ].filter(Boolean);
        if (!dates.includes(dateFilter)) return false;
      }
      return true;
    });
  }, [progressData.homeworkReport, searchQuery, courseFilter, colorFilter, dateFilter]);

  // Visible Challenge Days (All 30 days by default, or filtered by dateFilter)
  const visibleChallengeDaysMeta = useMemo(() => {
    const meta = Array.isArray(progressData.challengeDaysMeta) ? progressData.challengeDaysMeta : [];
    if (!dateFilter) return meta;
    return meta.filter(m => m.dateIso === dateFilter || m.deadlineIso === dateFilter);
  }, [progressData.challengeDaysMeta, dateFilter]);

  // Filtered Challenges rows
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
        const matchedCourse = rowCourses.some(c => c.toLowerCase() === courseFilter.toLowerCase());
        if (!matchedCourse) return false;
      }
      if (colorFilter !== 'all') {
        const hasMatchingColor = (row.days || []).some(
          d => (!dateFilter || visibleDaySet.has(Number(d.day))) && d.effectiveColor === colorFilter
        );
        if (!hasMatchingColor) return false;
      }
      return true;
    });
  }, [progressData.challengesReport, visibleChallengeDaysMeta, searchQuery, courseFilter, colorFilter, dateFilter]);

  // Manual color override API call
  const applyManualCellColor = async (userId, dayNum, color, studentName = '') => {
    const cellKey = `${userId}_${dayNum}`;
    setSavingCellKey(cellKey);
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/progress/challenges/override`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ userId, day: dayNum, color })
      });
      if (res.status === 401 || res.status === 403) {
        onSessionExpiredRef.current?.();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Rangni saqlashda xatolik');
      }
      const { generatedAt: _ignoredTs, ...comparable } = data || {};
      lastPayloadSigRef.current = JSON.stringify(comparable);
      hasLoadedRef.current = true;
      setProgressData(data);
      setSelectedCell(prev => {
        if (!prev || prev.userId !== userId || Number(prev.day) !== Number(dayNum)) return prev;
        const updatedRow = (data.challengesReport || []).find(r => r.userId === userId);
        const updatedDayCell = updatedRow?.days?.find(d => Number(d.day) === Number(dayNum));
        return updatedDayCell ? { ...prev, cell: updatedDayCell } : null;
      });
      const actionText = color === 'auto' ? 'avtomatik holatga qaytarildi' : `${getColorLabelUz(color)} rangga bo'yaldi`;
      showToast(`${studentName || 'Talaba'} · Day ${dayNum} ${actionText}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingCellKey('');
    }
  };

  const handleCellClick = (row, cell, dayMeta) => {
    if (paintBrush !== 'inspect') {
      applyManualCellColor(row.userId, cell.day, paintBrush, row.fullName);
      return;
    }
    setSelectedCell({
      userId: row.userId,
      fullName: row.fullName,
      email: row.email,
      courseName: row.courseName,
      day: cell.day,
      dayMeta,
      cell
    });
  };

  // Excel Download handler (supports both Homework Report & Challenges Report)
  const handleExportExcel = () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (activeReport === 'homework') {
        const exportRows = filteredHomeworkRows.map(row => ({
          '#': row.rank,
          'Talabaning ism-familiyasi': row.fullName,
          'Gmail pochtasi': row.email,
          'Kurs nomi': row.courseName,
          'Topshiriq berilgan sana': row.homeworkDate,
          'Topshiriqlar (Bajarildi)': row.homeworkDone,
          'Topshiriqlar (Bajarilmadi)': row.homeworkNotDone,
          'Topshiriqlar (Jami)': row.homeworkTotal,
          'Challenges Date': row.challengesDate,
          'Challenges (Bajarildi)': row.challengeDone,
          'Challenges (Bajarilmadi)': row.challengeNotDone,
          'Challenges (Jami)': row.challengeTotal,
          'Total (Bajarildi)': row.totalCompleted,
          'Total (Jami)': row.totalAssigned,
          'Holat': getRowColorBadge(row.rowColor).label
        }));
        const ws = XLSX.utils.json_to_sheet(exportRows);
        ws['!cols'] = [
          { wch: 5 },
          { wch: 24 },
          { wch: 28 },
          { wch: 28 },
          { wch: 22 },
          { wch: 16 },
          { wch: 16 },
          { wch: 14 },
          { wch: 22 },
          { wch: 16 },
          { wch: 16 },
          { wch: 14 },
          { wch: 14 },
          { wch: 14 },
          { wch: 12 }
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Homework Report');
        XLSX.writeFile(wb, `Homework_Report_${todayStr}.xlsx`);
        showToast('Homework Report Excel (.xlsx) fayli yuklab olindi!');
      } else {
        const exportRows = filteredChallengesRows.map(row => {
          const obj = {
            '#': row.rank,
            'Full name': row.fullName,
            'Gmail pochtasi': row.email,
            'Kurs nomi': row.courseName,
            'Bajarildi': row.completedCount,
            'Yashil': row.greenCount,
            'Sariq': row.yellowCount,
            'Qizil': row.redCount
          };
          visibleChallengeDaysMeta.forEach(meta => {
            const cell = (row.days || []).find(d => Number(d.day) === Number(meta.day));
            const headerKey = `Day ${meta.day} (${meta.dateDisplay || '—'})`;
            let val = getColorLabelUz(cell?.effectiveColor || 'none');
            if (cell?.manualColor) val += " [Qo'lda]";
            obj[headerKey] = val;
          });
          return obj;
        });
        const ws = XLSX.utils.json_to_sheet(exportRows);
        ws['!cols'] = [
          { wch: 5 },
          { wch: 24 },
          { wch: 28 },
          { wch: 26 },
          { wch: 10 },
          { wch: 8 },
          { wch: 8 },
          { wch: 8 },
          ...visibleChallengeDaysMeta.map(() => ({ wch: 20 }))
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Challenges Report');
        XLSX.writeFile(wb, `Challenges_Report_${todayStr}.xlsx`);
        showToast('Challenges Report Excel (.xlsx) fayli yuklab olindi!');
      }
    } catch (err) {
      showToast('Excel eksportida xatolik: ' + err.message, 'error');
    }
  };

  const hasActiveFilter = Boolean(searchQuery.trim() || colorFilter !== 'all' || courseFilter !== 'all' || dateFilter);

  const clearAllFilters = () => {
    setSearchQuery('');
    setColorFilter('all');
    setCourseFilter('all');
    setDateFilter('');
  };

  const summaryStats = useMemo(() => {
    const hwRows = progressData.homeworkReport || [];
    const chRows = progressData.challengesReport || [];
    return {
      totalStudents: progressData.totalStudents || hwRows.length,
      hwGreen: hwRows.filter(r => r.rowColor === 'green').length,
      hwYellow: hwRows.filter(r => r.rowColor === 'yellow').length,
      hwRed: hwRows.filter(r => r.rowColor === 'red').length,
      chGreen: chRows.reduce((s, r) => s + (r.greenCount || 0), 0),
      chYellow: chRows.reduce((s, r) => s + (r.yellowCount || 0), 0),
      chRed: chRows.reduce((s, r) => s + (r.redCount || 0), 0),
      activeChallengeDays: (progressData.challengeDaysMeta || []).filter(m => m.exists).length,
      manualOverridesTotal: chRows.reduce((s, r) => s + (r.manualOverrideCount || 0), 0)
    };
  }, [progressData]);

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-[10000] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
            toastMsg.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-emerald-600 text-white border-emerald-500'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toastMsg.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">monitoring</span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Progress & Hisobotlar</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sinxron
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Kurslardagi uyga vazifalar, topshiriqlar va 30 kunlik Challenges natijalari nazorati
              </p>
            </div>
          </div>
        </div>

        {/* Right Actions: Refresh + Excel Download */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchProgress()}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-70"
          >
            <span className={`material-symbols-outlined text-[17px] text-indigo-500 ${refreshing ? 'animate-spin' : ''}`}>sync</span>
            <span>{refreshing ? 'Yangilanmoqda...' : 'Yangilash'}</span>
          </button>

          <button
            type="button"
            data-testid="progress-excel-download"
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            <span>Excel (.xlsx) yuklab olish</span>
          </button>
        </div>
      </div>

      {/* Two Main Category Buttons: Homework Report & Challenges Report */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 gap-1.5">
          <button
            type="button"
            data-testid="tab-homework-report"
            onClick={() => {
              setActiveReport('homework');
              setSelectedCell(null);
            }}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeReport === 'homework'
                ? 'bg-[#1F4E37] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
            <span>Homework Report</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeReport === 'homework' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}>
              {filteredHomeworkRows.length}
            </span>
          </button>

          <button
            type="button"
            data-testid="tab-challenges-report"
            onClick={() => setActiveReport('challenges')}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeReport === 'challenges'
                ? 'bg-[#1F4E37] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-700/50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">calendar_view_month</span>
            <span>Challenges Report</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeReport === 'challenges' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}>
              {filteredChallengesRows.length} · 30 kun
            </span>
          </button>
        </div>

        {/* Summary KPI Chips */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
            Talabalar: <strong className="text-slate-950 dark:text-white">{summaryStats.totalStudents}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300">
            🟢 Yashil: {activeReport === 'homework' ? summaryStats.hwGreen : summaryStats.chGreen}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300">
            🟡 Sariq: {activeReport === 'homework' ? summaryStats.hwYellow : summaryStats.chYellow}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300">
            🔴 Qizil: {activeReport === 'homework' ? summaryStats.hwRed : summaryStats.chRed}
          </span>
        </div>
      </div>

      {/* Filters Toolbar (Both Reports: Search, Color, Course, Date) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Student Search Input */}
          <div className="md:col-span-4 relative">
            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              data-testid="progress-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Talabaning ismi yoki gmail pochtasi..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Course Filter */}
          <div className="md:col-span-3">
            <select
              data-testid="progress-course-filter"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Barcha kurslar</option>
              {availableCourses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="md:col-span-3 flex items-center gap-1.5">
            <input
              type="date"
              data-testid="progress-date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-bold cursor-pointer shrink-0"
                title="Sanani tozalash"
              >
                ✕
              </button>
            )}
          </div>

          {/* Color Select Dropdown (Quick access) */}
          <div className="md:col-span-2">
            <select
              data-testid="progress-color-filter"
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">Barcha ranglar</option>
              <option value="green">🟢 Yashil</option>
              <option value="yellow">🟡 Sariq</option>
              <option value="red">🔴 Qizil</option>
            </select>
          </div>
        </div>

        {/* Second Row: Quick Color Filter Pills + Clear button */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">Rang filtri:</span>
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                data-testid={`color-pill-${opt.id}`}
                onClick={() => setColorFilter(opt.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  colorFilter === opt.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
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
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">filter_alt_off</span>
              <span>Filtrlarni tozalash</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
          Xatolik: {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Progress jadvallari yuklanmoqda...</p>
        </div>
      ) : activeReport === 'homework' ? (
        /* ==================== REPORT A: HOMEWORK REPORT ==================== */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#1F4E37] text-white font-black text-[11px]">
                Homework Report
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Topshiriqlar, uyga vazifalar va Challenges bajarilish jadvali
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              Ko'rsatilmoqda: <strong className="text-slate-900 dark:text-white">{filteredHomeworkRows.length}</strong> talaba
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[1060px]" data-testid="admin-homework-report-table">
              <thead>
                <tr className="bg-[#1F4E37] text-white font-bold">
                  <th className="px-3 py-3 border border-[#173c2a] text-center w-12">#</th>
                  <th className="px-3.5 py-3 border border-[#173c2a]">Talabaning ism-familiyasi</th>
                  <th className="px-3.5 py-3 border border-[#173c2a]">Gmail pochtasi</th>
                  <th className="px-3.5 py-3 border border-[#173c2a]">Kurs nomi</th>
                  <th className="px-3 py-3 border border-[#173c2a] text-center">Topshiriq berilgan sana</th>
                  <th className="px-3.5 py-3 border border-[#173c2a] text-center">Topshiriqlar</th>
                  <th className="px-3 py-3 border border-[#173c2a] text-center">Challenges Date</th>
                  <th className="px-3.5 py-3 border border-[#173c2a] text-center">Challenges</th>
                  <th className="px-3.5 py-3 border border-[#173c2a] text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredHomeworkRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400 font-semibold">
                      Tanlangan filtrlar bo'yicha talaba topilmadi.
                    </td>
                  </tr>
                ) : (
                  filteredHomeworkRows.map((row) => {
                    const badge = getRowColorBadge(row.rowColor);
                    return (
                      <tr
                        key={row.userId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-center font-black text-slate-800 dark:text-slate-100">
                          {row.rank}
                        </td>
                        <td className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center justify-between gap-2">
                            <span>{row.fullName}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                row.tariff === 'FREE'
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  : 'bg-amber-400/20 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {row.tariff}
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                          {row.email}
                        </td>
                        <td className="px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                          {row.courseName}
                        </td>
                        <td className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-center font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.homeworkDate}
                        </td>
                        <td className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-center">
                          <div className="font-black text-sm text-slate-900 dark:text-white">
                            {row.homeworkDone}
                          </div>
                          <div className="flex items-center justify-center gap-1 flex-wrap mt-0.5 text-[10px] font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400">Bajardi: {row.homeworkDone}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-rose-600 dark:text-rose-400">Bajarmadi: {row.homeworkNotDone}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-500 dark:text-slate-400">Jami: {row.homeworkTotal}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-center font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {row.challengesDate}
                        </td>
                        <td className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-center">
                          <div className="font-black text-sm text-slate-900 dark:text-white">
                            {row.challengeDone}
                          </div>
                          <div className="flex items-center justify-center gap-1 flex-wrap mt-0.5 text-[10px] font-bold">
                            <span className="text-emerald-600 dark:text-emerald-400">Bajardi: {row.challengeDone}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-rose-600 dark:text-rose-400">Bajarmadi: {row.challengeNotDone}</span>
                            <span className="text-slate-300 dark:text-slate-600">|</span>
                            <span className="text-slate-500 dark:text-slate-400">Jami: {row.challengeTotal}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-black text-sm text-slate-950 dark:text-white">
                              {row.totalCompleted}
                              <span className="text-[10px] font-bold text-slate-400"> / {row.totalAssigned}</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ==================== REPORT B: 30-DAY CHALLENGES REPORT ==================== */
        <div className="space-y-3">
          {/* Legend + Manual Paint Brush Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Color rules legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-emerald-500 inline-block border border-emerald-600" />
                <span>Deadline ichida — Yashil</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-amber-400 inline-block border border-amber-500" />
                <span>Deadlinedan keyin — Sariq</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-rose-500 inline-block border border-rose-600" />
                <span>Tashlanmagan — Qizil</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 inline-block" />
                <span>Hali ochilmagan kun</span>
              </span>
            </div>

            {/* Manual Painting Tools */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-indigo-500">palette</span>
                Qo'lda bo'yash:
              </span>
              {BRUSH_OPTIONS.map(b => (
                <button
                  key={b.id}
                  type="button"
                  data-testid={`paint-brush-${b.id}`}
                  onClick={() => {
                    setPaintBrush(b.id);
                    if (b.id !== 'inspect') setSelectedCell(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border flex items-center gap-1 transition-all cursor-pointer ${
                    paintBrush === b.id
                      ? `${b.cls} ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-slate-900 shadow-xs scale-[1.02]`
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{b.icon}</span>
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 30-Day Spreadsheet Matrix */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs min-w-[1400px]" data-testid="admin-challenges-report-table">
                <thead>
                  {/* Row 1: Dates above Day 1..Day 30 */}
                  <tr className="bg-[#163b29] text-emerald-100 text-[10px] font-bold">
                    <th className="px-2.5 py-1.5 border border-[#123021] text-center sticky left-0 z-20 bg-[#163b29] w-12">
                      Sana
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] sticky left-12 z-20 bg-[#163b29] min-w-[190px]">
                      30 Day Challenge
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] min-w-[190px]">
                      Aloqa
                    </th>
                    <th className="px-3 py-1.5 border border-[#123021] min-w-[180px]">
                      Yo'nalish
                    </th>
                    {visibleChallengeDaysMeta.map(meta => (
                      <th
                        key={`date_${meta.day}`}
                        className="px-1.5 py-1.5 border border-[#123021] text-center whitespace-nowrap font-mono min-w-[68px]"
                        title={`${meta.title}${meta.deadlineDisplay ? ` | Muddat: ${meta.deadlineDisplay}` : ''}`}
                      >
                        {meta.dateDisplay}
                      </th>
                    ))}
                  </tr>

                  {/* Row 2: Main Column Headers */}
                  <tr className="bg-[#1F4E37] text-white font-bold">
                    <th className="px-2.5 py-2.5 border border-[#173c2a] text-center sticky left-0 z-20 bg-[#1F4E37] w-12">
                      #
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] sticky left-12 z-20 bg-[#1F4E37] min-w-[190px]">
                      Full name
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] min-w-[190px]">
                      Gmail pochtasi
                    </th>
                    <th className="px-3 py-2.5 border border-[#173c2a] min-w-[180px]">
                      Kurs nomi
                    </th>
                    {visibleChallengeDaysMeta.map(meta => (
                      <th
                        key={`day_${meta.day}`}
                        className="px-2 py-2.5 border border-[#173c2a] text-center whitespace-nowrap min-w-[68px]"
                        title={`${meta.title}${meta.deadlineDisplay ? ` | Deadline: ${meta.deadlineDisplay}` : ''}`}
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
                        className="px-4 py-10 text-center text-slate-500 dark:text-slate-400 font-semibold"
                      >
                        {dateFilter && visibleChallengeDaysMeta.length === 0
                          ? `Tanlangan sana (${dateFilter}) uchun challenge kuni topilmadi.`
                          : "Tanlangan filtrlar bo'yicha talaba topilmadi."}
                      </td>
                    </tr>
                  ) : (
                    filteredChallengesRows.map(row => (
                      <tr key={row.userId} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-2.5 py-2.5 border border-slate-300 dark:border-slate-700 text-center font-black sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-slate-800 dark:text-slate-100">
                          {row.rank}
                        </td>
                        <td className="px-3 py-2.5 border border-slate-300 dark:border-slate-700 font-bold sticky left-12 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-slate-900 dark:text-white whitespace-nowrap">
                          {row.fullName}
                        </td>
                        <td className="px-3 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
                          {row.email}
                        </td>
                        <td className="px-3 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                          {row.courseName}
                        </td>
                        {visibleChallengeDaysMeta.map(meta => {
                          const cell = (row.days || []).find(d => Number(d.day) === Number(meta.day)) || {
                            day: meta.day,
                            exists: meta.exists,
                            autoColor: 'none',
                            manualColor: null,
                            effectiveColor: 'none'
                          };
                          const dimmed = colorFilter !== 'all' && cell.effectiveColor !== colorFilter;
                          const cellKey = `${row.userId}_${meta.day}`;
                          const isSaving = savingCellKey === cellKey;
                          const isSelected = selectedCell?.userId === row.userId && Number(selectedCell?.day) === Number(meta.day);

                          return (
                            <td
                              key={cellKey}
                              data-testid={`challenge-cell-${row.userId}-${meta.day}`}
                              onClick={() => handleCellClick(row, cell, meta)}
                              title={`${row.fullName} · Day ${meta.day} (${meta.dateDisplay}) — ${getColorLabelUz(cell.effectiveColor)}${cell.manualColor ? " (Qo'lda bo'yalgan)" : ' (Avtomatik)'}`}
                              className={`relative border border-slate-300 dark:border-slate-700 p-0 h-10 min-w-[68px] text-center select-none transition-all ${
                                paintBrush !== 'inspect' ? 'cursor-crosshair' : 'cursor-pointer'
                              } ${getChallengeCellClass(cell.effectiveColor, dimmed)} ${
                                isSelected ? 'ring-2 ring-inset ring-indigo-600 dark:ring-white z-10' : ''
                              }`}
                            >
                              {isSaving && (
                                <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              )}
                              {!isSaving && cell.manualColor && (
                                <span
                                  className="absolute top-1 right-1 w-2 h-2 rounded-full bg-white shadow-xs border border-black/20"
                                  title="Qo'lda bo'yalgan"
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Cell Details & Manual Color Picker Panel */}
          {selectedCell && (
            <div
              data-testid="challenge-cell-inspector"
              className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/40 p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#1F4E37] text-white font-black text-xs">
                    Day {selectedCell.day}
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-white">
                    {selectedCell.fullName}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ({selectedCell.dayMeta?.dateDisplay || '—'})
                  </span>
                  {selectedCell.cell?.manualColor && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[10px] font-black">
                      Qo'lda bo'yalgan
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Joriy holat: <strong>{getColorLabelUz(selectedCell.cell?.effectiveColor)}</strong>
                  {' · '}
                  Avtomatik: <strong>{getColorLabelUz(selectedCell.cell?.autoColor)}</strong>
                  {selectedCell.cell?.submittedAt && (
                    <span> · Topshirgan: {new Date(selectedCell.cell.submittedAt).toLocaleString('uz-UZ')}</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="inspector-paint-green"
                  disabled={savingCellKey === `${selectedCell.userId}_${selectedCell.day}`}
                  onClick={() => applyManualCellColor(selectedCell.userId, selectedCell.day, 'green', selectedCell.fullName)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  Yashil
                </button>
                <button
                  type="button"
                  data-testid="inspector-paint-yellow"
                  disabled={savingCellKey === `${selectedCell.userId}_${selectedCell.day}`}
                  onClick={() => applyManualCellColor(selectedCell.userId, selectedCell.day, 'yellow', selectedCell.fullName)}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  Sariq
                </button>
                <button
                  type="button"
                  data-testid="inspector-paint-red"
                  disabled={savingCellKey === `${selectedCell.userId}_${selectedCell.day}`}
                  onClick={() => applyManualCellColor(selectedCell.userId, selectedCell.day, 'red', selectedCell.fullName)}
                  className="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  Qizil
                </button>
                <button
                  type="button"
                  data-testid="inspector-paint-auto"
                  disabled={savingCellKey === `${selectedCell.userId}_${selectedCell.day}`}
                  onClick={() => applyManualCellColor(selectedCell.userId, selectedCell.day, 'auto', selectedCell.fullName)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  Avtomatikga qaytarish
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Yopish
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
