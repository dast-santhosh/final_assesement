import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SlotBookingPage from './pages/SlotBookingPage';
import ExamPage from './pages/ExamPage';
import CommandantDashboard from './pages/CommandantDashboard';

export default function App() {
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
