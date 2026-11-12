import React, { useState } from 'react';

const SESAME_URL = 'https://app.sesame.com/';

export default function SpeakingPartnerView({ onClose }) {
  const [premiumNotice, setPremiumNotice] = useState(false);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-6 px-2 sm:px-4 animate-fade-in font-sans">
      <div
        data-testid="speaking-plus-modal"
        className="speaking-plus-modal w-full max-w-[660px] rounded-3xl border-2 p-6 sm:p-9 shadow-xl transition-colors"
      >
        {/* Top Retro Studio Microphone + Heading */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto flex items-center justify-center select-none" aria-hidden="true">
            <svg className="w-11 h-11 drop-shadow-sm" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="micHead" x1="20" y1="8" x2="44" y2="38" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#F8FAFC" />
                  <stop offset="48%" stopColor="#CBD5E1" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <linearGradient id="micStand" x1="20" y1="36" x2="44" y2="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#94A3B8" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
              </defs>
              <rect x="21" y="7" width="22" height="29" rx="11" fill="url(#micHead)" stroke="#475569" strokeWidth="1.8" />
              <path d="M23 15h18M22 20h20M22 25h20M24 30h16" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              <path d="M16 25c0 8.837 7.163 16 16 16s16-7.163 16-16" stroke="url(#micStand)" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="32" y1="41" x2="32" y2="51" stroke="url(#micStand)" strokeWidth="3.2" strokeLinecap="round" />
              <ellipse cx="32" cy="54" rx="12" ry="3.5" fill="url(#micStand)" stroke="#334155" strokeWidth="1.4" />
            </svg>
          </div>

          <h1 className="speaking-plus-title font-outfit text-2xl sm:text-[28px] font-black tracking-tight leading-tight">
            Speaking Plus — choose your partner
          </h1>
          <p className="speaking-plus-subtitle text-xs sm:text-sm font-medium">
            Free-conversation practice with an AI voice partner.
          </p>
        </div>

        {/* Two Partner Cards: Mock Stream (Premium) & Sesame (Free -> app.sesame.com) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mt-7">
          {/* 1. Mock Stream (Premium / Disabled by centre) */}
          <button
            type="button"
            data-testid="speaking-card-mock-stream"
            aria-disabled="true"
            onClick={() => setPremiumNotice(true)}
            className="speaking-card-premium rounded-2xl p-6 border flex flex-col items-center justify-between text-center gap-4 cursor-not-allowed transition-all"
          >
            <div className="space-y-3 flex flex-col items-center">
              {/* Soft Pearl / Sphere Orb */}
              <div
                className="speaking-orb w-8 h-8 rounded-full shadow-inner"
                aria-hidden="true"
              />
              <div>
                <h2 className="speaking-card-heading font-outfit font-extrabold text-lg leading-snug">
                  Mock Stream
                </h2>
                <p className="speaking-card-desc text-xs font-medium mt-1 leading-relaxed">
                  Our own live voice chat (Maya)
                </p>
              </div>
              <span className="speaking-premium-badge inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase">
                PREMIUM
              </span>
            </div>

            <span className="speaking-disabled-pill w-full py-2.5 px-3 rounded-xl text-xs font-bold leading-tight">
              Disabled by your centre
            </span>
          </button>

          {/* 2. Sesame (Free -> opens https://app.sesame.com/ in a new tab) */}
          <a
            href={SESAME_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="speaking-card-sesame"
            className="speaking-card-sesame group rounded-2xl p-6 border flex flex-col items-center justify-center text-center gap-3.5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg no-underline"
          >
            {/* Green Branch / Leaves Icon */}
            <div className="w-8 h-8 flex items-center justify-center group-hover:scale-110 transition-transform" aria-hidden="true">
              <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none">
                <path className="speaking-leaf-stem" d="M9 28C14 21 20 14 27 8" stroke="#2D5A1C" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M16 18C11.5 17 9 13 10.5 9.5C14 9 17.5 12 16 18Z" fill="#52B75B" stroke="#2D5A1C" strokeWidth="1.1" />
                <path d="M21 13.5C21.5 9 25 6.5 28.5 7.5C29 11 26 14.5 21 13.5Z" fill="#74CF7B" stroke="#2D5A1C" strokeWidth="1.1" />
                <path d="M18.5 20.5C22.5 19.5 26 21.5 26.5 25C23 26.5 19 24.5 18.5 20.5Z" fill="#63C26B" stroke="#2D5A1C" strokeWidth="1.1" />
                <path d="M12.5 23.5C8.5 22.5 6.5 25 7.5 28C10.5 28.5 13 26.5 12.5 23.5Z" fill="#4CA954" stroke="#2D5A1C" strokeWidth="1.1" />
              </svg>
            </div>

            <div>
              <h2 className="speaking-sesame-heading font-outfit font-extrabold text-lg leading-snug">
                Sesame
              </h2>
              <p className="speaking-sesame-desc text-xs font-medium mt-1 leading-relaxed">
                Maya · Miles (opens in a new tab)
              </p>
            </div>

            <span className="speaking-free-badge inline-flex items-center justify-center px-3.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase">
              FREE
            </span>
          </a>
        </div>

        {/* Premium notice if student clicks Mock Stream */}
        {premiumNotice && (
          <div className="speaking-premium-alert mt-4 px-4 py-2.5 rounded-xl border text-center text-xs font-semibold animate-fade-in">
            Mock Stream faqat <b>Premium</b> tarif uchun mo&apos;ljallangan (markaz tomonidan hozircha o&apos;chirilgan). Bepul mashq uchun <b>Sesame</b> kartasini tanlang!
          </div>
        )}

        {/* Cancel button */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            data-testid="speaking-plus-cancel"
            onClick={() => onClose?.()}
            className="speaking-plus-cancel px-7 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
