import React, { useState, useEffect } from 'react';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

export default function AdminLibrary() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states (4-talab)
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publishedDate, setPublishedDate] = useState('2024');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverError, setCoverError] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/library`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  // Obloshka rasmi yuklash (rasm hajmi 3 MB dan oshmasligi kerak - 4-talab)
  const handleCoverChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSizeBytes = 3 * 1024 * 1024; // 3 MB
    if (file.size > maxSizeBytes) {
      setCoverError(`Xatolik: Muqova rasmi hajmi 3 MB dan oshmasligi kerak! (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
      setCoverFile(null);
      setCoverPreview('');
      e.target.value = '';
      return;
    }

    setCoverError('');
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      alert("Iltimos, kitob nomi va muallifini kiriting!");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('author', author.trim());
      formData.append('publishedDate', publishedDate.trim());
      if (coverFile) formData.append('cover', coverFile);
      if (pdfFile) formData.append('pdf', pdfFile);

      const res = await fetch(`${API_BASE}/api/library`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const newBook = await res.json();
        setBooks(prev => [...prev, newBook]);
        setShowAddModal(false);
        setTitle('');
        setAuthor('');
        setCoverFile(null);
        setCoverPreview('');
        setPdfFile(null);
        alert("Kitob muvaffaqiyatli kutubxonaga qo'shildi!");
      } else {
        const data = await res.json();
        alert(data.error || "Xatolik yuz berdi");
      }
    } catch (err) {
      alert("Serverga ulanish xatoligi: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (id) => {
    if (!confirm("Haqiqatan ham bu kitobni kutubxonadan o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/library/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBooks(prev => prev.filter(b => b.id !== id));
      }
    } catch (e) {
      alert("O'chirishda xatolik: " + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#5B5FEF] text-[30px]">local_library</span>
            <h1 className="font-outfit text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Kitoblar Kutubxonasi (Library)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Talabalar uchun PDF kitoblar va qo'llanmalarni boshqarish. Qo'shilgan kitoblar talabalar panelida 3D javonda aks etadi.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4A4DE0] text-white font-bold text-xs shadow-md shadow-[#5B5FEF]/25 flex items-center gap-2 transition-all cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Yangi kitob qo'shish</span>
        </button>
      </div>

      {/* Books Table / Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {books.map((b) => (
          <div
            key={b.id}
            className="rounded-2xl p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
          >
            {/* Obloshka o'lchamlari bir xil (4-talab) */}
            <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner">
              <img
                src={b.cover}
                alt={b.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>

            <div>
              <h3 className="font-outfit font-black text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-tight">
                {b.title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {b.author} · {b.date}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <a
                href={b.pdfUrl || b.cover}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-bold text-[11px] flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">visibility</span>
                <span>Ochish</span>
              </a>
              <button
                onClick={() => handleDeleteBook(b.id)}
                className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="O'chirish"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ==================== YANGI KITOB QO'SHISH MODALI (4-talab) ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#5B5FEF] text-[24px]">post_add</span>
                <h3 className="font-outfit font-black text-lg text-slate-900 dark:text-white">
                  Libraryga Yangi Kitob Qo'shish
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddBook} className="p-6 space-y-4">
              {/* Kitob nomi */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Kitob nomi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: SAT Math Advanced Prep 2026"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:border-[#5B5FEF] focus:outline-hidden"
                />
              </div>

              {/* Kitob muallifi va sanasi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                    Muallif <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Masalan: Dr. John Chung"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:border-[#5B5FEF] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1 flex items-center justify-between">
                    <span>Nashr etilgan sanasi</span>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900/60 flex items-center gap-1">
                      <span>Kalendar</span>
                      <span>📅</span>
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-indigo-500 text-[18px] pointer-events-none">
                      calendar_month
                    </span>
                    <input
                      type="date"
                      value={publishedDate ? (publishedDate.length === 4 ? `${publishedDate}-01-01` : publishedDate) : ''}
                      onChange={(e) => setPublishedDate(e.target.value)}
                      onClick={(e) => {
                        if (e.target.showPicker) {
                          try { e.target.showPicker(); } catch (err) {}
                        }
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:border-[#5B5FEF] focus:outline-hidden cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Obloshka rasmi yuklash (max 3 MB, o'lchamlari bir xil - 4-talab) */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Kitobning muqova (obloshka) rasmi (maksimal 3 MB) <span className="text-rose-500">*</span>
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-800/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverChange}
                    className="hidden"
                    id="coverFileInput"
                  />
                  <label htmlFor="coverFileInput" className="cursor-pointer flex flex-col items-center">
                    {coverPreview ? (
                      <div className="w-24 h-32 rounded-lg overflow-hidden border shadow-md mb-2">
                        <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <span className="material-symbols-outlined text-3xl text-slate-400 mb-1">add_photo_alternate</span>
                    )}
                    <span className="text-xs font-bold text-[#5B5FEF] hover:underline">
                      {coverFile ? coverFile.name : "Rasm tanlang (Max 3 MB)"}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WEBP</span>
                  </label>
                  {coverError && <p className="text-xs font-bold text-rose-500 mt-1.5">{coverError}</p>}
                </div>
              </div>

              {/* PDF fayli */}
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                  Kitobning PDF fayli (.pdf formatda)
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setPdfFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-2.5 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#EEF0FF] file:text-[#5B5FEF] hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              {/* Modal footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !!coverError}
                  className="px-6 py-2.5 rounded-xl bg-[#5B5FEF] hover:bg-[#4A4DE0] text-white font-bold text-xs shadow-md shadow-[#5B5FEF]/25 disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting ? "Yuklanmoqda..." : "Add (Kitobni qo'shish)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}