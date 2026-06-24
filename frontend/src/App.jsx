import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { apiRequest } from './api';
import LoginPage from './pages/LoginPage';
import SlotBookingPage from './pages/SlotBookingPage';
import ExamPage from './pages/ExamPage';
import CommandantDashboard from './pages/CommandantDashboard';

export default function App() {
  const [serverWarmed, setServerWarmed] = useState(false);
  const [warmProgress, setWarmProgress] = useState(0);

  useEffect(() => {
    let progressInterval;
    const warmServer = async () => {
      // Slow tick loader simulation to match Render's 40-50s cold start wake-up duration
      progressInterval = setInterval(() => {
        setWarmProgress(prev => {
          if (prev >= 98) return prev;
          // Slowly increase progress
          return prev + 1;
        });
      }, 500);

      try {
        await apiRequest('/api/health');
        setServerWarmed(true);
        setWarmProgress(100);
        clearInterval(progressInterval);
      } catch (err) {
        console.error("Warming check failed, retrying in 3 seconds...", err);
        setTimeout(warmServer, 3000);
      }
    };

    warmServer();
    return () => clearInterval(progressInterval);
  }, []);

  if (!serverWarmed) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2 style={{ fontFamily: 'var(--font-title)', marginBottom: '8px' }}>
          Establishing Secured Environment
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '350px' }}>
          Waking up secure Render backend invigilator nodes. This may take up to 60 seconds on free tier...
        </p>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${warmProgress}%` }}></div>
        </div>
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Waking up progress: {warmProgress}%
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/book" element={<SlotBookingPage />} />
        <Route path="/exam" element={<ExamPage />} />
        <Route path="/commandant" element={<CommandantDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
