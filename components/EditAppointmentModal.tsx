import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TURKISH_DAYS, TURKISH_MONTHS, formatDate, getActiveWeekMonday, isBookingEnabled, getWeekDaysFromMonday } from '@/utils/constants';



function isEditable(tarihStr: string, saatInt: number) {
  const now = new Date();
  const apptDate = new Date(tarihStr);
  apptDate.setHours(saatInt, 0, 0, 0);
  const cutoff = new Date(apptDate.getTime() - 3 * 60 * 60 * 1000); // 3 saat
  return now < cutoff;
}

export default function EditAppointmentModal({
  isOpen,
  onClose,
  appointment,
  user,
  appointments = [],
  closedSlots = {},
  onSuccess,
  showToast
}: {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  user: any;
  appointments?: any[];
  closedSlots?: any;
  onSuccess: () => void;
  showToast: (msg: string, type?: string) => void;
}) {
  const [teamMembers, setTeamMembers] = useState<{ad: string, soyad: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');
  const [selectedHour, setSelectedHour] = useState<number>(8);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (isOpen && appointment) {
      const extraCount = appointment.kategori === 'voleybol' ? 11 : 9;
      let members = appointment.oyuncular || [];
      
      // Ensure array is correct size
      if (members.length < extraCount) {
        members = [...members, ...Array.from({ length: extraCount - members.length }, () => ({ ad: '', soyad: '' }))];
      } else if (members.length > extraCount) {
        members = members.slice(0, extraCount);
      }
      
      setTeamMembers(members);
      setSelectedDateStr(appointment.tarih);
      setSelectedHour(appointment.saat);
    }
  }, [isOpen, appointment]);

  const availableDays = useMemo(() => {
    const monday = getActiveWeekMonday();
    const days = getWeekDaysFromMonday(monday);
    const now = new Date();
    
    return days.map(d => {
      const dateStr = formatDate(d);
      const isPastDay = new Date(d.getTime()).setHours(23, 59, 59, 999) < now.getTime();
      const dayClosed = closedSlots[dateStr] === 'ALL' || isPastDay;
      const label = `${d.getDate()} ${TURKISH_MONTHS[d.getMonth()]} ${TURKISH_DAYS[d.getDay()]}`;
      return { val: dateStr, label, disabled: dayClosed && dateStr !== appointment?.tarih };
    }).filter(d => !d.disabled);
  }, [closedSlots, appointment]);

  const availableHours = useMemo(() => {
    if (!appointment || !selectedDateStr) return [];
    const dateStr = selectedDateStr;
    const now = new Date();
    const [y, m, d] = dateStr.split('-');
    const apptDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const isPastDay = apptDate.setHours(23, 59, 59, 999) < now.getTime();
    
    if (closedSlots[dateStr] === 'ALL' || isPastDay) {
       if (dateStr === appointment.tarih) return [appointment.saat];
       return [];
    }
    
    const dayAppts = appointments.filter(a => a.tarih === dateStr && a.id !== appointment.id);
    const closedArr = Array.isArray(closedSlots[dateStr]) ? closedSlots[dateStr] : [];
    
    const isToday = apptDate.getDate() === now.getDate() && apptDate.getMonth() === now.getMonth() && apptDate.getFullYear() === now.getFullYear();

    const hours = [];
    for (let h = 8; h <= 22; h++) {
      const slotPast = isToday && h <= now.getHours();
      const isTaken = dayAppts.some(a => a.saat === h);
      const isClosed = closedArr.includes(h);
      if ((dateStr === appointment.tarih && h === appointment.saat) || (!slotPast && !isTaken && !isClosed)) {
        hours.push(h);
      }
    }
    return hours;
  }, [appointment, appointments, closedSlots, selectedDateStr]);

  if (!isOpen || !appointment) return null;

  const editable = isEditable(appointment.tarih, appointment.saat);

  const saveEditAppt = async () => {
    if (!appointment.id) return;
    
    // Booking window kontrolü
    if (!isBookingEnabled()) {
      showToast('⏳ Randevular henüz açılmadı! Saat 10:00\'da aktif olacak.', 'error');
      return;
    }
    
    setLoading(true);
    
    let currentError = null;

    if (selectedHour === appointment.saat && selectedDateStr === appointment.tarih) {
      // Sadece oyuncular değişti
      const { error } = await supabase.from('appointments').update({ 
        oyuncular: teamMembers
      }).eq('id', appointment.id);
      currentError = error;
    } else {
      // Tarih veya saat değişti (trigger'ı aşmak için sil + ekle)
      const delRes = await supabase.from('appointments').delete().eq('id', appointment.id);
      if (delRes.error) {
        currentError = delRes.error;
      } else {
        const insRes = await supabase.from('appointments').insert({
          user_id: appointment.user_id,
          tarih: selectedDateStr,
          saat: selectedHour,
          kategori: appointment.kategori,
          oyuncular: teamMembers
        });
        
        if (insRes.error) {
          currentError = insRes.error;
          // Hata olursa eskiyi geri al
          await supabase.from('appointments').insert({
            user_id: appointment.user_id,
            tarih: appointment.tarih,
            saat: appointment.saat,
            kategori: appointment.kategori,
            oyuncular: appointment.oyuncular
          });
        }
      }
    }
    
    setLoading(false);

    if (currentError) { 
      if (currentError.code === '23505') showToast('Seçtiğiniz slot doldu veya aynı güne başka randevunuz var.', 'error');
      else showToast('Hata: ' + currentError.message, 'error'); 
      return; 
    }
    
    onSuccess();
    showToast('Randevu başarıyla güncellendi.', 'success');
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '620px' }}>
        <button className="modal-close" onClick={onClose} disabled={loading}>✕</button>
        <h2 className="modal-title">✏️ Randevuyu Düzenle</h2>
        
        <div className="modal-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {editable ? (
            <>
              <select
                value={selectedDateStr}
                onChange={e => {
                  setSelectedDateStr(e.target.value);
                  setSelectedHour(8); // reset hour on date change to avoid invalid hours
                }}
                className="form-input"
                style={{ width: 'auto', padding: '4px 8px', height: 'auto', fontSize: '14px' }}
                disabled={loading}
              >
                {availableDays.map(d => (
                  <option key={d.val} value={d.val}>{d.label} {d.val === appointment.tarih ? '(Mevcut)' : ''}</option>
                ))}
              </select>
              <span>—</span>
              <select 
                value={selectedHour} 
                onChange={e => setSelectedHour(parseInt(e.target.value))}
                className="form-input"
                style={{ width: 'auto', padding: '4px 8px', height: 'auto', fontSize: '14px', minWidth: '110px' }}
                disabled={loading}
              >
                {availableHours.length === 0 && <option value={selectedHour} disabled>{String(selectedHour).padStart(2, '0')}:00 (Dolu)</option>}
                {availableHours.map(h => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00 {h === appointment.saat && selectedDateStr === appointment.tarih ? '(Mevcut)' : ''}</option>
                ))}
              </select>
            </>
          ) : (
            <span>{appointment.tarih} — {String(appointment.saat).padStart(2, '0')}:00</span>
          )}
          <span>| {appointment.kategori === 'basketbol' ? 'Basketbol' : 'Voleybol'}</span>
        </div>
        
        {!editable && (
          <div className="team-locked-notice">
            🔒 Randevuya 3 saatten az kaldığı için takım listesi düzenlenemez.
          </div>
        )}

        <div className="team-list">
          <div className="team-member-header">
            <div></div><div className="team-member-label">Ad</div><div className="team-member-label">Soyad</div>
          </div>
          <div className="team-member-row row-owner">
            <div className="team-member-number">1</div>
            <input type="text" value={user?.ad || ''} readOnly className="form-input readonly" />
            <input type="text" value={user?.soyad || ''} readOnly className="form-input readonly" />
          </div>
          {teamMembers.map((member, i) => (
            <div className="team-member-row" key={i}>
              <div className="team-member-number">{i + 2}</div>
              <input type="text" placeholder="Ad" value={member.ad} readOnly={!editable || loading} className={`form-input ${!editable ? 'readonly' : ''}`} onChange={e => { if(editable) { const newT = [...teamMembers]; newT[i] = { ...newT[i], ad: e.target.value }; setTeamMembers(newT); } }} />
              <input type="text" placeholder="Soyad" value={member.soyad} readOnly={!editable || loading} className={`form-input ${!editable ? 'readonly' : ''}`} onChange={e => { if(editable) { const newT = [...teamMembers]; newT[i] = { ...newT[i], soyad: e.target.value }; setTeamMembers(newT); } }} />
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>İptal</button>
          {editable && (
            <button className="btn btn-primary" onClick={saveEditAppt} disabled={loading}>
              {loading ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
