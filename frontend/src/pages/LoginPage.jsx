import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, User, Lock, Mail, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState('student'); // 'student' or 'teacher'
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(false);

    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    if (mode === 'register' && !name) {
      setError('Please enter your full name.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save current email session info locally for the portal endpoints
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_name', name || email.split('@')[0]);

        if (role === 'teacher') {
          // Instruct through a popup alert
          alert('Welcome Teacher! Accessing Commandant Security Console...');
          navigate('/commandant');
        } else {
          alert('Welcome Student! Loading Slot Booking Interface...');
          navigate('/book');
        }
      } else {
        // Registering a new student profile
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_name', name);
        alert(`Account created successfully for ${name}! Proceeding to Exam Slot Booking.`);
        navigate('/book');
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      
      {/* Logos and Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center', marginBottom: '15px' }}>
          <img src="/devshala-logo.png" alt="DevShaala Logo" className="logo-img" style={{ height: '70px', borderRadius: '12px' }} />
          <img src="/gtc-logo.png" alt="Global Tech Council Logo" className="partner-logo" style={{ height: '70px', width: '70px', borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'var(--font-title)', letterSpacing: '-0.02em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          DevShaala Secure Exam Invigilator
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '5px' }}>
          Official Python MasterClass Final Assessment Portal (Certified by Global Tech Council)
        </p>
      </div>

      {/* Glassmorphic Login Card */}
      <div className="glass-card" style={{ maxWidth: '440px', width: '100%' }}>
        
        {/* Role Selector Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '25px' }}>
          <button 
            type="button"
            onClick={() => { setRole('student'); setError(''); }}
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: 'none', 
              border: 'none', 
              color: role === 'student' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
              fontFamily: 'var(--font-title)',
              fontWeight: '700',
              fontSize: '15px',
              borderBottom: role === 'student' ? '2px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            Student Login
          </button>
          <button 
            type="button"
            onClick={() => { setRole('teacher'); setMode('login'); setError(''); }}
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: 'none', 
              border: 'none', 
              color: role === 'teacher' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
              fontFamily: 'var(--font-title)',
              fontWeight: '700',
              fontSize: '15px',
              borderBottom: role === 'teacher' ? '2px solid var(--accent-primary)' : 'none',
              cursor: 'pointer'
            }}
          >
            Invigilator
          </button>
        </div>

        <h3 style={{ fontSize: '20px', marginBottom: '20px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LogIn size={20} className="text-blue-500" /> 
          {mode === 'login' ? 'Sign In to Portal' : 'Register Student'}
        </h3>

        {error && (
          <div style={{ 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid var(--danger)', 
            borderRadius: '10px', 
            padding: '12px', 
            marginBottom: '20px', 
            color: 'var(--danger)',
            fontSize: '13px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {mode === 'register' && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="Enter full name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
                <User size={18} style={{ position: 'absolute', right: '16px', top: '15px', color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="email" 
                className="text-input" 
                placeholder="you@domain.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
              <Mail size={18} style={{ position: 'absolute', right: '16px', top: '15px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '25px' }}>
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                className="text-input" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <Lock size={18} style={{ position: 'absolute', right: '16px', top: '15px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', padding: '15px' }} 
            disabled={loading}
          >
            {loading ? 'Authenticating...' : mode === 'login' ? 'Verify & Sign In' : 'Create Account'}
          </button>

          {role === 'student' && (
            <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {mode === 'login' ? (
                <>
                  New Candidate?{' '}
                  <span 
                    onClick={() => { setMode('register'); setError(''); }} 
                    style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Register Account
                  </span>
                </>
              ) : (
                <>
                  Have an account?{' '}
                  <span 
                    onClick={() => { setMode('login'); setError(''); }} 
                    style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Log In
                  </span>
                </>
              )}
            </div>
          )}

        </form>

      </div>

      <p style={{ marginTop: '40px', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.05em' }}>
        DEVSHAALA SECURED PLATFORM © 2026
      </p>

    </div>
  );
}
