import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

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

const normalizePushItem = (p) =>
  p && typeof p === 'object'
    ? {
        ...p,
        title: cleanDisplayText(p.title),
        message: cleanDisplayText(p.message)
      }
    : p;

const CoinIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block text-sky-500`} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L4.5 7.5v9L12 22l7.5-5.5v-9L12 2zm0 2.3l5.3 3.9L12 12 6.7 8.2 12 4.3zm-5.5 5.4l4.5 3.3v6.2l-4.5-3.3V9.7zm6.5 9.5V13l4.5-3.3v6.2L13 19.2z" />
  </svg>
);

const BellIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const SendIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ClockIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const BlockIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const TrophyIcon = ({ className = 'w-7 h-7' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const MegaphoneIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-5v12L3 14v-3z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </svg>
);

const PlusCircleIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const PlusIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const TrashIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const OpenExternalIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CloseIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UploadIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ImageIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const CheckCircleIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={`${className} shrink-0 inline-block`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

function getAdminAuthHeaders(extra = {}) {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('admin_token') || localStorage.getItem('token')
      : '';
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function toLocalDateTimeInputValue(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getDefaultDeadlineForDay(dayNum = 1) {
  const d = new Date(Date.now() + Math.max(1, dayNum) * 24 * 3600 * 1000);
  d.setHours(23, 59, 0, 0);
  return toLocalDateTimeInputValue(d);
}

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusBanner, setStatusBanner] = useState(null); // { type: 'success'|'error', text: string }

  // Scheduled Push Notifications state (Top section - max 10/day)
  const [pushItems, setPushItems] = useState([]);
  const [pushDailyCount, setPushDailyCount] = useState(0);
  const [pushDailyLimit, setPushDailyLimit] = useState(10);
  const [pushTitle, setPushTitle] = useState('30 day Challenge boshlandi! 🎙️🏆');
  const [pushMessage, setPushMessage] = useState(
    "Admin tomonidan yangi 30 day Challenge e'lon qilindi! Har kuni vazifani bajarib Coin, Streak va XP ballar yuting."
  );
  const [pushSendNow, setPushSendNow] = useState(true);
  const [pushScheduledAt, setPushScheduledAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushErrorMsg, setPushErrorMsg] = useState('');
  const [isAnnouncingChallenge, setIsAnnouncingChallenge] = useState(false);

  // Add / Edit / Open Day modal state
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit'
  const [dayForm, setDayForm] = useState(null);
  const [isSavingDay, setIsSavingDay] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [newTaskDraft, setNewTaskDraft] = useState('');
  const [dayModalError, setDayModalError] = useState('');

  const fetchChallenges = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/challenges`, {
        headers: getAdminAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setChallenges((Array.isArray(data) ? data : []).map(normalizeChallengeItem));
      }
    } catch (e) {
      console.error('Fetch challenges error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPushNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/push-notifications`, {
        headers: getAdminAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPushItems((Array.isArray(data.items) ? data.items : []).map(normalizePushItem));
        setPushDailyCount(Number(data.dailyCount || 0));
        setPushDailyLimit(Number(data.dailyLimit || 10));
      }
    } catch (e) {
      console.error('Fetch push notifications error:', e);
    }
  };

  useEffect(() => {
    fetchChallenges();
    fetchPushNotifications();
    const timer = setInterval(() => {
      fetchPushNotifications();
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const showBanner = (type, text) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner(prev => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const nextSequentialDay = useMemo(() => {
    const used = new Set(challenges.map(c => Number(c.day)));
    for (let d = 1; d <= 30; d++) {
      if (!used.has(d)) return d;
    }
    return 31;
  }, [challenges]);

  const challengeByDay = useMemo(() => {
    const map = new Map();
    challenges.forEach(c => map.set(Number(c.day), c));
    return map;
  }, [challenges]);

  // Scheduled Push Send handler (Enforces 10/day quota strictly)
  const handleSendPushNotification = async (e) => {
    e.preventDefault();
    setPushErrorMsg('');

    if (!pushMessage.trim()) {
      setPushErrorMsg("Bildirishnoma matnini kiriting.");
      return;
    }

    if (pushDailyCount >= pushDailyLimit) {
      setPushErrorMsg(
        "Kunlik limitingiz tugadi! Bir kunda maksimal 10 ta push bildirishnoma yuborish mumkin. Keyingi kuni yana 10 ta yuborishingiz mumkin."
      );
      return;
    }

    let scheduledIso = new Date().toISOString();
    if (!pushSendNow) {
      const parsed = new Date(pushScheduledAt);
      if (!pushScheduledAt || isNaN(parsed.getTime())) {
        setPushErrorMsg("Iltimos, to'g'ri sana va vaqt tanlang.");
        return;
      }
      scheduledIso = parsed.toISOString();
    }

    setIsSendingPush(true);
    try {
      const res = await fetch(`${API_BASE}/api/push-notifications`, {
        method: 'POST',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: pushTitle.trim() || 'Admin bildirishnomasi 🔔',
          message: pushMessage.trim(),
          scheduledAt: scheduledIso
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 429 || data.limitReached) {
        setPushDailyCount(Number(data.dailyCount ?? pushDailyLimit));
        setPushErrorMsg(
          data.error ||
            "Kunlik limitingiz tugadi! Bir kunda maksimal 10 ta push bildirishnoma yuborish mumkin."
        );
        return;
      }

      if (!res.ok) {
        setPushErrorMsg(data.error || "Push bildirishnoma yuborishda xatolik yuz berdi.");
        return;
      }

      setPushDailyCount(Number(data.dailyCount ?? pushDailyCount + 1));
      await fetchPushNotifications();
      const isImmediate = pushSendNow || new Date(scheduledIso).getTime() <= Date.now() + 2000;
      showBanner(
        'success',
        isImmediate
          ? `Push bildirishnoma barcha talabalarga darhol yuborildi! (${Number(data.dailyCount ?? pushDailyCount + 1)}/10)`
          : `Push bildirishnoma ${new Date(scheduledIso).toLocaleString('uz-UZ')} vaqtiga rejalashtirildi!`
      );
    } catch (err) {
      setPushErrorMsg("Server bilan bog'lanishda xatolik: " + err.message);
    } finally {
      setIsSendingPush(false);
    }
  };

  const handleCancelPendingPush = async (pushId) => {
    try {
      const res = await fetch(`${API_BASE}/api/push-notifications/${pushId}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders()
      });
      if (res.ok) {
        await fetchPushNotifications();
        showBanner('success', "Rejalashtirilgan push bildirishnoma bekor qilindi.");
      }
    } catch (e) {}
  };

  const handleAnnounceChallenge = async () => {
    setIsAnnouncingChallenge(true);
    try {
      const res = await fetch(`${API_BASE}/api/challenges/announce`, {
        method: 'POST',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          announceTitle: pushTitle.trim() || "30 day Challenge boshlandi! 🏆",
          announceMessage:
            pushMessage.trim() ||
            "Admin tomonidan yangi 30 day Challenge e'lon qilindi! Har kuni vazifalarni bajarib Coin, Streak va XP yuting."
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showBanner('success', data.message || "30 day Challenge e'lon qilindi va talabalarga bildirishnoma yuborildi!");
      } else {
        showBanner('error', data.error || "E'lon yuborishda xatolik yuz berdi.");
      }
    } catch (err) {
      showBanner('error', "Xatolik: " + err.message);
    } finally {
      setIsAnnouncingChallenge(false);
    }
  };

  // Open Add Day Modal
  const openAddDayModal = (forcedDay = null) => {
    const targetDay = forcedDay && forcedDay <= 30 && !challengeByDay.has(forcedDay) ? forcedDay : nextSequentialDay;
    if (targetDay > 30) {
      showBanner('error', '30 ta kunning barchasi allaqachon qo‘shilgan.');
      return;
    }
    setDayModalError('');
    setNewTaskDraft('');
    setModalMode('add');
    setDayForm({
      day: targetDay,
      title: `Day ${targetDay}: Speaking Practice`,
      description: `Day ${targetDay} mavzusi bo'yicha berilgan materiallarni ko'rib chiqing va vazifalarni o'z muddatida bajaring.`,
      image: '',
      images: [],
      tasks: [
        '1. Mavzu materiallari va rasmlarini diqqat bilan o‘rganing',
        '2. Asosiy iboralar bilan amaliy mashqni bajaring'
      ],
      xp: 100,
      coins: 30,
      streakBonus: 2,
      deadline: getDefaultDeadlineForDay(targetDay),
      urgentWindowMinutes: 120,
      notifyStudents: true
    });
  };

  // Open existing Day Modal (via Ochish button)
  const openEditDayModal = (ch) => {
    setDayModalError('');
    setNewTaskDraft('');
    setModalMode('edit');
    setDayForm({
      day: Number(ch.day),
      title: ch.title || `Day ${ch.day}`,
      description: ch.description || '',
      image: ch.image || '',
      images: Array.isArray(ch.images) ? [...ch.images] : (ch.image ? [ch.image] : []),
      tasks: Array.isArray(ch.tasks) && ch.tasks.length > 0 ? [...ch.tasks] : [],
      xp: Number(ch.xp ?? 100),
      coins: Number(ch.coins ?? 30),
      streakBonus: Number(ch.streakBonus ?? 2),
      deadline: ch.deadline ? toLocalDateTimeInputValue(ch.deadline) : '',
      urgentWindowMinutes: Number(ch.urgentWindowMinutes ?? 120),
      notifyStudents: false,
      submissionsCount: ch.submissionsCount || 0
    });
  };

  const uploadSingleImageFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: getAdminAuthHeaders(),
      body: formData
    });
    if (!res.ok) {
      throw new Error('Rasm yuklashda xatolik');
    }
    const data = await res.json();
    return data.url;
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setDayModalError('');
    try {
      const url = await uploadSingleImageFile(file);
      setDayForm(prev => {
        const imgs = Array.isArray(prev.images) ? prev.images : [];
        return {
          ...prev,
          image: url,
          images: imgs.includes(url) ? imgs : [url, ...imgs]
        };
      });
    } catch (err) {
      setDayModalError(err.message);
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingGallery(true);
    setDayModalError('');
    try {
      const uploadedUrls = [];
      for (const f of files) {
        const url = await uploadSingleImageFile(f);
        if (url) uploadedUrls.push(url);
      }
      setDayForm(prev => {
        const existing = Array.isArray(prev.images) ? prev.images : [];
        const merged = Array.from(new Set([...existing, ...uploadedUrls]));
        return {
          ...prev,
          image: prev.image || merged[0] || '',
          images: merged
        };
      });
    } catch (err) {
      setDayModalError(err.message);
    } finally {
      setUploadingGallery(false);
      e.target.value = '';
    }
  };

  const handleAddTaskItem = () => {
    const trimmed = newTaskDraft.trim();
    if (!trimmed) return;
    setDayForm(prev => ({
      ...prev,
      tasks: [...(prev.tasks || []), trimmed]
    }));
    setNewTaskDraft('');
  };

  const handleSaveDay = async (e) => {
    e.preventDefault();
    if (!dayForm) return;
    setDayModalError('');

    if (!dayForm.title.trim()) {
      setDayModalError("Mavzu nomini kiriting.");
      return;
    }

    const finalTasks = [...(dayForm.tasks || [])];
    if (newTaskDraft.trim()) {
      finalTasks.push(newTaskDraft.trim());
    }

    let deadlineIso = null;
    if (dayForm.deadline) {
      const parsed = new Date(dayForm.deadline);
      if (!isNaN(parsed.getTime())) {
        deadlineIso = parsed.toISOString();
      }
    }

    const payload = {
      day: dayForm.day,
      title: dayForm.title.trim(),
      description: dayForm.description.trim(),
      image: dayForm.image.trim() || (dayForm.images?.[0] || ''),
      images: dayForm.images || [],
      tasks: finalTasks,
      xp: Number(dayForm.xp) || 0,
      coins: Number(dayForm.coins) || 0,
      streakBonus: Number(dayForm.streakBonus) || 0,
      deadline: deadlineIso,
      urgentWindowMinutes: Number(dayForm.urgentWindowMinutes) || 120,
      notifyStudents: Boolean(dayForm.notifyStudents)
    };

    setIsSavingDay(true);
    try {
      const isAdd = modalMode === 'add';
      const url = isAdd ? `${API_BASE}/api/challenges/day` : `${API_BASE}/api/challenges/day/${dayForm.day}`;
      const res = await fetch(url, {
        method: isAdd ? 'POST' : 'PUT',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDayModalError(data.error || "Kun ma'lumotlarini saqlashda xatolik.");
        return;
      }
      if (Array.isArray(data.challenges)) {
        setChallenges(data.challenges.map(normalizeChallengeItem));
      } else {
        await fetchChallenges();
      }
      setModalMode(null);
      setDayForm(null);
      showBanner(
        'success',
        isAdd
          ? `Day ${dayForm.day} muvaffaqiyatli qo'shildi va barcha talabalarga ko'rindi!`
          : `Day ${dayForm.day} yangilandi!`
      );
    } catch (err) {
      setDayModalError('Server xatosi: ' + err.message);
    } finally {
      setIsSavingDay(false);
    }
  };

  const handleDeleteDay = async (dayNum) => {
    if (!window.confirm(`Day ${dayNum} kartasini o'chirmoqchimisiz? Qolgan kunlar ketma-ket qayta raqamlanadi.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/challenges/day/${dayNum}`, {
        method: 'DELETE',
        headers: getAdminAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.challenges)) {
        setChallenges(data.challenges.map(normalizeChallengeItem));
        if (dayForm?.day === dayNum) {
          setModalMode(null);
          setDayForm(null);
        }
        showBanner('success', `Day ${dayNum} o'chirildi.`);
      } else {
        showBanner('error', data.error || "O'chirishda xatolik.");
      }
    } catch (err) {
      showBanner('error', err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 flex flex-col items-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="mt-2 text-sm font-bold">30 day Challenge yuklanmoqda...</p>
      </div>
    );
  }

  const slotNumbers = Array.from({ length: 30 }, (_, idx) => idx + 1);

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans">
      {/* Top Status Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-xs animate-fade-in ${
            statusBanner.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'error' ? (
              <AlertIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            ) : (
              <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button onClick={() => setStatusBanner(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================== SECTION 3: SCHEDULED PUSH NOTIFICATION SYSTEM (MAX 10/DAY) ==================== */}
      <div className="p-5 rounded-3xl bg-amber-50/90 dark:bg-amber-950/20 border border-amber-200/90 dark:border-amber-800/50 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <BellIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-outfit text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider block">
                Talabalarga Push Bildirishnoma Yuborish va Rejalashtirish
              </span>
              <span className="text-[11px] text-amber-800/80 dark:text-amber-200/70 font-medium block">
                Barcha talabalarning student panelida belgilangan vaqtda push bildirishnoma sifatida chiqadi
              </span>
            </div>
          </div>

          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shrink-0 border whitespace-nowrap ${
              pushDailyCount >= pushDailyLimit
                ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
            }`}
          >
            {pushDailyCount >= pushDailyLimit ? (
              <BlockIcon className="w-4 h-4" />
            ) : (
              <ClockIcon className="w-4 h-4" />
            )}
            <span>
              Bugungi limit: {pushDailyCount} / {pushDailyLimit} (Qolgan: {Math.max(0, pushDailyLimit - pushDailyCount)})
            </span>
          </div>
        </div>

        <form onSubmit={handleSendPushNotification} className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4 space-y-1">
              <label className="text-[11px] font-bold text-amber-950 dark:text-amber-200 block">
                Bildirishnoma sarlavhasi
              </label>
              <input
                type="text"
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                placeholder="Push sarlavhasi..."
              />
            </div>

            <div className="lg:col-span-4 space-y-1">
              <label className="text-[11px] font-bold text-amber-950 dark:text-amber-200 block">
                Push xabar matni
              </label>
              <input
                type="text"
                value={pushMessage}
                onChange={(e) => setPushMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                placeholder="Talabalarga boradigan push matni..."
              />
            </div>

            <div className="lg:col-span-4 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-amber-950 dark:text-amber-200">
                  Yuborish vaqti
                </label>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setPushSendNow(true);
                      setPushScheduledAt(toLocalDateTimeInputValue(new Date()));
                    }}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      pushSendNow
                        ? 'bg-amber-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    Hozir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPushSendNow(false);
                      setPushScheduledAt(toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60000)));
                    }}
                    className={`px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                      !pushSendNow
                        ? 'bg-amber-500 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    Rejalashtirish
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={pushScheduledAt}
                  onChange={(e) => {
                    setPushSendNow(false);
                    setPushScheduledAt(e.target.value);
                  }}
                  className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-amber-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={isSendingPush}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-sm shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0 transition-all whitespace-nowrap"
                >
                  <SendIcon className="w-3.5 h-3.5" />
                  <span>{isSendingPush ? 'Yuborilmoqda...' : 'Yuborish'}</span>
                </button>
              </div>
            </div>
          </div>

          {pushErrorMsg && (
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>{pushErrorMsg}</span>
            </div>
          )}
        </form>

        {/* Recent Scheduled / Sent Push Items */}
        {pushItems.filter(p => p.status !== 'cancelled').length > 0 && (
          <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Push navbat va tarix ({pushItems.filter(p => p.status !== 'cancelled').length} ta)
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {pushItems
                .filter(p => p.status !== 'cancelled')
                .slice(0, 12)
                .map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200/70 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white truncate">{item.title}</span>
                        {item.status === 'sent' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            Yuborildi ({item.recipientCount || 0} talaba)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-bold flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            Rejalashtirilgan
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">{item.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {new Date(item.scheduledAt).toLocaleString('uz-UZ', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelPendingPush(item.id)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Rejalashtirilgan pushni bekor qilish"
                        >
                          <CloseIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== SECTION 2: 30 DAY CHALLENGE HEADER & ADD DAY ==================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <TrophyIcon className="w-7 h-7 text-amber-500" />
            <h1 className="font-outfit text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              30 day Challenge
            </h1>
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-xs border border-amber-500/25">
              {challenges.length} / 30 kun
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Har qatorda 5 tadan, jami 6 qator (30 ta card). Add Day tugmasi orqali har bir kunlik card rasm, vazifa va bonuslari bilan qo‘shiladi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={handleAnnounceChallenge}
            disabled={isAnnouncingChallenge}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <MegaphoneIcon className="w-4 h-4" />
            <span>{isAnnouncingChallenge ? "Yuborilmoqda..." : "Challenge E'lon Qilish"}</span>
          </button>

          <button
            type="button"
            onClick={() => openAddDayModal()}
            disabled={challenges.length >= 30}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
          >
            <PlusCircleIcon className="w-4 h-4" />
            <span>Add Day {challenges.length < 30 ? `(Day ${nextSequentialDay})` : '(30/30)'}</span>
          </button>
        </div>
      </div>

      {/* ==================== 30 CARDS GRID: 5 CARDS PER ROW x 6 ROWS = 30 CARDS ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {slotNumbers.map((dayNum) => {
          const ch = challengeByDay.get(dayNum);

          if (!ch) {
            const isNextSlot = dayNum === nextSequentialDay;
            return (
              <div
                key={`empty_${dayNum}`}
                onClick={() => isNextSlot && openAddDayModal(dayNum)}
                className={`rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-center text-center min-h-[218px] transition-all ${
                  isNextSlot
                    ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/15 hover:bg-amber-100/70 dark:hover:bg-amber-950/30 cursor-pointer group'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-65'
                }`}
              >
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 ${
                    isNextSlot
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Day {dayNum}
                </span>

                {isNextSlot ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                      <PlusIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300">Add Day {dayNum}</span>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                      Rasm va vazifa qo‘shish
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    Kutilmoqda
                  </span>
                )}
              </div>
            );
          }

          return (
            <div
              key={ch.day}
              className="group relative rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-h-[218px]"
            >
              {/* Image Cover */}
              <div className="relative h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {ch.image ? (
                  <img
                    src={ch.image}
                    alt={ch.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400/25 via-orange-400/20 to-indigo-500/25">
                    <ImageIcon className="w-7 h-7 text-amber-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-white font-outfit text-[10px] font-black uppercase tracking-wider shadow-xs">
                  Day {ch.day}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteDay(ch.day)}
                  title={`Day ${ch.day} ni o'chirish`}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>

                <div className="absolute bottom-1.5 left-2 right-2 text-white">
                  <p className="text-[11px] font-extrabold truncate drop-shadow-sm">{ch.title}</p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300 gap-1">
                  <span title="XP">⚡ {ch.xp}</span>
                  <span title="Coin" className="flex items-center gap-0.5"><CoinIcon className="w-3 h-3" /> {ch.coins}</span>
                  <span title="Streak bonus">🔥 +{ch.streakBonus ?? 2}</span>
                </div>

                {ch.deadline && (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span className="truncate">
                      Muddat: {new Date(ch.deadline).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' })}{' '}
                      {new Date(ch.deadline).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => openEditDayModal(ch)}
                  className="w-full py-1.5 rounded-lg bg-amber-500/12 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-300 font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Ochish</span>
                  <OpenExternalIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ==================== ADD / EDIT DAY PORTAL MODAL ==================== */}
      {dayForm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl relative my-auto animate-scale-up overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-white font-outfit font-black text-xs">
                    Day {dayForm.day}
                  </span>
                  <h3 className="font-outfit font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    {modalMode === 'add' ? `Yangi kun qo'shish (Add Day ${dayForm.day})` : `Day ${dayForm.day} — Tahrirlash va Tafsilotlar`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalMode(null);
                    setDayForm(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form id="challengeDayForm" onSubmit={handleSaveDay} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {dayModalError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold">
                    {dayModalError}
                  </div>
                )}

                {/* Cover Image Upload */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Card muqova rasmi (Admin tomonidan yuklanadi)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-5 h-28 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center relative">
                      {dayForm.image ? (
                        <img src={dayForm.image} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400">Rasm tanlanmagan</span>
                      )}
                    </div>
                    <div className="sm:col-span-7 space-y-2">
                      <label className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                        <UploadIcon className="w-4 h-4" />
                        <span>{uploadingCover ? 'Rasm yuklanmoqda...' : 'Kompyuterdan muqova rasm yuklash'}</span>
                        <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" disabled={uploadingCover} />
                      </label>
                      <input
                        type="url"
                        value={dayForm.image}
                        onChange={(e) => setDayForm(prev => ({ ...prev, image: e.target.value }))}
                        placeholder="Yoki rasm URL manzili..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Mavzu nomi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dayForm.title}
                    onChange={(e) => setDayForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Masalan: IELTS Speaking Fluency Part 1"
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-amber-500 outline-none"
                  />
                </div>

                {/* Details / Ma'lumotlar */}
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Kun ma'lumotlari va yo'riqnomasi
                  </label>
                  <textarea
                    rows={3}
                    value={dayForm.description}
                    onChange={(e) => setDayForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Talabalar cardni ochganda ko'radigan batafsil ma'lumot..."
                    className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-amber-500 outline-none resize-none"
                  />
                </div>

                {/* Tasks / Vazifalar */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Vazifalar ro'yxati
                  </label>
                  <div className="space-y-1.5">
                    {(dayForm.tasks || []).map((taskItem, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={taskItem}
                          onChange={(e) => {
                            const next = [...dayForm.tasks];
                            next[idx] = e.target.value;
                            setDayForm(prev => ({ ...prev, tasks: next }));
                          }}
                          className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDayForm(prev => ({
                              ...prev,
                              tasks: prev.tasks.filter((_, i) => i !== idx)
                            }))
                          }
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newTaskDraft}
                      onChange={(e) => setNewTaskDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTaskItem();
                        }
                      }}
                      placeholder="Yangi vazifa qo'shish..."
                      className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddTaskItem}
                      className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-bold cursor-pointer"
                    >
                      + Qo'shish
                    </button>
                  </div>
                </div>

                {/* Gallery Images Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Ichki rasmlar galereyasi ({(dayForm.images || []).length} ta)
                    </label>
                    <label className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold cursor-pointer flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{uploadingGallery ? 'Yuklanmoqda...' : 'Rasmlar yuklash'}</span>
                      <input type="file" multiple accept="image/*" onChange={handleGalleryUpload} className="hidden" disabled={uploadingGallery} />
                    </label>
                  </div>
                  {(dayForm.images || []).length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {dayForm.images.map((imgUrl, idx) => (
                        <div key={idx} className="relative group h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img src={imgUrl} alt={`Rasm ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() =>
                              setDayForm(prev => ({
                                ...prev,
                                images: prev.images.filter((_, i) => i !== idx)
                              }))
                            }
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <CloseIcon className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rewards: XP, Coins, Streaks */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 mb-1">
                      <CoinIcon className="w-3.5 h-3.5" />
                      <span>Coinlar</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={dayForm.coins}
                      onChange={(e) => setDayForm(prev => ({ ...prev, coins: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Strikelar (🔥)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={dayForm.streakBonus}
                      onChange={(e) => setDayForm(prev => ({ ...prev, streakBonus: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      XP ballar (⚡)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={dayForm.xp}
                      onChange={(e) => setDayForm(prev => ({ ...prev, xp: Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Deadline & 50% Late Window */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Topshirish muddati (Deadline)
                      </label>
                      <input
                        type="datetime-local"
                        value={dayForm.deadline}
                        onChange={(e) => setDayForm(prev => ({ ...prev, deadline: e.target.value }))}
                        className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        50% bonus oynasi (oxirgi daqiqalar)
                      </label>
                      <select
                        value={dayForm.urgentWindowMinutes}
                        onChange={(e) => setDayForm(prev => ({ ...prev, urgentWindowMinutes: Number(e.target.value) }))}
                        className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                      >
                        <option value={30}>Oxirgi 30 daqiqa (50%)</option>
                        <option value={60}>Oxirgi 1 soat (50%)</option>
                        <option value={120}>Oxirgi 2 soat (50%)</option>
                        <option value={360}>Oxirgi 6 soat (50%)</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    O'z muddatida topshirgan talaba 100% bonus oladi ({dayForm.coins} Coin, +{dayForm.streakBonus} Streak, +{dayForm.xp} XP); muddati juda kam qolganda topshirganda 50% ({Math.round(dayForm.coins * 0.5)} Coin, +{dayForm.streakBonus > 0 ? Math.max(1, Math.round(dayForm.streakBonus * 0.5)) : 0} Streak, +{Math.round(dayForm.xp * 0.5)} XP) beriladi.
                  </p>
                </div>

                {/* Notify Students Checkbox */}
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(dayForm.notifyStudents)}
                    onChange={(e) => setDayForm(prev => ({ ...prev, notifyStudents: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span>Saqlanganda barcha talabalarga bildirishnoma sifatida yuborish</span>
                </label>
              </form>

              {/* Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div>
                  {modalMode === 'edit' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDay(dayForm.day)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      O'chirish
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode(null);
                      setDayForm(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    form="challengeDayForm"
                    disabled={isSavingDay || uploadingCover || uploadingGallery}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingDay ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
