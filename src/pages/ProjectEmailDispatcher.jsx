import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Terminal, Code, FileSpreadsheet, Play, CheckCircle, AlertCircle, Eye, RefreshCw } from 'lucide-react';

const PYTHON_SCRIPT_DISPLAY = `import csv
import io
import js
from string import Template

HTML_TEMPLATE = """[Beautiful HTML Scorecard Template]"""

async def run_dispatch(csv_content, sender_email, app_password):
    template = Template(HTML_TEMPLATE)
    js.on_python_log("Python WASM Kernel Ready...")
    js.on_python_log("Authenticated successfully with SMTP server.")
    
    f = io.StringIO(csv_content)
    reader = csv.DictReader(f)
    
    for row in reader:
        # Standardize keys to uppercase for robustness
        row_upper = {k.upper().strip(): v for k, v in row.items()}
        
        name = row_upper.get("NAME", "Student").strip()
        recipient_email = row_upper.get("EMAIL", "").strip()
        
        # Render HTML scorecard
        personalized_html = template.safe_substitute(
            NAME=name,
            PROGRAM=row_upper.get("PROGRAM", "0").strip(),
            PRESENTATION=row_upper.get("PRESENTATION", "0").strip(),
            EXPLANATION=row_upper.get("EXPLANATION", "0").strip(),
            QUESTIONAIRRE=row_upper.get("QUESTIONAIRRE", row_upper.get("QUESTIONNAIRE", "0")).strip(),
            OVERALL=row_upper.get("OVERALL", "0").strip(),
            TOTAL=row_upper.get("TOTAL", "0").strip(),
            GRADE=row_upper.get("GRADE", "N/A").strip(),
            REMARKS=row_upper.get("REMARKS", "").strip()
        )
        
        # Register generated email with JS UI
        js.on_email_generated(name, recipient_email, personalized_html)
        
        if recipient_email:
            js.on_python_log(f"📧 Dispatching email to {name} ({recipient_email})...")
            # Invoke the async JS SMTP.js wrapper
            success = await js.send_email_via_js(
                sender_email, 
                app_password, 
                recipient_email, 
                f"Python MasterClass Final Project Scores - {name}", 
                personalized_html
            )
            if success:
                js.on_python_log(f"✅ Sent successfully to {name}")
            else:
                js.on_python_log(f"❌ Failed to send to {name}")
        else:
            js.on_python_log(f"⚠️ No email address found for {name}, generated scorecard only.")
            
    js.on_python_log("🎉 Dispatch process complete!")`;

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Final Project Scores - DevShaala</title>
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
                            <h2 style="margin-top: 0; color: #1e3a8a; font-size: 24px; text-align: center;">Python MasterClass Batch I</h2>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Hi <strong>$NAME</strong>,</p>
                            <p style="font-size: 16px; line-height: 1.6; color: #4b5563;">Congratulations on successfully completing your <strong>Final Project</strong>! Below is a detailed breakdown of your performance, reviewed by your mentor.</p>

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
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Program</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$PROGRAM</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Presentation</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$PRESENTATION</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Explanation</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$EXPLANATION</td>
                                            </tr>
                                            <tr>
                                                <td style="color: #4b5563; border-bottom: 1px solid #e2e8f0;">Questionnaire</td>
                                                <td align="right" style="color: #1e3a8a; font-weight: bold; border-bottom: 1px solid #e2e8f0;">$QUESTIONAIRRE</td>
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
                                    Batch Name: Python MasterClass Batch I<br>
                                    Project Name: Final Project<br>
                                    --------------------------------------<br>
                                    Program Marks    : $PROGRAM<br>
                                    Presentation     : $PRESENTATION<br>
                                    Explanation      : $EXPLANATION<br>
                                    Questionnaire    : $QUESTIONAIRRE<br>
                                    Overall          : $OVERALL<br>
                                    --------------------------------------<br>
                                    Total Marks      : $TOTAL<br>
                                    Grade            : $GRADE<br>
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
                            <p style="margin: 0;">© 2024 DevShaala under GTC. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
                <div style="height: 40px;"></div>
            </td>
        </tr>
    </table>

</body>
</html>`;

export default function ProjectEmailDispatcher() {
  const navigate = useNavigate();
  const [pyodideLoaded, setPyodideLoaded] = useState(false);
  const [pyodideError, setPyodideError] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [senderEmail, setSenderEmail] = useState('devshaala@gmail.com');
  const [appPassword, setAppPassword] = useState('cdoyctvndvvsrafv');
  const [csvFile, setCsvFile] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [logs, setLogs] = useState([]);
  const [generatedEmails, setGeneratedEmails] = useState([]);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'code'
  
  // Preview modal states
  const [previewEmail, setPreviewEmail] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const terminalEndRef = useRef(null);
  const pyodideRef = useRef(null);

  // Auto scroll logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Load Pyodide on mount
  useEffect(() => {
    const initPyodide = async () => {
      if (window.loadPyodide) {
        setInitializing(true);
        try {
          // Initialize WebAssembly environment
          const py = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/'
          });
          pyodideRef.current = py;
          setPyodideLoaded(true);
        } catch (err) {
          console.error("Failed to load Pyodide kernel:", err);
          setPyodideError(err.message);
        } finally {
          setInitializing(false);
        }
      } else {
        setPyodideError("Pyodide script tag not detected. Please verify your internet connection and page configuration.");
      }
    };

    initPyodide();
  }, []);

  // Expose callbacks to global window for Python WASM runtime
  useEffect(() => {
    window.on_python_log = (msg) => {
      setLogs(prev => [...prev, msg]);
    };

    window.on_email_generated = (name, email, html) => {
      setGeneratedEmails(prev => {
        // Avoid duplicate additions
        if (prev.some(item => item.email === email)) {
          return prev.map(item => item.email === email ? { name, email, html, status: 'Pending' } : item);
        }
        return [...prev, { name, email, html, status: 'Pending' }];
      });
    };

    window.send_email_via_js = async (sender, password, recipient, subject, bodyHTML) => {
      // Update state in real-time
      setGeneratedEmails(prev => prev.map(e => e.email === recipient ? { ...e, status: 'Sending...' } : e));
      
      if (window.Email) {
        try {
          // Remove spaces from passcode
          const cleanPassword = password.replace(/\s+/g, '');
          const response = await window.Email.send({
            Host: "smtp.gmail.com",
            Username: sender,
            Password: cleanPassword,
            To: recipient,
            From: sender,
            Subject: subject,
            Body: bodyHTML
          });
          
          if (response === 'OK') {
            setGeneratedEmails(prev => prev.map(e => e.email === recipient ? { ...e, status: 'Sent Successfully' } : e));
            return true;
          } else {
            setGeneratedEmails(prev => prev.map(e => e.email === recipient ? { ...e, status: `Failed: ${response}` } : e));
            return false;
          }
        } catch (err) {
          setGeneratedEmails(prev => prev.map(e => e.email === recipient ? { ...e, status: `Error: ${err.message}` } : e));
          return false;
        }
      } else {
        setGeneratedEmails(prev => prev.map(e => e.email === recipient ? { ...e, status: 'Error: SMTP.js not loaded' } : e));
        return false;
      }
    };

    return () => {
      delete window.on_python_log;
      delete window.on_email_generated;
      delete window.send_email_via_js;
    };
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result);
      setLogs(prev => [...prev, `[System] Loaded CSV file: ${file.name} (${file.size} bytes)`]);
    };
    reader.readAsText(file);
  };

  const handleRunDispatcher = async () => {
    if (!pyodideRef.current || !csvContent) return;
    setRunning(true);
    setLogs([]);
    setGeneratedEmails([]);

    try {
      setLogs(prev => [...prev, "[WASM Kernel] Launching Python execution pipeline..."]);
      
      const py = pyodideRef.current;

      // Escape backslashes and triple quotes in template string
      const escapedTemplate = HTML_TEMPLATE.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
      
      // Inject python run script
      const pythonScript = `
import csv
import io
import js
from string import Template

HTML_TEMPLATE = """${escapedTemplate}"""

async def run_dispatch(csv_content, sender_email, app_password):
    template = Template(HTML_TEMPLATE)
    js.on_python_log("[Python WASM] Parsing scorecard records...")
    
    f = io.StringIO(csv_content)
    reader = csv.DictReader(f)
    
    count = 0
    for row in reader:
        # Standardize keys to uppercase to match template
        row_upper = {k.upper().strip(): v for k, v in row.items()}
        
        name = row_upper.get("NAME", "Student").strip()
        recipient_email = row_upper.get("EMAIL", "").strip()
        
        # Render HTML scorecard
        personalized_html = template.safe_substitute(
            NAME=name,
            PROGRAM=row_upper.get("PROGRAM", "0").strip(),
            PRESENTATION=row_upper.get("PRESENTATION", "0").strip(),
            EXPLANATION=row_upper.get("EXPLANATION", "0").strip(),
            QUESTIONAIRRE=row_upper.get("QUESTIONAIRRE", row_upper.get("QUESTIONNAIRE", "0")).strip(),
            OVERALL=row_upper.get("OVERALL", "0").strip(),
            TOTAL=row_upper.get("TOTAL", "0").strip(),
            GRADE=row_upper.get("GRADE", "N/A").strip(),
            REMARKS=row_upper.get("REMARKS", "").strip()
        )
        
        js.on_email_generated(name, recipient_email, personalized_html)
        
        if recipient_email:
            js.on_python_log(f"📧 Dispatching email to {name} ({recipient_email})...")
            # Await the JS SMTP.js callback wrapper
            success = await js.send_email_via_js(
                sender_email, 
                app_password, 
                recipient_email, 
                f"Python MasterClass Final Project Scores - {name}", 
                personalized_html
            )
            if success:
                js.on_python_log(f"✅ Sent successfully to {name}")
                count += 1
            else:
                js.on_python_log(f"❌ Failed to send to {name}")
        else:
            js.on_python_log(f"⚠️ No email address found for {name}, generated scorecard only.")
            
    js.on_python_log(f"\\n🎉 Process complete! Dispatched {count} scorecards.")
`;

      await py.runPythonAsync(pythonScript);
      
      const runDispatchPy = py.globals.get('run_dispatch');
      await runDispatchPy(csvContent, senderEmail, appPassword);
      
      alert("Scorecard emails successfully processed!");
    } catch (err) {
      console.error(err);
      setLogs(prev => [...prev, `[Python Crash] ${err.message}`]);
      alert(`Python execution encountered an error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '1400px' }}>
      
      {/* Header bar */}
      <div className="logo-header">
        <div className="logo-container">
          <img src="/devshala-logo.png" alt="DevShaala Logo" className="logo-img" />
          <span className="logo-text">Final Project WASM Scorecard Dispatcher</span>
        </div>
        <button 
          type="button" 
          className="btn-secondary" 
          style={{ padding: '8px 16px', fontSize: '13px' }}
          onClick={() => navigate('/commandant')}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>

      {/* Main Console Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '450px 1fr', gap: '25px', marginBottom: '25px', alignItems: 'start' }}>
        
        {/* Left Console Configuration Card */}
        <div className="glass-card" style={{ padding: '25px' }}>
          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Mail size={18} className="text-blue-500" /> Dispatcher Credentials
          </h3>

          <div className="input-group">
            <label className="input-label">Sender Gmail Account</label>
            <input 
              type="email" 
              className="text-input" 
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              disabled={running}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Gmail App Password</label>
            <input 
              type="password" 
              className="text-input" 
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="16-letter App Password"
              disabled={running}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Spaces are automatically ignored.
            </span>
          </div>

          <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '30px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <FileSpreadsheet size={18} className="text-emerald-500" /> Load Student CSV File
          </h3>

          <div style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '12px',
            padding: '25px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-secondary)',
            marginBottom: '25px',
            cursor: 'pointer',
            transition: 'border-color 0.2s ease',
            position: 'relative'
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) {
              setCsvFile(file);
              const reader = new FileReader();
              reader.onload = (event) => {
                setCsvContent(event.target.result);
                setLogs(prev => [...prev, `[System] Loaded CSV file via Drag&Drop: ${file.name}`]);
              };
              reader.readAsText(file);
            }
          }}
          >
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
              disabled={running}
            />
            <FileSpreadsheet size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <p style={{ fontSize: '14px', fontWeight: '600' }}>
              {csvFile ? csvFile.name : "Choose CSV File or Drop it here"}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Requires headers: NAME, EMAIL, TOTAL, Grade, Remarks
            </p>
          </div>

          {/* WebAssembly Loader Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            backgroundColor: pyodideLoaded ? 'rgba(16, 185, 129, 0.08)' : 'rgba(217, 119, 6, 0.08)',
            border: `1px solid ${pyodideLoaded ? 'rgba(16, 185, 129, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
            borderRadius: '12px',
            marginBottom: '25px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {initializing ? (
                <RefreshCw className="animate-spin text-amber-500" size={16} />
              ) : pyodideLoaded ? (
                <CheckCircle className="text-emerald-500" size={16} />
              ) : (
                <AlertCircle className="text-amber-500" size={16} />
              )}
              <span style={{ fontSize: '13px', fontWeight: '600' }}>
                {initializing ? "Initializing WASM Kernel..." : pyodideLoaded ? "Python WASM Core Loaded" : "WASM Core Pending"}
              </span>
            </div>
            {pyodideError && (
              <span style={{ fontSize: '11px', color: 'var(--danger)' }}>Kernel Error</span>
            )}
          </div>

          <button 
            onClick={handleRunDispatcher} 
            className="btn-primary" 
            style={{ width: '100%', padding: '15px' }}
            disabled={running || !pyodideLoaded || !csvContent}
          >
            <Play size={16} /> Run Python Email Dispatcher
          </button>
        </div>

        {/* Right Output Log & Code Preview Console */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '540px' }}>
          
          {/* Tab Selector bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            padding: '0 20px'
          }}>
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                padding: '15px 20px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '700',
                color: activeTab === 'logs' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'logs' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Terminal size={14} /> Execution Console Log
            </button>
            <button
              onClick={() => setActiveTab('code')}
              style={{
                padding: '15px 20px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '700',
                color: activeTab === 'code' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'code' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Code size={14} /> Python Source Code (WASM Runtime)
            </button>
          </div>

          {/* Tab Content Panels */}
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px', padding: '20px' }}>
            {activeTab === 'logs' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {logs.map((log, index) => (
                  <div key={index} style={{ 
                    whiteSpace: 'pre-wrap', 
                    color: log.startsWith('❌') || log.includes('[Python Crash]') ? '#f87171' : 
                           log.startsWith('✅') || log.startsWith('🎉') ? '#4ade80' : 
                           log.startsWith('📧') ? '#60a5fa' : 
                           log.startsWith('⚠️') ? '#fbbf24' : '#e2e8f0'
                  }}>
                    {log}
                  </div>
                ))}
                {logs.length === 0 && (
                  <div style={{ color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                    Console Idle. Click "Run Python Email Dispatcher" to execute script.
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            ) : (
              <pre style={{ margin: 0, overflowX: 'auto', color: '#38bdf8', whiteSpace: 'pre-wrap', fontFamily: 'monospace', lineHeight: '1.5' }}>
                {PYTHON_SCRIPT_DISPLAY}
              </pre>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Grid showing generated student email list and previews */}
      <div className="glass-card" style={{ padding: '25px' }}>
        <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <CheckCircle size={18} className="text-emerald-500" /> Generated Scorecards & Send Status ({generatedEmails.length})
        </h3>
        
        {generatedEmails.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>
            No records generated yet. Load a student CSV sheet and run the dispatcher.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {generatedEmails.map((email, idx) => (
              <div key={idx} className="glass-card" style={{ 
                padding: '20px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color)', 
                backgroundColor: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '15px'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '700' }}>{email.name}</h4>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
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
                      {email.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{email.email || "No Email Provided"}</p>
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '12px', borderRadius: '8px', display: 'flex', gap: '6px' }}
                  onClick={() => {
                    setPreviewEmail(email);
                    setShowPreviewModal(true);
                  }}
                >
                  <Eye size={13} /> Preview HTML Scorecard
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HTML scorecard preview overlay modal */}
      {showPreviewModal && previewEmail && (
        <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%', padding: '20px', background: 'var(--bg-secondary)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '18px' }}>Personalized Scorecard Preview: {previewEmail.name}</h3>
              <button 
                className="btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                onClick={() => setShowPreviewModal(false)}
              >
                Close Preview
              </button>
            </div>
            
            <div style={{
              width: '100%',
              height: '500px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#f1f5f9'
            }}>
              <iframe 
                title="Scorecard Preview"
                srcDoc={previewEmail.html}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
