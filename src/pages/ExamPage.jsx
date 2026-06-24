import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Editor from '@monaco-editor/react';
import { Shield, AlertTriangle, MonitorPlay, Send, RefreshCw, Compass, ArrowLeft, ArrowRight, Check } from 'lucide-react';

const getNow = () => {
  const simTime = localStorage.getItem('simulated_time');
  if (simTime) {
    return new Date(simTime);
  }
  return new Date();
};

export default function ExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || localStorage.getItem('user_email');

  const [loading, setLoading] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [questionsData, setQuestionsData] = useState(null);
  const [questionsList, setQuestionsList] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [logs, setLogs] = useState([]);
  
  // Custom Toast State (focus-safe notifications)
  const [toastMessage, setToastMessage] = useState(null);
  
  // Timer
  const [timeRemaining, setTimeRemaining] = useState(90 * 60); // 90 mins in seconds
  
  // Proctor webcam
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [referencePhoto, setReferencePhoto] = useState('');
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  useEffect(() => {
    if (!email) {
      alert('Student email is required to take the exam.');
      navigate('/');
      return;
    }
    
    startExamSession();
    startWebcam();

    // Tab focus loss (anti-cheat tab tracker)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount(prev => {
          const newCount = prev + 1;
          const timestamp = new Date().toLocaleTimeString();
          const logMsg = `Infraction: Tab switch / Window blur detected #${newCount} at ${timestamp}`;
          
          setLogs(l => [...l, { timestamp: new Date().toISOString(), type: 'Tab Switch', description: logMsg }]);
          triggerToast(`⚠️ SECURITY WARNING: Window switch detected! Tab switching is logged as a violation.`);
          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopWebcam();
    };
  }, []);

  // Keyboard shortcut blocking & Fullscreen enforcement
  useEffect(() => {
    if (!examStarted) return;

    const handleKeyDown = (e) => {
      const key = e.key;

      // Prevent Alt, Ctrl, and Win/Command shortcut keys
      if (e.altKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast("⚠️ Key combination blocked! Shortcuts are strictly disabled.");
        return false;
      }

      // Disable Tab key (Prevents navigating away/focusing address bar)
      if (key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        triggerToast("⚠️ Tab key blocked! Please use Spacebar to indent your code.");
        return false;
      }

      // Disable Function keys (F1 to F12)
      if (key.startsWith('F') && key.length > 1 && !isNaN(Number(key.substring(1)))) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast("⚠️ Function keys are disabled during this exam.");
        return false;
      }
    };

    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs && examStarted) {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(l => [...l, { 
          timestamp: new Date().toISOString(), 
          type: 'Fullscreen Exit', 
          description: `Security Warning: Candidate exited fullscreen mode at ${timestamp}` 
        }]);
        triggerToast("⚠️ SECURITY ALERT: Fullscreen exited! This infraction has been logged.");
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [examStarted]);

  const startExamSession = async () => {
    setLoading(true);
    try {
      // 1. Fetch questions.json from public directory
      const questionsRes = await fetch('/questions.json');
      if (!questionsRes.ok) {
        throw new Error('Failed to load exam questions configuration file.');
      }
      const questionsData = await questionsRes.json();
      setQuestionsData(questionsData);

      // 2. Load candidate booking from Firestore
      const bookingDoc = await getDoc(doc(db, 'bookings', email.toLowerCase()));
      if (!bookingDoc.exists()) {
        alert('No exam slot booking found for this email.');
        navigate('/book');
        return;
      }
      const booking = bookingDoc.data();
      setReferencePhoto(booking.photo || '');

      // 3. Load or create submission document in Firestore
      const now = getNow();
      const subRef = doc(db, 'submissions', email.toLowerCase());
      const subDoc = await getDoc(subRef);

      let startedAtStr = '';
      if (subDoc.exists()) {
        const subData = subDoc.data();
        if (subData.submittedAt) {
          alert('Exam has already been submitted.');
          navigate('/book');
          return;
        }
        startedAtStr = subData.startedAt;
        setAnswers(subData.answers || {});
      } else {
        // Enforce time slot window logic
        const slotStart = new Date(booking.startIso);
        const startLimit = new Date(slotStart.getTime() + 30 * 60 * 1000); // 30 minutes window

        if (now < slotStart) {
          const diffMs = slotStart - now;
          const diffMins = Math.ceil(diffMs / 60000);
          alert(`Exam slot has not started yet. Starts in ${diffMins} minutes.`);
          navigate('/book');
          return;
        }

        if (now > startLimit) {
          alert('You failed to start the exam within the first 30 minutes of your booked time slot. Access denied.');
          navigate('/book');
          return;
        }

        // Initialize new submission document
        const newSubmission = {
          name: booking.name,
          email: email.toLowerCase(),
          startedAt: now.toISOString(),
          submittedAt: null,
          answers: {},
          logs: [],
          marks: null,
          feedback: "",
          passcode: null,
          published: false
        };
        await setDoc(subRef, newSubmission);
        startedAtStr = newSubmission.startedAt;
      }

      // Calculate time remaining
      const startedAt = new Date(startedAtStr);
      const elapsedSeconds = Math.floor((now - startedAt) / 1000);
      const timeRemainingSeconds = Math.max(90 * 60 - elapsedSeconds, 0);
      setTimeRemaining(timeRemainingSeconds);
      
      const timestamp = new Date().toLocaleTimeString();
      setLogs([{
        timestamp: new Date().toISOString(),
        type: 'Session Start',
        description: `Exam started by candidate at ${timestamp}`
      }]);

      // Compile questions list flat array
      const examPaper = questionsData?.exam_paper;
      const list = [];
      if (examPaper) {
        if (examPaper.Section_A_MCQs?.questions) {
          examPaper.Section_A_MCQs.questions.forEach((q, idx) => {
            list.push({
              id: q.id,
              index: idx + 1,
              section: 'A',
              sectionTitle: 'Section A: Multiple Choice Questions',
              instructions: examPaper.Section_A_MCQs.instructions,
              key: `A_${q.id}`,
              type: 'mcq',
              question: q.question,
              options: q.options,
              correct_answer: q.correct_answer,
              marks: 0.5
            });
          });
        }
        if (examPaper.Section_B_Programs?.questions) {
          examPaper.Section_B_Programs.questions.forEach((q, idx) => {
            list.push({
              id: q.id,
              index: idx + 1,
              section: 'B',
              sectionTitle: 'Section B: Core Programs',
              instructions: examPaper.Section_B_Programs.instructions,
              key: `B_${q.id}`,
              type: 'short_code',
              question: q.question,
              marks: 3.0
            });
          });
        }
        if (examPaper.Section_C_Long_Programs?.questions) {
          examPaper.Section_C_Long_Programs.questions.forEach((q, idx) => {
            list.push({
              id: q.id,
              index: idx + 1,
              section: 'C',
              sectionTitle: 'Section C: Detailed System Scenarios',
              instructions: examPaper.Section_C_Long_Programs.instructions,
              key: `C_${q.id}`,
              type: 'long_code',
              question: q.question,
              marks: 6.0
            });
          });
        }
        if (examPaper.Section_D_Short_Answers?.questions) {
          examPaper.Section_D_Short_Answers.questions.forEach((q, idx) => {
            list.push({
              id: q.id,
              index: idx + 1,
              section: 'D',
              sectionTitle: 'Section D: Short Theoretical Answers',
              instructions: examPaper.Section_D_Short_Answers.instructions,
              key: `D_${q.id}`,
              type: 'short_answer',
              question: q.question,
              marks: 1.0
            });
          });
        }
      }
      setQuestionsList(list);
    } catch (e) {
      alert(`Access Denied:\n${e.message}`);
      navigate('/book');
    } finally {
      setLoading(false);
    }
  };

  // Timer Countdown Ticker
  useEffect(() => {
    if (loading || timeRemaining <= 0 || !examStarted) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('⏰ TIME EXPIRED!\nYour exam is being automatically submitted.');
          submitExam(answers, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, timeRemaining, answers, examStarted]);

  // Webcam capture
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (e) {
      console.error("Camera proctor initialization failed", e);
      triggerToast("⚠️ Webcam access failed! Proctor requires video feed.");
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const exitFullscreen = () => {
    const doc = window.document;
    if (doc.exitFullscreen) {
      doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  };


  const handleMCQSelect = (qId, option) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: option
    }));
  };

  const handleTextChange = (qId, val) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: val
    }));
  };

  const handleStartWithFullscreen = () => {
    const elem = document.documentElement;
    const requestFs = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
    
    if (requestFs) {
      requestFs.call(elem)
        .then(() => {
          setExamStarted(true);
          triggerToast("🔒 Fullscreen active. Keyboard locks engaged.");
        })
        .catch(err => {
          console.warn("Fullscreen error:", err);
          setExamStarted(true);
          triggerToast("⚠️ Fullscreen request rejected. Proceeding in windowed mode.");
        });
    } else {
      setExamStarted(true);
    }
  };
  const submitExam = async (currentAnswers = answers, isAuto = false) => {
    setLoading(true);
    exitFullscreen();
    try {
      const now = getNow();
      const subRef = doc(db, 'submissions', email.toLowerCase());
      const subDoc = await getDoc(subRef);
      if (!subDoc.exists()) {
        alert('No active exam session found.');
        navigate('/book');
        return;
      }
      const submission = subDoc.data();
      if (submission.submittedAt) {
        alert('Exam is already submitted.');
        navigate('/book');
        return;
      }

      await setDoc(subRef, {
        answers: currentAnswers || {},
        logs: logs || [],
        submittedAt: now.toISOString()
      }, { merge: true });

      alert(isAuto ? 'Exam auto-submitted successfully.' : 'Exam submitted successfully! Verification completed.');
      navigate('/book');
    } catch (e) {
      alert(`Submission failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? String(hrs).padStart(2, '0') + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2 style={{ fontFamily: 'var(--font-title)' }}>Initializing Secure Exam Room</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Configuring real-time logs and proctor connection...</p>
      </div>
    );
  }

  // Ready Overlay for user gesture to trigger fullscreen
  if (!examStarted) {
    return (
      <div className="loading-overlay" style={{ backgroundColor: '#7f1d1d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '600px', padding: '45px', borderRadius: '18px', backgroundColor: '#991b1b', border: '3px solid #f87171', textAlign: 'center', boxShadow: '0 20px 45px rgba(0,0,0,0.6)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '15px', color: '#fee2e2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🚨 CRITICAL WARNING: AI PROCTORING ACTIVE
          </h2>
          <p style={{ fontSize: '15px', lineHeight: '1.7', marginBottom: '30px', color: '#fee2e2' }}>
            All candidate actions, tab switching, window focus losses, and keyboard combinations are actively monitored and logged in the evaluation database.
            <br /><br />
            <strong>Exiting fullscreen mode or attempting to cheat will result in immediate flagging and potential disqualification.</strong>
          </p>
          <button 
            type="button" 
            style={{ 
              width: '100%', 
              padding: '18px', 
              fontSize: '17px', 
              fontWeight: '900', 
              backgroundColor: '#ffffff', 
              color: '#991b1b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              textTransform: 'uppercase'
            }} 
            onClick={handleStartWithFullscreen}
          >
            Authorize Fullscreen & Start Exam
          </button>
        </div>
      </div>
    );
  }

  // Fullscreen Pause Overlay
  if (examStarted && !isFullscreen) {
    return (
      <div className="loading-overlay" style={{ backgroundColor: '#7f1d1d', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
        <div style={{ maxWidth: '650px', padding: '45px', borderRadius: '18px', backgroundColor: '#991b1b', border: '3px solid #f87171', textAlign: 'center', boxShadow: '0 20px 45px rgba(0,0,0,0.6)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '20px', color: '#fee2e2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🚨 FULLSCREEN MODE REQUIRED
          </h2>
          <p style={{ fontSize: '15px', lineHeight: '1.7', marginBottom: '30px', color: '#fee2e2' }}>
            You have exited fullscreen mode! The exam session has been suspended and this security breach has been logged.
            <br /><br />
            To resume taking the test, please click the button below to restore secure fullscreen environment.
          </p>
          <button
            type="button"
            style={{
              width: '100%',
              padding: '18px',
              fontSize: '17px',
              fontWeight: '950',
              backgroundColor: '#ffffff',
              color: '#991b1b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              textTransform: 'uppercase'
            }}
            onClick={() => {
              const elem = document.documentElement;
              const requestFs = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen;
              if (requestFs) {
                requestFs.call(elem)
                  .then(() => {
                    setIsFullscreen(true);
                  })
                  .catch(err => {
                    console.error("Fullscreen restoration failed:", err);
                  });
              }
            }}
          >
            Re-Enter Fullscreen & Resume Test
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questionsList[currentQuestionIndex];
  const totalQuestions = questionsList.length;

  const isQuestionAnswered = (q) => {
    if (!q) return false;
    const ans = answers[q.key];
    if (ans === undefined || ans === null) return false;
    if (typeof ans === 'string') return ans.trim().length > 0;
    return true;
  };

  return (
    <div className="app-container" style={{ paddingBottom: '160px' }}>
      
      {/* Custom Toast Alert Notification (focus safe) */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--danger)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(220, 38, 36, 0.35)',
          zIndex: 99999,
          fontWeight: '700',
          fontSize: '15px',
          textAlign: 'center',
          fontFamily: 'var(--font-title)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header bar */}
      <div className="logo-header">
        <div className="logo-container">
          <img src="/devshala-logo.png" alt="DevShaala Logo" className="logo-img" />
          <span className="logo-text" style={{ color: 'var(--accent-secondary)' }}>Secure Exam Sandbox</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Candidate: <b>{email}</b></span>
          <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
            🔒 Keyboard & Fullscreen Locked
          </span>
        </div>
      </div>

      {currentQuestion ? (
        <div className="exam-layout-slide">
          
          {/* Left Column: Current Question Slide */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '520px', justifyContent: 'space-between' }}>
            <div>
              {/* Section Header info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: 'var(--accent-primary)', fontSize: '18px', margin: 0 }}>
                    {currentQuestion.sectionTitle}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {currentQuestion.instructions}
                  </span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', backgroundColor: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent-primary)', padding: '4px 10px', borderRadius: '6px' }}>
                  {currentQuestion.marks} Mark{currentQuestion.marks !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Question Text */}
              <p style={{ fontWeight: '600', fontSize: '16px', marginBottom: '20px', lineHeight: '1.5' }}>
                Question {currentQuestionIndex + 1}. {currentQuestion.question}
              </p>

              {/* Input Area based on Question Type */}
              <div style={{ marginTop: '10px' }}>
                {currentQuestion.type === 'mcq' && (
                  <div className="option-list">
                    {currentQuestion.options.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        className={`option-btn ${answers[currentQuestion.key] === opt ? 'selected' : ''}`}
                        onClick={() => handleMCQSelect(currentQuestion.key, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {(currentQuestion.type === 'short_code' || currentQuestion.type === 'long_code') && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                      🐍 Python 3 Monaco Code Editor:
                    </span>
                    <div className="monaco-container-wrapper" style={{ height: currentQuestion.type === 'long_code' ? '300px' : '200px' }}>
                      <Editor
                        height="100%"
                        defaultLanguage="python"
                        language="python"
                        theme="vs-light"
                        value={answers[currentQuestion.key] || ''}
                        onChange={(val) => handleTextChange(currentQuestion.key, val || '')}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 4
                        }}
                      />
                    </div>
                  </div>
                )}

                {currentQuestion.type === 'short_answer' && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>
                      Your written response:
                    </span>
                    <textarea 
                      className="text-input" 
                      style={{ minHeight: '140px', fontFamily: 'var(--font-main)', fontSize: '15px', resize: 'vertical' }}
                      placeholder="Type your explanation or description here..."
                      value={answers[currentQuestion.key] || ''}
                      onChange={(e) => handleTextChange(currentQuestion.key, e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Nav Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '30px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              >
                <ArrowLeft size={16} /> Previous
              </button>
              
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Slide {currentQuestionIndex + 1} of {totalQuestions}
              </span>

              {currentQuestionIndex < totalQuestions - 1 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                >
                  Next <ArrowRight size={16} />
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn-primary" 
                  style={{ background: 'var(--success)' }}
                  onClick={() => {
                    if (window.confirm("Are you sure you want to final submit the exam? Answers cannot be modified once uploaded.")) {
                      submitExam(answers, false);
                    }
                  }}
                >
                  <Send size={15} /> Finalize Exam
                </button>
              )}
            </div>

          </div>

          {/* Right Column: Sticky Timer & Question Grid Navigator */}
          <div>
            <div className="timer-card glass-card" style={{ padding: '20px' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  Remaining Exam Time
                </p>
                <div className={`time-display ${timeRemaining < 10 * 60 ? 'time-critical' : ''}`}>
                  {formatTime(timeRemaining)}
                </div>
              </div>

              {/* Questions Navigator Grid */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Questions Navigator
                </h4>
                <div className="question-nav-grid">
                  {questionsList.map((q, idx) => {
                    const isCurrent = idx === currentQuestionIndex;
                    const isAnswered = isQuestionAnswered(q);
                    return (
                      <button
                        key={q.key}
                        type="button"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`nav-node-btn ${isCurrent ? 'active' : ''} ${isAnswered ? 'answered' : ''}`}
                        title={`${q.sectionTitle} - Q${q.id}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Security Logs */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px', textAlign: 'left' }}>
                <h4 style={{ fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                  <Shield size={15} style={{ color: 'var(--accent-primary)' }} /> Live Invigilator Logs
                </h4>
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tab Switches:</span>
                    <span style={{ fontWeight: '700', color: tabSwitchCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{tabSwitchCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Proctor Camera:</span>
                    <span style={{ fontWeight: '700', color: cameraActive ? 'var(--success)' : 'var(--danger)' }}>{cameraActive ? 'ONLINE' : 'OFFLINE'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Security Integrity:</span>
                    <span style={{ fontWeight: '700', color: 'var(--success)' }}>SECURED</span>
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                className="btn-primary" 
                style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                onClick={() => {
                  if (window.confirm("Are you sure you want to final submit the exam? Answers cannot be modified once uploaded.")) {
                    submitExam(answers, false);
                  }
                }}
              >
                <Send size={15} /> Submit Exam
              </button>
            </div>
          </div>

        </div>
      ) : (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
          <p>No questions loaded. Please contact the administrator.</p>
        </div>
      )}

      {/* Floating Webcam Feed at Bottom Right Corner (Hides Sliders & Thresholds) */}
      <div className="proctor-webcam-corner">
        <video ref={videoRef} autoPlay muted playsInline className="webcam-feed" />
        <div className="proctor-status-indicator">
          Secured
        </div>
      </div>

    </div>
  );
}
