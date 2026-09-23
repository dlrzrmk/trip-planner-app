import React, { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { getToken, getUser, setToken, setUser } from './api';
import { LanguageProvider, useLang } from './i18n/LanguageContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TripEditor from './pages/TripEditor.jsx';
import TripView from './pages/TripView.jsx';

export const AuthContext = createContext(null);
export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUserState] = useState(getUser());

  const login = (token, user) => {
    setToken(token);
    setUser(user);
    setUserState(user);
  };
  const logout = () => {
    setToken(null);
    setUser(null);
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthed: !!getToken() }}>
      {children}
    </AuthContext.Provider>
  );
}

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function LanguageSwitcher() {
  const { lang, setLang, languages } = useLang();
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      className="lang-switcher"
      style={{ fontSize: 13, padding: '4px 6px', borderRadius: 6, border: '1px solid #e3e6ee' }}
    >
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

function TopBar() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  return (
    <div className="topbar">
      <Link to="/" className="brand">✈️ {t('appName')}</Link>
      <div className="top-actions">
        <LanguageSwitcher />
        {user && (
          <>
            <span style={{ fontSize: 14, color: '#6b7280' }}>{user.name}</span>
            <button
              className="btn secondary small"
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              {t('nav.logout')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TopBar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/new"
            element={
              <RequireAuth>
                <TripEditor />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id/edit"
            element={
              <RequireAuth>
                <TripEditor />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id"
            element={
              <RequireAuth>
                <TripView />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  );
}
