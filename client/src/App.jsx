import React, { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { getToken, getUser, setToken, setUser } from './api';
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

function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="topbar">
      <Link to="/" className="brand">✈️ Seyahat Planlayıcı</Link>
      <div className="top-actions">
        <span style={{ fontSize: 14, color: '#6b7280' }}>{user.name}</span>
        <button
          className="btn secondary small"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Çıkış yap
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
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
  );
}
