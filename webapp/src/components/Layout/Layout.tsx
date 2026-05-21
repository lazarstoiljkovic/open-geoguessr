import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.scss';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="layout__header">
        <Link to="/" className="layout__logo">
          <span className="layout__logo-icon">🌍</span>
          <span>Open GeoGuessr</span>
        </Link>
        <nav className="layout__nav">
          <Link to="/" className="layout__nav-link">Play</Link>
          <Link to="/leaderboard" className="layout__nav-link">Leaderboard</Link>
          {isAuthenticated ? (
            <div className="layout__user">
              <span className="layout__username">{user?.username}</span>
              <button className="btn btn--secondary" onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <div className="layout__auth">
              <Link to="/login" className="btn btn--secondary">Login</Link>
              <Link to="/register" className="btn btn--primary">Register</Link>
            </div>
          )}
        </nav>
      </header>
      <main className="layout__main">{children}</main>
    </div>
  );
}
