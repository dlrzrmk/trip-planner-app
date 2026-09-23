import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../App.jsx';
import { useLang } from '../i18n/LanguageContext.jsx';

export default function Register() {
  const location = useLocation();
  const [step, setStep] = useState(location.state?.needsVerification ? 'verify' : 'form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(location.state?.email || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const submitForm = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password, phone });
      if (data.needsVerification) {
        setEmail(data.email);
        setStep('verify');
      }
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        setEmail(err.response.data.email);
        setStep('verify');
        return;
      }
      setError(err.response?.data?.error || t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-email', { email, code });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || t('auth.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResendMsg('');
    setError('');
    setResending(true);
    try {
      await api.post('/auth/resend-code', { email });
      setResendMsg(t('auth.resendSuccess'));
    } catch (err) {
      setError(err.response?.data?.error || t('auth.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  if (step === 'verify') {
    return (
      <div className="container auth-wrap">
        <div className="card">
          <h2>{t('auth.verifyTitle')}</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>{t('auth.verifyIntro', email)}</p>
          <form onSubmit={submitVerify}>
            <div className="field">
              <label>{t('auth.verifyCode')}</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} />
            </div>
            {error && <div className="error-text">{error}</div>}
            {resendMsg && <div style={{ color: '#1c8b4c', fontSize: 13, marginBottom: 8 }}>{resendMsg}</div>}
            <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? t('auth.verifying') : t('auth.verifyButton')}
            </button>
          </form>
          <p style={{ marginTop: 16, fontSize: 14 }}>
            <button
              type="button"
              className="btn secondary small"
              onClick={resendCode}
              disabled={resending}
            >
              {resending ? t('auth.resending') : t('auth.resendCode')}
            </button>
          </p>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            <button type="button" className="btn secondary small" onClick={() => setStep('form')}>
              {t('auth.backToForm')}
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container auth-wrap">
      <div className="card">
        <h2>{t('auth.registerTitle')}</h2>
        <form onSubmit={submitForm}>
          <div className="field">
            <label>{t('auth.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              required
            />
          </div>
          <div className="field">
            <label>
              {t('auth.password')} ({t('auth.passwordHint')})
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? t('auth.registeringIn') : t('auth.registerButton')}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          {t('auth.hasAccount')} <Link to="/login">{t('auth.goLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
