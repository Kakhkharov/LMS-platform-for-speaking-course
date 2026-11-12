import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:5000'
  : 'https://api.mathscore.uz';

export default function AdminLeaderboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('all'); // 'daily', 'weekly', 'monthly', 'all'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('xp'); // 'xp', 'coins', 'streak'
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetToast, setResetToast] = useState(null);

  const showToastMessage = useCallback((text, type = 'success') => {
    setResetToast({ text, type });
    setTimeout(() => {
      setResetToast(prev => (prev && prev.text === text ? null : prev));
    }, 3500);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const params = new URLSearchParams({
        period: periodFilter,
        sortBy
      });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`${API_BASE}/api/leaderboard?${params.toString()}`, {
        cache: 'no-store',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      }
    } catch (err) {
      console.error('Admin leaderboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [periodFilter, sortBy, startDate, endDate]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);

    let es = null;
    try {
      es = new EventSource(`${API_BASE}/api/system/stream`);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data || '{}');
          if (parsed.type === 'gamification_update' || parsed.type === 'leaderboard_reset') {
            fetchLeaderboard();
          }
        } catch (e) {}
      };
    } catch (e) {}

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [fetchLeaderboard]);

  const handleConfirmResetAll = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      const token = localStorage.getItem('admin_token') || localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/leaderboard/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Ko'rsatkichlarni nolga tushirishda xatolik yuz berdi.");
      }
      setStudents(prev =>
        prev.map(st => ({
          ...st,
          xp: 0,
          displayXp: 0,
          coins: 0,
          streak: 0,
          dailyXp: 0,
          weeklyXp: 0,
          monthlyXp: 0,
          activityDates: []
        }))
      );
      setShowResetModal(false);
      await fetchLeaderboard();
      showToastMessage(
        data.message || "Barcha talabalarning Streak, Coin va XP ko'rsatkichlari 0 ga tushirildi!"
      );
    } catch (err) {
      showToastMessage(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  // Filterlash va saralash
  const filteredStudents = useMemo(() => {
    return students
      .filter(st => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (st.name || '').toLowerCase().includes(q);
          const matchEmail = (st.email || '').toLowerCase().includes(q);
          if (!matchName && !matchEmail) return false;
        }

        if (selectedCourse !== 'all') {
          const courseList = Array.isArray(st.courses) && st.courses.length > 0
            ? st.courses
            : (st.course ? [st.course] : []);
          if (!courseList.some(c => c === selectedCourse) && st.course !== selectedCourse) {
            return false;
          }
        }

        return true;
      })
      .map(st => ({
        ...st,
        displayXp: Number(st.displayXp ?? st.xp ?? 0),
        coins: Number(st.coins ?? 0),
        streak: Number(st.streak ?? 0)
      }))
      .sort((a, b) => {
        if (sortBy === 'coins') return (b.coins - a.coins) || (b.displayXp - a.displayXp);
        if (sortBy === 'streak') return (b.streak - a.streak) || (b.displayXp - a.displayXp);
        return (b.displayXp - a.displayXp) || (b.xp - a.xp);
      });
  }, [students, selectedCourse, searchQuery, sortBy]);

  // Excel formatida yuklab olish (.xlsx)
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredStudents.map((st, idx) => ({
        '№': idx + 1,
        "Reyting o'rni": `${idx + 1}-o'rin`,
        'Ism-familiya': st.name,
        'Gmail pochta': st.email,
        'Kurs nomi': st.course,
        'Sana': st.date,
        'Jami streaklar': `${st.streak} kun`,
        'Jami coinlar': st.coins,
        'Jami XP ballar': st.displayXp
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leaderboard');

      // Ustun kengliklarini sozlash
      worksheet['!cols'] = [
        { wch: 5 },
        { wch: 14 },
        { wch: 24 },
        { wch: 28 },
        { wch: 35 },
        { wch: 14 },
        { wch: 15 },
        { wch: 14 },
        { wch: 16 }
      ];

      XLSX.writeFile(workbook, `Speaking_Platform_Leaderboard_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Excel export error:', err);
      alert("Excel faylini yuklab olishda xatolik yuz berdi: " + err.message);
    }
  };

  // PDF formatida yuklab olish (.pdf)
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text("Ingliz Tili Speaking Platformasi - Talabalar Leaderboardi", 14, 15);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Hisobot sanasi: ${new Date().toLocaleDateString('ru-RU')} | Filtr: ${periodFilter.toUpperCase()} | Jami talabalar: ${filteredStudents.length}`, 14, 22);

      const tableData = filteredStudents.map((st, idx) => [
        idx + 1,
        `${idx + 1}-o'rin`,
        st.name,
        st.email,
        st.course,
        st.date,
        `${st.streak} kun`,
        st.coins,
        st.displayXp
      ]);

      autoTable(doc, {
        startY: 26,
        head: [['№', "O'rni", 'Ism-familiya', 'Gmail pochta', 'Kurs nomi', 'Sana', 'Streak', 'Coinlar', 'XP ballar']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229], // Indigo 600
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 16, halign: 'center' },
          2: { cellWidth: 38 },
          3: { cellWidth: 48 },
          4: { cellWidth: 65 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 20, halign: 'center' },
          7: { cellWidth: 18, halign: 'center' },
          8: { cellWidth: 20, halign: 'center' }
        }
      });

      doc.save(`Speaking_Platform_Leaderboard_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert("PDF faylini yuklab olishda xatolik yuz berdi: " + err.message);
    }
  };

  const allCourses = Array.from(new Set(
    students.flatMap(s => (Array.isArray(s.courses) && s.courses.length > 0 ? s.courses : [s.course])).filter(Boolean)
  ));

  // Jami statistika
  const totalStreaks = filteredStudents.reduce((sum, s) => sum + (s.streak || 0), 0);
  const totalCoins = filteredStudents.reduce((sum, s) => sum + (s.coins || 0), 0);
  const totalXp = filteredStudents.reduce((sum, s) => sum + (s.displayXp || 0), 0);
  const maxStreak = filteredStudents.length > 0 ? Math.max(...filteredStudents.map(s => s.streak || 0)) : 0;

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Toast Feedback */}
      {resetToast && (
        <div
          data-testid="leaderboard-reset-toast"
          className={`fixed bottom-5 right-5 z-[10000] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
            resetToast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-emerald-600 text-white border-emerald-500'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {resetToast.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{resetToast.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[32px]">
              leaderboard
            </span>
            <h1 className="font-outfit text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Talabalar Leaderboardi & Reytingi
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ingliz tili speaking kursi talabalarining yig'gan coinlari, XP ballari va kunlik streaklari monitoringi
          </p>
        </div>

        {/* Gamification Controls (Streak, Coins, XP + Restart) & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            data-testid="admin-leaderboard-gamification-bar"
            className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-1 rounded-full bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 select-none"
          >
            {/* Streak Button */}
            <button
              type="button"
              data-testid="leaderboard-pill-streak"
              onClick={() => setSortBy('streak')}
              title="Streak kunlari bo'yicha saralash"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                sortBy === 'streak' ? 'ring-2 ring-orange-500/60 shadow-xs' : ''
              }`}
            >
              <img src="/streak_flame.svg" alt="Streak" className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0" />
              <span className="font-outfit font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                {totalStreaks}
              </span>
              <span className="text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">
                Streak
              </span>
            </button>

            {/* Coins Button */}
            <button
              type="button"
              data-testid="leaderboard-pill-coins"
              onClick={() => setSortBy('coins')}
              title="Coinlar bo'yicha saralash"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                sortBy === 'coins' ? 'ring-2 ring-sky-500/60 shadow-xs' : ''
              }`}
            >
              <img src="/gem_diamond.svg" alt="Coins" className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0" />
              <span className="font-outfit font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                {totalCoins.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">
                Coins
              </span>
            </button>

            {/* XP Button */}
            <button
              type="button"
              data-testid="leaderboard-pill-xp"
              onClick={() => setSortBy('xp')}
              title="XP ballar bo'yicha saralash"
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
                sortBy === 'xp' ? 'ring-2 ring-amber-500/60 shadow-xs' : ''
              }`}
            >
              <img src="/xp_badge.svg" alt="XP" className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0" />
              <span className="font-outfit font-black text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                {totalXp.toLocaleString()} XP
              </span>
            </button>

            {/* Restart Button */}
            <button
              type="button"
              data-testid="leaderboard-restart-btn"
              disabled={resetting}
              onClick={() => setShowResetModal(true)}
              title="Restart: Barcha talabalarning Streak, Coin va XP natijalarini nolga tushirish"
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/15 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/35 font-black text-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <span className={`material-symbols-outlined text-[17px] ${resetting ? 'animate-spin' : ''}`}>
                restart_alt
              </span>
              <span>Restart</span>
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            title="Excel (.xlsx) formatida yuklab olish"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 active:scale-95 transition-all cursor-pointer"
            title="PDF formatida yuklab olish"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>PDF yuklab olish</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">group</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Talabalar soni</p>
            <p className="font-outfit text-xl font-black text-slate-900 dark:text-white">{filteredStudents.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <span className="text-xl">🪙</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami Coinlar</p>
            <p className="font-outfit text-xl font-black text-slate-900 dark:text-white">{totalCoins.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <span className="text-xl">⭐</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jami XP Ballar</p>
            <p className="font-outfit text-xl font-black text-slate-900 dark:text-white">{totalXp.toLocaleString()}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
            <span className="text-xl">🔥</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Eng yuqori streak</p>
            <p className="font-outfit text-xl font-black text-slate-900 dark:text-white">{maxStreak} kun</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar (Kunlik, Haftalik, Oylik, Shu sanadan shu sanagacha, Kurs, Qidiruv) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Davr tugmalari: Kunlik, Haftalik, Oylik, Barchasi */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Filtr:</span>
            </span>
            {[
              { id: 'all', label: 'Barcha vaqt' },
              { id: 'daily', label: 'Kunlik' },
              { id: 'weekly', label: 'Haftalik' },
              { id: 'monthly', label: 'Oylik' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodFilter === p.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Saralash mezoni */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">Saralash:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-800 dark:text-white outline-none cursor-pointer"
            >
              <option value="xp">XP ballar bo'yicha</option>
              <option value="coins">Coinlar bo'yicha</option>
              <option value="streak">Streak kunlari bo'yicha</option>
            </select>
          </div>
        </div>

        {/* 2-qator: Shu sanadan shu sanagacha, Kurs tanlash, Qidiruv */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Shu sanadan */}
          <div className="sm:col-span-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1 flex items-center justify-between">
              <span>Shu sanadan</span>
              <span className="text-[10px]">📅</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onClick={(e) => {
                if (e.target.showPicker) {
                  try { e.target.showPicker(); } catch (err) {}
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
            />
          </div>

          {/* Shu sanagacha */}
          <div className="sm:col-span-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1 flex items-center justify-between">
              <span>Shu sanagacha</span>
              <span className="text-[10px]">📅</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              onClick={(e) => {
                if (e.target.showPicker) {
                  try { e.target.showPicker(); } catch (err) {}
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
            />
          </div>

          {/* Kurs tanlash */}
          <div className="sm:col-span-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Kurs
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">Barcha kurslar</option>
              {allCourses.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Qidiruv */}
          <div className="sm:col-span-3">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Qidiruv
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Ism yoki Gmail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Clear Filters CTA */}
        {(startDate || endDate || selectedCourse !== 'all' || searchQuery || periodFilter !== 'all') && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedCourse('all');
                setSearchQuery('');
                setPeriodFilter('all');
              }}
              className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              <span>Filtrlarni tozalash</span>
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard Jadvali */}
      <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4 text-center w-28">Reyting O'rni</th>
                <th className="py-3.5 px-4">Talabaning Ism-familiyasi</th>
                <th className="py-3.5 px-4">Gmail Pochtasi</th>
                <th className="py-3.5 px-4">Kurs Nomi</th>
                <th className="py-3.5 px-4 text-center">Sanasi</th>
                <th className="py-3.5 px-4 text-center">Jami Streak</th>
                <th className="py-3.5 px-4 text-center">Jami Coinlar</th>
                <th className="py-3.5 px-4 text-center">Jami XP Ball</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <p className="font-bold text-sm">Leaderboard yuklanmoqda...</p>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">sentiment_dissatisfied</span>
                    <p className="font-bold text-sm">Berilgan filtrlar bo'yicha talaba topilmadi</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st, idx) => {
                  const rank = idx + 1;
                  let rankBadge = (
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                      #{rank}
                    </span>
                  );
                  if (rank === 1) {
                    rankBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-600 dark:text-amber-400 font-extrabold text-xs border border-amber-400/30">
                        <span>🥇 1-o'rin</span>
                      </span>
                    );
                  } else if (rank === 2) {
                    rankBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-300/30 text-slate-700 dark:text-slate-300 font-extrabold text-xs border border-slate-300/50">
                        <span>🥈 2-o'rin</span>
                      </span>
                    );
                  } else if (rank === 3) {
                    rankBadge = (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-700/15 text-amber-700 dark:text-amber-300 font-extrabold text-xs border border-amber-700/30">
                        <span>🥉 3-o'rin</span>
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Tartib raqami */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* Reyting o'rni */}
                      <td className="py-3.5 px-4 text-center">
                        {rankBadge}
                      </td>

                      {/* Ism-familiya + Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={st.avatar}
                            alt={st.name}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/20"
                          />
                          <div>
                            <p className="font-outfit font-extrabold text-slate-900 dark:text-white">
                              {st.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Gmail pochtasi */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {st.email}
                      </td>

                      {/* Kurs nomi */}
                      <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-100 dark:border-indigo-900/50">
                          {st.course}
                        </span>
                      </td>

                      {/* Sanasi */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500 dark:text-slate-400">
                        {st.date}
                      </td>

                      {/* Streak */}
                      <td className="py-3.5 px-4 text-center font-bold text-orange-500">
                        <span className="inline-flex items-center gap-1">
                          <span>🔥</span>
                          <span>{st.streak} kun</span>
                        </span>
                      </td>

                      {/* Coinlar */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                        <span className="inline-flex items-center gap-1">
                          <span>🪙</span>
                          <span>{st.coins.toLocaleString()}</span>
                        </span>
                      </td>

                      {/* XP Ball */}
                      <td className="py-3.5 px-4 text-center font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        <span className="inline-flex items-center gap-1">
                          <span>⭐</span>
                          <span>{st.displayXp.toLocaleString()} XP</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restart (Zero All Students Gamification) Confirmation Modal */}
      {showResetModal && (
        <div
          data-testid="leaderboard-reset-modal"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => !resetting && setShowResetModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">restart_alt</span>
              </div>
              <div>
                <h3 className="font-outfit text-lg font-black text-slate-900 dark:text-white">
                  Barcha natijalarni nolga tushirish?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  <strong>Restart</strong> tasdiqlanganda barcha talabalarning Student panelida to'plagan{' '}
                  <strong>Streak</strong>, <strong>Coins</strong> va <strong>XP</strong> ko'rsatkichlari real vaqt rejimida{' '}
                  <strong>0</strong> ga tushiriladi.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Streak</div>
                <div className="font-outfit font-black text-sm text-orange-600 dark:text-orange-400">
                  {totalStreaks} → 0
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">Coins</div>
                <div className="font-outfit font-black text-sm text-sky-600 dark:text-sky-400">
                  {totalCoins.toLocaleString()} → 0
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400">XP</div>
                <div className="font-outfit font-black text-sm text-amber-600 dark:text-amber-400">
                  {totalXp.toLocaleString()} → 0
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                data-testid="cancel-leaderboard-reset"
                disabled={resetting}
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                data-testid="confirm-leaderboard-reset"
                disabled={resetting}
                onClick={handleConfirmResetAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${resetting ? 'animate-spin' : ''}`}>
                  restart_alt
                </span>
                <span>{resetting ? 'Tozalanmoqda...' : 'Ha, 0 ga tushirish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
