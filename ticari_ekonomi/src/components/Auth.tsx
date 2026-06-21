import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        // If email confirmation is enabled on Supabase, alert user
        if (data.user && !data.session) {
          setInfoMsg('Kayıt başarılı! Lütfen e-posta adresinizi doğrulayın.');
        } else {
          onAuthSuccess();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Google ile giriş yapılamadı.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-logo">🪙</div>
        <h1>Ekonomi Takip</h1>
        <p className="auth-subtitle">
          {isSignUp ? 'Yeni bir hesap oluşturun' : 'Hesabınıza giriş yapın'}
        </p>
      </div>

      <form onSubmit={handleAuth} style={{ width: '100%' }}>
        {errorMsg && (
          <div
            className="toast error"
            style={{
              position: 'static',
              marginBottom: '16px',
              animation: 'none',
            }}
          >
            <FiAlertCircle />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div
            className="toast success"
            style={{
              position: 'static',
              marginBottom: '16px',
              animation: 'none',
              borderLeft: '4px solid var(--primary)',
              color: 'var(--primary)',
            }}
          >
            <FiAlertCircle />
            <span>{infoMsg}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">E-Posta Adresi</label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
              }}
            >
              <FiMail />
            </span>
            <input
              type="email"
              className="form-control"
              placeholder="e-posta@adresiniz.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ paddingLeft: '44px' }}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Şifre</label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
              }}
            >
              <FiLock />
            </span>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingLeft: '44px' }}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ marginTop: '12px' }}
          disabled={loading}
        >
          {loading
            ? 'İşlem yapılıyor...'
            : isSignUp
            ? 'Kayıt Ol'
            : 'Giriş Yap'}
        </button>
      </form>

      <div className="auth-divider">veya</div>

      <button
        type="button"
        className="btn btn-google"
        onClick={handleGoogleLogin}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
      >
        <FcGoogle size={20} />
        <span>Google ile Giriş Yap</span>
      </button>

      <div style={{ marginTop: '24px', fontSize: '0.8rem' }}>
        <span>
          {isSignUp ? 'Zaten hesabınız var mı? ' : 'Henüz hesabınız yok mu? '}
        </span>
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontWeight: '700',
            cursor: 'pointer',
            padding: '0',
            fontFamily: 'inherit',
          }}
        >
          {isSignUp ? 'Giriş Yap' : 'Kayıt Ol'}
        </button>
      </div>
    </div>
  );
};
