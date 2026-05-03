import { useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TURKISH_DAYS, TURKISH_MONTHS } from '@/utils/constants';

function isEditable(tarihStr: string, saatInt: number) {
  const now = new Date();
  const apptDate = new Date(tarihStr);
  apptDate.setHours(saatInt, 0, 0, 0);
  const cutoff = new Date(apptDate.getTime() - 3 * 60 * 60 * 1000); // 3 saat
  return now < cutoff;
}

function isCancellable(tarihStr: string, saatInt: number) {
  const now = new Date();
  const apptDate = new Date(tarihStr);
  apptDate.setHours(saatInt, 0, 0, 0);
  const cutoff = new Date(apptDate.getTime() - 5 * 60 * 60 * 1000); // 5 saat
  return now < cutoff;
}

export default function MyAppointmentsModal({
  isOpen,
  onClose,
  appointments,
  user,
  onSuccess,
  showToast,
  onOpenEditAppt
}: {
  isOpen: boolean;
  onClose: () => void;
  appointments: any[];
  user: any;
  onSuccess: () => void;
  showToast: (msg: string, type?: string) => void;
  onOpenEditAppt: (appt: any) => void;
}) {
  const supabase = useMemo(() => createClient(), []);

  if (!isOpen || !user) return null;

  const myAppointmentsList = appointments
    .filter(a => a.user_id === user.id)
    .sort((a, b) => new Date(a.tarih + 'T' + String(a.saat).padStart(2, '0') + ':00').getTime() - new Date(b.tarih + 'T' + String(b.saat).padStart(2, '0') + ':00').getTime());

  const cancelAppointment = async (appt: any) => {
    if (!isCancellable(appt.tarih, appt.saat)) {
      showToast('Randevuya 5 saatten az kaldığı için iptal edilemez!', 'error');
      return;
    }
    if (!confirm('Randevunuzu iptal etmek istediğinizden emin misiniz?')) return;

    const { error } = await supabase.from('appointments').delete().eq('id', appt.id);

    if (error) {
      showToast('Hata: ' + error.message, 'error');
      return;
    }

    onSuccess();
    showToast('Randevu iptal edildi.', 'success');
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '660px' }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">📅 Randevularım</h2>
        <p className="modal-subtitle">Almış olduğunuz saha randevuları aşağıda listelenmiştir.</p>
        <div>
          {myAppointmentsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-400)', fontSize: '15px' }}>Henüz hiç randevunuz yok.</div>
          ) : (
            myAppointmentsList.map(a => {
              const [y, m, d] = a.tarih.split('-');
              const tarihLabel = `${d} ${TURKISH_MONTHS[parseInt(m) - 1]} ${y}`;
              const gunLabel = TURKISH_DAYS[new Date(a.tarih).getDay()];
              const isPast = new Date(a.tarih + 'T' + String(a.saat).padStart(2, '0') + ':00') < new Date();

              return (
                <div key={a.id} className={`randevu-card ${isPast ? 'randevu-past' : 'randevu-upcoming'}`}>
                  <div className="randevu-card-top">
                    <div className="randevu-card-left">
                      <div className="randevu-date">{tarihLabel}</div>
                      <div className="randevu-day">{gunLabel}</div>
                    </div>
                    <div className="randevu-card-body">
                      <div className="randevu-time">⏰ {String(a.saat).padStart(2, '0')}:00 – {String(a.saat + 1).padStart(2, '0')}:00</div>
                      <div className="randevu-cat">{a.kategori === 'basketbol' ? '🏀 Basketbol' : '🏐 Voleybol'}</div>
                    </div>
                    <div className={`randevu-badge ${isPast ? 'badge-past' : 'badge-upcoming'}`}>
                      {isPast ? 'Geçmiş' : 'Yakında'}
                    </div>
                  </div>
                  {!isPast && (
                    <div className="randevu-actions-container">
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginBottom: '12px', padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: '8px' }}>
                        ℹ️ <strong>Bilgi:</strong> Randevunuza son <strong>5 saat</strong> kalana kadar iptal işlemi yapabilir, son <strong>3 saat</strong> kalana kadar takım kadronuzu düzenleyebilirsiniz.
                      </div>
                      <div className="randevu-actions">
                        {isEditable(a.tarih, a.saat) ? (
                          <button className="btn-randevu-edit" onClick={() => onOpenEditAppt(a)}>✏️ Düzenle</button>
                        ) : (
                          <button className="btn-randevu-edit" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Son 3 saat — kadro kilitlendi">🔒 Kadro Kilitlendi</button>
                        )}
                        {isCancellable(a.tarih, a.saat) ? (
                          <button className="btn-randevu-cancel" onClick={() => cancelAppointment(a)}>🗑️ İptal Et</button>
                        ) : (
                          <button className="btn-randevu-cancel" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Son 5 saat — iptal kilitlendi">🔒 İptal Süresi Doldu</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
