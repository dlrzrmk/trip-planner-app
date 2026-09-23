import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../App.jsx';
import { useLang } from '../i18n/LanguageContext.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        navigate('/register', { state: { needsVerification: true, email: err.response.data.email } });
        return;
      }
      setError(err.response?.data?.error || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container auth-wrap">
      <div className="card">
        <h2>{t('auth.loginTitle')}</h2>
        <form onSubmit={submit}>
          <div className="field">
            <label>{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          {t('auth.noAccount')} <Link to="/register">{t('auth.goRegister')}</Link>
        </p>
      </div>
    </div>
  );
}
