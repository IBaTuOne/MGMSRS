'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 1) return digits;
  if (digits.length <= 4) return `${digits[0]}(${digits.slice(1)}`;
  if (digits.length <= 7) return `${digits[0]}(${digits.slice(1, 4)}) ${digits.slice(4)}`;
  if (digits.length <= 9) return `${digits[0]}(${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7)}`;
  return `${digits[0]}(${digits.slice(1, 4)}) ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
}

function getRawPhone(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [phone, setPhone] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phoneRaw = getRawPhone(phone);
    const birthDate = formData.get('birthDate') as string;

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      setLoading(false);
      return;
    }

    if (phoneRaw.length !== 11 || !phoneRaw.startsWith('0')) {
      setError('Telefon numarası 0 ile başlamalı ve 11 haneli olmalıdır.');
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phoneRaw,
          birth_date: birthDate,
        },
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-card" style={{ maxWidth: '520px', padding: '40px 36px' }}>
        {/* Logo */}
        <div className="auth-logo">
          <img
            src="/gm-logo.png"
            alt="Gençlik Merkezi"
            className="auth-logo-img"
            style={{ width: '150px', height: '150px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
          />
        </div>

        <h1 className="auth-title">Üye Ol</h1>
        <p className="auth-subtitle">Saha randevusu için hesap oluşturun.</p>

        {error && (
          <div className="error-msg" style={{ display: 'block' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="success-msg" style={{ display: 'block' }}>
            Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...
          </div>
        )}

        <form className="auth-form" onSubmit={handleRegister} noValidate>

          {/* Ad / Soyad */}
          <div className="form-grid-auth">
            <div className="form-group">
              <label htmlFor="regAd">Ad</label>
              <input type="text" id="regAd" name="firstName" className="form-input" placeholder="Adınız" required autoComplete="given-name" />
            </div>
            <div className="form-group">
              <label htmlFor="regSoyad">Soyad</label>
              <input type="text" id="regSoyad" name="lastName" className="form-input" placeholder="Soyadınız" required autoComplete="family-name" />
            </div>
          </div>

          {/* Doğum Tarihi */}
          <div className="form-group">
            <label htmlFor="regDogum">Doğum Tarihi</label>
            <input type="date" id="regDogum" name="birthDate" className="form-input" max={new Date().toISOString().split('T')[0]} required />
          </div>

          {/* Telefon */}
          <div className="form-group">
            <label htmlFor="regTelefon">Telefon Numarası</label>
            <input
              type="tel"
              id="regTelefon"
              className="form-input"
              placeholder="0(5XX) XXX XX XX"
              value={phone}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '');
                if (raw.length > 0 && raw[0] !== '0') return;
                setPhone(formatPhone(e.target.value));
              }}
              autoComplete="tel"
              required
            />
          </div>

          {/* E-posta */}
          <div className="form-group">
            <label htmlFor="regEmail">E-posta Adresi</label>
            <input type="email" id="regEmail" name="email" className="form-input" placeholder="ornek@mail.com" autoComplete="email" required />
          </div>

          {/* Şifre / Şifre Tekrar */}
          <div className="form-grid-auth">
            <div className="form-group">
              <label htmlFor="regSifre">Şifre</label>
              <input type="password" id="regSifre" name="password" className="form-input" placeholder="Min. 6 karakter" autoComplete="new-password" minLength={6} required />
            </div>
            <div className="form-group">
              <label htmlFor="regSifre2">Şifre Tekrar</label>
              <input type="password" id="regSifre2" name="confirmPassword" className="form-input" placeholder="Şifrenizi tekrar girin" autoComplete="new-password" required />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            style={{ marginTop: '6px' }}
            disabled={loading || success}
          >
            {loading ? 'İşleniyor...' : 'Üye Oluştur'}
          </button>

        </form>

        <div className="auth-footer">
          Zaten hesabınız var mı? <Link href="/login">Giriş Yap</Link>
        </div>

        <div className="auth-footer" style={{ marginTop: '8px' }}>
          <Link href="/" style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
            &larr; Takvime Dön
          </Link>
        </div>

      </div>
    </div>
  );
}
