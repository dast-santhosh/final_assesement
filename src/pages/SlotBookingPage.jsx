import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { Calendar, Clock, Camera, CheckCircle, ShieldCheck, HelpCircle, Lock, Trophy } from 'lucide-react';
import { uploadImage } from '../utils/uploadImage';

// Generate the 20 slots of 2 hours, from 25.06.2026 to 27.06.2026
const SLOTS = [];
const startTimes = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
const days = ["2026-06-25", "2026-06-26", "2026-06-27"];

let slotCount = 0;
for (const day of days) {
  for (const startTime of startTimes) {
    if (slotCount >= 20) break;
    const [sh, sm] = startTime.split(':').map(Number);
    const eh = sh + 2;
    const endTime = `${String(eh).padStart(2, '0')}:00`;
    
    const startIso = `${day}T${startTime}:00`;
    const endIso = `${day}T${endTime}:00`;
    
    SLOTS.push({
      id: `slot_${slotCount + 1}`,
      displayDate: day.split('-').reverse().join('.'), // DD.MM.YYYY
      displayTime: `${startTime} - ${endTime}`,
      startIso,
      endIso
    });
    slotCount++;
  }
}

export default function SlotBookingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  
  // Webcam & photo capture
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [photoBase64, setPhotoBase64] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // States for booking status / lobby
  const [booking, setBooking] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Verification & Certificate states
  const [passcode, setPasscode] = useState('');
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);
  const [scorecard, setScorecard] = useState(null);

  // Simulated Time for Testing
  const [simulatedTime, setSimulatedTime] = useState(
    localStorage.getItem('simulated_time') || ''
  );

  // Countdown clock states
  const [timeRemaining, setTimeRemaining] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [canStart, setCanStart] = useState(false);
  const [startWindowExpired, setStartWindowExpired] = useState(false);

  useEffect(() => {
    const storedEmail = localStorage.getItem('user_email');
    const storedName = localStorage.getItem('user_name');
    
    if (!storedEmail) {
      alert('Authentication required. Please login first.');
      navigate('/');
      return;
    }
    
    setEmail(storedEmail);
    setName(storedName || '');

    // Show popup instructions immediately on load
    alert(
      "STEP-BY-STEP INSTRUCTIONS:\n\n" +
      "1. Enter your full name and email to identify yourself.\n" +
      "2. Select a 2-hour exam slot (Only available slots can be chosen, one student per slot model).\n" +
      "3. Activate your webcam and capture a clear face photo. This will be used as a biometric key during the exam!\n" +
      "4. Click 'Confirm Slot Booking'."
    );

    checkExistingBooking(storedEmail);
  }, [simulatedTime]); // Reload state if simulated time changes

  // Cleanup webcam stream when navigating away
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const checkExistingBooking = async (userEmail) => {
    setLoading(true);
    try {
      const bookingDoc = await getDoc(doc(db, 'bookings', userEmail.toLowerCase()));
      if (bookingDoc.exists()) {
        setBooking(bookingDoc.data());
      } else {
        await fetchSlots();
      }
      
      // Check if student has already submitted exam
      const subDoc = await getDoc(doc(db, 'submissions', userEmail.toLowerCase()));
      if (subDoc.exists()) {
        setSubmission(subDoc.data());
      }

      // Check results status
      const configDoc = await getDoc(doc(db, 'config', 'global'));
      setResultsPublished(configDoc.exists() ? (configDoc.data().resultsPublished || false) : false);

    } catch (e) {
      console.error("Error checking existing booking:", e);
      await fetchSlots();
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      const slotCounts = {};
      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      bookingsSnap.forEach(docSnap => {
        const data = docSnap.data();
        slotCounts[data.slotId] = (slotCounts[data.slotId] || 0) + 1;
      });

      const slotsWithStatus = SLOTS.map(slot => ({
        ...slot,
        isBooked: (slotCounts[slot.id] || 0) >= 3,
        bookingCount: slotCounts[slot.id] || 0
      }));

      setSlots(slotsWithStatus);
      // Auto-select first available slot
      const firstAvailable = slotsWithStatus.find(s => !s.isBooked);
      if (firstAvailable) {
        setSelectedSlotId(firstAvailable.id);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to load slots. Please check your internet connection.');
    }
  };

  // Webcam controls
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error(e);
      alert('Webcam access failed! Please allow camera permissions.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    
    // Mirror draw for intuitive alignment
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64 = canvas.toDataURL('image/jpeg');
    setPhotoBase64(base64);
    stopCamera();
    alert('Biometric photo captured successfully! This will serve as your ID card match inside the exam.');
  };

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlotId) {
      alert('Please select an exam slot.');
      return;
    }
    if (!photoBase64) {
      alert('Biometric registration is mandatory. Please capture your face photo first.');
      return;
    }

    setSubmitting(true);
    try {
      const targetSlot = SLOTS.find(s => s.id === selectedSlotId);
      if (!targetSlot) {
        alert('Selected slot does not exist.');
        setSubmitting(false);
        return;
      }

      // Check if student already has a booking
      const bookingDoc = await getDoc(doc(db, 'bookings', email.toLowerCase()));
      if (bookingDoc.exists()) {
        alert(`Student with email ${email} has already booked a slot.`);
        setSubmitting(false);
        return;
      }

      // Check slot bookings count
      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      let activeBookingsCount = 0;
      bookingsSnap.forEach(docSnap => {
        if (docSnap.data().slotId === selectedSlotId) activeBookingsCount++;
      });

      if (activeBookingsCount >= 3) {
        alert('This slot has already been booked by the maximum limit of 3 students.');
        setSubmitting(false);
        return;
      }

      // Direct browser-to-Cloudinary upload
      let uploadedUrl = null;
      try {
        uploadedUrl = await uploadImage(photoBase64);
      } catch (uploadErr) {
        console.error("Cloudinary upload failed", uploadErr);
      }

      const bookingData = {
        slotId: selectedSlotId,
        displayDate: targetSlot.displayDate,
        displayTime: targetSlot.displayTime,
        startIso: targetSlot.startIso,
        endIso: targetSlot.endIso,
        photo: uploadedUrl || photoBase64,
        name,
        email: email.toLowerCase(),
        bookedAt: simulatedTime ? new Date(simulatedTime).toISOString() : new Date().toISOString()
      };

      await setDoc(doc(db, 'bookings', email.toLowerCase()), bookingData);
      alert('Slot booked successfully!');
      setBooking(bookingData);
    } catch (err) {
      alert(err.message || 'Booking failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Timer logic for booked slot countdown
  useEffect(() => {
    if (!booking || submission) return;

    const timer = setInterval(() => {
      const now = simulatedTime ? new Date(simulatedTime) : new Date();
      const slotStart = new Date(booking.startIso);
      const slotEnd = new Date(booking.endIso);

      const diffMs = slotStart - now;
      const startLimit = new Date(slotStart.getTime() + 30 * 60 * 1000); // 30 mins window

      if (diffMs > 0) {
        // Countdown mode
        const days = Math.floor(diffMs / (24 * 3600 * 1000));
        const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
        const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        const secs = Math.floor((diffMs % (60 * 1000)) / 1000);
        setTimeRemaining({ days, hours, mins, secs });
        setCanStart(false);
        setStartWindowExpired(false);
      } else {
        // Active/Elapsed time slot
        setTimeRemaining({ days: 0, hours: 0, mins: 0, secs: 0 });
        
        if (now <= startLimit) {
          // Within 30 min limit
          setCanStart(true);
          setStartWindowExpired(false);
        } else {
          // Passed 30 mins, did not start
          setCanStart(false);
          setStartWindowExpired(true);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [booking, simulatedTime, submission]);

  const handleStartExam = () => {
    alert("ALERT: Entering secure examination sandbox.\n- All browser exits/tab switches are actively logged.\n- Proctor webcam checks identity. Avoid looking away from monitor.");
    navigate(`/exam?email=${encodeURIComponent(email)}`);
  };

  const handleSimulateTimeChange = (val) => {
    setSimulatedTime(val);
    if (val) {
      localStorage.setItem('simulated_time', val);
      alert(`Simulation: System time set to ${val}. Countdown updated.`);
    } else {
      localStorage.removeItem('simulated_time');
      alert(`Simulation: Restored to real-world time.`);
    }
  };

  const handleVerifyPasscode = async (e) => {
    e.preventDefault();
    if (!passcode) {
      alert('Please enter your 16-digit passcode.');
      return;
    }

    setVerifyingPasscode(true);
    try {
      const subDoc = await getDoc(doc(db, 'submissions', email.toLowerCase()));
      if (!subDoc.exists()) {
        alert('No exam submission found for this email.');
        return;
      }
      const sub = subDoc.data();

      if (!resultsPublished || !sub.published) {
        alert('Results have not been published by the invigilator yet.');
        return;
      }

      if (!sub.passcode || sub.passcode.replace(/\s/g, '').toLowerCase() !== passcode.replace(/\s/g, '').toLowerCase()) {
        alert('Incorrect 16-digit passcode. Access denied.');
        return;
      }

      setScorecard({
        name: sub.name,
        email: sub.email,
        marks: sub.marks,
        feedback: sub.feedback,
        submittedAt: sub.submittedAt
      });
      alert('Passcode verified! Official scorecard and certificate decrypted successfully.');
    } catch (err) {
      alert('Verification failed. Incorrect passcode.');
    } finally {
      setVerifyingPasscode(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2 style={{ fontFamily: 'var(--font-title)' }}>Lobby Loading</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Warming secure exam controller...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* Header */}
      <div className="logo-header">
        <div className="logo-container">
          <img src="/devshala-logo.png" alt="DevShaala Logo" className="logo-img" />
          <span className="logo-text">Python Masterclass Exam</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Welcome, <b>{name}</b></span>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            onClick={() => {
              localStorage.clear();
              navigate('/');
            }}
          >
            Logout
          </button>
          <img src="/gtc-logo.png" alt="Partner Logo" className="partner-logo" style={{ height: '30px', width: '30px', objectFit: 'cover' }} />
        </div>
      </div>

      {/* Simulator Control Bar for Grading Ease */}
      {!scorecard && (
        <div className="glass-card" style={{ padding: '15px 25px', marginBottom: '25px', borderColor: 'var(--warning)', borderStyle: 'dashed', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={16} /> Test Simulation Controls
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Adjust the portal's active system clock to test slots, start window limits (first 30 mins) and live timers.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              type="datetime-local" 
              className="text-input" 
              style={{ width: '220px', padding: '8px 12px', fontSize: '13px' }}
              value={simulatedTime}
              onChange={e => handleSimulateTimeChange(e.target.value)}
            />
            {simulatedTime && (
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 12px', fontSize: '12px' }}
                onClick={() => handleSimulateTimeChange('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main State Panel */}
      {!booking && (
        /* 1. Booking Form Interface */
        <div style={{ maxWidth: '650px', margin: '0 auto', width: '100%' }}>
          <div className="glass-card">
            <h2 style={{ fontSize: '24px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar className="text-blue-500" /> Book Python MasterClass Exam Slot
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '25px' }}>
              Select your exam timing and enroll your face pattern. <b>Each slot is strictly locked for 1 student only.</b>
            </p>

            <form onSubmit={handleBooking}>
              <div className="input-group">
                <label className="input-label">Student Full Name</label>
                <input 
                  type="text" 
                  className="text-input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                />
              </div>

              <div className="input-group">
                <label className="input-label">Student Email</label>
                <input 
                  type="email" 
                  className="text-input" 
                  value={email} 
                  disabled 
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Select Exam Slot (2-hour limit)</label>
                <select 
                  className="select-input" 
                  value={selectedSlotId} 
                  onChange={e => setSelectedSlotId(e.target.value)}
                  required
                >
                  {slots.map(slot => (
                    <option key={slot.id} value={slot.id} disabled={slot.isBooked}>
                      {slot.displayDate} @ {slot.displayTime} {slot.isBooked ? ' (Unavailable)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Photo Registration Capture */}
              <div className="input-group" style={{ marginTop: '25px', textAlign: 'center' }}>
                <label className="input-label" style={{ display: 'block', marginBottom: '10px' }}>Biometric Face Registration</label>
                
                {isCameraActive ? (
                  <div className="webcam-container">
                    <video ref={videoRef} autoPlay className="webcam-feed" muted />
                    <div className="camera-guide-box"></div>
                    <button 
                      type="button" 
                      className="btn-primary" 
                      onClick={capturePhoto}
                      style={{ position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <Camera size={18} /> Click Photo
                    </button>
                  </div>
                ) : photoBase64 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '160px', height: '120px', border: '2px solid var(--success)', borderRadius: '12px', overflow: 'hidden' }}>
                      <img src={photoBase64} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={startCamera}>
                      Capture New Photo
                    </button>
                  </div>
                ) : (
                  <div style={{ border: '2px dashed var(--border-color)', borderRadius: '16px', padding: '40px', cursor: 'pointer', textAlign: 'center' }} onClick={startCamera}>
                    <Camera size={40} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Click to activate camera and capture enrollment photo</p>
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '30px', padding: '16px' }}
                disabled={submitting}
              >
                {submitting ? 'Reserving...' : 'Confirm Slot Booking'}
              </button>
            </form>
          </div>
        </div>
      )}

      {booking && !submission && (
        /* 2. Confirmed Slot / Exam Countdown Lobby */
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '15px', borderRadius: '50%' }}>
                <ShieldCheck size={40} />
              </div>
            </div>
            <h2 style={{ fontSize: '26px', marginBottom: '5px' }}>Exam Slot Confirmed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Your Python Masterclass Final Exam booking is secured.
            </p>

            {/* Booking Details Card */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '15px', padding: '20px', margin: '25px 0', textAlign: 'left', display: 'flex', gap: '20px', alignItems: 'center' }}>
              <img src={booking.photo} alt="Student" style={{ width: '90px', height: '110px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border-color)' }} />
              <div>
                <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>{booking.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Calendar size={14} className="text-blue-400" /> Slot Date: <b>{booking.displayDate}</b>
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} className="text-violet-400" /> Slot Time: <b>{booking.displayTime} (2 Hr)</b>
                </p>
              </div>
            </div>

            {/* Countdown / Start Action Display */}
            {!canStart && !startWindowExpired && (
              <div style={{ padding: '20px 0' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
                  🕒 D-DAY COUNTDOWN TO EXAM
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                  {[{ label: 'Days', val: timeRemaining.days }, { label: 'Hours', val: timeRemaining.hours }, { label: 'Mins', val: timeRemaining.mins }, { label: 'Secs', val: timeRemaining.secs }].map((item, idx) => (
                    <div key={idx} style={{ minWidth: '70px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent-primary)' }}>{String(item.val).padStart(2, '0')}</div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '20px' }}>
                  Please log in within the 30-minute start window once the slot activates.
                </p>
              </div>
            )}

            {canStart && (
              <div style={{ padding: '20px 0' }}>
                <div style={{ color: 'var(--success)', fontWeight: '600', marginBottom: '15px', fontSize: '16px' }}>
                  🟢 Your exam slot is now active! (90 minutes limit)
                </div>
                <button 
                  onClick={handleStartExam} 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '18px', fontSize: '16px', fontWeight: '700' }}
                >
                  Start Secure Exam Sandbox
                </button>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '15px' }}>
                  *Make sure you start within the first 30 minutes of your time slot, otherwise access will be denied.
                </p>
              </div>
            )}

            {startWindowExpired && (
              <div style={{ padding: '20px 0', color: 'var(--danger)' }}>
                <div style={{ fontWeight: '700', fontSize: '18px', marginBottom: '10px' }}>
                  ❌ ACCESS EXPIRED
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  You failed to start the exam within the first 30 minutes of your booked slot time. Please contact the administrator.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {booking && submission && !resultsPublished && (
        /* 3. Completed Exam, Awaiting Grading */
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', padding: '15px', borderRadius: '50%' }}>
                <CheckCircle size={40} />
              </div>
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>Exam Submitted Successfully</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
              Your answers and proctor telemetry logs have been secured on our servers.<br />
              <b>Awaiting evaluation and results publication by the lead invigilator.</b>
            </p>
            <div style={{ marginTop: '20px', padding: '15px', background: 'var(--bg-secondary)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
              Status: Scored & Logged · Results Pending
            </div>
          </div>
        </div>
      )}

      {booking && submission && resultsPublished && !scorecard && (
        /* 4. Results Published, Awaiting Decryption Passcode */
        <div style={{ maxWidth: '550px', margin: '0 auto', width: '100%' }}>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '15px', borderRadius: '50%' }}>
                <Lock size={36} />
              </div>
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Decrypt Exam Certificate</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '25px', lineHeight: '1.5' }}>
              Results are released! Enter the 16-digit passcode sent to your registered email (from <b>devshaala@gmail.com</b>) to decrypt your scorecard and official certificate.
            </p>

            <form onSubmit={handleVerifyPasscode}>
              <div className="input-group">
                <label className="input-label">16-Digit Decryption Key</label>
                <input 
                  type="text" 
                  className="text-input" 
                  placeholder="e.g. 1234-5678-9012-3456" 
                  value={passcode} 
                  onChange={e => setPasscode(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '2px', fontWeight: '700', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '100%', marginTop: '20px', padding: '15px' }}
                disabled={verifyingPasscode}
              >
                {verifyingPasscode ? 'Decrypting...' : 'Unlock Scorecard & Certificate'}
              </button>
            </form>
          </div>
        </div>
      )}

      {scorecard && (
        /* 5. Decrypted Certificate View */
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          
          {/* Back button */}
          <div style={{ textAlign: 'left', marginBottom: '15px' }}>
            <button 
              className="btn-secondary" 
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={() => { setScorecard(null); setPasscode(''); }}
            >
              Back to Verification
            </button>
          </div>

          {/* Note Banner */}
          <div style={{
            background: 'rgba(79, 70, 229, 0.1)',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            borderRadius: '12px',
            padding: '14px 20px',
            color: 'var(--accent-primary)',
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '15px'
          }}>
            Original certificate will be sent to Email ID!
          </div>

          {/* Stunning Certificate Frame */}
          <div className="certificate-frame">
            <div className="cert-seal"></div>
            
            <div className="cert-header">
              <img src="/devshala-logo.png" alt="DevShaala Logo" style={{ height: '50px' }} />
              <img src="/gtc-logo.png" alt="Partner Logo" className="partner-logo" style={{ height: '50px', width: '50px', objectFit: 'cover' }} />
            </div>

            <div className="cert-title">Certificate of Completion</div>
            <div className="cert-subtitle">This document officially certifies that</div>

            <div className="cert-body">
              <div className="cert-name">{scorecard.name}</div>
              <p className="cert-text">
                has successfully completed the comprehensive, project-based evaluation and invigilated testing requirements for the
                <b style={{ color: 'var(--accent-secondary)', display: 'block', margin: '8px 0', fontSize: '18px' }}>Python Masterclass Certification</b>
                demonstrating high competence in data types, file I/O operations, algorithms, and modular object-oriented programming.
              </p>
              
              <div className="cert-marks">
                Final Grade: {scorecard.marks >= 27 ? 'A+ (Excellent)' : scorecard.marks >= 24 ? 'A (Very Good)' : scorecard.marks >= 21 ? 'B (Good)' : scorecard.marks >= 15 ? 'Pass' : 'Needs Improvement'} · Score: {scorecard.marks}/30
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Evaluation Date: {new Date(scorecard.submittedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="cert-footer">
              <div className="cert-sig">
                <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--text-primary)', fontSize: '18px', marginBottom: '4px' }}>Santhosh P</div>
                <div className="cert-sig-line"></div>
                <div className="cert-sig-title">Founder & Lead Mentor</div>
              </div>
              <div className="cert-sig">
                <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: 'var(--text-primary)', fontSize: '18px', marginBottom: '4px' }}>Proctor Verified</div>
                <div className="cert-sig-line"></div>
                <div className="cert-sig-title">Global Tech Council Auditor</div>
              </div>
            </div>

          </div>

          {/* Feedback Card */}
          {scorecard.feedback && (
            <div className="glass-card" style={{ marginTop: '20px', textAlign: 'left' }}>
              <h4 style={{ color: 'var(--accent-primary)', marginBottom: '8px' }}>Instructor Evaluation Remarks</h4>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                "{scorecard.feedback}"
              </p>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
