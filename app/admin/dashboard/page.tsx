'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TURKISH_DAYS, TURKISH_MONTHS, formatDate, getActiveWeekMonday, isWeekTransitionPreview, getWeekDaysFromMonday } from '@/utils/constants';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Constants
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08–22



export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [closedSlots, setClosedSlots] = useState<any>({});
  
  const [currentWeekMonday, setCurrentWeekMonday] = useState<Date | null>(null);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const [dragApptId, setDragApptId] = useState<string | null>(null);

  const [toast, setToast] = useState({ msg: '', type: '', show: false });

  // Modals
  const [apptDetail, setApptDetail] = useState<any | null>(null);
  const [postponeApptId, setPostponeApptId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeHour, setPostponeHour] = useState('');
  
  const [banTarget, setBanTarget] = useState<{ id: string, name: string } | null>(null);
  const [banReason, setBanReason] = useState('');

  const [banError, setBanError] = useState('');
  
  const [bannedModalOpen, setBannedModalOpen] = useState(false);

  // Week transition state
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

  const loadData = useCallback(async () => {
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/admin/login');
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (!profile || profile.role !== 'admin') {
      router.push('/');
      return;
    }

    const now = new Date();
    const pastDate = new Date(now); pastDate.setDate(now.getDate() - 30);
    const futureDate = new Date(now); futureDate.setDate(now.getDate() + 60);
    const startStr = formatDate(pastDate);
    const endStr = formatDate(futureDate);

    const promises: any[] = [
      supabase.from('appointments').select('*').gte('tarih', startStr).lte('tarih', endStr),
      supabase.from('profiles').select('id, ad, soyad, email, telefon, is_banned, ban_reason'),
      supabase.from('closed_slots').select('*').gte('tarih', startStr).lte('tarih', endStr)
    ];

    const [apptsRes, usersRes, closedRes] = await Promise.all(promises);

    setAppointments(apptsRes.data || []);
    setUsers(usersRes.data || []);
    setBannedUsers((usersRes.data || []).filter((u: any) => u.is_banned));

    const cObj: any = {};
    (closedRes.data || []).forEach((c: any) => {
      if (c.saat === null) cObj[c.tarih] = 'ALL';
      else {
        if (!cObj[c.tarih]) cObj[c.tarih] = [];
        cObj[c.tarih].push(c.saat);
      }
    });
    setClosedSlots(cObj);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
    setCurrentWeekMonday(getActiveWeekMonday());
    setIsPreviewMode(isWeekTransitionPreview());

    let reloadTimeout: NodeJS.Timeout;

    // Preview mode status checker (her 30 saniye kontrol et)
    const previewInterval = setInterval(() => {
      setIsPreviewMode(isWeekTransitionPreview());
    }, 30000);

    // Supabase Realtime (Eşzamanlı Güncelleme)
    const channel = supabase.channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAppointments(prev => {
            if (prev.find(a => a.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setAppointments(prev => prev.filter(a => a.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setAppointments(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'closed_slots' }, () => {
        clearTimeout(reloadTimeout);
        reloadTimeout = setTimeout(() => loadData(), 500);
      })
      .subscribe();

    return () => {
      clearInterval(previewInterval);
      clearTimeout(reloadTimeout);
      supabase.removeChannel(channel);
    };
  }, [loadData, supabase]);

  // Optimization: O(1) Lookup Maps (must be before early return to respect hooks order)
  const appointmentsMap = useMemo(() => {
    const map: any = {};
    appointments.forEach(a => { map[`${a.tarih}_${a.saat}`] = a; });
    return map;
  }, [appointments]);

  const usersMap = useMemo(() => {
    const map: any = {};
    users.forEach(u => { map[u.id] = u; });
    return map;
  }, [users]);

  if (!currentWeekMonday) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // Nav
  const prevWeek = () => {
    const m = new Date(currentWeekMonday);
    m.setDate(m.getDate() - 7);
    setCurrentWeekMonday(m);
  };

  const nextWeek = () => {
    const activeMonday = getActiveWeekMonday();
    const m = new Date(currentWeekMonday);
    m.setDate(m.getDate() + 7);
    if (m > activeMonday) return;
    setCurrentWeekMonday(m);
  };

  const isPastWeek = () => {
    const active = getActiveWeekMonday();
    return currentWeekMonday!.getTime() < active.getTime();
  };
  const readOnly = isPastWeek();

  // Slot checks
  const isDayClosed = (dateStr: string) => closedSlots[dateStr] === 'ALL';
  const isSlotClosedStr = (dateStr: string, hour: number) => {
    if (!closedSlots[dateStr]) return false;
    if (closedSlots[dateStr] === 'ALL') return true;
    return Array.isArray(closedSlots[dateStr]) && closedSlots[dateStr].includes(hour);
  };

  // Actions
  const toggleDayClosed = async (dateStr: string) => {
    if (readOnly) return;
    if (closedSlots[dateStr] === 'ALL') {
      const { error } = await supabase.rpc('admin_open_day', { target_tarih: dateStr });
      if (error) { showToast('Hata: ' + error.message, 'error'); return; }
      showToast('Gün açıldı.', 'success');
    } else {
      await supabase.rpc('admin_open_day', { target_tarih: dateStr });
      const { error } = await supabase.rpc('admin_close_slot', { target_tarih: dateStr, target_saat: null });
      if (error) { showToast('Hata: ' + error.message, 'error'); return; }
      showToast('Gün kapatıldı.', 'success');
    }
    await loadData();
  };

  const toggleSlotClosedAction = async (dateStr: string, hour: number) => {
    if (readOnly || isDayClosed(dateStr)) return;
    const isClosed = isSlotClosedStr(dateStr, hour);
    if (isClosed) {
      const { error } = await supabase.rpc('admin_open_slot', { target_tarih: dateStr, target_saat: hour });
      if (error) { showToast('Hata: ' + error.message, 'error'); return; }
      showToast('Slot açıldı.', 'success');
    } else {
      const { error } = await supabase.rpc('admin_close_slot', { target_tarih: dateStr, target_saat: hour });
      if (error) { showToast('Hata: ' + error.message, 'error'); return; }
      showToast('Slot kapatıldı.', 'success');
    }
    await loadData();
  };

  // Drag and Drop
  const handleDrop = async (dateStr: string, hour: number) => {
    if (!dragApptId || readOnly) return;
    if (appointments.some(a => a.tarih === dateStr && a.saat === hour && a.id !== dragApptId)) {
      showToast('Bu slot zaten dolu!', 'error'); return;
    }
    if (isDayClosed(dateStr) || isSlotClosedStr(dateStr, hour)) {
      showToast('Bu slot kapalı!', 'error'); return;
    }

    if (!window.confirm('Randevuyu bu saate ötelemek istediğinizden emin misiniz?')) {
      return;
    }

    const { error } = await supabase.rpc('admin_postpone_appointment', { 
      target_appt_id: dragApptId, 
      new_tarih: dateStr, 
      new_saat: hour 
    });
    if (error) {
      if (error.code === '23505') showToast('Bu slot zaten dolu!', 'error');
      else showToast('Hata: ' + error.message, 'error');
      return;
    }
    await loadData();
    showToast('Randevu başarıyla ötelendi. ✓', 'success');
  };

  // Appointments
  const cancelAppt = async (id: string) => {
    if (!confirm('Bu randevuyu iptal etmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.rpc('admin_delete_appointment', { target_appt_id: id });
    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    await loadData();
    setApptDetail(null);
    showToast('Randevu iptal edildi.', 'success');
  };

  const confirmPostpone = async () => {
    if (!postponeDate || !postponeHour || !postponeApptId) { showToast('Eksik seçim!', 'error'); return; }
    const h = parseInt(postponeHour);
    if (appointments.some(a => a.tarih === postponeDate && a.saat === h && a.id !== postponeApptId)) {
      showToast('Seçilen slot zaten dolu!', 'error'); return;
    }
    if (isDayClosed(postponeDate) || isSlotClosedStr(postponeDate, h)) {
      showToast('Seçilen slot kapalı!', 'error'); return;
    }

    const { error } = await supabase.rpc('admin_postpone_appointment', { 
      target_appt_id: postponeApptId, 
      new_tarih: postponeDate, 
      new_saat: h 
    });
    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    await loadData();
    setPostponeApptId(null);
    showToast('Randevu başarıyla ötelendi.', 'success');
  };

  const confirmBan = async () => {
    if (!banTarget) return;
    setBanError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.rpc('admin_ban_user', {
      target_user_id: banTarget.id,
      ban_reason_text: banReason || 'Belirtilmedi'
    });

    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    await loadData();
    setBanTarget(null);
    setBanReason('');
    setApptDetail(null);
    showToast(`${banTarget.name} yasaklandı.`, 'success');
  };

  const unbanUser = async (userId: string) => {
    const { error } = await supabase.rpc('admin_unban_user', { target_user_id: userId });
    if (error) { showToast('Hata: ' + error.message, 'error'); return; }
    await loadData();
    showToast('Yasak başarıyla kaldırıldı.', 'success');
  };

  // Rendering logic
  const days = getWeekDaysFromMonday(currentWeekMonday);
  const startD = days[0];
  const endD = days[6];
  const weekLabel = `${startD.getDate()} ${TURKISH_MONTHS[startD.getMonth()]} — ${endD.getDate()} ${TURKISH_MONTHS[endD.getMonth()]} ${endD.getFullYear()}`;


  // Postpone options
  const getPostponeDateOptions = () => {
    const opts: { val: string; label: string }[] = [];
    const t = new Date();
    t.setHours(0,0,0,0);
    
    // Randevu alınabilen hafta: Aktif haftanın pazartesisi
    const activeMonday = getActiveWeekMonday();
    const days = getWeekDaysFromMonday(activeMonday);
    
    days.forEach(d => {
      // Geçmiş günlere öteleme yapılamaz (Bugün dahil ileri tarihler eklenebilir)
      if (d >= t) {
        opts.push({ 
          val: formatDate(d), 
          label: `${TURKISH_DAYS[d.getDay()]} ${d.getDate()} ${TURKISH_MONTHS[d.getMonth()]} ${d.getFullYear()}` 
        });
      }
    });
    
    return opts;
  };

  const getPostponeHourOptions = () => {
    if (!postponeDate) return [];
    return HOURS.map(h => {
      const existingAppt = appointmentsMap[`${postponeDate}_${h}`];
      const isBooked = existingAppt && existingAppt.id !== postponeApptId;
      const isClosed = isDayClosed(postponeDate) || isSlotClosedStr(postponeDate, h);
      let label = `${String(h).padStart(2, '0')}:00 – ${String(h + 1).padStart(2, '0')}:00`;
      if (isBooked) label += ' (Dolu)';
      if (isClosed) label += ' (Kapalı)';
      return { val: h, label, disabled: isBooked || isClosed };
    });
  };

  return (
    <div className="admin-layout" onClick={(e) => { if ((e.target as HTMLElement).closest('.week-label-wrapper') === null) setWeekPickerOpen(false); }}>
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-logo">
            <Image src="/gm-logo.png" alt="GSB Logo" width={80} height={80} />
            <div className="admin-logo-text">
              <span className="admin-logo-main">Yönetim Paneli</span>
              <span className="admin-logo-sub">Manavgat Gençlik Merkezi</span>
            </div>
          </div>
          <nav className="admin-nav">
            <button className="admin-nav-btn" onClick={() => setBannedModalOpen(true)}>🚫 Yasaklı Kullanıcılar</button>
            <button className="admin-nav-btn danger" onClick={handleLogout}>🚪 Çıkış Yap</button>
          </nav>
        </div>
      </header>

      <div className="admin-toolbar">
        {isPreviewMode && (
          <div style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#93C5FD', borderBottom: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📢 Yeni hafta önizlemesi aktif — Kullanıcılar saat 10:00'da randevu alabilecek. Şu anda yalnızca siz düzenleme yapabilirsiniz.
          </div>
        )}
        <div className="admin-week-nav">
          <button className="admin-week-btn" onClick={prevWeek} title="Önceki Hafta">‹</button>
          <div className="week-label-wrapper">
            <button className="admin-week-label-btn" onClick={() => setWeekPickerOpen(!weekPickerOpen)}>
              {weekLabel} <span className="wp-arrow">▾</span>
            </button>
            {weekPickerOpen && (
              <div className="week-picker-dropdown" style={{ display: 'block' }}>
                {Array.from({ length: 13 }, (_, i) => {
                  const offsetWeeks = i - 12; // -12 to 0
                  const m = new Date(getActiveWeekMonday());
                  m.setDate(m.getDate() + offsetWeeks * 7);
                  const sd = getWeekDaysFromMonday(m)[0];
                  const ed = getWeekDaysFromMonday(m)[6];
                  const isCurrent = formatDate(m) === formatDate(currentWeekMonday);
                  return (
                    <div 
                      key={i} 
                      className={`wp-item ${isCurrent ? 'wp-active' : ''}`}
                      onClick={() => { setCurrentWeekMonday(m); setWeekPickerOpen(false); }}
                    >
                      <span>{sd.getDate()} {TURKISH_MONTHS[sd.getMonth()]} — {ed.getDate()} {TURKISH_MONTHS[ed.getMonth()]} {ed.getFullYear()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {(() => {
            const maxMonday = getActiveWeekMonday();
            const isMax = currentWeekMonday ? formatDate(currentWeekMonday) === formatDate(maxMonday) : false;
            return (
              <button className="admin-week-btn" onClick={nextWeek} title="Sonraki Hafta" disabled={isMax} style={{ opacity: isMax ? 0.3 : 1 }}>›</button>
            );
          })()}
        </div>
        <div className="admin-legend">
          <div className="admin-legend-item"><div className="legend-dot booked"></div> Dolu</div>
          <div className="admin-legend-item"><div className="legend-dot empty"></div> Boş (tıkla: kapat)</div>
          <div className="admin-legend-item"><div className="legend-dot closed"></div> Kapalı (tıkla: aç)</div>
        </div>
      </div>

      <div className="admin-grid-wrapper">
        <div className="admin-grid">
          {readOnly && (
            <div style={{ padding: '9px 20px', fontSize: '12px', fontWeight: 600, background: 'rgba(71,85,105,0.2)', color: 'var(--gray-400)', borderBottom: '1px solid var(--border)' }}>
              📖 Geçmiş hafta — Salt-okunur mod. Yalnızca randevu detayları görüntülenebilir.
            </div>
          )}
          
          <div className="ag-row ag-header-row">
            <div className="ag-day-cell ag-header-cell">Gün / Saat</div>
            {HOURS.map(h => (
              <div key={h} className="ag-slot-cell ag-header-cell">{String(h).padStart(2, '0')}:00</div>
            ))}
          </div>

          {days.map((day, idx) => {
            const dateStr = formatDate(day);
            const dayClosed = isDayClosed(dateStr);

            return (
              <div key={idx} className={`ag-row ${dayClosed ? 'ag-row-closed' : ''}`}>
                <div className="ag-day-cell">
                  <div className="ag-day-name">{TURKISH_DAYS[day.getDay()]}</div>
                  <div className="ag-day-date">{day.getDate()} {TURKISH_MONTHS[day.getMonth()]}</div>
                  {!readOnly && (
                    <button className={`ag-day-toggle ${dayClosed ? 'ag-btn-open' : 'ag-btn-close'}`} onClick={() => toggleDayClosed(dateStr)}>
                      {dayClosed ? '🔓 Aç' : '🔒 Kapat'}
                    </button>
                  )}
                </div>

                {HOURS.map(hour => {
                  const appt = appointmentsMap[`${dateStr}_${hour}`];
                  const slotClosed = !dayClosed && isSlotClosedStr(dateStr, hour);
                  
                  if (dayClosed) {
                    return <div key={hour} className="ag-slot-cell"><div className="ag-slot dag-closed" title="Gün kapalı">—</div></div>;
                  }

                  if (appt) {
                    const u = usersMap[appt.user_id];
                    return (
                      <div key={hour} className="ag-slot-cell">
                        <div 
                          className="ag-slot ag-slot-booked"
                          draggable={!readOnly}
                          onDragStart={() => setDragApptId(appt.id)}
                          onDragEnd={() => setDragApptId(null)}
                          onClick={() => setApptDetail(appt)}
                        >
                          {appt.kategori === 'basketbol' ? '🏀' : '🏐'}<br/><small>{u ? u.ad : '?'}</small>
                        </div>
                      </div>
                    );
                  }

                  if (slotClosed) {
                    return (
                      <div key={hour} className="ag-slot-cell">
                        <div className="ag-slot ag-slot-closed" onClick={() => toggleSlotClosedAction(dateStr, hour)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>🔒</div>
                      </div>
                    );
                  }

                  return (
                    <div key={hour} className="ag-slot-cell">
                      <div 
                        className="ag-slot ag-slot-empty"
                        onClick={() => toggleSlotClosedAction(dateStr, hour)}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={() => handleDrop(dateStr, hour)}
                        style={{ cursor: readOnly ? 'default' : 'pointer' }}
                      ></div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Appt Detail Modal --- */}
      {apptDetail && (() => {
        const u = usersMap[apptDetail.user_id];
        const isBanned = bannedUsers.some(b => b.id === apptDetail.user_id);
        const isPast = new Date(`${apptDetail.tarih}T${String(apptDetail.saat).padStart(2, '0')}:00:00`) < new Date();
        const [y, m, d] = apptDetail.tarih.split('-');

        return (
          <div className="admin-overlay">
            <div className="admin-modal wide">
              <button className="admin-modal-close" onClick={() => setApptDetail(null)}>✕</button>
              <h2 className="admin-modal-title">📋 Randevu Detayı</h2>
              <div className="appt-info-grid">
                <div className="appt-info-section">
                  <div className="appt-info-title">📅 Randevu</div>
                  <div className="appt-info-row"><span>Tarih:</span> <strong>{d} {TURKISH_MONTHS[parseInt(m) - 1]} {y}</strong></div>
                  <div className="appt-info-row"><span>Saat:</span>  <strong>{String(apptDetail.saat).padStart(2, '0')}:00 – {String(apptDetail.saat + 1).padStart(2, '0')}:00</strong></div>
                  <div className="appt-info-row"><span>Spor:</span>  <strong>{apptDetail.kategori === 'basketbol' ? '🏀 Basketbol' : '🏐 Voleybol'}</strong></div>
                  <div className="appt-info-row"><span>Durum:</span>
                    <span className={`appt-status-badge ${isPast ? 'past' : 'upcoming'}`}>{isPast ? 'Geçmiş' : 'Yakında'}</span>
                  </div>
                </div>
                <div className="appt-info-section">
                  <div className="appt-info-title">👤 Rezervasyon Sahibi</div>
                  {u ? (
                    <>
                      <div className="appt-info-row"><span>Ad Soyad:</span> <strong>{u.ad} {u.soyad}</strong></div>
                      <div className="appt-info-row"><span>Telefon:</span>  <strong>{u.telefon || '—'}</strong></div>
                      <div className="appt-info-row"><span>E-posta:</span>  <strong>{u.email}</strong></div>
                    </>
                  ) : <div className="appt-info-row" style={{ color: 'var(--gray-600)' }}>Kullanıcı bulunamadı.</div>}
                </div>
              </div>

              {((u) || (apptDetail.oyuncular && apptDetail.oyuncular.length > 0)) && (
                <div className="appt-info-section" style={{ marginBottom: '20px' }}>
                  <div className="appt-info-title">👥 Takım Üyeleri</div>
                  <div className="appt-players">
                    {u && <div className="appt-player"><span className="player-num">1</span> {u.ad} {u.soyad} <em>(Kaptan)</em></div>}
                    {apptDetail.oyuncular?.map((o: any, i: number) => {
                      if (!o.ad && !o.soyad) return null;
                      return <div key={i} className="appt-player"><span className="player-num">{i + 2}</span> {o.ad} {o.soyad}</div>;
                    })}
                  </div>
                </div>
              )}

              <div className="appt-action-row">
                {(!isPast && !readOnly) ? (
                  <>
                    <button className="admin-btn admin-btn-outline" onClick={() => { setPostponeApptId(apptDetail.id); setApptDetail(null); }}>⏩ Öteleme</button>
                    <button className="admin-btn admin-btn-danger" onClick={() => cancelAppt(apptDetail.id)}>🗑 İptal Et</button>
                  </>
                ) : <span style={{ color: 'var(--gray-500)', fontSize: '12px', alignSelf: 'center' }}>📖 Geçmiş randevu — düzenleme devre dışı</span>}
                <span style={{ flex: 1 }}></span>
                {u && !isBanned ? (
                  <button className="admin-btn admin-btn-danger" onClick={() => { setBanTarget({ id: u.id, name: `${u.ad} ${u.soyad}` }); setApptDetail(null); }}>🚫 Yasakla</button>
                ) : (isBanned ? <span style={{ color: '#FF8080', fontSize: '12px', alignSelf: 'center' }}>⚠️ Yasaklı kullanıcı</span> : null)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- Postpone Modal --- */}
      {postponeApptId && (
        <div className="admin-overlay">
          <div className="admin-modal" style={{ maxWidth: '460px' }}>
            <button className="admin-modal-close" onClick={() => setPostponeApptId(null)}>✕</button>
            <h2 className="admin-modal-title">⏩ Randevu Öteleme</h2>
            <p className="admin-modal-subtitle">Randevuyu taşımak istediğiniz yeni tarih ve saati seçin.</p>
            <div className="admin-form-group">
              <label className="admin-form-label">Yeni Tarih</label>
              <select className="admin-form-input" value={postponeDate} onChange={e => { setPostponeDate(e.target.value); setPostponeHour(''); }}>
                <option value="">— Tarih Seçin —</option>
                {getPostponeDateOptions().map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Yeni Saat</label>
              <select className="admin-form-input" value={postponeHour} onChange={e => setPostponeHour(e.target.value)}>
                <option value="">{postponeDate ? '— Saat Seçin —' : '— Önce Tarih Seçin —'}</option>
                {getPostponeHourOptions().map(o => <option key={o.val} value={o.val} disabled={o.disabled}>{o.label}</option>)}
              </select>
            </div>
            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-outline" onClick={() => setPostponeApptId(null)}>İptal</button>
              <button className="admin-btn admin-btn-primary" style={{ width: 'auto', padding: '10px 28px' }} onClick={confirmPostpone}>✅ Ötelemeyi Onayla</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Ban Modal --- */}
      {banTarget && (
        <div className="admin-overlay">
          <div className="admin-modal" style={{ maxWidth: '440px' }}>
            <button className="admin-modal-close" onClick={() => { setBanTarget(null); setBanReason(''); }}>✕</button>
            <h2 className="admin-modal-title">🚫 Kullanıcıyı Yasakla</h2>
            <p className="admin-modal-subtitle">
              <strong style={{ color: '#FCA5A5' }}>{banTarget.name}</strong> kullanıcısı yasaklanacak.
              Bu kullanıcı artık randevu alamayacak.
            </p>
            {banError && <div className="admin-alert admin-alert-error">{banError}</div>}
            <div className="admin-form-group">
              <label className="admin-form-label">Yasaklama Sebebi (isteğe bağlı)</label>
              <input type="text" className="admin-form-input" placeholder="Sebep giriniz..." value={banReason} onChange={e => setBanReason(e.target.value)} />
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-outline" onClick={() => { setBanTarget(null); setBanReason(''); }}>İptal</button>
              <button className="admin-btn admin-btn-danger" style={{ width: 'auto', padding: '10px 24px' }} onClick={confirmBan}>🚫 Yasakla</button>
            </div>
          </div>
        </div>
      )}

      {/* --- Banned Users List --- */}
      {bannedModalOpen && (
        <div className="admin-overlay">
          <div className="admin-modal wide">
            <button className="admin-modal-close" onClick={() => setBannedModalOpen(false)}>✕</button>
            <h2 className="admin-modal-title">🚫 Yasaklı Kullanıcılar</h2>
            <p className="admin-modal-subtitle">Sisteme erişimi kısıtlanan kullanıcıların listesi.</p>
            <div>
              {bannedUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-600)' }}>Yasaklı kullanıcı bulunmamaktadır.</div>
              ) : (
                bannedUsers.map(b => (
                  <div key={b.id} className="banned-row">
                    <div className="banned-row-header">
                      <div className="banned-name">{b.ad} {b.soyad}</div>
                      <button className="admin-btn admin-btn-green admin-btn-sm" onClick={() => unbanUser(b.id)}>✅ Yasağı Kaldır</button>
                    </div>
                    <div className="banned-email">{b.email}</div>
                    <div className="banned-meta">Sebep: {b.ban_reason || 'Belirtilmedi'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Toast --- */}
      <div className={`admin-toast admin-toast-${toast.type} ${toast.show ? 'show' : ''}`}>
        {toast.msg}
      </div>
    </div>
  );
}
