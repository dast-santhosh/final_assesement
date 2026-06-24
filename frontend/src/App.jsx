import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SlotBookingPage from './pages/SlotBookingPage';
import ExamPage from './pages/ExamPage';
import CommandantDashboard from './pages/CommandantDashboard';
import { Monitor } from 'lucide-react';

export default function App() {
  const [isUnsupportedDevice, setIsUnsupportedDevice] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent.toLowerCase();
      const isMobileUA = /mobile|android|iphone|ipad|tablet|playbook|silk/.test(ua);
      const isSmallScreen = window.innerWidth < 1024;
      setIsUnsupportedDevice(isMobileUA || isSmallScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (isUnsupportedDevice) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#7f1d1d',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999999,
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          maxWidth: '500px',
          padding: '40px',
          borderRadius: '16px',
          backgroundColor: '#991b1b',
          border: '3px solid #f87171',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{
            backgroundColor: 'rgba(254, 226, 226, 0.1)',
            padding: '16px',
            borderRadius: '50%',
            color: '#fca5a5'
          }}>
            <Monitor size={48} />
          </div>
          
          <h2 style={{
            fontSize: '24px',
            fontWeight: '900',
            color: '#fee2e2',
            textTransform: 'uppercase',
            margin: 0,
            letterSpacing: '0.05em'
          }}>
            🚨 Device Not Supported
          </h2>
          
          <p style={{
            fontSize: '15px',
            lineHeight: '1.6',
            color: '#fee2e2',
            margin: 0
          }}>
            This secure examination sandbox requires a **Laptop or Desktop computer**. 
            Mobile phones and tablets are not supported due to webcam proctoring requirements and programming environment layouts.
          </p>
          
          <div style={{
            fontSize: '13px',
            color: '#fca5a5',
            borderTop: '1px solid rgba(248, 113, 113, 0.3)',
            paddingTop: '15px',
            width: '100%'
          }}>
            Please open this exam portal on a desktop or laptop device.
          </div>
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
