import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GameProvider } from './context/GameContext';
import AppRouter from './router';
import './index.scss';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GameProvider>
          <AppRouter />
        </GameProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
