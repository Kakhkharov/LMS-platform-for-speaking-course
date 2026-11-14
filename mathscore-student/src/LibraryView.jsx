import React, { useState, useEffect } from 'react';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

export default function LibraryView({ darkMode, onPremiumRequired = null }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [premiumBlocked, setPremiumBlocked] = useState(false);

  const fetchBooks = async () => {
    try {
      const token = localStorage.getItem('student_token');
      const res = await fetch(`${API_BASE}/api/library`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData?.code === 'PREMIUM_REQUIRED') {
          setPremiumBlocked(true);
          onPremiumRequired?.('Library');
          return;
        }
      }
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        setPremiumBlocked(false);
      }
    } catch (e) {
      console.error("Library fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    const interval = setInterval(fetchBooks, 10000);
    return () => clearInterval(interval);
  }, []);

  if (premiumBlocked) {
    return (
      <div className="bg-surface rounded-3xl p-10 border border-outline-variant text-center space-y-3 shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-3xl">lock</span>
        </div>
        <h3 className="font-outfit text-lg font-black text-on-surface">Bu bo'lim faqat Premium (VIP) talabalar uchun</h3>
        <p className="text-xs text-outline max-w-md mx-auto">
          Bu bo'limdan foydalanish uchun Premium kursga qo'shilishingiz kerak. Sizni kutamiz va siz maqsad qilgan natijaga olib chiqamiz!
        </p>
        <a
          href="https://t.me/azizbekbro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-black shadow-sm hover:opacity-95"
        >
          Premium kursga qo'shilish (@azizbekbro)
        </a>
      </div>
    );
  }

  const filteredBooks = books.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (b.title || '').toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q);
  });

  // 2-rasmga mos ravishda kitoblarni 2 ta yoki undan ortiq javonlarga 5 tadan bo'lib joylashtiramiz
  const shelfRows = [];
  const itemsPerShelf = 5;
  for (let i = 0; i < filteredBooks.length; i += itemsPerShelf) {
    shelfRows.push(filteredBooks.slice(i, i + itemsPerShelf));
  }
  if (shelfRows.length === 0 && !loading) {
    shelfRows.push([]);
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <svg className="w-8 h-8 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              <path d="M8 7h8M8 11h6" />
            </svg>
            <h1
              className="text-3xl sm:text-4xl font-serif italic font-bold text-on-surface tracking-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" }}
            >
              My Library
            </h1>
          </div>
          <p className="text-xs text-outline mt-1 font-medium">
            O'quv qo'llanmalari, badiiy va ilmiy kitoblar javoni. O'qish uchun kitob ustiga bosing.
          </p>
        </div>

        {/* Qidiruv */}
        <div className="relative w-full sm:w-72">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kitob yoki muallifni qidirish..."
            className="w-full pl-9 pr-3 py-2 bg-surface border border-outline-variant rounded-xl text-xs font-medium text-on-surface focus:border-primary focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* 3D YOG'OCH JAVONLAR UI DIZAYNI */}
      <div className="library-shelf-surface relative rounded-3xl overflow-hidden p-6 sm:p-10 border border-slate-200 dark:border-slate-800 bg-[#E6E8EA] dark:bg-[#131926] shadow-inner">
        {/* Orqa fon devor teksturasi */}
        <div className="absolute inset-0 opacity-40 dark:opacity-25 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.75),transparent_75%)] dark:bg-[radial-gradient(circle_at_50%_20%,rgba(148,163,184,0.18),transparent_75%)] pointer-events-none" />

        {/* Javon sarlavhasi: chiroyli shriftda My Library */}
        <div className="text-center mb-10 relative z-10">
          <h2
            className="font-serif italic text-4xl sm:text-5xl text-slate-700 dark:text-amber-100/95 font-semibold tracking-wide drop-shadow-xs dark:drop-shadow-[0_0_24px_rgba(251,191,36,0.28)]"
            style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" }}
          >
            My Library
          </h2>
          <div className="w-20 h-0.5 mx-auto mt-2.5 rounded-full bg-gradient-to-r from-transparent via-slate-400/70 dark:via-amber-300/60 to-transparent" />
        </div>

        {/* Javonlar konteyneri */}
        <div className="space-y-16 sm:space-y-20 relative z-10 max-w-5xl mx-auto">
          {shelfRows.map((shelf, shelfIdx) => (
            <div key={shelfIdx} className="relative pt-6">
              {/* Kitoblar qatori (Javon ustida turgan 3D kitoblar) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 items-end justify-items-center px-4 sm:px-8 mb-[-4px] relative z-20">
                {shelf.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className="group relative cursor-pointer flex flex-col items-center transition-all duration-300 hover:-translate-y-2.5"
                    style={{ perspective: '800px' }}
                  >
                    {/* Dark mode rejimida kitob ustiga olib borganda orqa fonda yonadigan yumshoq chiroq nuri */}
                    <div
                      aria-hidden="true"
                      className="hidden dark:block pointer-events-none absolute -inset-6 -top-5 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-110 z-0"
                      style={{
                        background: 'radial-gradient(circle at 50% 48%, rgba(253, 224, 130, 0.58) 0%, rgba(251, 191, 36, 0.28) 42%, rgba(245, 158, 11, 0) 76%)',
                        filter: 'blur(16px)'
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="hidden dark:block pointer-events-none absolute -inset-1.5 rounded-lg opacity-0 group-hover:opacity-95 transition-opacity duration-300 z-0 bg-amber-300/25 blur-md"
                    />

                    {/* Qizil xatcho'p (Red Bookmark Ribbon) */}
                    <div className="absolute -top-3 right-3 sm:right-4 z-30 w-4 sm:w-5 h-8 sm:h-9 bg-rose-600 text-white flex flex-col items-center justify-start pt-0.5 shadow-md group-hover:scale-105 transition-transform">
                      <span className="text-[9px] font-black leading-none">★</span>
                      <div className="absolute bottom-0 left-0 right-0 border-solid border-b-[6px] border-b-transparent border-l-[8px] border-l-rose-600 border-r-[8px] border-r-rose-600" />
                    </div>

                    {/* 3D Kitob muqovasi (Obloshka) */}
                    <div className="relative z-10 w-28 sm:w-32 h-40 sm:h-44 rounded-sm overflow-hidden bg-slate-800 shadow-[5px_8px_16px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:shadow-[8px_16px_24px_rgba(0,0,0,0.45)] dark:group-hover:shadow-[0_0_32px_rgba(251,191,36,0.48),0_14px_28px_rgba(0,0,0,0.7)] border border-slate-300/40 dark:border-slate-700 dark:group-hover:border-amber-300/60">
                      {/* Kitob umurtqasi (Spine highlight) */}
                      <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/40 via-white/20 to-transparent z-10 pointer-events-none" />

                      <img
                        src={book.cover || "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=300&auto=format&fit=crop"}
                        alt={book.title}
                        className="w-full h-full object-cover select-none"
                        loading="lazy"
                      />

                      {/* Kitob sarlavhasi ustiga tushadigan yozuv (agar rasmda matn yo'q bo'lsa) */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 pointer-events-none">
                        <h4 className="text-[11px] sm:text-xs font-bold text-white leading-tight drop-shadow-md line-clamp-2">
                          {book.title}
                        </h4>
                        <p className="text-[9px] text-slate-300 drop-shadow-xs truncate mt-0.5">
                          {book.author}
                        </p>
                      </div>
                    </div>

                    {/* Kitob tagidagi soya (Javon ustiga tushadigan soya) */}
                    <div className="relative z-10 w-24 sm:w-28 h-2 bg-black/35 dark:group-hover:bg-amber-400/35 rounded-full blur-[2px] mt-0.5 group-hover:opacity-75 transition-all" />
                  </div>
                ))}

                {/* Bo'sh joylar to'ldirgich */}
                {Array.from({ length: Math.max(0, itemsPerShelf - shelf.length) }).map((_, emptyIdx) => (
                  <div key={`empty-${emptyIdx}`} className="w-28 sm:w-32 h-40 sm:h-44 hidden md:block opacity-0 pointer-events-none" />
                ))}
              </div>

              {/* 2-RASMDAGI HAQIQIY YOG'OCH JAVON (Wooden Shelf Plank + Wall Brackets) */}
              <div className="relative w-full z-10">
                {/* Yog'och javonning ustki yuzasi */}
                <div
                  className="w-full h-5 sm:h-6 rounded-xs shadow-[0_6px_10px_rgba(0,0,0,0.35)]"
                  style={{
                    background: 'linear-gradient(180deg, #D99B52 0%, #C3833B 40%, #A66827 100%)',
                    borderTop: '2px solid rgba(255, 230, 180, 0.4)',
                    borderBottom: '2px solid rgba(80, 45, 10, 0.6)'
                  }}
                />

                {/* Javonning old qalin qirrasi (Bevel front edge) */}
                <div
                  className="w-full h-2 rounded-b-xs"
                  style={{
                    background: 'linear-gradient(180deg, #8C531B 0%, #63380D 100%)',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }}
                />

                {/* Chap va o'ng devor tutqichlari (Steel wall brackets & suspension cables - 2-rasm) */}
                <div className="absolute -top-16 left-6 w-0.5 h-18 bg-slate-400 rotate-[-18deg] origin-bottom hidden sm:block" />
                <div className="absolute -top-16 right-6 w-0.5 h-18 bg-slate-400 rotate-[18deg] origin-bottom hidden sm:block" />

                {/* Devor qavslari (Metal brackets underneath) */}
                <div className="absolute top-7 left-12 w-3.5 h-5 bg-slate-400/80 rounded-b-sm shadow-sm hidden sm:block" />
                <div className="absolute top-7 right-12 w-3.5 h-5 bg-slate-400/80 rounded-b-sm shadow-sm hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== KITOBNI O'QISH VA KO'RISH MODALI ==================== */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-surface border border-outline-variant rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 bg-surface border-b border-outline-variant flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">menu_book</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-outfit text-base sm:text-lg font-bold text-on-surface truncate">
                    {selectedBook.title}
                  </h3>
                  <p className="text-xs text-outline truncate">
                    Muallif: <span className="font-semibold text-on-surface">{selectedBook.author}</span> · Nashr: {selectedBook.date || '2024'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedBook.pdfUrl || selectedBook.cover}
                  download={`${selectedBook.title}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span className="hidden sm:inline">Yuklab olish</span>
                </a>
                <button
                  onClick={() => setSelectedBook(null)}
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-slate-400 hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Modal Content / PDF Viewer */}
            <div className="dashboard-subcard flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center min-h-[450px]">
              {selectedBook.pdfUrl && selectedBook.pdfUrl.endsWith('.pdf') ? (
                <iframe
                  src={`${selectedBook.pdfUrl}#toolbar=1`}
                  title={selectedBook.title}
                  className="w-full h-[600px] rounded-xl border border-outline-variant shadow-md bg-white"
                />
              ) : (
                <div className="text-center space-y-4 max-w-md py-10">
                  <div className="relative w-36 h-52 mx-auto rounded-xl overflow-hidden shadow-2xl border-2 border-white/20">
                    <img
                      src={selectedBook.cover}
                      alt={selectedBook.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-outfit text-xl font-black text-on-surface">
                      {selectedBook.title}
                    </h4>
                    <p className="text-xs text-outline mt-1 font-medium">
                      Muallif: {selectedBook.author} | Yil: {selectedBook.date}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Mazkur kitob to'liq elektron nusxada mavjud. Quyidagi tugma orqali kitobni yuklab olishingiz yoki to'liq ekranda o'qishingiz mumkin.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <a
                      href={selectedBook.pdfUrl || selectedBook.cover}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-2.5 rounded-full bg-primary hover:bg-primary/95 text-white font-bold text-xs shadow-md shadow-primary/25 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">menu_book</span>
                      <span>Kitobni o'qish</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}