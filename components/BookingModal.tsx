import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TURKISH_DAYS, TURKISH_MONTHS, formatDate, isBookingEnabled, getActiveWeekMonday } from '@/utils/constants';

export default function BookingModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  selectedHour, 
  user,
  appointments = [],
  onSuccess,
  showToast
}: { 
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  selectedHour: number | null;
  user: any;
  appointments?: any[];
  onSuccess: () => void;
  showToast: (msg: string, type?: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ad: string, soyad: string}[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedCategory(null);
      setTeamMembers([]);
    }
  }, [isOpen]);

  const userHasApptInWeek = useMemo(() => {
    const monday = getActiveWeekMonday();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    const startStr = formatDate(monday);
    const endStr = formatDate(sunday);
    
    return appointments.some(a => a.user_id === user?.id && a.tarih >= startStr && a.tarih <= endStr);
  }, [appointments, user?.id]);

  if (!isOpen || !selectedDate || selectedHour === null) return null;

  const dateStr = formatDate(selectedDate);
  const displayDate = `${selectedDate.getDate()} ${TURKISH_MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  const dayName = TURKISH_DAYS[selectedDate.getDay()];

  const handleSelectCategory = (category: string) => {
    if (userHasApptInWeek) return;
    setSelectedCategory(category);
    const extraCount = category === 'voleybol' ? 11 : 9;
    setTeamMembers(Array.from({ length: extraCount }, () => ({ ad: '', soyad: '' })));
    setStep(2);
  };

  const confirmBooking = async () => {
    if (!selectedCategory || !user) return;
    
    // Server-side'da da kontrol var ama client-side de uyaralım
    if (!isBookingEnabled()) {
      showToast('⏳ Randevular henüz açılmadı! Saat 10:00\'da aktif olacak.', 'error');
      return;
    }
    
    setBookingLoading(true);

    const { error } = await supabase.from('appointments').insert({
      user_id: user.id,
      tarih: dateStr,
      saat: selectedHour,
      kategori: selectedCategory,
      oyuncular: teamMembers
    });

    setBookingLoading(false);

    if (error) {
      if (error.code === '23505') showToast('Bu slot az önce doldu, lütfen başka bir saat seçin.', 'error');
      else showToast('Hata: ' + error.message, 'error');
      return;
    }

    // Broadcast the change to sync all clients securely
    const channel = supabase.channel('public-sync');
    await channel.send({ type: 'broadcast', event: 'refetch_data', payload: {} });
    supabase.removeChannel(channel);

    onSuccess();
    showToast('🎉 Randevunuz başarıyla oluşturuldu!', 'success');
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose} disabled={bookingLoading}>✕</button>
        <h2 className="modal-title">Randevu Oluştur</h2>
        <p className="modal-subtitle">{dayName}, {displayDate} — {String(selectedHour).padStart(2, '0')}:00</p>
        
        <div className="steps-indicator">
          <div className={`step ${step >= 1 ? 'active' : ''}`}><div className="step-circle">1</div><span>Branş</span></div>
          <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}><div className="step-circle">2</div><span>Takım</span></div>
        </div>

        {step === 1 && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px', color: 'var(--text-dark)' }}>Branş Seçin</h3>
            
            {userHasApptInWeek ? (
              <div className="appt-conflict-notice">
                <div className="notice-icon">⚠️</div>
                <div className="notice-text">
                  <strong>Zaten bir randevunuz var!</strong>
                  <p>Mevcut haftada zaten bir randevunuz bulunuyor. Haftada yalnızca bir randevu alabilirsiniz. Lütfen mevcut randevunuzu düzenleyin veya iptal edin.</p>
                </div>
              </div>
            ) : (
              <div className="category-grid">
                <div className={`category-card ${selectedCategory === 'basketbol' ? 'active' : ''}`} onClick={() => handleSelectCategory('basketbol')}>
                  <div className="category-icon">🏀</div>
                  <div className="category-name">Basketbol</div>
                </div>
                <div className={`category-card ${selectedCategory === 'voleybol' ? 'active' : ''}`} onClick={() => handleSelectCategory('voleybol')}>
                  <div className="category-icon">🏐</div>
                  <div className="category-name">Voleybol</div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '14px', color: 'var(--text-dark)' }}>Takım Listesi ({selectedCategory === 'basketbol' ? '10' : '12'} Kişi)</h3>
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
                  <input type="text" placeholder="Ad" value={member.ad} className="form-input" onChange={e => { 
                    const newT = [...teamMembers]; 
                    newT[i] = { ...newT[i], ad: e.target.value }; 
                    setTeamMembers(newT); 
                  }} />
                  <input type="text" placeholder="Soyad" value={member.soyad} className="form-input" onChange={e => { 
                    const newT = [...teamMembers]; 
                    newT[i] = { ...newT[i], soyad: e.target.value }; 
                    setTeamMembers(newT); 
                  }} />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setStep(1)} disabled={bookingLoading}>Geri</button>
              <button className="btn btn-primary" onClick={confirmBooking} disabled={bookingLoading}>{bookingLoading ? 'İşleniyor...' : '✅ Onayla'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
