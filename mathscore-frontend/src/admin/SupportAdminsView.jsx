import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : ((typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        ['5173', '5174', '5175'].includes(window.location.port))
        ? 'http://localhost:5000'
        : '');

export default function SupportAdminsView({ getInitialsAvatar, onSessionExpired }) {
  const [items, setItems] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealedIds, setRevealedIds] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [showAddPass, setShowAddPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showEditPass, setShowEditPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const loadSupportAdmins = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/support-admins`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      if (res.status === 401 || res.status === 403) {
        onSessionExpired?.();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCanManage(Boolean(data.canManage));
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (err) {
      console.error('Support admins load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupportAdmins();
  }, []);

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    try {
      return new Date(iso).toLocaleString('uz-UZ', {
        timeZone: 'Asia/Tashkent',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/support-admins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Yordamchi admin qo'shishda xatolik.");
      }
      setStatusMsg({ type: 'success', text: `"${data.item.name}" yordamchi admin sifatida qo'shildi.` });
      setFormData({ name: '', email: '', phone: '', password: '' });
      setShowAddModal(false);
      await loadSupportAdmins();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!passwordTarget) return;
    setSavingPassword(true);
    setStatusMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/support-admins/${passwordTarget.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ newPassword: newPasswordInput })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Parolni o'zgartirishda xatolik.");
      }
      setStatusMsg({ type: 'success', text: `${passwordTarget.name} ning kirish paroli yangilandi.` });
      setPasswordTarget(null);
      setNewPasswordInput('');
      await loadSupportAdmins();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setStatusMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/support-admins/${revokeTarget.id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Adminlikdan chetlatishda xatolik.');
      }
      setStatusMsg({ type: 'success', text: `"${revokeTarget.name}" adminlikdan chetlatildi.` });
      setRevokeTarget(null);
      await loadSupportAdmins();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setRevoking(false);
    }
  };

  const toggleReveal = (id) => {
    setRevealedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPassword = (id, pass) => {
    if (!pass) return;
    navigator.clipboard?.writeText(pass);
    setCopiedId(id);
    setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1800);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="modern-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="material-symbols-outlined text-indigo-500 text-[28px]">admin_panel_settings</span>
            <span>Support Adminlar</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold">
              {items.length} nafar
            </span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Asosiy admin tomonidan tayinlangan yordamchi adminlar — barcha boshqaruv huquqlariga ega.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              setStatusMsg(null);
              setShowAddModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>Yordamchi Admin Qo'shish</span>
          </button>
        )}
      </div>

      {!canManage && !loading && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>Yordamchi adminlarni qo'shish, parolini o'zgartirish yoki chetlatish faqat Asosiy Admin tomonidan amalga oshiriladi.</span>
        </div>
      )}

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {statusMsg.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{statusMsg.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMsg(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="modern-card p-12 text-center text-sm font-bold text-slate-400">
          Yuklanmoqda...
        </div>
      ) : items.length === 0 ? (
        <div className="modern-card p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[32px]">supervisor_account</span>
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Hozircha yordamchi adminlar yo'q</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Platformani boshqarishda yordam beradigan mas'ul xodim uchun alohida kirish hisobi yarating.
          </p>
        </div>
      ) : (
        <div className="modern-card overflow-hidden overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="p-4 px-5 border-b border-slate-200 dark:border-slate-700 bg-white/40 dark:bg-slate-800/40 grid grid-cols-12 font-black text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 gap-3">
              <div className="col-span-3">Ism familiyasi</div>
              <div className="col-span-3">Gmail pochtasi</div>
              <div className="col-span-2">Kirish paroli</div>
              <div className="col-span-2">Telefon raqami</div>
              <div className="col-span-1">Qo'shilgan sana</div>
              <div className="col-span-1 text-right">Amallar</div>
            </div>

            <div className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
              {items.map(item => {
                const isShown = Boolean(revealedIds[item.id]);
                const passText = item.plainPassword || 'Belgilangan';
                return (
                  <div
                    key={item.id}
                    className="p-4 px-5 grid grid-cols-12 items-center gap-3 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <img
                        src={item.avatar || getInitialsAvatar(item.name)}
                        alt={item.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getInitialsAvatar(item.name);
                        }}
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.name}</p>
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 mt-0.5">
                          Yordamchi Admin
                        </span>
                      </div>
                    </div>

                    <div className="col-span-3 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate select-all">{item.email}</p>
                    </div>

                    <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg truncate">
                        {item.plainPassword ? (isShown ? passText : '••••••••') : 'Kiritilgan'}
                      </span>
                      {item.plainPassword && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleReveal(item.id)}
                            title={isShown ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {isShown ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyPassword(item.id, item.plainPassword)}
                            title="Paroldan nusxa olish"
                            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 flex items-center justify-center cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[15px]">
                              {copiedId === item.id ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="col-span-2 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                      {item.phone || '-'}
                    </div>

                    <div className="col-span-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {formatDateTime(item.createdAt)}
                    </div>

                    <div className="col-span-1 flex items-center justify-end gap-2">
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPasswordTarget(item);
                              setNewPasswordInput('');
                              setShowEditPass(false);
                            }}
                            title="Kirish parolini o'zgartirish"
                            className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[17px]">lock_reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRevokeTarget(item)}
                            title="Adminlikdan chetlatish"
                            className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[17px]">person_remove</span>
                          </button>
                        </>
                      ) : (
                        <span className="material-symbols-outlined text-[16px] text-slate-400" title="Faqat Asosiy Admin boshqaradi">
                          lock
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Support Admin Modal */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="modern-card bg-white dark:bg-slate-900 w-full max-w-md p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Yordamchi Admin Qo'shish</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Ism familiyasi</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Masalan: Jasur Karimov"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Gmail pochtasi</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@gmail.com"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Telefon raqami</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+998 90 123 45 67"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Kirish paroli</label>
                <div className="relative">
                  <input
                    type={showAddPass ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Kamida 4 ta belgi"
                    className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPass(!showAddPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showAddPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Saqlanmoqda...' : 'Qo\'shish va Saqlash'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Change Password Modal */}
      {passwordTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="modern-card bg-white dark:bg-slate-900 w-full max-w-sm p-6 space-y-5 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-500">lock_reset</span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Parolni o'zgartirish</h3>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">{passwordTarget.name}</p>
              <p className="text-slate-500">{passwordTarget.email}</p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="relative">
                <input
                  type={showEditPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Yangi kirish paroli..."
                  className="w-full p-3.5 pr-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPass(!showEditPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showEditPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordTarget(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-60"
                >
                  {savingPassword ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Revoke Support Admin Modal */}
      {revokeTarget && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="modern-card bg-white dark:bg-slate-900 w-full max-w-sm p-6 space-y-5 shadow-2xl border border-rose-200 dark:border-rose-900/60 rounded-3xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">person_remove</span>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Adminlikdan chetlatish</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bu amal darhol kuchga kiradi.</p>
              </div>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Haqiqatdan ham <strong>{revokeTarget.name}</strong> ({revokeTarget.email}) ni adminlikdan chetlatmoqchimisiz?
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoking}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-60"
              >
                {revoking ? 'Chetlatilmoqda...' : 'Chetlatish'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
