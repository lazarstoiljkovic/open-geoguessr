import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import Login from '../pages/Login/Login';
import Register from '../pages/Register/Register';
import Lobby from '../pages/Lobby/Lobby';
import Room from '../pages/Game/Room';
import Game from '../pages/Game/Game';
import Leaderboard from '../pages/Leaderboard/Leaderboard';

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout>
            <Lobby />
          </Layout>
        }
      />
      <Route
        path="/login"
        element={
          <Layout>
            <Login />
          </Layout>
        }
      />
      <Route
        path="/register"
        element={
          <Layout>
            <Register />
          </Layout>
        }
      />
      <Route
        path="/room/:code"
        element={
          <Layout>
            <Room />
          </Layout>
        }
      />
      <Route path="/game/:code" element={<Game />} />
      <Route
        path="/leaderboard"
        element={
          <Layout>
            <Leaderboard />
          </Layout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
