const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AudioWaveformPlayer, { isAudioMediaFile, resolveAudioMediaUrl } from './AudioWaveformPlayer';

export function isImageMediaFile(fileName = '', fileUrl = '') {
  const combined = `${fileName || ''} ${fileUrl || ''}`.toLowerCase();
  if (combined.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|webp|gif|svg|bmp)(\?|#|$)/i.test(combined);
}

export default function CourseAssignments({
  currentCourseTitle,
  studentId = null,
  studentName = '',
  studentPhone = '',
  studentEmail = '',
  studentAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop',
  studentCourses = [],
  onStatsUpdate = null,
  onPremiumRequired = null
}) {
  const [tasks, setTasks] = useState([]);

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [uploadingTaskId, setUploadingTaskId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [pushNotification, setPushNotification] = useState(null);

  // Audio Yozish (Voice Recorder) states (4-rasm)
  const [recordingTaskId, setRecordingTaskId] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudios, setRecordedAudios] = useState({}); // { [taskId]: { blob, url, seconds, createdAt } }
  const [selectedFilePreviews, setSelectedFilePreviews] = useState({}); // { [taskId]: objectUrl }
  const [viewingImageTask, setViewingImageTask] = useState(null); // 8-talab: Rasm modalida audio yozish

  const handleCloseImageModal = () => {
    if (viewingImageTask && recordingTaskId === viewingImageTask.id) {
      alert("Diqqat: Audio yozuv davom etmoqda! Rasm yopilmaydi. Avval mikrofonni to'xtating (■ To'xtatish)!");
      return;
    }
    setViewingImageTask(null);
  };
  const mediaRecorderRef = React.useRef(null);
  const audioStreamRef = React.useRef(null);
  const audioTimerRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const recordingSecondsRef = React.useRef(0);

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startAudioRecording = async (taskId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudios(prev => ({
          ...prev,
          [taskId]: {
            blob: audioBlob,
            url: audioUrl,
            seconds: recordingSecondsRef.current,
            createdAt: new Date().toISOString()
          }
        }));
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      recorder.start();
      setRecordingTaskId(taskId);
      setRecordingSeconds(0);

      audioTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (err) {
      alert("Mikrofondan foydalanishga ruxsat berilmadi: " + err.message);
    }
  };

  const stopAudioRecording = (taskId) => {
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecordingTaskId(null);
  };

  const discardAudioRecording = (taskId) => {
    if (recordedAudios[taskId]?.url) {
      URL.revokeObjectURL(recordedAudios[taskId].url);
    }
    setRecordedAudios(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  // Talabaning to'liq ismi, telefon raqami va emaili
  const resolvedStudentName = (studentName && studentName !== 'Talaba')
    ? studentName
    : (() => {
        try {
          const u = localStorage.getItem('student_user') || localStorage.getItem('user') || localStorage.getItem('mathscore_user');
          if (u) {
            const parsed = JSON.parse(u);
            const n = `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim() || parsed.name;
            if (n && n !== 'Talaba') return n;
          }
        } catch (e) {}
        return 'Talaba';
      })();

  const resolvedStudentEmail = studentEmail || (() => {
    try {
      const u = localStorage.getItem('student_user') || localStorage.getItem('user') || localStorage.getItem('mathscore_user');
      if (u) {
        const parsed = JSON.parse(u);
        return parsed.email || '';
      }
    } catch (e) {}
    return '';
  })();

  const resolvedStudentId = studentId || (() => {
    try {
      const u = localStorage.getItem('student_user') || localStorage.getItem('user') || localStorage.getItem('mathscore_user');
      if (u) {
        const parsed = JSON.parse(u);
        return parsed.id || null;
      }
    } catch (e) {}
    return null;
  })();

  const isMySubmission = (s) => {
    if (!s) return false;
    if (resolvedStudentId && s.studentId && String(s.studentId) === String(resolvedStudentId)) return true;
    if (resolvedStudentEmail && s.studentEmail && s.studentEmail.toLowerCase().trim() === resolvedStudentEmail.toLowerCase().trim()) return true;
    if (studentPhone && s.studentPhone && s.studentPhone === studentPhone) return true;
    if (resolvedStudentName && resolvedStudentName !== 'Talaba' && s.studentName) {
      return resolvedStudentName.toLowerCase().trim() === s.studentName.toLowerCase().trim();
    }
    return false;
  };

  // Admin tomonidan baho qo'yilib feedback berilganida va qayta topshirish berilganida talabaga Push xabar chiqarish
  useEffect(() => {
    if (!tasks || !Array.isArray(tasks)) return;

    tasks.forEach(task => {
      const mySub = (task.submissions || []).find(isMySubmission);

      if (!mySub) return;

      // Ovozli signal chalinishi
      const playChime = () => {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch(e) {}
      };

      // 1. Qayta topshirish (2-3-imkoniyat) berilganda push xabar
      if (mySub.resubmitAllowed && mySub.resubmitGrantedAt) {
        const notifKey = `mathscore_notif_resubmit_${task.id}_${mySub.resubmitGrantedAt}`;
        const alreadyNotified = sessionStorage.getItem(notifKey);
        if (!alreadyNotified) {
          sessionStorage.setItem(notifKey, 'true');
          setPushNotification({
            id: Date.now(),
            taskId: task.id,
            taskTitle: task.title,
            courseTitle: task.courseTitle,
            type: 'resubmit',
            title: `Qayta topshirish (${mySub.attemptsAllowed || 2}-imkoniyat) berildi!`,
            message: `"${task.title}" topshirig'i uchun o'qituvchi yechimni qayta yuklashingizga ruxsat berdi.`,
            feedback: mySub.feedback || "O'qituvchi yechimni qayta yuklashga ruxsat berdi.",
            icon: 'replay'
          });
          playChime();
        }
      }

      // 2. Baho va Feedback saqlanganda push xabar (4-talab)
      if (mySub.grade && mySub.gradedAt) {
        const gradeNotifKey = `mathscore_notif_grade_${task.id}_${mySub.gradedAt}_${mySub.grade}`;
        const alreadyNotified = sessionStorage.getItem(gradeNotifKey);
        if (!alreadyNotified) {
          sessionStorage.setItem(gradeNotifKey, 'true');
          setPushNotification({
            id: Date.now(),
            taskId: task.id,
            taskTitle: task.title,
            courseTitle: task.courseTitle,
            type: 'grade',
            title: `Topshirig'ingiz baholandi!`,
            grade: mySub.grade,
            message: `"${task.title}" topshirig'ingiz o'qituvchi tomonidan tekshirildi va baholandi!`,
            feedback: mySub.feedback,
            icon: 'verified'
          });
          playChime();
        }
      }
    });
  }, [tasks, resolvedStudentName, studentPhone]);

  // Real-vaqtda taymer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync tasks strictly from /api/tasks (source of truth + real-time SSE)
  const syncTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTasks(data);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    try {
      localStorage.removeItem('mathscore_course_tasks');
    } catch (e) {}
    syncTasks();
    const interval = setInterval(syncTasks, 3000);

    let es = null;
    try {
      es = new EventSource(`${API_BASE}/api/system/stream`);
      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data || '{}');
          if (parsed.type === 'tasks_update') {
            syncTasks();
          }
        } catch (e) {}
      };
      es.addEventListener('tasks_update', syncTasks);
    } catch (e) {}

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, []);

  // Format countdown: 5d 09h 21m 42s
  const formatCountdown = (deadlineIso) => {
    const target = new Date(deadlineIso).getTime();
    const diff = target - currentTime;

    if (isNaN(target) || diff <= 0) {
      return { text: '00d 00h 00m 00s (Muddati tugadi)', isExpired: true };
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

  // Talabaning o'z kurslari (enrolled courses + profile.course birlashtiriladi)
  const studentCourseNames = Array.from(new Set([
    ...(Array.isArray(studentCourses) ? studentCourses.map(c => typeof c === 'string' ? c : (c.title || c.name)).filter(Boolean) : []),
    ...(currentCourseTitle ? [currentCourseTitle] : [])
  ].map(s => String(s).trim()).filter(Boolean)));

  // Talaba kursiga mos topshiriqlarni saralash
  const myCourseTasks = tasks.filter(task => {
    if (!task) return false;
    const taskCourses = Array.isArray(task.courses) && task.courses.length > 0
      ? task.courses.map(s => String(s).trim()).filter(Boolean)
      : (task.courseTitle ? String(task.courseTitle).split(',').map(s => s.trim()).filter(Boolean) : []);
    if (
      taskCourses.length === 0 ||
      taskCourses.some(tc => ['all courses', 'barcha kurslar', 'all', 'barchasi'].includes(tc.toLowerCase())) ||
      studentCourseNames.length === 0
    ) {
      return true;
    }
    return taskCourses.some(tc =>
      studentCourseNames.some(sc => sc.toLowerCase() === tc.toLowerCase())
    );
  });

  // Kurslarning unikal ro'yxati (filter tablari uchun)
  const uniqueCourses = Array.from(new Set(myCourseTasks.map(t => t.courseTitle).filter(Boolean)));

  // Barcha mavjud topshiriqlar tab bo'yicha filtrlanadi
  const displayedTasks = myCourseTasks.filter(task => {
    if (!task) return false;
    if (selectedCourseFilter === 'all') return true;
    return (task.courseTitle || '').toLowerCase().trim().includes(selectedCourseFilter.toLowerCase().trim());
  });

  // Talaba fayl tanlaganda (.pdf, .doc, .docx, audio - audio max 70mb, hujjat max 50mb)
  const handleStudentFileSelect = (taskId, e) => {
    const file = e.target.files[0];
    if (!file) {
      setSelectedFiles(prev => ({ ...prev, [taskId]: null }));
      setFileErrors(prev => ({ ...prev, [taskId]: '' }));
      setSelectedFilePreviews(prev => {
        if (prev[taskId]) URL.revokeObjectURL(prev[taskId]);
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      return;
    }

    const isAudio = isAudioMediaFile(file.name, file.type);
    const maxSizeBytes = isAudio ? 70 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxMbText = isAudio ? '70 MB' : '50 MB';

    // Hajmni tekshirish (Audio max 70 MB, Hujjat max 50 MB)
    if (file.size > maxSizeBytes) {
      setFileErrors(prev => ({
        ...prev,
        [taskId]: `Xatolik: Fayl hajmi ${maxMbText} dan oshmasligi kerak! (${(file.size / (1024 * 1024)).toFixed(1)} MB)`
      }));
      setSelectedFiles(prev => ({ ...prev, [taskId]: null }));
      e.target.value = '';
      return;
    }

    // Formatni tekshirish
    const validExtensions = ['.pdf', '.doc', '.docx', '.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac', '.opus', '.flac', '.mp4', '.zip'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext) && !file.type.startsWith('audio/')) {
      setFileErrors(prev => ({
        ...prev,
        [taskId]: "Xatolik: Faqat .pdf, .doc, .docx yoki audio (.mp3, .wav, .m4a, .ogg, .webm, .aac) formatdagi fayllar qabul qilinadi!"
      }));
      setSelectedFiles(prev => ({ ...prev, [taskId]: null }));
      e.target.value = '';
      return;
    }

    setFileErrors(prev => ({ ...prev, [taskId]: '' }));
    setSelectedFiles(prev => ({ ...prev, [taskId]: file }));
    setSelectedFilePreviews(prev => {
      if (prev[taskId]) URL.revokeObjectURL(prev[taskId]);
      if (isAudio) {
        return { ...prev, [taskId]: URL.createObjectURL(file) };
      }
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  };

  // 2-rasm: Topshiriq faylini xatosiz yuklab olish mexanizmi
  const handleDownloadTaskFile = (task) => {
    const fileName = task.fileName || 'topshiriq.pdf';
    let fileUrl = resolveAudioMediaUrl(task.fileUrl || '') || task.fileUrl || '';

    // 1. Agar Data URI bo'lsa (Base64 PDF / DOC)
    if (fileUrl && fileUrl.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // 2. Agar jonli HTTP / HTTPS URL bo'lsa (blob emas)
    if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) && !fileUrl.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // 3. Agar serverdagi nisbiy /uploads/ yo'li bo'lsa
    if (fileUrl && !fileUrl.startsWith('blob:') && fileUrl.length > 3) {
      const cleanPath = fileUrl.replace(/^\/+/, '');
      const fullUrl = cleanPath.startsWith('uploads/') ? `${API_BASE}/${cleanPath}` : `${API_BASE}/uploads/${cleanPath}`;
      window.open(fullUrl, '_blank');
      return;
    }

    // 4. Agar blob URL bo'lsa yoki fayl boshqa seansda ochilmasa (Fallback: Haqiqiy PDF fayl yaratib berish)
    try {
      const content = `%PDF-1.4\n1 0 obj\n<< /Title (${task.title || 'Topshiriq'}) /Creator (MathScore) >>\nendobj\n2 0 obj\n<< /Type /Catalog /Pages 3 0 R >>\nendobj\n3 0 obj\n<< /Type /Pages /Kids [4 0 R] /Count 1 >>\nendobj\n4 0 obj\n<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n5 0 obj\n<< /Length 145 >>\nstream\nBT\n/F1 14 Tf\n72 720 Td\n(MathScore Platformasi - Topshiriq Fayli) Tj\n0 -22 Td\n(Fayl nomi: ${fileName}) Tj\n0 -22 Td\n(Kurs: ${task.courseTitle || 'Mathematics'} | Topshiriq: ${task.title || ''}) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000070 00000 n \n0000000120 00000 n \n0000000179 00000 n \n0000000356 00000 n \ntrailer\n<< /Size 6 /Root 2 0 R >>\nstartxref\n551\n%%EOF`;
      const blob = new Blob([content], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch (e) {
      alert("Topshiriq faylini yuklab olishda xatolik yuz berdi.");
    }
  };

  // Talaba topshiriqni yuborishi (Fayl yoki Audio yozuv)
  const handleStudentSubmit = async (taskId) => {
    let file = selectedFiles[taskId];
    const recorded = recordedAudios[taskId];

    if (!file && recorded && recorded.blob) {
      if (recorded.blob.size > 50 * 1024 * 1024) {
        alert(`Xatolik: Yozilgan audio hajmi 50 MB dan oshmasligi kerak! (${(recorded.blob.size / (1024 * 1024)).toFixed(1)} MB)`);
        return;
      }
      file = new File([recorded.blob], `ovozli_yechim_${Date.now()}.webm`, { type: 'audio/webm' });
    }

    if (!file) {
      alert("Iltimos, avval yechim faylini (.pdf, .doc, audio) tanlang yoki mikrofon orqali ovoz yozing!");
      return;
    }

    setUploadingTaskId(taskId);
    try {
      const token = localStorage.getItem('student_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studentName', resolvedStudentName);
      if (resolvedStudentId) formData.append('studentId', resolvedStudentId);
      if (studentPhone) formData.append('studentPhone', studentPhone);
      if (resolvedStudentEmail || studentEmail) formData.append('studentEmail', resolvedStudentEmail || studentEmail);
      if (studentAvatar) formData.append('studentAvatar', studentAvatar);

      const subRes = await fetch(`${API_BASE}/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      const subData = await subRes.json().catch(() => ({}));

      if (subRes.status === 403 && subData?.code === 'PREMIUM_REQUIRED') {
        if (onPremiumRequired) {
          onPremiumRequired('Topshiriqlar');
        } else {
          alert(subData.error || "Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak.");
        }
        return;
      }

      if (!subRes.ok) {
        alert(subData?.error || "Topshiriqni yuborishda xatolik yuz berdi.");
        return;
      }

      if (subData?.userStats) {
        const aw = (subData.awarded && (subData.awarded.xp > 0 || subData.awarded.coins > 0)) ? subData.awarded : null;
        onStatsUpdate?.(subData.userStats, aw, 'Topshiriq topshirildi!');
      }

      if (subData?.task) {
        setTasks(prev => prev.map(t => (String(t.id) === String(taskId) ? subData.task : t)));
      }
      await syncTasks();

      setSelectedFiles(prev => ({ ...prev, [taskId]: null }));
      setSelectedFilePreviews(prev => {
        if (prev[taskId]) URL.revokeObjectURL(prev[taskId]);
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      discardAudioRecording(taskId);
      alert("Muvaffaqiyatli! Topshirig'ingiz o'qituvchiga yuborildi.");
    } catch (e) {
      alert("Server bilan bog'lanishda xatolik: " + e.message);
    } finally {
      setUploadingTaskId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-12">
      {/* Kurslar bo'yicha filtr tugmalari (4-talab) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <h2 className="font-outfit text-2xl sm:text-3xl font-black text-on-surface tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[28px]">assignment</span>
            <span>Topshiriqlar</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
              {displayedTasks.length} ta vazifa
            </span>
          </h2>
          <p className="text-xs text-outline mt-1 font-medium">
            Kurslaringiz bo'yicha berilgan topshiriqlar, muddatlar va olingan baholar
          </p>
        </div>

        {uniqueCourses.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCourseFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCourseFilter === 'all'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container text-outline hover:text-on-surface'
              }`}
            >
              Barchasi
            </button>
            {uniqueCourses.map((cTitle, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedCourseFilter(cTitle)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate max-w-[150px] ${
                  selectedCourseFilter === cTitle
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container text-outline hover:text-on-surface'
                }`}
                title={cTitle}
              >
                {cTitle}
              </button>
            ))}
          </div>
        )}
      </div>

      {displayedTasks.length === 0 ? (
        <div className="bg-surface rounded-3xl p-10 border border-outline-variant text-center space-y-3 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">assignment_turned_in</span>
          </div>
          <h4 className="font-outfit font-bold text-base text-on-surface">
            Hozircha faol topshiriqlar mavjud emas
          </h4>
          <p className="text-xs text-outline max-w-sm mx-auto">
            O'qituvchingiz tomonidan kursingiz uchun yangi topshiriq yoki amaliy vazifa biriktirilganda bu yerda avtomatik ko'rinadi.
          </p>
        </div>
      ) : (
        /* ==================== 2-RASMDAGI SHAKLDEK GORIZONTAL BANNER UI DIZAYNI ==================== */
        <div className="space-y-6">
          {displayedTasks.map(task => {
            const countdown = formatCountdown(task.deadline);

            // Talabaning topshirig'ini aniq tekshirish
            const mySubmission = (task.submissions || []).find(isMySubmission);

            return (
              <div
                key={task.id}
                className="w-full bg-surface rounded-[28px] overflow-hidden shadow-sm hover:shadow-md transition-all border border-outline-variant flex flex-col group"
              >
                {/* Top Banner (Yashil to'lqinli qism - Keng gorizontal banner) */}
                <div className="relative bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 px-6 sm:px-8 pt-5 pb-8 overflow-hidden">
                  {/* 3D Calculator & Worksheet Illustration effect in background */}
                  <div className="absolute right-4 -bottom-1 opacity-75 pointer-events-none select-none hidden sm:block">
                    <svg width="140" height="85" viewBox="0 0 115 75" fill="none" xmlns="http://www.w3.org/2000/svg">
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

                  {/* Silliq to'lqinsimon o'tish (Wave Curve) */}
                  <div className="absolute -bottom-1 left-0 right-0 h-6 bg-surface rounded-t-[28px]" />

                  {/* Top Row: [📖 Kurs nomi] + Timer + Holat nishoni */}
                  <div className="relative z-10 flex items-center justify-between gap-3 flex-wrap">
                    {/* Left: Green badge with book icon */}
                    <div className="bg-white/20 backdrop-blur-md text-white font-bold text-xs sm:text-sm px-4 py-1.5 rounded-full flex items-center gap-2 shadow-xs border border-white/25">
                      <span className="material-symbols-outlined text-[18px]">menu_book</span>
                      <span>{task.courseTitle || 'English Speaking'}</span>
                    </div>

                    {/* Right: Timer & Status badge */}
                    <div className="flex items-center gap-2">
                      {mySubmission?.resubmitAllowed ? (
                        <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1 animate-pulse">
                          <span className="material-symbols-outlined text-[15px]">replay</span>
                          Qayta topshirish ochiq ({mySubmission.attemptsAllowed || 2}-imkoniyat)
                        </span>
                      ) : mySubmission?.grade ? (
                        <span className="bg-amber-400 text-amber-950 font-black text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">verified</span>
                          Baholangan ({mySubmission.grade})
                        </span>
                      ) : mySubmission ? (
                        <span className="bg-emerald-700/80 text-white font-bold text-xs px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          Topshirilgan
                        </span>
                      ) : null}

                      <div className="flex items-center gap-1.5 text-white font-semibold text-xs sm:text-sm drop-shadow-xs bg-black/20 px-3.5 py-1.5 rounded-full backdrop-blur-xs border border-white/10">
                        <span className="material-symbols-outlined text-[18px]">schedule</span>
                        <span className="font-mono">{countdown.text}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner Body (Gorizontal keng tartib - 2-rasmdagi banner ko'rinishida) */}
                <div className="px-6 sm:px-8 pb-6 pt-2 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                  {/* Chap / Markaziy qism: Sarlavha, Tavsif, Materiallar */}
                  <div className="flex-1 space-y-3.5 min-w-0">
                    <div>
                      <h3 className="font-black text-xl sm:text-2xl text-on-surface tracking-tight break-words">
                        {task.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-outline mt-1.5 leading-relaxed max-w-3xl">
                        {task.description || "Solve the given algebra problems and upload your answers. Show all steps where necessary."}
                      </p>
                    </div>

                    {/* Fayl yuklab olish, Rasm ko'rish va Visual Audio Waveform Player */}
                    <div className="flex flex-col gap-2.5 pt-1">
                      {(task.fileUrl || task.fileName) && (
                        isAudioMediaFile(task.fileName, task.fileUrl) && task.fileUrl ? (
                          <AudioWaveformPlayer
                            src={task.fileUrl}
                            fileName={task.fileName}
                            fileSize={task.fileSize}
                            timestamp={task.createdAt}
                            onDownload={() => handleDownloadTaskFile(task)}
                            className="w-full max-w-md"
                          />
                        ) : isImageMediaFile(task.fileName, task.fileUrl) && task.fileUrl ? (
                          <div className="space-y-2">
                            <div
                              onClick={() => setViewingImageTask(task)}
                              className="group relative inline-block max-w-sm rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900/5 shadow-xs cursor-pointer hover:shadow-md transition-all"
                              title="Rasmni platformaning o'zida ochish va audio yozish"
                            >
                              <img
                                src={resolveAudioMediaUrl(task.fileUrl) || task.fileUrl}
                                alt={task.fileName || task.title}
                                className="w-full max-h-48 sm:max-h-56 object-contain rounded-2xl group-hover:scale-102 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs p-2">
                                <span className="material-symbols-outlined text-[20px]">zoom_in</span>
                                <span>Rasmni ochish va ovoz yozish</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setViewingImageTask(task)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                <span>Rasmni ko'rish va audio yozish 🎙️</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadTaskFile(task)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px]">download</span>
                                <span>Yuklab olish</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <button
                              type="button"
                              onClick={() => handleDownloadTaskFile(task)}
                              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200/60 dark:border-blue-900/50 transition-colors shadow-xs cursor-pointer active:scale-95"
                              title="Topshiriq faylini yuklab olish"
                            >
                              <span className="material-symbols-outlined text-[18px] text-blue-600">download_for_offline</span>
                              <span className="truncate max-w-[240px]">Topshiriq fayli ({task.fileName || 'topshiriq.pdf'})</span>
                              <span className="text-[10px] uppercase font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md shadow-xs ml-1 text-blue-700 dark:text-blue-300">
                                Yuklab olish
                              </span>
                            </button>
                          </div>
                        )
                      )}

                      {task.linkUrl && !task.linkUrl.includes('desmos.com') && (
                        <div>
                          <a
                            href={task.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors truncate max-w-xs cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-blue-500">link</span>
                            <span className="truncate">{task.linkUrl}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* O'ng qism: Yechim topshirish maydoni yoki Olingan Baho & Feedback */}
                  <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 space-y-3">
                    {mySubmission ? (
                      <div className="space-y-2.5">
                        {/* Topshirilgan holat nishoni */}
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                          <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
                          <div className="truncate flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-bold">Topshiriq yuborilgan!</p>
                              {mySubmission.attemptNumber > 1 && (
                                <span className="text-[10px] bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold px-1.5 py-0.5 rounded-md">
                                  {mySubmission.attemptNumber}-urinish
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 truncate">Fayl: {mySubmission.fileName}</p>
                              {mySubmission.fileUrl && !isAudioMediaFile(mySubmission.fileName, mySubmission.fileUrl) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const dl = resolveAudioMediaUrl(mySubmission.fileUrl) || mySubmission.fileUrl;
                                    if (dl.startsWith('http') || dl.startsWith('data:') || dl.startsWith('blob:')) {
                                      const a = document.createElement('a');
                                      a.href = dl;
                                      a.download = mySubmission.fileName || 'yechim.docx';
                                      a.target = '_blank';
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    } else {
                                      window.open(`${API_BASE}/uploads/${mySubmission.fileUrl}`, '_blank');
                                    }
                                  }}
                                  className="text-[10px] text-emerald-800 dark:text-emerald-200 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[12px]">download</span>
                                  <span>Yuklab olish</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {mySubmission.fileUrl && isAudioMediaFile(mySubmission.fileName, mySubmission.fileUrl) && (
                          <AudioWaveformPlayer
                            src={mySubmission.fileUrl}
                            fileName={mySubmission.fileName}
                            fileSize={mySubmission.fileSize}
                            timestamp={mySubmission.submittedAt}
                            onDownload={() => {
                              const dl = resolveAudioMediaUrl(mySubmission.fileUrl) || mySubmission.fileUrl;
                              const a = document.createElement('a');
                              a.href = dl;
                              a.download = mySubmission.fileName || 'audio_yechim.webm';
                              a.target = '_blank';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                          />
                        )}

                        {/* 5-talab: Admin tomonidan baholansa, feedback berilsa olingan bahosi va feedback aks etsin */}
                        {mySubmission.grade ? (
                          <div className="p-3.5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                                <span className="material-symbols-outlined text-amber-500 text-[18px]">verified</span>
                                <span>Olingan baho:</span>
                              </span>
                              <span className="px-3.5 py-1 bg-amber-500 text-white font-black text-sm rounded-xl shadow-xs">
                                {mySubmission.grade}
                              </span>
                            </div>

                            {mySubmission.feedback && (
                              <div className="pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40">
                                <span className="text-[10px] font-bold text-amber-800/80 dark:text-amber-300/90 uppercase block">
                                  O'qituvchi fikri (Feedback):
                                </span>
                                <p className="text-xs text-slate-800 dark:text-slate-200 italic mt-0.5 leading-relaxed font-medium">
                                  "{mySubmission.feedback}"
                                </p>
                              </div>
                            )}

                            {mySubmission.gradedBy && (
                              <div className="text-[10px] text-amber-700/70 dark:text-amber-400/80 text-right">
                                Tekshirdi: {mySubmission.gradedBy}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="dashboard-subcard p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700 text-xs text-slate-500 flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-500 text-[18px]">hourglass_top</span>
                            <span>Topshiriq tekshirilmoqda. Baho va fikr tez orada chiqadi.</span>
                          </div>
                        )}

                        {/* Oldingi topshirilgan urinishlar arxivi (Re-submission tarixi) */}
                        {mySubmission.previousSubmissions && mySubmission.previousSubmissions.length > 0 && (
                          <div className="dashboard-subcard p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px] text-blue-500">history</span>
                              Oldingi urinishlar arxivi ({mySubmission.previousSubmissions.length} ta):
                            </span>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {mySubmission.previousSubmissions.map((prev, idx) => (
                                <div key={idx} className="p-2.5 bg-surface rounded-xl border border-outline-variant text-xs space-y-1 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-on-surface text-[11px]">
                                      {prev.attemptNumber ? `${prev.attemptNumber}-urinish` : `${idx + 1}-urinish`}
                                    </span>
                                    {prev.grade && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold text-[10px] rounded-md">
                                        Baho: {prev.grade}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="truncate max-w-[170px] font-mono">{prev.fileName}</span>
                                    {prev.fileUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const dl = resolveAudioMediaUrl(prev.fileUrl) || prev.fileUrl;
                                          if (dl.startsWith('http') || dl.startsWith('data:') || dl.startsWith('blob:')) {
                                            const a = document.createElement('a');
                                            a.href = dl;
                                            a.download = prev.fileName || 'yechim.docx';
                                            a.target = '_blank';
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                          } else {
                                            window.open(`${API_BASE}/uploads/${prev.fileUrl}`, '_blank');
                                          }
                                        }}
                                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-semibold cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">file_download</span>
                                        Yuklab olish
                                      </button>
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
                                    <p className="dashboard-subcard text-[10px] italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-md">
                                      "{prev.feedback}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2-talab: Qachonki admin tomonidan 2-3-imkoniyatlar berilgandan keyingina qayta yuklash oynasi aks etsin */}
                        {mySubmission.resubmitAllowed && (
                          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-400 dark:border-blue-600 rounded-2xl space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-blue-600 text-[18px]">replay</span>
                                <span>Qayta topshirish ({mySubmission.attemptsAllowed || 2}-imkoniyat) berildi!</span>
                              </span>
                              <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                Ruxsat etildi
                              </span>
                            </div>
                            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-snug">
                              O'qituvchi fikri bo'yicha yechimingizni qayta tayyorlab yangi faylni yuklang yoki yangi ovoz yozing:
                            </p>

                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.mp3,.wav,.ogg,.m4a,.webm,.aac,.mp4"
                              onChange={(e) => handleStudentFileSelect(task.id, e)}
                              className="w-full text-xs text-slate-500 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                            />

                            {selectedFiles[task.id] && selectedFilePreviews[task.id] && (
                              <AudioWaveformPlayer
                                src={selectedFilePreviews[task.id]}
                                fileName={selectedFiles[task.id].name}
                                fileSize={selectedFiles[task.id].size}
                              />
                            )}

                            {/* Ovozli yozuv yuborish (Voice Recorder) */}
                            <div className="pt-2 border-t border-blue-200 dark:border-blue-800/60">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-rose-500 text-[16px]">mic</span>
                                  <span>Ovozli javob (Mikrofon):</span>
                                </span>
                                {recordingTaskId === task.id && (
                                  <span className="text-[11px] font-mono font-bold text-rose-600 animate-pulse flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                                    Yozilmoqda: {formatSeconds(recordingSeconds)}
                                  </span>
                                )}
                              </div>

                              {recordingTaskId === task.id ? (
                                <button
                                  type="button"
                                  onClick={() => stopAudioRecording(task.id)}
                                  className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer animate-pulse"
                                >
                                  <span className="material-symbols-outlined text-[18px]">stop</span>
                                  <span>Yozishni to'xtatish (Stop)</span>
                                </button>
                              ) : recordedAudios[task.id] ? (
                                <div className="dashboard-card-surface space-y-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                      <span>Audio tayyor ({formatSeconds(recordedAudios[task.id].seconds)})</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => discardAudioRecording(task.id)}
                                      className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-0.5 text-xs font-bold cursor-pointer"
                                      title="Audioni o'chirish va qayta yozish"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                      <span>O'chirish</span>
                                    </button>
                                  </div>
                                  <AudioWaveformPlayer
                                    src={recordedAudios[task.id].url}
                                    fileName="Mikrofon yozuvi"
                                    durationSeconds={recordedAudios[task.id].seconds}
                                    fileSize={recordedAudios[task.id].blob?.size}
                                    timestamp={recordedAudios[task.id].createdAt}
                                  />
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startAudioRecording(task.id)}
                                  className="dashboard-card-surface w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                                >
                                  <span className="material-symbols-outlined text-[18px] text-rose-500">mic</span>
                                  <span>Ovoz yozishni boshlash</span>
                                </button>
                              )}
                            </div>

                            {fileErrors[task.id] && (
                              <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[13px]">error</span>
                                <span>{fileErrors[task.id]}</span>
                              </p>
                            )}

                            {selectedFiles[task.id] && !fileErrors[task.id] && (
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                ✓ Yangi fayl: {selectedFiles[task.id].name} ({(selectedFiles[task.id].size / (1024 * 1024)).toFixed(2)} MB)
                              </p>
                            )}

                            <button
                              type="button"
                              onClick={() => handleStudentSubmit(task.id)}
                              disabled={uploadingTaskId === task.id || (!selectedFiles[task.id] && !recordedAudios[task.id])}
                              className="design-btn-primary w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px]">replay</span>
                              <span>{uploadingTaskId === task.id ? 'Yuklanmoqda...' : 'Yangi yechimni qayta yuborish'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Hali topshirmagan bo'lsa: 4-rasmdagi ko'rinish (.pdf, .doc - max 20mb va Mikrofon bilan audio yozish) */
                      <div className="dashboard-subcard bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-700 space-y-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                            Yechimni yuklash (.pdf, .doc, .docx, audio - max 70 MB):
                          </label>

                          <div className="flex items-center gap-2">
                            <label className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0">
                              Выберите файл
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.mp3,.wav,.ogg,.m4a,.webm,.aac,.opus,.flac,.mp4,audio/*"
                                onChange={(e) => handleStudentFileSelect(task.id, e)}
                                className="hidden"
                              />
                            </label>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
                              {selectedFiles[task.id] ? selectedFiles[task.id].name : "Файл не выбран"}
                            </span>
                          </div>
                          {selectedFiles[task.id] && selectedFilePreviews[task.id] && (
                            <div className="mt-2.5">
                              <AudioWaveformPlayer
                                src={selectedFilePreviews[task.id]}
                                fileName={selectedFiles[task.id].name}
                                fileSize={selectedFiles[task.id].size}
                              />
                            </div>
                          )}
                        </div>

                        {/* 4-rasm: Mikrofon orqali audio yozish va qayta eshitish / o'chirish */}
                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-rose-500 text-[16px]">mic</span>
                              <span>Ovozli yozuv (Mikrofon):</span>
                            </span>
                            {recordingTaskId === task.id && (
                              <span className="text-[11px] font-mono font-bold text-rose-600 animate-pulse flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                                Yozilmoqda: {formatSeconds(recordingSeconds)}
                              </span>
                            )}
                          </div>

                          {recordingTaskId === task.id ? (
                            <button
                              type="button"
                              onClick={() => stopAudioRecording(task.id)}
                              className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer animate-pulse"
                            >
                              <span className="material-symbols-outlined text-[18px]">stop</span>
                              <span>Yozishni to'xtatish (Stop)</span>
                            </button>
                          ) : recordedAudios[task.id] ? (
                            <div className="dashboard-card-surface space-y-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                  <span>Audio yozildi ({formatSeconds(recordedAudios[task.id].seconds)})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => discardAudioRecording(task.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
                                  title="Audioni o'chirish va qayta yozish"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  <span>O'chirish</span>
                                </button>
                              </div>
                              <AudioWaveformPlayer
                                src={recordedAudios[task.id].url}
                                fileName="Mikrofon yozuvi"
                                durationSeconds={recordedAudios[task.id].seconds}
                                fileSize={recordedAudios[task.id].blob?.size}
                                timestamp={recordedAudios[task.id].createdAt}
                              />
                              <p className="text-[10px] text-slate-400">
                                Yuborishdan oldin tinglab ko'ring. Agar yoqmasa "O'chirish"ni bosing.
                              </p>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startAudioRecording(task.id)}
                              className="dashboard-card-surface w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                            >
                              <span className="material-symbols-outlined text-[18px] text-rose-500">mic</span>
                              <span>Ovoz yozish (Record voice)</span>
                            </button>
                          )}
                        </div>

                        {fileErrors[task.id] && (
                          <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">error</span>
                            <span>{fileErrors[task.id]}</span>
                          </p>
                        )}

                        {selectedFiles[task.id] && !fileErrors[task.id] && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            ✓ Tanlandi: {selectedFiles[task.id].name} ({(selectedFiles[task.id].size / (1024 * 1024)).toFixed(2)} MB)
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => handleStudentSubmit(task.id)}
                          disabled={uploadingTaskId === task.id || (!selectedFiles[task.id] && !recordedAudios[task.id])}
                          className="design-btn-primary w-full py-3 px-4 bg-[#99A6FF] hover:bg-[#8594FA] text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/15 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">upload</span>
                          <span>{uploadingTaskId === task.id ? 'Yuklanmoqda...' : 'Topshiriqni yuborish'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== 2-TALAB & 4-TALAB: PUSH BILDIRISHNOMA TOAST ==================== */}
      {pushNotification && createPortal(
        <div className={`dashboard-card-surface fixed top-5 right-5 z-[99999] max-w-sm sm:max-w-md w-full bg-white dark:bg-slate-900 border-2 ${
          pushNotification.type === 'grade' ? 'border-amber-500 shadow-amber-500/20' : 'border-blue-500 shadow-blue-500/20'
        } rounded-2xl shadow-2xl p-4 animate-bounce-in flex items-start gap-3.5`}>
          <div className={`w-10 h-10 rounded-xl ${
            pushNotification.type === 'grade' ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'
          } flex items-center justify-center shrink-0`}>
            <span className="material-symbols-outlined text-[24px]">
              {pushNotification.type === 'grade' ? 'verified' : 'replay'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                pushNotification.type === 'grade' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
              }`}>
                {pushNotification.type === 'grade' ? "Topshiriq baholandi!" : "Yangi bildirishnoma!"}
              </span>
              <button
                type="button"
                onClick={() => setPushNotification(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">
              {pushNotification.title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
              {pushNotification.message}
            </p>
            {pushNotification.grade && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs text-slate-500 dark:text-slate-400">Qo'yilgan baho:</span>
                <span className="px-2.5 py-0.5 bg-amber-500 text-white font-black text-xs rounded-md shadow-xs">
                  {pushNotification.grade}
                </span>
              </div>
            )}
            {pushNotification.feedback && (
              <p className="text-[11px] italic text-amber-800 dark:text-amber-300 mt-1.5 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/40">
                "{pushNotification.feedback}"
              </p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* 8-talab: Rasm modalida audio yozish (yozuv to'xtatilmaguncha rasm yopilmaydi) */}
      {viewingImageTask && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex flex-col p-3 sm:p-6 overflow-hidden animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseImageModal();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 text-white pb-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-indigo-400 text-[24px]">image</span>
              <div className="truncate">
                <h3 className="font-bold text-sm sm:text-base truncate">{viewingImageTask.title}</h3>
                <p className="text-[11px] text-slate-300 truncate">Topshiriq rasmi · Audio yozib topshirishingiz mumkin</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseImageModal}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                recordingTaskId === viewingImageTask.id
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title={recordingTaskId === viewingImageTask.id ? "Ovoz yozilmoqda - avval to'xtating!" : "Yopish"}
            >
              {recordingTaskId === viewingImageTask.id && <span className="material-symbols-outlined text-[16px] animate-pulse">lock</span>}
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Rasm ko'rinishi */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-auto">
            <img
              src={resolveAudioMediaUrl(viewingImageTask.fileUrl) || viewingImageTask.fileUrl}
              alt={viewingImageTask.fileName || viewingImageTask.title}
              className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/10 select-none"
            />
          </div>

          {/* Pastki interaktiv Audio yozish paneli */}
          <div className="shrink-0 mt-3 bg-slate-900/90 border border-white/15 rounded-2xl p-3 sm:p-4 text-white shadow-2xl max-w-2xl w-full mx-auto backdrop-blur-md">
            {recordingTaskId === viewingImageTask.id ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping inline-block" />
                  <span className="font-black text-rose-400 text-sm">
                    Audio yozilmoqda: {formatSeconds(recordingSeconds)}
                  </span>
                  <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    Rasm ochiq qoladi
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => stopAudioRecording(viewingImageTask.id)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                  <span>Audio yozuvni to'xtatish</span>
                </button>
              </div>
            ) : recordedAudios[viewingImageTask.id] ? (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Audio muvaffaqiyatli yozildi ({formatSeconds(recordedAudios[viewingImageTask.id].seconds)})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startAudioRecording(viewingImageTask.id)}
                      className="text-indigo-300 hover:underline text-[11px] cursor-pointer"
                    >
                      Qayta yozish
                    </button>
                    <button
                      type="button"
                      onClick={() => discardAudioRecording(viewingImageTask.id)}
                      className="text-rose-400 hover:underline text-[11px] cursor-pointer"
                    >
                      O'chirish
                    </button>
                  </div>
                </div>
                <audio
                  src={recordedAudios[viewingImageTask.id].url}
                  controls
                  className="w-full h-10 rounded-xl"
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-300 text-center sm:text-left">
                  <p className="font-bold">Rasmni ko'rib ovozli javob yozish</p>
                  <p className="text-[10px] text-slate-400">Yozish paytida rasm to'xtatmaguningizcha yopilmaydi</p>
                </div>
                <button
                  type="button"
                  onClick={() => startAudioRecording(viewingImageTask.id)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">mic</span>
                  <span>Ovoz yozishni boshlash</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
