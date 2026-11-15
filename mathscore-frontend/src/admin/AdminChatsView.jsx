import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AudioWaveformPlayer from './AudioWaveformPlayer';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

export default function AdminChatsView({
  chats = [],
  onRefreshChats,
  getAuthMediaUrl,
  getInitialsAvatar
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replyOpenMap, setReplyOpenMap] = useState({});
  const [replyTexts, setReplyTexts] = useState({});
  const [sendingId, setSendingId] = useState(null);
  // Default: barcha chat cardlar minimize holatida turadi (faqat expandedMap[id] === true bo'lganlari ochiq)
  const [expandedMap, setExpandedMap] = useState({});
  const [maximizedStudentId, setMaximizedStudentId] = useState(null);
  const maximizedScrollRef = useRef(null);

  // Audio recording state for specific student card
  const [recordingStudentId, setRecordingStudentId] = useState(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingSecondsRef = useRef(0);
  const skipSendOnStopRef = useRef(false);

  const cleanupRecorder = () => {
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMaximizedStudentId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      skipSendOnStopRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      cleanupRecorder();
    };
  }, []);

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatMsgTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString('uz-UZ', {
        timeZone: 'Asia/Tashkent',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  const formatChatMessageText = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    let str = raw;
    for (let i = 0; i < 2; i++) {
      const prev = str;
      str = str
        .replace(/&quot;/g, '"')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      if (prev === str) break;
    }
    return str;
  };

  const markAsRead = async (studentId) => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`${API_BASE}/api/support-chats/${studentId}/read`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      onRefreshChats?.();
    } catch (e) {}
  };

  const openReplyBox = (chat) => {
    setExpandedMap(prev => ({ ...prev, [chat.studentId]: true }));
    setReplyOpenMap(prev => ({ ...prev, [chat.studentId]: true }));
    if ((chat.unreadByAdmin || 0) > 0) {
      markAsRead(chat.studentId);
    }
  };

  const toggleMinimizeCard = (studentId) => {
    if (maximizedStudentId === studentId) {
      setMaximizedStudentId(null);
      setExpandedMap(prev => ({ ...prev, [studentId]: false }));
      return;
    }
    setExpandedMap(prev => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const toggleMaximizeCard = (studentId) => {
    setMaximizedStudentId(prev => {
      if (prev === studentId) return null;
      setExpandedMap(m => ({ ...m, [studentId]: true }));
      return studentId;
    });
  };

  const handleSendTextReply = async (studentId, e) => {
    if (e) e.preventDefault();
    const text = String(replyTexts[studentId] || '').trim();
    if (!text) return;

    setSendingId(studentId);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/support-chats/${studentId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Xabar yuborishda xatolik.');
      }
      setReplyTexts(prev => ({ ...prev, [studentId]: '' }));
      await onRefreshChats?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingId(null);
    }
  };

  const uploadAndSendAudio = async (studentId, blob, durationSec) => {
    setSendingId(studentId);
    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      const file = new File([blob], `admin_voice_${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
      formData.append('audio', file);
      formData.append('duration', formatTimer(durationSec));

      const res = await fetch(`${API_BASE}/api/support-chats/${studentId}/messages`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Audio xabar yuborishda xatolik.');
      }
      await onRefreshChats?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingId(null);
    }
  };

  const startVoiceRecording = async (studentId) => {
    if (recordingStudentId && recordingStudentId !== studentId) {
      cancelVoiceRecording();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;
      skipSendOnStopRef.current = false;

      const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const shouldSend = !skipSendOnStopRef.current;
        const durationSec = recordingSecondsRef.current || 1;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanupRecorder();
        setRecordingStudentId(null);
        setRecordingSeconds(0);
        if (shouldSend && blob.size > 0) {
          await uploadAndSendAudio(studentId, blob, durationSec);
        }
      };

      recorder.start();
      setRecordingStudentId(studentId);
      setRecordingSeconds(0);
      setReplyOpenMap(prev => ({ ...prev, [studentId]: true }));

      audioTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (err) {
      alert('Mikrofondan foydalanishda xatolik: ' + err.message);
    }
  };

  const stopAndSendVoiceRecording = () => {
    skipSendOnStopRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecorder();
      setRecordingStudentId(null);
    }
  };

  const cancelVoiceRecording = () => {
    skipSendOnStopRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecorder();
      setRecordingStudentId(null);
    }
  };

  const sortedChats = [...chats].sort((a, b) => {
    const unreadDiff = (b.unreadByAdmin > 0 ? 1 : 0) - (a.unreadByAdmin > 0 ? 1 : 0);
    if (unreadDiff !== 0) return unreadDiff;
    const bTime = new Date(b.updatedAt || b.lastMessage?.createdAt || 0).getTime();
    const aTime = new Date(a.updatedAt || a.lastMessage?.createdAt || 0).getTime();
    return bTime - aTime;
  });

  const filteredChats = sortedChats.filter(c => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    return (
      (c.studentName || '').toLowerCase().includes(q) ||
      (c.studentEmail || '').toLowerCase().includes(q) ||
      (c.studentCourse || '').toLowerCase().includes(q)
    );
  });

  const totalUnread = chats.reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0);
  const allMinimized = filteredChats.length > 0 && filteredChats.every(c => !Boolean(expandedMap[c.studentId]));

  const toggleAllMinimized = () => {
    if (allMinimized) {
      const next = {};
      filteredChats.forEach(c => { next[c.studentId] = true; });
      setExpandedMap(next);
    } else {
      setExpandedMap({});
      setMaximizedStudentId(null);
    }
  };

  const maximizedChat = maximizedStudentId != null
    ? chats.find(c => String(c.studentId) === String(maximizedStudentId))
    : null;

  useEffect(() => {
    if (maximizedChat && maximizedScrollRef.current) {
      const el = maximizedScrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [maximizedStudentId, maximizedChat?.messages?.length]);

  const renderChatCard = (chat, { isMaximizedView = false } = {}) => {
    const isReplyOpen = Boolean(replyOpenMap[chat.studentId]);
    const isRecordingHere = recordingStudentId === chat.studentId;
    const isSendingHere = sendingId === chat.studentId;
    const isMinimized = !isMaximizedView && !Boolean(expandedMap[chat.studentId]);
    const isMaximizedHere = isMaximizedView || String(maximizedStudentId) === String(chat.studentId);
    const avatarSrc = getAuthMediaUrl(chat.studentAvatar) || getInitialsAvatar(chat.studentName);
    const messagesList = chat.messages || [];
    const lastMessage = messagesList.length > 0 ? messagesList[messagesList.length - 1] : null;

    return (
      <div
        key={isMaximizedView ? `max-${chat.studentId}` : chat.studentId}
        data-testid={isMaximizedView ? `chat-card-maximized-${chat.studentId}` : `chat-card-${chat.studentId}`}
        className={`modern-card rounded-3xl border overflow-hidden flex flex-col transition-all ${
          isMaximizedView
            ? 'w-full max-w-3xl h-[min(740px,calc(100vh-2rem))] sm:h-[min(760px,calc(100vh-3rem))] bg-white dark:bg-slate-900 shadow-2xl border-indigo-400/70 dark:border-indigo-500/50'
            : (chat.unreadByAdmin || 0) > 0
              ? 'border-indigo-400 dark:border-indigo-600 shadow-lg shadow-indigo-500/10'
              : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Card Header */}
        <div className="shrink-0 p-4 px-5 bg-white/60 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={avatarSrc}
              alt={chat.studentName}
              className="w-11 h-11 rounded-full object-cover border-2 border-indigo-500/30 shrink-0"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = getInitialsAvatar(chat.studentName);
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-sm text-slate-900 dark:text-white truncate">{chat.studentName}</h4>
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
                    chat.studentTariff === 'FREE'
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  }`}
                >
                  {chat.studentTariff || 'VIP'}
                </span>
              </div>
              <p className={`text-[11px] font-medium text-slate-500 dark:text-slate-400 ${isMaximizedView ? 'break-all' : 'truncate'}`}>
                {chat.studentEmail} {chat.studentCourse ? `• ${chat.studentCourse}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(chat.unreadByAdmin || 0) > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-xs">
                {chat.unreadByAdmin} yangi
              </span>
            )}
            <button
              type="button"
              onClick={() => openReplyBox(chat)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">reply</span>
              <span>Javob yozish</span>
            </button>

            <button
              type="button"
              onClick={() => toggleMinimizeCard(chat.studentId)}
              title={isMinimized ? "Ochish" : "Yig'ish"}
              aria-label={isMinimized ? "Ochish" : "Yig'ish"}
              data-testid={`chat-minimize-${chat.studentId}`}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isMinimized ? 'expand_more' : 'remove'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => toggleMaximizeCard(chat.studentId)}
              title={isMaximizedHere ? "Odatiy o'lchamga qaytarish" : "Kattalashtirish"}
              aria-label={isMaximizedHere ? "Kichraytirish" : "Kattalashtirish"}
              data-testid={`chat-maximize-${chat.studentId}`}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isMaximizedHere
                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">
                {isMaximizedHere ? 'close_fullscreen' : 'open_in_full'}
              </span>
            </button>
          </div>
        </div>

        {isMinimized ? (
          <div
            onClick={() => toggleMinimizeCard(chat.studentId)}
            className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-900/70 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 text-xs text-slate-500 dark:text-slate-400">
              <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                {messagesList.length} ta xabar
              </span>
              {lastMessage && (
                <span className="truncate">
                  <strong className="text-slate-700 dark:text-slate-200">
                    {lastMessage.senderRole === 'admin' ? 'Admin' : chat.studentName}:
                  </strong>{' '}
                  {lastMessage.type === 'audio' ? '🎤 Audio xabar' : formatChatMessageText(lastMessage.text)}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
              Ochish
            </span>
          </div>
        ) : (
          <>
            {/* Messages Scroll Area */}
            <div
              ref={isMaximizedView ? maximizedScrollRef : undefined}
              className={`p-4 sm:p-5 space-y-3 overflow-y-auto bg-slate-50/70 dark:bg-slate-950/40 ${
                isMaximizedView ? 'flex-1 min-h-0' : 'max-h-[290px]'
              }`}
            >
              {messagesList.map(msg => {
                const isAdmin = msg.senderRole === 'admin';
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    {!isAdmin && (
                      <img
                        src={avatarSrc}
                        alt={chat.studentName}
                        className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getInitialsAvatar(chat.studentName);
                        }}
                      />
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                        isAdmin
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className={`text-[10px] font-bold ${isAdmin ? 'text-indigo-100' : 'text-indigo-500 dark:text-indigo-300'}`}>
                          {isAdmin ? (msg.senderName || 'Azizbek (Admin)') : chat.studentName}
                        </span>
                        <span className={`text-[9px] ${isAdmin ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {formatMsgTime(msg.createdAt)}
                        </span>
                      </div>

                      {msg.type === 'audio' && msg.audioUrl ? (
                        <div className="min-w-[230px]">
                          <AudioWaveformPlayer
                            src={msg.audioUrl}
                            fileName="audio_message.webm"
                            timestamp={msg.createdAt}
                          />
                          {msg.text && (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words mt-1.5 opacity-95">{formatChatMessageText(msg.text)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{formatChatMessageText(msg.text)}</p>
                      )}
                    </div>

                    {isAdmin && (
                      <img
                        src={getAuthMediaUrl(msg.senderAvatar) || getInitialsAvatar(msg.senderName || 'Azizbek')}
                        alt={msg.senderName || 'Admin'}
                        className="w-7 h-7 rounded-full object-cover shrink-0 border border-indigo-400/50"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getInitialsAvatar(msg.senderName || 'Azizbek');
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline Reply Composer inside Card */}
            {(isReplyOpen || isMaximizedView) && (
              <div className="shrink-0 p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                {isRecordingHere ? (
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>
                      <span className="text-xs font-black text-rose-600 dark:text-rose-300 font-mono">
                        Ovoz yozilmoqda... {formatTimer(recordingSeconds)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelVoiceRecording}
                        title="Bekor qilish"
                        className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[17px]">close</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopAndSendVoiceRecording}
                        title="To'xtatish va yuborish"
                        className="px-3.5 h-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[17px]">stop</span>
                        <span>To'xtatish va yuborish</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={(e) => handleSendTextReply(chat.studentId, e)} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyTexts[chat.studentId] || ''}
                      onChange={(e) => setReplyTexts(prev => ({ ...prev, [chat.studentId]: e.target.value }))}
                      placeholder={`${chat.studentName} ga javob yozing...`}
                      disabled={isSendingHere}
                      className="flex-1 h-10 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => startVoiceRecording(chat.studentId)}
                      disabled={isSendingHere}
                      title="Mikrofon orqali audio xabar yozish"
                      className="w-10 h-10 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[20px]">mic</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingHere || !String(replyTexts[chat.studentId] || '').trim()}
                      title="Xabarni yuborish"
                      className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[19px]">send</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="modern-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-indigo-500 text-[28px]">forum</span>
            <span>Talabalar bilan yordam chatlari</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold">
              {chats.length} ta chat
            </span>
            {totalUnread > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-bold animate-pulse">
                {totalUnread} ta yangi
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Har bir talabaning savollari alohida kartochkada ko'rinadi — matn yoki audio xabar orqali javob bering.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Talaba ismi yoki email..."
              className="h-10 pl-9 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 min-w-[220px]"
            />
          </div>
          {filteredChats.length > 0 && (
            <button
              type="button"
              onClick={toggleAllMinimized}
              data-testid="chats-toggle-all-minimize"
              className="h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[17px]">
                {allMinimized ? 'unfold_more' : 'unfold_less'}
              </span>
              <span>{allMinimized ? "Barchasini ochish" : "Barchasini yig'ish"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onRefreshChats?.()}
            className="h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">refresh</span>
            <span>Yangilash</span>
          </button>
        </div>
      </div>

      {/* Individual Cards Grid */}
      {filteredChats.length === 0 ? (
        <div className="modern-card p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">chat_bubble_outline</span>
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Hozircha talabalardan xabar kelmagan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Talabalar Student paneldagi pastki o'ng Yordam chati orqali xabar yozganida shu yerda har bir talaba uchun alohida kartochka paydo bo'ladi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {filteredChats.map(chat => renderChatCard(chat))}
        </div>
      )}

      {/* Maximized Chat Card Overlay via Portal (escapes animate-fade-in transform context) */}
      {maximizedChat && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setMaximizedStudentId(null)}
          className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center"
        >
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl flex justify-center">
            {renderChatCard(maximizedChat, { isMaximizedView: true })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
