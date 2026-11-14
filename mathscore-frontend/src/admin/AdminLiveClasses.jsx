import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

// Sanani dd-mm-yyyy va yyyy-mm-dd o'rtasida o'girish yordamchilari (Kalendar uchun)
const toIsoDate = (dmy) => {
  if (!dmy) return '';
  if (dmy.includes('-')) {
    const parts = dmy.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return dmy; // already yyyy-mm-dd
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return '';
};

const toDmyDate = (ymd) => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 2) return ymd; // already dd-mm-yyyy
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return ymd;
};

export default function AdminLiveClasses() {
  const [classes, setClasses] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states (3-talab)
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('google-meet');
  const [url, setUrl] = useState('');
  const [date, setDate] = useState('09-11-2026'); // dd-mm-yyyy
  const [time, setTime] = useState('19:00'); // HH:mm
  const [desc, setDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/live-classes`);
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || !date.trim() || !time.trim()) {
      alert("Iltimos, barcha maydonlarni to'ldiring!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/live-classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          platform,
          url,
          date,
          time,
          description: desc
        })
      });

      if (res.ok) {
        const newClass = await res.json();
        setClasses(prev => [newClass, ...prev]);
        setShowAddModal(false);
        setTitle('');
        setUrl('');
        setDesc('');
        alert("Yangi jonli dars muvaffaqiyatli rejalashtirildi va talabalarga Push bildirishnoma yuborildi!");
      } else {
        alert("Xatolik yuz berdi");
      }
    } catch (err) {
      alert("Ulanish xatosi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClass = async (id) => {
    if (!confirm("Haqiqatan ham bu jonli darsni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/live-classes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setClasses(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      alert("O'chirishda xatolik: " + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-rose-500 text-[30px]">videocam</span>
            <h1 className="font-outfit text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Live Classes (Jonli Darslar Boshqaruvi)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Google Meet va YouTube jonli darslarini tashkil qilish. Talabalar dashboardidagi "Live Classes" kartasida aks etadi.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/25 flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Jonli Dars Qo'shish</span>
        </button>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {classes.map((cls) => {
          const isGMeet = cls.platform === 'google-meet';
          return (
            <div
              key={cls.id}
              className="rounded-2xl p-5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isGMeet ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                  }`}>
                    <span className="material-symbols-outlined text-[16px]">{isGMeet ? 'videocam' : 'smart_display'}</span>
                    <span>{isGMeet ? 'Google Meet' : 'YouTube Live'}</span>
                  </span>

                  <button
                    onClick={() => handleDeleteClass(cls.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>

                <h3 className="font-outfit font-black text-base text-slate-900 dark:text-white">
                  {cls.title}
                </h3>
                {cls.description && (
                  <p className="text-xs text-slate-500 leading-relaxed">{cls.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
                    <span>{cls.date}</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                    <span>{cls.time}</span>
                  </span>
                </div>

                <a
                  href={cls.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Havolani ochish</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal (Using React Portal so it is never clipped or displaced by parent overflow!) */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative my-auto overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">videocam</span>
                </span>
                <h3 className="font-outfit font-black text-lg text-slate-900 dark:text-white">
                  Yangi Jonli Dars E'lon Qilish
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Dars Nomi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: IELTS Speaking Band 8.0 Live Mock Interview"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Platforma <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlatform('google-meet')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      platform === 'google-meet' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">videocam</span>
                    <span>Google Meet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('youtube')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      platform === 'youtube' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">smart_display</span>
                    <span>YouTube Live</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Jonli Dars Havolasi (URL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={platform === 'google-meet' ? 'https://meet.google.com/xyz-abcd-efg' : 'https://youtube.com/live/...'}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Boshlanish sanasi (Kalendardan tanlash) */}
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1 flex items-center justify-between">
                    <span>
                      Boshlanish Sanasi <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900/60 flex items-center gap-1">
                      <span>Kalendar</span>
                      <span>📅</span>
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-rose-500 text-[18px] pointer-events-none">
                      calendar_month
                    </span>
                    <input
                      type="date"
                      value={toIsoDate(date)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setDate(toDmyDate(val));
                      }}
                      onClick={(e) => {
                        if (e.target.showPicker) {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-rose-500 focus:outline-hidden cursor-pointer"
                    />
                  </div>
                  {date && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      Tanlangan format: <span className="font-bold text-slate-800 dark:text-slate-200">{date}</span>
                    </p>
                  )}
                </div>

                {/* Boshlanish vaqti */}
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1 flex items-center justify-between">
                    <span>
                      Boshlanish Vaqti <span className="text-rose-500">*</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      (HH:mm)
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[18px] pointer-events-none">
                      schedule
                    </span>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      onClick={(e) => {
                        if (e.target.showPicker) {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-rose-500 focus:outline-hidden cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Qisqacha Tavsif (Ixtiyoriy)
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Part 2 Cue kartalari, intonatsiya va ravon gapirish bo'yicha amaliy mashg'ulot..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Saqlanmoqda...' : "Jonli darsni e'lon qilish"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
