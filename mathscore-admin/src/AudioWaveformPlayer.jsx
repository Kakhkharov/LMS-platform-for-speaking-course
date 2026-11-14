import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

const BAR_COUNT = 44;

export function isAudioMediaFile(fileName = '', fileUrl = '') {
  const combined = `${fileName || ''} ${fileUrl || ''}`.toLowerCase();
  if (combined.startsWith('blob:') || combined.includes('data:audio/') || combined.includes('data:video/mp4')) {
    return true;
  }
  return /\.(mp3|wav|ogg|m4a|webm|aac|flac|opus|mp4)(\?|#|$)/i.test(combined);
}

export function resolveAudioMediaUrl(fileUrl = '') {
  if (!fileUrl) return '';
  let url = String(fileUrl).trim();
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const cleaned = url.replace(/^\/+/, '');
    url = cleaned.startsWith('uploads/') ? `${API_BASE}/${cleaned}` : `${API_BASE}/uploads/${cleaned}`;
  }

  try {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('admin_token') || localStorage.getItem('student_token') || localStorage.getItem('token')
        : '';
    if (token && url.includes('/uploads/') && !url.includes('token=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}token=${encodeURIComponent(token)}`;
    }
  } catch (e) {}

  return url;
}

function formatDurationMMSS(sec) {
  const safe = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function formatSizeReadable(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '';
  if (num < 1024) return `${num} B`;
  const kb = num / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace('.', ',')} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

function formatTimeHHMM(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (e) {
    return '';
  }
}

function generateFallbackBars(seedText = 'audio', count = BAR_COUNT) {
  let hash = 2166136261;
  const str = String(seedText || 'audio');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars = [];
  for (let i = 0; i < count; i++) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    const rand = (Math.abs(hash) % 100) / 100;
    const envelope = Math.sin(((i + 1) / (count + 1)) * Math.PI);
    const val = Math.max(0.14, Math.min(0.95, 0.16 + rand * 0.65 * (0.45 + 0.55 * envelope)));
    bars.push(Number(val.toFixed(3)));
  }
  return bars;
}

export default function AudioWaveformPlayer({
  src,
  fileName = '',
  durationSeconds = 0,
  fileSize = 0,
  timestamp = null,
  onDownload = null,
  className = ''
}) {
  const instanceId = useId();
  const audioRef = useRef(null);
  const waveformRef = useRef(null);

  const resolvedSrc = useMemo(() => resolveAudioMediaUrl(src), [src]);
  const fallbackBars = useMemo(() => generateFallbackBars(fileName || src || 'audio'), [fileName, src]);

  const [bars, setBars] = useState(fallbackBars);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(durationSeconds) || 0);
  const [knownSize, setKnownSize] = useState(Number(fileSize) || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setBars(fallbackBars);
    setIsPlaying(false);
    setCurrentTime(0);
    setLoadError(false);
    if (Number(durationSeconds) > 0) setDuration(Number(durationSeconds));
    if (Number(fileSize) > 0) setKnownSize(Number(fileSize));
  }, [resolvedSrc, fallbackBars, durationSeconds, fileSize]);

  useEffect(() => {
    if (!resolvedSrc) return;
    let cancelled = false;
    const controller = new AbortController();

    async function decodePeaks() {
      try {
        const res = await fetch(resolvedSrc, { signal: controller.signal });
        if (!res.ok) return;
        const contentLen = Number(res.headers.get('content-length') || 0);
        const arrBuf = await res.arrayBuffer();
        if (cancelled) return;

        if (!fileSize && (arrBuf.byteLength > 0 || contentLen > 0)) {
          setKnownSize(arrBuf.byteLength || contentLen);
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx || arrBuf.byteLength === 0) return;

        const audioCtx = new AudioCtx();
        try {
          const decoded = await audioCtx.decodeAudioData(arrBuf.slice(0));
          if (cancelled) return;

          if (decoded.duration && decoded.duration > 0) {
            setDuration(decoded.duration);
          }

          const channelData = decoded.getChannelData(0);
          const blockSize = Math.max(1, Math.floor(channelData.length / BAR_COUNT));
          const rawPeaks = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            const start = i * blockSize;
            const end = Math.min(channelData.length, start + blockSize);
            let sum = 0;
            const step = Math.max(1, Math.floor((end - start) / 48));
            let samples = 0;
            for (let j = start; j < end; j += step) {
              sum += Math.abs(channelData[j]);
              samples++;
            }
            rawPeaks.push(samples > 0 ? sum / samples : 0);
          }

          const maxPeak = Math.max(...rawPeaks, 0.01);
          const normalized = rawPeaks.map(p => {
            const ratio = Math.pow(p / maxPeak, 0.78);
            return Number(Math.max(0.12, Math.min(1, ratio)).toFixed(3));
          });
          if (!cancelled) setBars(normalized);
        } finally {
          audioCtx.close().catch(() => {});
        }
      } catch (e) {}
    }

    decodePeaks();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [resolvedSrc, fileSize]);

  useEffect(() => {
    const onGlobalPlay = (e) => {
      if (e.detail !== instanceId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('mathscore-audio-play', onGlobalPlay);
    return () => window.removeEventListener('mathscore-audio-play', onGlobalPlay);
  }, [instanceId]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      window.dispatchEvent(new CustomEvent('mathscore-audio-play', { detail: instanceId }));
      audio.playbackRate = playbackRate;
      await audio.play();
      setIsPlaying(true);
      setLoadError(false);
    } catch (err) {
      setIsPlaying(false);
      setLoadError(true);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const seekAtClientX = (clientX) => {
    const el = waveformRef.current;
    const audio = audioRef.current;
    if (!el || !audio) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const targetDuration = (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0)
      ? audio.duration
      : duration;
    if (targetDuration > 0) {
      const nextTime = ratio * targetDuration;
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  const effectiveDuration = duration > 0 ? duration : 0;
  const progress = effectiveDuration > 0 ? Math.max(0, Math.min(1, currentTime / effectiveDuration)) : 0;
  const displayedTime = isPlaying || currentTime > 0 ? formatDurationMMSS(currentTime) : formatDurationMMSS(effectiveDuration);
  const formattedSize = formatSizeReadable(knownSize);
  const formattedTimestamp = formatTimeHHMM(timestamp);

  return (
    <div
      className={`group/wave rounded-2xl px-3.5 py-2.5 border transition-colors select-none shadow-2xs
        bg-[#eef6fd] border-[#c8e0f7] text-slate-800
        dark:bg-[#1e2c3a] dark:border-[#2c4054] dark:text-slate-100 ${className}`}
    >
      <audio
        ref={audioRef}
        src={resolvedSrc}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && Number.isFinite(d) && d > 0) {
            setDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          if (!isDragging) {
            setCurrentTime(e.currentTarget.currentTime || 0);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => setLoadError(true)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pauza' : 'Ijro etish'}
          className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm
            bg-[#3390ec] hover:bg-[#2782dc] dark:bg-[#4ea4f6] dark:hover:bg-[#3b93e6] text-white"
        >
          {isPlaying ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
              <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
            </svg>
          ) : (
            <svg className="w-4 h-4 translate-x-[1.5px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.5 4.6c0-1.05 1.15-1.7 2.04-1.14l11.2 7.15c.82.52.82 1.72 0 2.24l-11.2 7.15c-.89.56-2.04-.09-2.04-1.14V4.6Z" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div
            ref={waveformRef}
            role="slider"
            aria-label="Audio progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(effectiveDuration)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            onPointerDown={(e) => {
              setIsDragging(true);
              seekAtClientX(e.clientX);
              e.currentTarget.setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (isDragging) seekAtClientX(e.clientX);
            }}
            onPointerUp={(e) => {
              if (isDragging) {
                seekAtClientX(e.clientX);
                setIsDragging(false);
                e.currentTarget.releasePointerCapture?.(e.pointerId);
              }
            }}
            className="h-7 flex items-center gap-[2px] cursor-pointer touch-none"
            title={fileName || 'Audio'}
          >
            {bars.map((amp, idx) => {
              const barRatio = (idx + 0.5) / bars.length;
              const isPlayed = progress > 0 && barRatio <= progress;
              const pxHeight = Math.round(3 + amp * 23);
              return (
                <span
                  key={idx}
                  style={{ height: `${pxHeight}px` }}
                  className={`flex-1 min-w-[2px] max-w-[3.5px] rounded-full transition-colors duration-100 ${
                    isPlayed
                      ? 'bg-[#217ad1] dark:bg-[#60b6ff]'
                      : 'bg-[#9ac4eb] dark:bg-[#496179]'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1 text-[11px] font-medium leading-none">
            <span className="text-slate-600 dark:text-[#7f97ae] truncate">
              {displayedTime}
              {formattedSize ? `, ${formattedSize}` : ''}
              {fileName ? ` · ${fileName}` : ''}
            </span>
            {loadError && (
              <span className="text-[10px] font-bold text-rose-500 shrink-0">Yuklanmadi</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end justify-between self-stretch shrink-0 pl-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={cycleSpeed}
              title="Ijro tezligi"
              className="px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-tight transition-colors cursor-pointer
                bg-[#d7eafa] hover:bg-[#c5e0f7] text-[#2274c9]
                dark:bg-[#2a3c4e] dark:hover:bg-[#354c63] dark:text-[#6ab3f3]"
            >
              {playbackRate}x
            </button>
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                title="Faylni yuklab olish"
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer
                  bg-[#d7eafa] hover:bg-[#c5e0f7] text-[#2274c9]
                  dark:bg-[#2a3c4e] dark:hover:bg-[#354c63] dark:text-[#6ab3f3]"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            )}
          </div>

          {formattedTimestamp && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-[#7f97ae] leading-none">
              {formattedTimestamp}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
