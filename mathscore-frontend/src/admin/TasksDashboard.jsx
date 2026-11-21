const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AudioWaveformPlayer, { isAudioMediaFile, resolveAudioMediaUrl } from './AudioWaveformPlayer';

const INITIAL_TASKS = [];

export default function TasksDashboard({ adminProfile, courses = [], students = [] }) {
  const [tasks, setTasks] = useState([]);
  const initialNotifSeededRef = useRef(false);

  const courseTitlesFromCourses = (courses || []).map(c => typeof c === 'string' ? c : (c.title || c.name)).filter(Boolean);
  const courseTitlesFromStudents = (students || []).map(s => s?.course).filter(c => c && !['barchasi', 'all'].includes(String(c).toLowerCase()));
  const availableCourses = Array.from(new Set([...courseTitlesFromCourses, ...courseTitlesFromStudents].map(s => String(s).trim()).filter(Boolean)));

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null); // Delete Confirmation Modal (2-rasm)

  // 2-talab: View Submissions & Baholash / Feedback Modali
  const [viewingTask, setViewingTask] = useState(null);
  const currentViewingTask = viewingTask ? (tasks.find(t => String(t.id) === String(viewingTask.id)) || viewingTask) : null;
  const [gradingState, setGradingState] = useState({});
  const [savingGradeId, setSavingGradeId] = useState(null);
  const [adminPushNotification, setAdminPushNotification] = useState(null);

  // Talaba yeçim yuklaganda Admin panelida Push bildirishnoma va ovozli signal
  useEffect(() => {
    if (!tasks || !Array.isArray(tasks)) return;

    tasks.forEach(task => {
      (task.submissions || []).forEach(sub => {
        if (!sub || !sub.submittedAt) return;
        const subNotifKey = `admin_notif_sub_${task.id}_${sub.id || sub.submittedAt}`;
        const alreadyNotified = sessionStorage.getItem(subNotifKey);
        if (!alreadyNotified) {
          sessionStorage.setItem(subNotifKey, 'true');

          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          } catch (e) {}

          setAdminPushNotification({
            id: Date.now(),
            taskId: task.id,
            task,
            studentName: sub.studentName || 'Talaba',
            fileName: sub.fileName || 'yeçim fayli',
            submittedAt: sub.submittedAt,
            title: "Yangi yeçim topshirildi!",
            message: `${sub.studentName || 'Talaba'} "${task.title}" topshirig'iga yangi fayl yukladi.`
          });
        }
      });
    });
  }, [tasks]);

  useEffect(() => {
    if (!adminPushNotification) return;
    const t = setTimeout(() => setAdminPushNotification(null), 7000);
    return () => clearTimeout(t);
  }, [adminPushNotification]);

  // Xavfsiz yuklab olish mexanizmi (Base64 data URI, HTTP url yoki server uploads)
  const handleDownloadSubmissionFile = (sub) => {
    if (!sub || !sub.fileUrl) {
      alert("Fayl topilmadi yoki yuklanmagan.");
      return;
    }
    const fileName = sub.fileName || 'topşiriq_yeçimi.docx';
    const url = resolveAudioMediaUrl(sub.fileUrl) || sub.fileUrl;

    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    window.open(`${API_BASE}/uploads/${url}`, '_blank');
  };

  // 3-talab: 3-nuqtali Settings orqali Cardni edit qilish (Title & Deadline uzaytirish)
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Dynamic default future date: 7 kun keyin
  const getDefaultFutureDate = () => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return d.toISOString().split('T')[0];
  };

  const allKnownCourses = (availableCourses && availableCourses.length > 0)
    ? availableCourses
    : ['IELTS Speaking Masterclass (Band 8.0+)', 'General English Speaking & Fluency', 'Pronunciation & American Accent Training', 'Everyday English Conversations & Idioms', 'Business English Spoken Communication'];

  // Form states for Add Task (3-rasm)
  const [selectedCourses, setSelectedCourses] = useState([allKnownCourses[0] || 'IELTS Speaking Masterclass (Band 8.0+)']);

  useEffect(() => {
    if (allKnownCourses.length === 0) return;
    setSelectedCourses(prev => {
      if (Array.isArray(prev) && prev.includes('All Courses')) return ['All Courses'];
      const valid = (prev || []).filter(c => allKnownCourses.includes(c));
      return valid.length > 0 ? valid : [allKnownCourses[0]];
    });
  }, [allKnownCourses.join('|')]);
  const [formCoins, setFormCoins] = useState(50);
  const [formXp, setFormXp] = useState(100);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDueDate, setFormDueDate] = useState(getDefaultFutureDate);
  const [formDueTime, setFormDueTime] = useState('23:59'); // 11-talab: Soatni belgilash imkoni
  const [formLink, setFormLink] = useState('');
  const [formFile, setFormFile] = useState(null);
  const [formFileError, setFormFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optimallashtirilgan: har 10 soniyada teskari hisobni yangilab turish (CPU ni bo'shatish)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Backend /api/tasks bilan to'g'ridan-to'g'ri sinxronizatsiya (Hech qanday localStorage/tasksPayload zombi keshsiz)
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          if (!initialNotifSeededRef.current) {
            initialNotifSeededRef.current = true;
            data.forEach(task => {
              (task.submissions || []).forEach(sub => {
                if (sub && sub.submittedAt) {
                  try {
                    sessionStorage.setItem(`admin_notif_sub_${task.id}_${sub.id || sub.submittedAt}`, 'true');
                  } catch (e) {}
                }
              });
            });
          }
          setTasks(data);
        }
      }
    } catch (e) {
      console.error('Tasks fetch error:', e);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('mathscore_course_tasks');
    } catch (e) {}

    fetchTasks();
    // SSE real-time ishlaydi, shuning uchun polling fallback 20 soniyada bir
    const interval = setInterval(fetchTasks, 20000);

    let es = null;
    try {
      es = new EventSource(`${API_BASE}/api/system/stream`);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data || '{}');
          if (parsed.type === 'tasks_update') {
            fetchTasks();
          }
        } catch (e) {}
      };
      es.addEventListener('tasks_update', () => {
        fetchTasks();
      });
    } catch (e) {}

    return () => {
      clearInterval(interval);
      try { if (es) es.close(); } catch (e) {}
    };
  }, []);

  // Sync grading inputs when viewingTask opens or updates (Stabil: cheksiz re-render bo'lmaydi)
  useEffect(() => {
    if (currentViewingTask && currentViewingTask.submissions) {
      setGradingState(prev => {
        let changed = false;
        const next = { ...prev };
        currentViewingTask.submissions.forEach(sub => {
          if (!next[sub.id]) {
            changed = true;
            next[sub.id] = {
              grade: sub.grade || '',
              feedback: sub.feedback || ''
            };
          }
        });
        return changed ? next : prev;
      });
    }
  }, [currentViewingTask?.id, currentViewingTask?.submissions?.length]);

  // Format countdown: 5d 09h 21m 42s (1-rasmga 1 ga 1)
  const formatCountdown = (deadlineIso) => {
    const target = new Date(deadlineIso).getTime();
    const diff = target - currentTime;

    if (isNaN(target) || diff <= 0) {
      return { text: '00d 00h 00m 00s', isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n) => String(n).padStart(2, '0');
    return {
      text: `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`,
      isExpired: false
    };
  };

  // Preview countdown in Add Modal
  const getPreviewCountdown = (dateStr, timeStr = '23:59') => {
    if (!dateStr) return 'Day: 00  Hour: 00  Min: 00  Sec: 00';
    const combinedStr = dateStr.includes('T') ? dateStr : `${dateStr}T${timeStr || '23:59'}:00`;
    const target = new Date(combinedStr).getTime();
    const diff = target - currentTime;
    if (isNaN(target) || diff <= 0) return 'Muddati tugagan';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `Day: ${days}   Hour: ${hours}   Min: ${minutes}   Sec: ${seconds}`;
  };

  // File upload change (Max 70 MB)
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setFormFile(null);
      setFormFileError('');
      return;
    }
    const maxSizeBytes = 70 * 1024 * 1024; // 70 MB
    if (file.size > maxSizeBytes) {
      setFormFileError(`Xatolik: Fayl hajmi 70 MB dan oshmasligi kerak! (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
      setFormFile(null);
      e.target.value = '';
    } else {
      setFormFile(file);
      setFormFileError('');
    }
  };

  // Add Task submit (Ok tugmasi - 3-rasm)
  const handleOkSubmitTask = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert("Iltimos, topşiriq nomini kiriting!");
      return;
    }
    if (!formDueDate) {
      alert("Iltimos, topşiriq muddatini tanlang!");
      return;
    }

    setIsSubmitting(true);
    const deadlineIso = new Date(`${formDueDate}T${formDueTime || '23:59'}:00`).toISOString();
    const courseTitleStr = selectedCourses.join(', ') || 'All Courses';

    try {
      const formData = new FormData();
      formData.append('courseTitle', courseTitleStr);
      formData.append('courses', JSON.stringify(selectedCourses));
      formData.append('coins', formCoins);
      formData.append('xp', formXp);
      formData.append('title', formTitle.trim());
      formData.append('description', formDesc.trim().slice(0, 256));
      formData.append('deadline', deadlineIso);
      formData.append('linkUrl', formLink.trim());
      if (formFile) {
        formData.append('file', formFile);
      }

      const taskRes = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        body: formData
      });
      const resData = await taskRes.json().catch(() => ({}));
      if (!taskRes.ok) {
        throw new Error(resData.error || "Topshiriq yaratishda xatolik yuz berdi.");
      }

      await fetchTasks();
      setShowAddTaskModal(false);
      setFormTitle('');
      setFormDesc('');
      setFormLink('');
      setFormFile(null);
      setFormFileError('');
      alert("Topshiriq muvaffaqiyatli chop etildi!");
    } catch (err) {
      alert(err.message || "Topshiriq saqlashda xatolik.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm delete (2-rasm - Yes tugmasi)
  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    const targetId = taskToDelete.id;

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${targetId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "O'chirishda xatolik.");
      }
      if (viewingTask && String(viewingTask.id) === String(targetId)) {
        setViewingTask(null);
      }
      await fetchTasks();
      setTaskToDelete(null);
    } catch (err) {
      alert(err.message || "Topshiriqni o'chirishda xatolik.");
    }
  };

  // 2-talab: Baholash va feedbackni saqlaş
  const handleSaveGradeAndFeedback = async (taskId, submissionId) => {
    const data = gradingState[submissionId] || {};
    const grade = (data.grade || '').trim();
    const feedback = (data.feedback || '').trim();

    if (!grade) {
      alert("Iltimos, talaba uchun bahoni kiriting!");
      return;
    }

    setSavingGradeId(submissionId);

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          grade,
          feedback,
          gradedBy: adminProfile?.name ? `${adminProfile.name} (Admin)` : 'Admin'
        })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Baholashda xatolik.");
      }
      if (resData.task && viewingTask && String(viewingTask.id) === String(taskId)) {
        setViewingTask(resData.task);
      }
      await fetchTasks();
      alert("Talaba topshirig'i baholandi va feedback saqlandi!");
    } catch (err) {
      alert(err.message || "Bahoni saqlashda xatolik.");
    } finally {
      setSavingGradeId(null);
    }
  };

  // 2-talab: Admin talabaga 2-3-imkoniyat berishi
  const handleGrantResubmit = async (taskId, submissionId, attempts) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/allow-resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          attemptsAllowed: attempts,
          feedback: gradingState[submissionId]?.feedback || undefined
        })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Ruxsat berishda xatolik.");
      }
      if (resData.task && viewingTask && String(viewingTask.id) === String(taskId)) {
        setViewingTask(resData.task);
      }
      await fetchTasks();
      alert(`Talabaga ${attempts}-imkoniyat muvaffaqiyatli berildi! Talaba panelida bildirishnoma aks etadi.`);
    } catch (err) {
      alert(err.message || "Xatolik yuz berdi.");
    }
  };

  const handleRevokeResubmit = async (taskId, submissionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          resubmitAllowed: false,
          attemptsAllowed: 1
        })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Bekor qilishda xatolik.");
      }
      if (resData.task && viewingTask && String(viewingTask.id) === String(taskId)) {
        setViewingTask(resData.task);
      }
      await fetchTasks();
    } catch (err) {
      alert(err.message || "Bekor qilishda xatolik.");
    }
  };

  // 3-talab: 3 nuqtali edit oynasini ochish
  const handleOpenEditTask = (task) => {
    setEditingTask(task);
    setEditTitle(task.title || '');
    setEditDesc(task.description || '');
    setEditDeadline(task.deadline || new Date().toISOString());
  };

  // 3-talab a): Deadlineni uzaytirish (+1 kun, +3 kun, +1 hafta)
  const handleExtendDeadlineDays = (daysToAdd) => {
    const currentBase = editDeadline ? new Date(editDeadline).getTime() : Date.now();
    const newTarget = new Date(Math.max(currentBase, Date.now()) + daysToAdd * 24 * 3600 * 1000);
    setEditDeadline(newTarget.toISOString());
  };

  // 3-talab c): O'zgarishlarni saqlash
  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      alert("Iltimos, topshiriq nomini kiriting!");
      return;
    }

    setIsSavingEdit(true);

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim().slice(0, 256),
          deadline: editDeadline
        })
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || "Yangilashda xatolik.");
      }
      await fetchTasks();
      setEditingTask(null);
      alert("Topshiriq muvaffaqiyatli yangilandi!");
    } catch (err) {
      alert(err.message || "Yangilashda xatolik.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Top Header: Tasks for my students & Add Task CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span>Tasks for my students</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-bold">
              {tasks.length} ta card
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Öquvçilar uçun topşiriqlar, muddatlar va nazorat kartalari
          </p>
        </div>

        <div>
          <button
            onClick={() => {
              setSelectedCourses(allKnownCourses.length > 0 ? [allKnownCourses[0]] : ['IELTS Speaking Masterclass (Band 8.0+)']);
              setShowAddTaskModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* ==================== 1-RASM UI DESIGN: CARDS GRID ==================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
        {tasks.map(task => {
          const countdown = formatCountdown(task.deadline);
          const submissionsList = task.submissions || [];
          const submittedCount = submissionsList.length;

          return (
            <div
              key={task.id}
              className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-slate-100 dark:border-slate-800 flex flex-col justify-between group"
            >
              {/* Top Banner (Yashil to'lqinli qism - 1-rasm) */}
              <div className="relative bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 pt-4 px-5 pb-8 overflow-hidden">
                {/* 3D Calculator & Worksheet Illustration effect in background */}
                <div className="absolute right-2 bottom-1 opacity-70 pointer-events-none select-none">
                  <svg width="115" height="75" viewBox="0 0 115 75" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="18" y="10" width="50" height="60" rx="8" fill="#E2F1E8" opacity="0.9" />
                    <rect x="25" y="18" width="22" height="4" rx="2" fill="#A8D5BA" />
                    <rect x="25" y="26" width="36" height="3" rx="1.5" fill="#C5E5D2" />
                    <rect x="25" y="33" width="30" height="3" rx="1.5" fill="#C5E5D2" />
                    {/* Calculator */}
                    <g transform="rotate(-6 55 12)">
                      <rect x="52" y="12" width="46" height="58" rx="8" fill="#1D70B8" stroke="#145A96" strokeWidth="1.5" />
                      <rect x="58" y="18" width="34" height="13" rx="3" fill="#60A5FA" />
                      <circle cx="64" cy="38" r="3" fill="#93C5FD" />
                      <circle cx="75" cy="38" r="3" fill="#93C5FD" />
                      <circle cx="86" cy="38" r="3" fill="#93C5FD" />
                      <circle cx="64" cy="48" r="3" fill="#93C5FD" />
                      <circle cx="75" cy="48" r="3" fill="#93C5FD" />
                      <circle cx="86" cy="48" r="3" fill="#93C5FD" />
                      <circle cx="64" cy="58" r="3" fill="#FCD34D" />
                      <circle cx="75" cy="58" r="3" fill="#FCD34D" />
                      <circle cx="86" cy="58" r="3" fill="#34D399" />
                    </g>
                  </svg>
                </div>

                {/* Silliq to'lqinsimon ötiş (Wave Curve) */}
                <div className="absolute -bottom-1 left-0 right-0 h-6 bg-white dark:bg-slate-900 rounded-t-[28px]" />

                {/* Top Row: [📖 Kurs / Fan nomi (2 qatorgacha siğadigan)] + Aylana Delete Button */}
                <div className="relative z-10 flex items-start justify-between gap-3">
                  {/* Left: Green badge with book icon */}
                  <div className="bg-white/20 backdrop-blur-md text-white font-bold text-xs px-3.5 py-1.5 rounded-2xl flex items-center gap-2 shadow-xs border border-white/25 max-w-[calc(100%-46px)]">
                    <span className="material-symbols-outlined text-[16px] shrink-0">menu_book</span>
                    <span className="line-clamp-2 leading-tight break-words">{task.courseTitle || 'Mathematics'}</span>
                  </div>

                  {/* Delete Icon (Aniq mukammal aylana shape - 2-rasm talabi) */}
                  <button
                    type="button"
                    onClick={() => setTaskToDelete(task)}
                    className="w-9 h-9 min-w-[36px] min-h-[36px] max-w-[36px] max-h-[36px] aspect-square rounded-full shrink-0 bg-white flex items-center justify-center shadow-md hover:bg-rose-50 hover:scale-105 active:scale-95 transition-all cursor-pointer group/del"
                    title="Topşiriqni öçiriş"
                  >
                    <span className="material-symbols-outlined text-rose-500 text-[19px] group-hover/del:rotate-12 transition-transform">
                      delete
                    </span>
                  </button>
                </div>

                {/* Kreativ va öqişga oson Deadline Countdown badge (2-rasm talabi) */}
                <div className="relative z-10 mt-2.5 flex items-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 bg-black/30 backdrop-blur-md rounded-full text-white text-[11px] font-mono font-bold border border-white/20 shadow-xs whitespace-nowrap ${countdown.isExpired ? 'bg-rose-900/40 text-rose-200 border-rose-300/30' : ''}`}>
                    <span className={`material-symbols-outlined text-[14px] ${countdown.isExpired ? 'text-rose-400' : 'text-amber-300'}`}>
                      {countdown.isExpired ? 'timer_off' : 'timer'}
                    </span>
                    <span className="tracking-wide">{countdown.text}</span>
                  </div>
                </div>
              </div>

              {/* Card Body (Oq qism - 1-rasm) */}
              <div className="px-5 pb-5 pt-1 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-white tracking-tight line-clamp-2 leading-snug break-words" title={task.title}>
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {task.description || "Solve the given algebra problems and upload your answers. Show all steps where necessary."}
                  </p>
                </div>

                {/* 3 ta statistika qutichasi (3-rasm: Total, Submit, Links töliq siğadigan qilingan) */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                  {/* 1. Total */}
                  <div className="bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl p-2 sm:p-2.5 flex items-center gap-1.5 sm:gap-2 border border-purple-100/60 dark:border-purple-900/40">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">description</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-sm text-slate-800 dark:text-white leading-tight">
                        {task.tasksCount || 1}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap leading-tight mt-0.5">
                        Total
                      </div>
                    </div>
                  </div>

                  {/* 2. Submit */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-2 sm:p-2.5 flex items-center gap-1.5 sm:gap-2 border border-emerald-100/60 dark:border-emerald-900/40">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">groups</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-sm text-slate-800 dark:text-white leading-tight">
                        {submittedCount || task.uploadedStudentsCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap leading-tight mt-0.5">
                        Submit
                      </div>
                    </div>
                  </div>

                  {/* 3. Links */}
                  <div className="bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl p-2 sm:p-2.5 flex items-center gap-1.5 sm:gap-2 border border-blue-100/60 dark:border-blue-900/40">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] sm:text-[18px]">link</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-sm text-slate-800 dark:text-white leading-tight">
                        {task.linksCount || (task.linkUrl ? 1 : 0)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap leading-tight mt-0.5">
                        Links
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: View tugmasi & ... settings (1-rasm talabi) */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setViewingTask(task)}
                    className="flex-1 py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">visibility</span>
                    <span>View</span>
                  </button>

                  {/* 3-talab: 3-rasmdagi 3 ta nuqtali setting orqali cardni edit qilish */}
                  <button
                    onClick={() => handleOpenEditTask(task)}
                    className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                    title="Topşiriqni tahrirlaş (Edit)"
                  >
                    <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================== 2-TALAB: VIEW MODAL (TALABALAR YUKLAGAN FAYLLARI, BAHOLASH, FEEDBACK) ==================== */}
      {currentViewingTask && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-100 dark:border-slate-800 shadow-2xl relative my-auto animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">assignment_turned_in</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-bold text-[10px]">
                      {currentViewingTask.courseTitle}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {formatCountdown(currentViewingTask.deadline).text}
                    </span>
                  </div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight mt-0.5">
                    {currentViewingTask.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setViewingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Submissions List & Grading Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Task Details Summary */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Topşiriq izohi:</span>
                    <p className="line-clamp-2">{currentViewingTask.description || "Izoh mavjud emas."}</p>
                  </div>
                  {currentViewingTask.fileName && !isAudioMediaFile(currentViewingTask.fileName, currentViewingTask.fileUrl) && (
                    <a
                      href={resolveAudioMediaUrl(currentViewingTask.fileUrl) || currentViewingTask.fileUrl}
                      download={currentViewingTask.fileName}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-600 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-blue-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Asl fayl ({currentViewingTask.fileName})</span>
                    </a>
                  )}
                </div>
                {currentViewingTask.fileUrl && isAudioMediaFile(currentViewingTask.fileName, currentViewingTask.fileUrl) && (
                  <AudioWaveformPlayer
                    src={currentViewingTask.fileUrl}
                    fileName={currentViewingTask.fileName}
                    fileSize={currentViewingTask.fileSize}
                    timestamp={currentViewingTask.createdAt}
                    onDownload={() => handleDownloadSubmissionFile({ fileUrl: currentViewingTask.fileUrl, fileName: currentViewingTask.fileName })}
                  />
                )}
              </div>

              {/* Submissions Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-[18px]">group</span>
                    <span>Talabalar tomonidan topshirilgan yeçimlar</span>
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 text-xs font-bold">
                    {(currentViewingTask.submissions || []).length} ta yeçim
                  </span>
                </div>

                {(!currentViewingTask.submissions || currentViewingTask.submissions.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="material-symbols-outlined text-3xl text-slate-300">hourglass_empty</span>
                    <p className="text-xs text-slate-500 font-medium">Hozirça heç bir talaba ushbu topşiriqqa fayl yuklamagan.</p>
                  </div>
                ) : (
                  currentViewingTask.submissions.map((sub, idx) => {
                    const gradeVal = gradingState[sub.id]?.grade ?? (sub.grade || '');
                    const feedbackVal = gradingState[sub.id]?.feedback ?? (sub.feedback || '');
                    const isSaving = savingGradeId === sub.id;

                    return (
                      <div
                        key={sub.id || idx}
                        className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-xs"
                      >
                        {/* Student Info & File Download (1-rasm: Profil rasmi, Ism familiyasi, Yuklangan vaqti integratsiyalashgan) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                          <div className="flex items-center gap-3">
                            {sub.studentAvatar ? (
                              <img
                                src={sub.studentAvatar}
                                alt={sub.studentName}
                                className="w-11 h-11 rounded-full object-cover border-2 border-blue-500 shadow-xs shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                                {(sub.studentName || 'A').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-800 dark:text-white">
                                  {sub.studentName || 'Talaba'}
                                </span>
                                {sub.attemptNumber > 1 ? (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                                    {sub.attemptNumber}-urinish
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    1-urinish
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                                {sub.studentPhone && <span className="text-blue-600 dark:text-blue-400 font-semibold">📞 {sub.studentPhone}</span>}
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-500">
                                  <span className="material-symbols-outlined text-[13px]">schedule</span>
                                  Yuklangan vaqti: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Hozirgina'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Download Button (2-talab) */}
                          {sub.fileUrl && !isAudioMediaFile(sub.fileName, sub.fileUrl) && (
                            <button
                              type="button"
                              onClick={() => handleDownloadSubmissionFile(sub)}
                              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800 transition-colors self-start sm:self-auto cursor-pointer"
                              title="Talaba topshirgan yeçim faylini yuklab olish"
                            >
                              <span className="material-symbols-outlined text-[16px]">file_download</span>
                              <span>Faylni yuklab olish ({sub.fileName || 'yeçim.docx'})</span>
                            </button>
                          )}
                        </div>

                        {sub.fileUrl && isAudioMediaFile(sub.fileName, sub.fileUrl) && (
                          <AudioWaveformPlayer
                            src={sub.fileUrl}
                            fileName={sub.fileName}
                            fileSize={sub.fileSize}
                            timestamp={sub.submittedAt}
                            onDownload={() => handleDownloadSubmissionFile(sub)}
                          />
                        )}

                        {/* Grading & Feedback Controls (2-talab) */}
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                              <span className="material-symbols-outlined text-amber-500 text-[16px]">star</span>
                              <span>Baho:</span>
                            </label>
                            <input
                              type="text"
                              value={gradeVal}
                              onChange={(e) => setGradingState(prev => ({
                                ...prev,
                                [sub.id]: { ...(prev[sub.id] || {}), grade: e.target.value }
                              }))}
                              placeholder="Masalan: 95 / 100 yoki A*"
                              className="w-48 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-white focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                              Feedback (Öqituvçi fikri va tavsiyasi):
                            </label>
                            <textarea
                              rows={2}
                              value={feedbackVal}
                              onChange={(e) => setGradingState(prev => ({
                                ...prev,
                                [sub.id]: { ...(prev[sub.id] || {}), feedback: e.target.value }
                              }))}
                              placeholder="Talabaga topşiriq böyiça fikringizni yozing..."
                              className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white focus:border-blue-500 focus:outline-hidden resize-none"
                            />
                          </div>

                          {/* 2-talab: Qayta topshirish uçun 2-3-imkoniyat berish boşqaruvi */}
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[17px] text-blue-600">replay</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Qayta topshirish:
                              </span>
                              {sub.resubmitAllowed ? (
                                <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                  {sub.attemptsAllowed || 2}-imkoniyat ochiq
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">
                                  Yopiq
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleGrantResubmit(currentViewingTask.id, sub.id, 2)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  sub.resubmitAllowed && sub.attemptsAllowed === 2
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:border-blue-500'
                                }`}
                                title="Talabaga 2-marta yuborish imkoniyatini berish"
                              >
                                <span>2-imkoniyat</span>
                                {sub.resubmitAllowed && sub.attemptsAllowed === 2 && <span>✓</span>}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleGrantResubmit(currentViewingTask.id, sub.id, 3)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  sub.resubmitAllowed && sub.attemptsAllowed === 3
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 hover:border-blue-500'
                                }`}
                                title="Talabaga 3-marta yuborish imkoniyatini berish"
                              >
                                <span>3-imkoniyat</span>
                                {sub.resubmitAllowed && sub.attemptsAllowed === 3 && <span>✓</span>}
                              </button>

                              {sub.resubmitAllowed && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeResubmit(currentViewingTask.id, sub.id)}
                                  className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  title="Qayta topshirish ruxsatini bekor qiliş"
                                >
                                  Bekor qiliş
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                            <span className="text-[10px] text-slate-400">
                              {sub.grade ? `✓ Hozirgi baho: ${sub.grade}` : "Hali baholanmagan"}
                            </span>
                            <button
                              onClick={() => handleSaveGradeAndFeedback(currentViewingTask.id, sub.id)}
                              disabled={isSaving}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-[15px]">check</span>
                              <span>{isSaving ? "Saqlanmoqda..." : "Baholash va saqlaş"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Oldingi topshirilgan urinishlar arxivi (1-talab: Re-submission tarixi saqlanadi) */}
                        {sub.previousSubmissions && sub.previousSubmissions.length > 0 && (
                          <div className="p-3.5 bg-slate-100/90 dark:bg-slate-900/90 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                              <span className="material-symbols-outlined text-[16px] text-blue-600">history</span>
                              <span>Oldingi urinishlar arxivi ({sub.previousSubmissions.length} ta):</span>
                            </div>
                            <div className="space-y-2">
                              {sub.previousSubmissions.map((prev, pIdx) => (
                                <div key={pIdx} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 dark:text-white">
                                        {prev.attemptNumber ? `${prev.attemptNumber}-urinish` : `${pIdx + 1}-urinish`}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {prev.submittedAt ? new Date(prev.submittedAt).toLocaleString('uz-UZ') : ''}
                                      </span>
                                    </div>
                                    {prev.grade && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold text-[11px] rounded-md">
                                        Baho: {prev.grade}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                    <span className="truncate max-w-[200px] font-mono">{prev.fileName}</span>
                                    {prev.fileUrl && (
                                      <a
                                        href={resolveAudioMediaUrl(prev.fileUrl) || prev.fileUrl}
                                        download={prev.fileName}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1 underline cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">file_download</span>
                                        Yuklab olish
                                      </a>
                                    )}
                                  </div>
                                  {prev.fileUrl && isAudioMediaFile(prev.fileName, prev.fileUrl) && (
                                    <AudioWaveformPlayer
                                      src={prev.fileUrl}
                                      fileName={prev.fileName}
                                      fileSize={prev.fileSize}
                                      timestamp={prev.submittedAt}
                                    />
                                  )}
                                  {prev.feedback && (
                                    <p className="text-[11px] italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-md">
                                      "{prev.feedback}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setViewingTask(null)}
                className="px-6 py-2 bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Yopiş
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== 3-TALAB: 3 NUQTA BOSILGANDA CARD EDIT MODALI ==================== */}
      {editingTask && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden my-auto animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Topşiriqni tahrirlaş (Edit Task)
                </h3>
              </div>

              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveEditTask} id="editTaskForm" className="p-6 pt-4 space-y-4 overflow-y-auto flex-1">
              {/* Kurs nishoni */}
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span className="material-symbols-outlined text-[16px]">menu_book</span>
                <span>Kurs: {editingTask.courseTitle}</span>
              </div>

              {/* b) Card Title ni edit qila oladi */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Card Title (Topşiriq nomi) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Qisqacha izoh (Description)
                </label>
                <textarea
                  rows={2}
                  maxLength={256}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white focus:border-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* a) Berilgan deadlineni uzaytirishi mumkin: 1 kunga; 3 kunga; 1 haftaga */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Deadlineni uzaytirish (Muddatni cho'zish):
                </label>

                {/* Tezkor uzaytirish tugmalari */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleExtendDeadlineDays(1)}
                    className="py-2 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">more_time</span>
                    <span>+1 kunga</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExtendDeadlineDays(3)}
                    className="py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">more_time</span>
                    <span>+3 kunga</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExtendDeadlineDays(7)}
                    className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">more_time</span>
                    <span>+1 haftaga</span>
                  </button>
                </div>

                {/* Sana tanlash va joriy muddat */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Muddati (Sana):</span>
                    <input
                      type="date"
                      value={editDeadline ? new Date(editDeadline).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          setEditDeadline(new Date(e.target.value + 'T23:59:59').toISOString());
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Teskari hisob:</span>
                    <div className="h-[37px] flex items-center px-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 rounded-xl text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 truncate">
                      {getPreviewCountdown(editDeadline)}
                    </div>
                  </div>
                </div>
              </div>
            </form>

            {/* c) Pinned Footer with Saqlaş */}
            <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                Bekor qiliş
              </button>
              <button
                type="submit"
                form="editTaskForm"
                disabled={isSavingEdit}
                className="px-7 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                <span>{isSavingEdit ? "Saqlanmoqda..." : "Saqlaş"}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== 2-RASM UI DESIGN: DELETE CONFIRMATION MODAL ==================== */}
      {taskToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-7 border border-slate-100 dark:border-slate-800 shadow-2xl relative text-center space-y-4 my-auto animate-scale-up">
            {/* Close Cross icon at top right */}
            <button
              onClick={() => setTaskToDelete(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            {/* Red soft circular badge with Trash Can icon (2-rasm) */}
            <div className="w-16 h-16 rounded-full bg-red-100/70 dark:bg-red-950/40 flex items-center justify-center mx-auto text-red-500 mb-2">
              <span className="material-symbols-outlined text-[32px]">delete</span>
            </div>

            {/* Title: Delete Course */}
            <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
              Delete Course
            </h3>

            {/* Description matching 2-rasm text */}
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-1">
              Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200 font-bold">"{taskToDelete.courseTitle || 'Mathematics'}"</strong> course? This action cannot be undone and will remove all related data from both admin and <strong className="text-slate-800 dark:text-slate-200 font-bold">student panels</strong>.
            </p>

            {/* Bottom 2 buttons: No & Yes (2-rasm) */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-md shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Yes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ==================== 3-RASM UI DESIGN: ADD NEW TASK MODAL ==================== */}
      {showAddTaskModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden my-auto animate-scale-up">
            {/* Top right blue gradient accent wave (3-rasm) */}
            <div className="absolute top-0 right-0 w-32 h-24 bg-gradient-to-bl from-blue-500/25 to-transparent rounded-bl-full pointer-events-none" />

            {/* Modal Pinned Header */}
            <div className="flex items-center justify-between p-6 pb-3 border-b border-slate-100 dark:border-slate-800 relative z-10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  Add New Task
                </h3>
              </div>

              <button
                onClick={() => setShowAddTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleOkSubmitTask} id="addTaskForm" className="p-6 pt-4 space-y-4 relative z-10 overflow-y-auto flex-1">
              {/* 1. Select Course * (Bir nechta kurslarni tanlash imkoniyati - 3-rasm) */}
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Select Course(s) <span className="text-rose-500">*</span>
                    <span className="text-[11px] font-normal text-slate-500 ml-1.5">(Bir yoki bir nechta kursni tanlang)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCourses.length === allKnownCourses.length && !selectedCourses.includes('All Courses')) {
                        setSelectedCourses([allKnownCourses[0]]);
                      } else {
                        setSelectedCourses([...allKnownCourses]);
                      }
                    }}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {selectedCourses.length === allKnownCourses.length && !selectedCourses.includes('All Courses') ? "Faqat bittasi" : "Barchasini tanlash"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCourses.includes('All Courses')) {
                        setSelectedCourses([allKnownCourses[0] || 'All Courses']);
                      } else {
                        setSelectedCourses(['All Courses']);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedCourses.includes('All Courses')
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {selectedCourses.includes('All Courses') ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span>Barcha kurslar</span>
                  </button>
                  {allKnownCourses.map((cName, idx) => {
                    const isChecked = !selectedCourses.includes('All Courses') && selectedCourses.includes(cName);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          const base = selectedCourses.filter(c => c !== 'All Courses');
                          if (isChecked) {
                            if (base.length > 1) {
                              setSelectedCourses(base.filter(c => c !== cName));
                            }
                          } else {
                            setSelectedCourses([...base, cName]);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {isChecked ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                        <span>{cName}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  ✓ Tanlangan kurslar: <span className="font-bold text-slate-700 dark:text-slate-300">{selectedCourses.includes('All Courses') ? 'Barcha kurslar' : selectedCourses.join(', ')}</span> ({selectedCourses.includes('All Courses') ? "Barcha talabalar ko'radi" : "Faqat shu kurs talabalari ko'radi"})
                </p>
              </div>

              {/* 2. Task Name * (3-rasm) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  <span className="material-symbols-outlined text-slate-400 text-[16px]">assignment</span>
                  <span>Task Name <span className="text-rose-500">*</span></span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-500 text-[18px]">
                    description
                  </span>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Enter task name"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-medium focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 3. Description (max 256 characters) * (3-rasm) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  <span className="material-symbols-outlined text-blue-500 text-[16px]">description</span>
                  <span>Description (max 256 characters) <span className="text-rose-500">*</span></span>
                </div>
                <div className="relative">
                  <textarea
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    maxLength={256}
                    rows={3}
                    placeholder="Enter task description..."
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-medium resize-none focus:border-blue-500 focus:outline-hidden"
                  />
                  <div className="absolute right-3 bottom-2.5 text-[10px] font-mono text-slate-400">
                    {formDesc.length}/256
                  </div>
                </div>
              </div>

              {/* 4. Due Date * va Time (Soat) (5-rasm, 11-talab) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Due Date */}
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5 flex items-center justify-between">
                    <span>Due Date <span className="text-rose-500">*</span></span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/60 flex items-center gap-1">
                      <span>Kalendar</span>
                      <span>📅</span>
                    </span>
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-500 text-[18px] pointer-events-none">
                      calendar_month
                    </span>
                    <input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      onClick={(e) => {
                        if (e.target.showPicker) {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      required
                      className="w-full pl-10 pr-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white cursor-pointer focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Due Time (11-talab: Soatni kiritish) */}
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5 flex items-center justify-between">
                    <span>Deadline Time (Soat) <span className="text-rose-500">*</span></span>
                    <span className="text-[10px] font-mono text-slate-400">HH:MM</span>
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-500 text-[18px] pointer-events-none">
                      schedule
                    </span>
                    <input
                      type="time"
                      value={formDueTime}
                      onChange={(e) => setFormDueTime(e.target.value)}
                      required
                      className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white cursor-pointer focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Time Countdown Preview */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 rounded-xl text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                <span className="material-symbols-outlined text-blue-500 text-[16px]">timer</span>
                <span className="text-[10px] uppercase font-sans text-slate-400">Qolgan vaqt:</span>
                <span className="truncate text-blue-600 dark:text-blue-400">{getPreviewCountdown(formDueDate, formDueTime)}</span>
              </div>

              {/* 5. Rewards: Coins & XP (Vazifa uchun ajratilgan coinlar va XP ballar) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                    Reward Coins 🪙
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-amber-500 text-[18px]">
                      monetization_on
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={formCoins}
                      onChange={(e) => setFormCoins(e.target.value)}
                      placeholder="50"
                      className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                    Reward XP ⚡
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-500 text-[18px]">
                      bolt
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={formXp}
                      onChange={(e) => setFormXp(e.target.value)}
                      placeholder="100"
                      className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Add Link (optional) (3-rasm) */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                  <span className="material-symbols-outlined text-blue-500 text-[16px]">cloud</span>
                  <span>Add Link (optional)</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-blue-500 text-[18px]">
                    link
                  </span>
                  <input
                    type="url"
                    value={formLink}
                    onChange={(e) => setFormLink(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-white font-medium focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 7. Upload File (max 20 MB) — Fayllar, audio, video, rasmlar (3-rasm) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span className="material-symbols-outlined text-blue-500 text-[16px]">cloud_upload</span>
                    <span>Upload File (max 20 MB)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">PDF, Audio, Video, Rasm</span>
                </div>

                <label className="border-2 border-dashed border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 sm:p-5 text-center bg-blue-50/20 dark:bg-blue-950/10 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50/40 transition-all block">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.mov"
                    className="hidden"
                  />
                  <span className="material-symbols-outlined text-3xl text-blue-500 mb-1">cloud_upload</span>
                  <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Click to upload</span> or drag and drop
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-center gap-2 flex-wrap">
                    <span>📄 Hujjat (.pdf, .doc)</span>
                    <span>🎵 Audio (.mp3, .wav)</span>
                    <span>🎬 Video (.mp4)</span>
                    <span>🖼️ Rasm</span>
                  </div>
                  {formFileError && (
                    <div className="text-xs text-rose-500 font-bold mt-1.5">{formFileError}</div>
                  )}
                  {formFile && !formFileError && (
                    <div className="text-xs font-bold text-emerald-600 mt-1.5">
                      ✓ {formFile.name} ({(formFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </div>
                  )}
                </label>
              </div>
            </form>

            {/* 7. Modal Pinned Footer: Cancel & ✓ OK (3-rasm) */}
            <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => setShowAddTaskModal(false)}
                className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="addTaskForm"
                disabled={isSubmitting || !!formFileError}
                className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>{isSubmitting ? 'Saqlanmoqda...' : 'OK'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ==================== ADMIN PUSH NOTIFICATION (YANGI YECHIM TOPSHIRILGANDA) ==================== */}
      {adminPushNotification && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-5 right-5 z-[99999] max-w-sm sm:max-w-md w-full bg-white dark:bg-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/25 rounded-2xl p-4 flex items-start gap-3.5 animate-bounce-in">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Yangi topşiriq topshirildi!
              </span>
              <button
                onClick={() => setAdminPushNotification(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="font-black text-sm text-slate-800 dark:text-white mt-0.5">
              {adminPushNotification.title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
              {adminPushNotification.message}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => {
                  setViewingTask(adminPushNotification.task);
                  setAdminPushNotification(null);
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">visibility</span>
                <span>Yeçimni köriş va baholash</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
