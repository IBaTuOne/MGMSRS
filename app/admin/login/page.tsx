'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('E-posta veya şifre hatalı!');
      setLoading(false);
      return;
    }

    // Role verification should ideally happen on the server/middleware
    // We will verify their role inside the dashboard as well.
    router.push('/admin/dashboard');
  };

  return (
    <div className="admin-login-page">
      <div className="admin-auth-card">
        <div className="admin-auth-logo">
          <img src="/gm-logo.png" alt="GSB Gençlik Merkezleri Logo" />
        </div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span className="admin-auth-badge">🛡️ YÖNETİM PANELİ</span>
        </div>
        <h1 className="admin-auth-title">Admin Girişi</h1>
        <p className="admin-auth-subtitle">Manavgat Gençlik Merkezi Yönetim Sistemi</p>

        {error && <div className="admin-alert admin-alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="admin-form-group">
            <label className="admin-form-label">Yönetici E-posta</label>
            <input 
              type="email" 
              className="admin-form-input" 
              placeholder="admin@gsb.gov.tr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Şifre</label>
            <input 
              type="password" 
              className="admin-form-input" 
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required 
            />
            <div style={{ textAlign: 'right', marginTop: '6px' }}>
              <Link href="/reset-password?from=admin" style={{ fontSize: '13px', color: 'var(--primary, #3b82f6)', textDecoration: 'none', fontWeight: 500 }}>
                Şifremi unuttum?
              </Link>
            </div>
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}
