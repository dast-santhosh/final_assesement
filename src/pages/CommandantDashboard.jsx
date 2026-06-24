import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { Users, FileText, CheckCircle, Mail, Send, Award, ArrowLeft, Shield } from 'lucide-react';

const sendSmtpEmail = (emailConfig) => {
  return new Promise((resolve, reject) => {
    try {
      const config = {
        ...emailConfig,
        nocache: Math.floor(1e6 * Math.random() + 1),
        Action: "Send"
      };
      const payload = JSON.stringify(config);
      
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://smtpjs.com/v3/smtpjs.aspx?", true);
      xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      xhr.onload = function () {
        resolve(xhr.responseText);
      };
      xhr.onerror = function (e) {
        reject(new Error("Network error occurred during SMTP request"));
      };
      xhr.send(payload);
    } catch (err) {
      reject(err);
    }
  });
};

export default function CommandantDashboard() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [questionsData, setQuestionsData] = useState(null);
  const [questionsList, setQuestionsList] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Grading inputs
  const [questionGrades, setQuestionGrades] = useState({});
  const [feedback, setFeedback] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Email simulation modals
  const [dispatchedEmails, setDispatchedEmails] = useState([]);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // 1. Fetch questions client-side from the public folder
      const questionsRes = await fetch('/questions.json');
      if (!questionsRes.ok) {
        throw new Error('Failed to load questions.json');
      }
      const questions = await questionsRes.json();
      setQuestionsData(questions);

      // 2. Fetch all submissions from Firestore
      const submissionsSnap = await getDocs(collection(db, 'submissions'));
      const list = [];
      submissionsSnap.forEach(docSnap => {
        list.push(docSnap.data());
      });
      setSubmissions(list);
    } catch (e) {
      alert('Failed to load submissions. Please check your network connection.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (questionsData) {
      const examPaper = questionsData.exam_paper;
      const list = [];
      if (examPaper) {
        if (examPaper.Section_A_MCQs?.questions) {
          examPaper.Section_A_MCQs.questions.forEach((q, idx) => {
            list.push({
              id: q.id,
              index: idx + 1,
              section: 'A',
              sectionTitle: 'Section A: Multiple Choice Questions',
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
              key: `D_${q.id}`,
              type: 'short_answer',
              question: q.question,
              marks: 1.0
            });
          });
        }
      }
      setQuestionsList(list);
    }
  }, [questionsData]);

  const handleSelectSubmission = (sub) => {
    setSelectedSub(sub);
    setFeedback(sub.feedback || '');
    
    // Load question grades from selection or auto-initialize them
    const grades = {};
    const examPaper = questionsData?.exam_paper;
    
    if (examPaper) {
      const list = [];
      if (examPaper.Section_A_MCQs?.questions) {
        examPaper.Section_A_MCQs.questions.forEach(q => list.push({ key: `A_${q.id}`, type: 'mcq', correct_answer: q.correct_answer }));
      }
      if (examPaper.Section_B_Programs?.questions) {
        examPaper.Section_B_Programs.questions.forEach(q => list.push({ key: `B_${q.id}`, type: 'short_code' }));
      }
      if (examPaper.Section_C_Long_Programs?.questions) {
        examPaper.Section_C_Long_Programs.questions.forEach(q => list.push({ key: `C_${q.id}`, type: 'long_code' }));
      }
      if (examPaper.Section_D_Short_Answers?.questions) {
        examPaper.Section_D_Short_Answers.questions.forEach(q => list.push({ key: `D_${q.id}`, type: 'short_answer' }));
      }

      list.forEach(q => {
        if (sub.questionGrades && sub.questionGrades[q.key] !== undefined) {
          grades[q.key] = sub.questionGrades[q.key];
        } else {
          // Auto-grade MCQs to make grading faster
          if (q.type === 'mcq') {
            const studentAns = sub.answers[q.key];
            grades[q.key] = (studentAns === q.correct_answer) ? 0.5 : 0;
          } else {
            grades[q.key] = 0; // Default others to 0 marks initially
          }
        }
      });
    }
    setQuestionGrades(grades);
  };

  const handleGradeChange = (key, val, maxLimit) => {
    const num = Math.min(Math.max(Number(val) || 0, 0), maxLimit);
    setQuestionGrades(prev => ({
      ...prev,
      [key]: num
    }));
  };

  const getLiveTotalMarks = () => {
    let total = 0;
    Object.values(questionGrades).forEach(g => {
      total += Number(g) || 0;
    });
    return Math.round(total * 100) / 100;
  };
  const handleSaveGrade = async (e) => {
    e.preventDefault();
    if (!selectedSub) return;
    
    setSavingGrade(true);
    try {
      const qGrades = questionGrades || {};
      let totalMarks = 0;
      Object.values(qGrades).forEach(val => {
        totalMarks += Number(val) || 0;
      });

      const updatedSub = {
        ...selectedSub,
        questionGrades: qGrades,
        marks: Math.round(totalMarks * 100) / 100,
        feedback: feedback || ""
      };

      const subRef = doc(db, 'submissions', selectedSub.email.toLowerCase());
      await setDoc(subRef, updatedSub);
      
      alert('Grades saved successfully!');
      
      // Update local state
      setSubmissions(prev => prev.map(s => s.email.toLowerCase() === selectedSub.email.toLowerCase() ? updatedSub : s));
      setSelectedSub(updatedSub);
    } catch (err) {
      alert(`Failed to save grades: ${err.message}`);
    } finally {
      setSavingGrade(false);
    }
  };

  const handlePublishResults = async () => {
    if (submissions.some(s => s.marks === null)) {
      if (!window.confirm("WARNING: There are ungraded submissions. Unfinished candidates will not receive passcodes. Proceed to publish?")) {
        return;
      }
    }

    setPublishing(true);
    try {
      // 1. Publish global config to Firestore
      await setDoc(doc(db, 'config', 'global'), { resultsPublished: true });

      const EMAIL_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Final Exam Scores - DevShaala</title>
</head>
<body style="margin: 0; padding: 0; background-color: #e0e7ff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333333;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #e0e7ff; padding: 40px 10px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; max-width: 600px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <tr>
                        <td align="center" style="padding: 25px 20px; background-color: #ffffff; border-bottom: 2px solid #f3f4f6;">
                            <img src="https://i.ibb.co/5hLjp6qw/Dev-Shaala-Logo.png" alt="DevShaala Logo" style="max-height: 55px; display: block; margin-bottom: 10px;">
                            <p style="margin: 0; font-size: 14px; font-weight: bold; letter-spacing: 0.5px;">
                                <span style="color: #1e3a8a;">from DEVSHAALA</span> 
                                <span style="color: #9ca3af; font-weight: normal; margin: 0 5px;">~</span> 
                                <span style="color: #10b981;">under GTC</span>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Python MasterClass" style="width: 100%; max-height: 200px; object-fit: cover; display: block;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin-top: 0; color: #1e3a8a; font-size: 24px; text-align: center;">Python Masterclass Assessment</h2>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Hi <strong>$NAME</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Congratulations on successfully completing your <strong>Final Exam</strong>! Below is a detailed breakdown of your performance, reviewed by your mentor.</p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Please enter the following 16-digit passcode on the results portal to decrypt and download your official completion certificate:</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <span style="color: #ef4444; font-family: monospace; font-size: 20px; font-weight: bold; background: #fee2e2; padding: 10px 20px; border-radius: 6px; border: 1px dashed #fca5a5; display: inline-block; letter-spacing: 1px;">$PASSCODE</span>
                            </div>
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0; background-color: #f8fafc; border: 2px solid #bfdbfe; border-radius: 10px; overflow: hidden;">
                                <tr>
                                    <td align="center" style="background-color: #1e3a8a; padding: 20px; color: #ffffff;">
                                        <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd;">Total Score</p>
                                        <h1 style="margin: 5px 0 0 0; font-size: 48px;">$TOTAL</h1>
                                        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #10b981;">Grade: $GRADE</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 20px 30px;">
                                        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="font-size: 15px;">
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section A: MCQ Questionnaire</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$QUESTIONAIRRE</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section B: Core Programs</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$PROGRAM</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section C: Systems Scenario (Long Code)</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$PRESENTATION</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Section D: Theoretical Answers</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$EXPLANATION</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563;">Overall Impression</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold;">$OVERALL</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px 20px; margin-bottom: 30px;">
                                <p style="margin: 0; color: #065f46; font-size: 15px; font-style: italic;">
                                    <strong>Mentor's Remark:</strong> "$REMARKS"
                                </p>
                            </div>
                            <hr style="border: none; border-top: 1px dashed #cbd5e1; margin: 30px 0;">
                            <p style="font-size: 14px; font-weight: bold; color: #1e3a8a; margin-bottom: 10px;">Message summary for your records:</p>
                            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px;">
                                <p style="font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.6; color: #334155; margin: 0;">
                                    Name: $NAME<br>
                                    Batch Name: Python Masterclass Assessment<br>
                                    Exam Name: Final Theory & Practical Exam<br>
                                    --------------------------------------<br>
                                    MCQ Questionnaire: $QUESTIONAIRRE<br>
                                    Core Programs    : $PROGRAM<br>
                                    Systems Scenario : $PRESENTATION<br>
                                    Theory Answers   : $EXPLANATION<br>
                                    Overall          : $OVERALL<br>
                                    --------------------------------------<br>
                                    Total Marks      : $TOTAL<br>
                                    Grade            : $GRADE<br>
                                    Decryption Key   : $PASSCODE<br>
                                    Remarks          : $REMARKS<br>
                                    <br>
                                    Best Regards,<br>
                                    SANTHOSH<br>
                                    Mentor, DEVSHAALA
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="background-color: #1e3a8a; padding: 20px; color: #bfdbfe; font-size: 12px;">
                            <p style="margin: 0;">© 2026 DevShaala under GTC. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
                <div style="height: 40px;"></div>
            </td>
        </tr>
    </table>
</body>
</html>`;

      const dispatches = [];
      // 2. Loop over submissions and generate passcode if they are graded and don't have passcode yet
      for (const sub of submissions) {
        if (sub.marks !== null) {
          let passcode = sub.passcode;
          if (!passcode) {
            const p1 = Math.floor(1000 + Math.random() * 9000);
            const p2 = Math.floor(1000 + Math.random() * 9000);
            const p3 = Math.floor(1000 + Math.random() * 9000);
            const p4 = Math.floor(1000 + Math.random() * 9000);
            passcode = `${p1}-${p2}-${p3}-${p4}`;

            const updatedSub = {
              ...sub,
              passcode,
              published: true
            };

            await setDoc(doc(db, 'submissions', sub.email.toLowerCase()), updatedSub);
          }

          // Calculate section totals
          let marksMcq = 0;
          let marksPrograms = 0;
          let marksLongPrograms = 0;
          let marksShortAnswers = 0;

          const qGrades = sub.questionGrades || {};
          
          // Section A: MCQ (A_1 to A_20, 0.5 marks each)
          for (let i = 1; i <= 20; i++) {
            marksMcq += Number(qGrades[`A_${i}`]) || 0;
          }
          // Section B: Core Programs (B_1 to B_3, 3 marks each)
          for (let i = 1; i <= 3; i++) {
            marksPrograms += Number(qGrades[`B_${i}`]) || 0;
          }
          // Section C: Long Program (C_1, 6 marks)
          marksLongPrograms += Number(qGrades[`C_1`]) || 0;
          // Section D: Short Answers (D_1 to D_5, 1 mark each)
          for (let i = 1; i <= 5; i++) {
            marksShortAnswers += Number(qGrades[`D_${i}`]) || 0;
          }

          const marksTotal = sub.marks;
          let grade = "F";
          let overallImpression = "Needs Improvement";

          if (marksTotal >= 27) {
            grade = "A+";
            overallImpression = "Outstanding Performance";
          } else if (marksTotal >= 24) {
            grade = "A";
            overallImpression = "Excellent Performance";
          } else if (marksTotal >= 21) {
            grade = "B+";
            overallImpression = "Very Good";
          } else if (marksTotal >= 18) {
            grade = "B";
            overallImpression = "Good Effort";
          } else if (marksTotal >= 15) {
            grade = "C";
            overallImpression = "Satisfactory";
          } else {
            grade = "F";
            overallImpression = "Unsatisfactory / Fail";
          }

          dispatches.push({
            to: sub.email,
            from: 'devshaala@gmail.com',
            subject: `DevShaala Python Masterclass Exam Results - ${sub.name}`,
            passcode,
            status: 'Pending',
            studentName: sub.name,
            marksMcq: marksMcq.toFixed(1),
            marksPrograms: marksPrograms.toFixed(1),
            marksLongPrograms: marksLongPrograms.toFixed(1),
            marksShortAnswers: marksShortAnswers.toFixed(1),
            marksTotal: marksTotal.toFixed(1),
            grade,
            overallImpression,
            feedback: sub.feedback || 'None'
          });
        }
      }

      if (dispatches.length === 0) {
        alert('No graded submissions found to publish.');
        setPublishing(false);
        return;
      }

      // Initial loading state in modal
      setDispatchedEmails([{ 
        to: 'All Candidates', 
        from: 'system', 
        subject: 'Initializing Python WASM Compiler...', 
        body: 'Please wait while WebAssembly finishes loading the Python runtime...', 
        passcode: '----', 
        status: 'Loading WASM...' 
      }]);
      setShowEmailModal(true);

      // Load Pyodide WASM
      let pyodideInstance = window.pyodideInstance;
      if (!pyodideInstance) {
        try {
          pyodideInstance = await window.loadPyodide();
          window.pyodideInstance = pyodideInstance;
        } catch (err) {
          alert(`Failed to load Python WASM compiler: ${err.message}`);
          setShowEmailModal(false);
          setPublishing(false);
          return;
        }
      }

      // Reset logs modal with the parsed dispatches list
      setDispatchedEmails(dispatches);

      // 3. Dispatch real emails via SMTP.js sequentially to update status progressively
      const updatedDispatches = [...dispatches];
      for (let i = 0; i < updatedDispatches.length; i++) {
        const d = updatedDispatches[i];
        updatedDispatches[i] = { ...d, status: 'Compiling in Python...' };
        setDispatchedEmails([...updatedDispatches]);

        try {
          // Set variables in Pyodide namespace
          pyodideInstance.globals.set("student_name", d.studentName);
          pyodideInstance.globals.set("marks_mcq", d.marksMcq);
          pyodideInstance.globals.set("marks_programs", d.marksPrograms);
          pyodideInstance.globals.set("marks_long_programs", d.marksLongPrograms);
          pyodideInstance.globals.set("marks_short_answers", d.marksShortAnswers);
          pyodideInstance.globals.set("marks_total", d.marksTotal);
          pyodideInstance.globals.set("grade", d.grade);
          pyodideInstance.globals.set("overall_impression", d.overallImpression);
          pyodideInstance.globals.set("feedback", d.feedback);
          pyodideInstance.globals.set("passcode", d.passcode);

          // Execute template replacement in Python
          const pythonCode = `
from string import Template

template = Template("""${EMAIL_HTML_TEMPLATE}""")
personalized_html = template.safe_substitute(
    NAME=student_name,
    PROGRAM=f"{marks_programs}/9.0",
    PRESENTATION=f"{marks_long_programs}/6.0",
    EXPLANATION=f"{marks_short_answers}/5.0",
    QUESTIONAIRRE=f"{marks_mcq}/10.0",
    OVERALL=overall_impression,
    TOTAL=f"{marks_total}/30.0",
    GRADE=grade,
    REMARKS=feedback,
    PASSCODE=passcode
)
personalized_html
`;
          const htmlBody = pyodideInstance.runPython(pythonCode);

          updatedDispatches[i] = { ...d, status: 'Sending...' };
          setDispatchedEmails([...updatedDispatches]);

          const response = await sendSmtpEmail({
            Host: "smtp.gmail.com",
            Username: "devshaala@gmail.com",
            Password: "cdoyctvndvvsrafv", // password without spaces
            To: d.to,
            From: "devshaala@gmail.com",
            Subject: d.subject,
            Body: htmlBody
          });

          if (response === 'OK') {
            updatedDispatches[i] = { ...d, status: 'Sent Successfully', body: 'HTML compiled via Python WASM and sent successfully.' };
          } else {
            updatedDispatches[i] = { ...d, status: `Failed: ${response}` };
          }
        } catch (err) {
          updatedDispatches[i] = { ...d, status: `Error: ${err.message}` };
        }
        setDispatchedEmails([...updatedDispatches]);
      }

      alert('Results published and email dispatch process completed!');
      
      // Reload submissions from database
      await fetchSubmissions();
    } catch (e) {
      alert(`Failed to publish: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <h2 style={{ fontFamily: 'var(--font-title)' }}>Security Console Loading</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Warming teacher security records...</p>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: '1400px' }}>
      
      {/* Header bar */}
      <div className="logo-header">
        <div className="logo-container">
          <img src="/devshala-logo.png" alt="DevShaala Logo" className="logo-img" />
          <span className="logo-text" style={{ color: 'var(--danger)' }}>Teacher Security Command Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => navigate('/')}
          >
            <ArrowLeft size={14} /> Back to Login
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <div>
          <h2 style={{ fontSize: '26px' }}>Academic Invigilator Summary</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Grade student answers and review secure proctoring infraction logs.
          </p>
        </div>
        <button 
          onClick={handlePublishResults} 
          className="btn-primary" 
          style={{ background: 'var(--accent-gradient)', padding: '12px 24px' }}
          disabled={publishing || submissions.length === 0}
        >
          <Send size={15} /> Publish Results (Send Emails)
        </button>
      </div>

      {/* Main Grid View */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '25px', alignItems: 'start' }}>
        
        {/* Left Side: Candidates List */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} className="text-blue-400" /> Candidates ({submissions.length})
          </h3>
          {submissions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '20px 0' }}>No submissions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {submissions.map(sub => {
                const totalViolations = sub.logs?.filter(l => l.type !== 'Session Start')?.length || 0;
                return (
                  <button
                    key={sub.email}
                    className={`option-btn ${selectedSub?.email === sub.email ? 'selected' : ''}`}
                    onClick={() => handleSelectSubmission(sub)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px' }}
                  >
                    <div style={{ textAlign: 'left', minWidth: '0' }}>
                      <p style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{sub.email}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {sub.marks !== null ? (
                        <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700' }}>{sub.marks}/30</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700' }}>Ungraded</span>
                      )}
                      <p style={{ fontSize: '10px', color: totalViolations > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {totalViolations} alerts
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Grading Sheet & Proctor Audit */}
        {selectedSub ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Candidate Header & Grade Editor */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', alignItems: 'start', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', color: 'var(--text-primary)' }}>{selectedSub.name}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Email: {selectedSub.email}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Started: {new Date(selectedSub.startedAt).toLocaleString()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--accent-primary)' }}>
                    Total Score: {getLiveTotalMarks()} / 30
                  </div>
                  {selectedSub.passcode && (
                    <div style={{ padding: '6px 12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px dashed var(--accent-primary)', borderRadius: '10px', marginTop: '5px' }}>
                      <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Passcode: </span>
                      <b style={{ color: 'var(--text-primary)', fontSize: '12px', letterSpacing: '0.5px' }}>{selectedSub.passcode}</b>
                    </div>
                  )}
                </div>
              </div>

              {/* Grading Form */}
              <form onSubmit={handleSaveGrade} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Overall Teacher Feedback</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="Enter final summary feedback here..." 
                    value={feedback} 
                    onChange={e => setFeedback(e.target.value)}
                  />
                </div>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={savingGrade}
                  style={{ width: '100%', height: '48px' }}
                >
                  {savingGrade ? 'Saving Grade...' : 'Save Evaluated Score (Out of 30)'}
                </button>
              </form>
            </div>

            {/* Invigilator Logs */}
            <div className="glass-card">
              <h3 style={{ fontSize: '16px', marginBottom: '15px', color: 'var(--accent-primary)' }}>
                Proctor Security Logs & Infractions
              </h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-secondary)', padding: '15px' }}>
                {selectedSub.logs?.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No security alerts recorded. Clean session.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px' }}>Timestamp</th>
                        <th style={{ padding: '8px' }}>Log Type</th>
                        <th style={{ padding: '8px' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSub.logs.map((log, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td style={{ padding: '8px', fontWeight: '600', color: log.type === 'Tab Switch' ? 'var(--danger)' : 'var(--warning)' }}>
                            {log.type}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                            {log.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Student Answers Sheet (Unified Question list) */}
            <div className="glass-card">
              <h3 style={{ fontSize: '17px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--accent-secondary)' }}>
                Evaluate Answers Question-by-Question
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {questionsList.map((q) => {
                  const studentAns = selectedSub.answers[q.key];
                  const currentGrade = questionGrades[q.key] !== undefined ? questionGrades[q.key] : 0;
                  
                  return (
                    <div key={q.key} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '15px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '700', textTransform: 'uppercase' }}>
                          Question {q.index} ({q.sectionTitle})
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          Max Weight: {q.marks} Mark{q.marks !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Question prompt */}
                      <p style={{ fontWeight: '600', fontSize: '14.5px', marginBottom: '10px', color: 'var(--text-primary)' }}>
                        {q.question}
                      </p>

                      {/* Correct answer if MCQ */}
                      {q.type === 'mcq' && (
                        <p style={{ fontSize: '12.5px', color: 'var(--success)', marginBottom: '8px', fontWeight: '500' }}>
                          ✓ Correct Answer Key: <b>{q.correct_answer}</b>
                        </p>
                      )}

                      {/* Student response box */}
                      <div style={{ marginTop: '5px', marginBottom: '15px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>
                          Candidate's Submission:
                        </span>
                        {studentAns ? (
                          <pre style={{ 
                            background: 'var(--bg-primary)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '8px', 
                            padding: '12px', 
                            fontSize: '13px', 
                            fontFamily: q.type.includes('code') ? 'monospace' : 'inherit',
                            color: 'var(--text-primary)',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '220px',
                            overflowY: 'auto'
                          }}>
                            {studentAns}
                          </pre>
                        ) : (
                          <div style={{ padding: '8px', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px' }}>
                            (No answer submitted)
                          </div>
                        )}
                      </div>

                      {/* Mark Grading Control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                          Assign Score:
                        </span>

                        {q.type === 'mcq' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className={`btn-secondary ${currentGrade === 0 ? 'selected' : ''}`}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                borderRadius: '6px', 
                                background: currentGrade === 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-secondary)',
                                borderColor: currentGrade === 0 ? 'var(--danger)' : 'var(--border-color)',
                                color: currentGrade === 0 ? 'var(--danger)' : 'var(--text-primary)',
                                fontWeight: currentGrade === 0 ? '700' : '500'
                              }}
                              onClick={() => handleGradeChange(q.key, 0, q.marks)}
                            >
                              0.0 (Incorrect)
                            </button>
                            <button
                              type="button"
                              className={`btn-secondary ${currentGrade === 0.5 ? 'selected' : ''}`}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                borderRadius: '6px', 
                                background: currentGrade === 0.5 ? 'rgba(5, 150, 105, 0.1)' : 'var(--bg-secondary)',
                                borderColor: currentGrade === 0.5 ? 'var(--success)' : 'var(--border-color)',
                                color: currentGrade === 0.5 ? 'var(--success)' : 'var(--text-primary)',
                                fontWeight: currentGrade === 0.5 ? '700' : '500'
                              }}
                              onClick={() => handleGradeChange(q.key, 0.5, q.marks)}
                            >
                              0.5 (Correct)
                            </button>
                          </div>
                        ) : q.type === 'short_answer' ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className={`btn-secondary ${currentGrade === 0 ? 'selected' : ''}`}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                borderRadius: '6px',
                                background: currentGrade === 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--bg-secondary)',
                                borderColor: currentGrade === 0 ? 'var(--danger)' : 'var(--border-color)',
                                color: currentGrade === 0 ? 'var(--danger)' : 'var(--text-primary)',
                                fontWeight: currentGrade === 0 ? '700' : '500'
                              }}
                              onClick={() => handleGradeChange(q.key, 0, q.marks)}
                            >
                              0
                            </button>
                            <button
                              type="button"
                              className={`btn-secondary ${currentGrade === 1 ? 'selected' : ''}`}
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                borderRadius: '6px',
                                background: currentGrade === 1 ? 'rgba(5, 150, 105, 0.1)' : 'var(--bg-secondary)',
                                borderColor: currentGrade === 1 ? 'var(--success)' : 'var(--border-color)',
                                color: currentGrade === 1 ? 'var(--success)' : 'var(--text-primary)',
                                fontWeight: currentGrade === 1 ? '700' : '500'
                              }}
                              onClick={() => handleGradeChange(q.key, 1, q.marks)}
                            >
                              1
                            </button>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Or custom:</span>
                            <input 
                              type="number" 
                              step="0.1" 
                              style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                              value={currentGrade}
                              onChange={(e) => handleGradeChange(q.key, e.target.value, q.marks)}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input 
                              type="number" 
                              step="0.5" 
                              style={{ width: '80px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                              value={currentGrade}
                              onChange={(e) => handleGradeChange(q.key, e.target.value, q.marks)}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              (0 to {q.marks})
                            </span>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        ) : (
          <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '15px' }} />
            <h3>Select a candidate from the list to grade and review.</h3>
          </div>
        )}

      </div>

      {/* Simulated Email Cards Overlay Modal */}
      {showEmailModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', background: 'var(--bg-secondary)' }}>
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={22} /> Results Email Dispatch Log
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                The following mock email cards representing verification letters have been successfully triggered.
              </p>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {dispatchedEmails.map((email, idx) => (
                <div key={idx} className="email-sim-card">
                  <div className="email-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="email-meta"><b>From:</b> {email.from}</div>
                      <div className="email-meta"><b>To:</b> {email.to}</div>
                      <div className="email-meta"><b>Subject:</b> {email.subject}</div>
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: email.status === 'Sent Successfully' ? 'rgba(74, 222, 128, 0.2)' : 
                                  email.status === 'Sending...' ? 'rgba(250, 204, 21, 0.2)' : 
                                  email.status?.startsWith('Failed') || email.status?.startsWith('Error') ? 'rgba(248, 113, 113, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                      color: email.status === 'Sent Successfully' ? 'rgb(74, 222, 128)' : 
                             email.status === 'Sending...' ? 'rgb(250, 204, 21)' : 
                             email.status?.startsWith('Failed') || email.status?.startsWith('Error') ? 'rgb(248, 113, 113)' : 'rgb(156, 163, 175)',
                      border: `1px solid ${
                        email.status === 'Sent Successfully' ? 'rgba(74, 222, 128, 0.4)' : 
                        email.status === 'Sending...' ? 'rgba(250, 204, 21, 0.4)' : 
                        email.status?.startsWith('Failed') || email.status?.startsWith('Error') ? 'rgba(248, 113, 113, 0.4)' : 'rgba(156, 163, 175, 0.4)'
                      }`
                    }}>
                      {email.status || 'Pending'}
                    </div>
                  </div>
                  <div className="email-body">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{email.body}</p>
                    <div className="email-passcode-box">
                      {email.passcode}
                    </div>
                  </div>
                </div>
              ))}
              {dispatchedEmails.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No emails were generated (make sure you graded at least one candidate!).</p>
              )}
            </div>

            <button 
              onClick={() => setShowEmailModal(false)} 
              className="btn-primary" 
              style={{ marginTop: '25px', width: '120px' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
