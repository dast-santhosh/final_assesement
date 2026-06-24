import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Configurations from frontend root project
const firebaseConfig = {
    apiKey: "AIzaSyAKLmBYyEJMHiTcL7T1O4asErBv5ncCuC0",
    authDomain: "apex-code-labs.firebaseapp.com",
    projectId: "apex-code-labs",
    storageBucket: "apex-code-labs.firebasestorage.app",
    messagingSenderId: "98765885664",
    appId: "1:98765885664:web:4aa13742b5c269fe588085",
    measurementId: "G-3QNKWQQZFG"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Configure Cloudinary if environment keys are present
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const uploadPhoto = async (photoBase64) => {
  if (process.env.CLOUDINARY_CLOUD_NAME && photoBase64 && photoBase64.startsWith('data:image')) {
    try {
      const res = await cloudinary.uploader.upload(photoBase64, {
        folder: 'devshaala_exams'
      });
      console.log("Photo uploaded to Cloudinary successfully:", res.secure_url);
      return res.secure_url;
    } catch (err) {
      console.error("Cloudinary upload failed, using local base64 fallback:", err);
      return photoBase64;
    }
  }
  return photoBase64;
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const questionsPath = path.join(__dirname, '..', 'questions.json');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'devshaala@gmail.com',
    pass: 'cdoy ctvn dvvs rafv'
  }
});

const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: '"DevShaala Team" <devshaala@gmail.com>',
      to,
      subject,
      text
    });
    console.log(`Successfully dispatched real email to ${to}`);
  } catch (err) {
    console.error(`Failed to send real email to ${to}:`, err);
  }
};

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

const getNow = (req) => {
  const simTime = req.headers['x-simulated-time'] || req.body?.simulatedTime;
  if (simTime) {
    return new Date(simTime);
  }
  return new Date();
};

// 1. Health warmer endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: getNow(req).toISOString(), message: 'Render server active' });
});

// 2. Fetch all slots with availability info (locks out slot if 3 students booked it)
app.get('/api/slots', async (req, res) => {
  try {
    const slotCounts = {};
    const bookingsSnap = await getDocs(collection(db, 'bookings'));
    bookingsSnap.forEach(doc => {
      const data = doc.data();
      slotCounts[data.slotId] = (slotCounts[data.slotId] || 0) + 1;
    });

    const slotsWithStatus = SLOTS.map(slot => ({
      ...slot,
      isBooked: (slotCounts[slot.id] || 0) >= 3,
      bookingCount: slotCounts[slot.id] || 0
    }));
    res.json({ slots: slotsWithStatus });
  } catch (err) {
    console.error("Firestore slots fetch failed:", err);
    res.status(500).json({ error: "Failed to retrieve slots." });
  }
});

// 3. Book a slot (with photo capture validation)
app.post('/api/book-slot', async (req, res) => {
  const { email, name, slotId, photo } = req.body;
  
  if (!email || !name || !slotId || !photo) {
    return res.status(400).json({ error: 'All fields (email, name, slotId, and photo) are required.' });
  }

  try {
    const bookingDoc = await getDoc(doc(db, 'bookings', email.toLowerCase()));
    if (bookingDoc.exists()) {
      return res.status(400).json({ error: `Student with email ${email} has already booked a slot.` });
    }

    const targetSlot = SLOTS.find(s => s.id === slotId);
    if (!targetSlot) {
      return res.status(404).json({ error: 'Selected slot does not exist.' });
    }

    // Enforce "3 students per slot" limit
    const bookingsSnap = await getDocs(collection(db, 'bookings'));
    let activeBookingsCount = 0;
    bookingsSnap.forEach(doc => {
      if (doc.data().slotId === slotId) activeBookingsCount++;
    });

    if (activeBookingsCount >= 3) {
      return res.status(400).json({ error: 'This slot has already been booked by the maximum limit of 3 students.' });
    }

    // Process Cloudinary Upload if configured, fallback to direct Firestore base64 storage
    const storedPhoto = await uploadPhoto(photo);

    const bookingData = {
      slotId,
      displayDate: targetSlot.displayDate,
      displayTime: targetSlot.displayTime,
      startIso: targetSlot.startIso,
      endIso: targetSlot.endIso,
      photo: storedPhoto,
      name,
      email: email.toLowerCase(),
      bookedAt: getNow(req).toISOString()
    };

    await setDoc(doc(db, 'bookings', email.toLowerCase()), bookingData);
    res.json({ message: 'Slot booked successfully!', booking: bookingData });
  } catch (err) {
    console.error("Firestore booking failed:", err);
    res.status(500).json({ error: "Failed to complete slot booking." });
  }
});

// 4. Retrieve booking details for a student
app.get('/api/booking/:email', async (req, res) => {
  const email = req.params.email.toLowerCase();
  try {
    const bookingDoc = await getDoc(doc(db, 'bookings', email));
    if (!bookingDoc.exists()) {
      return res.status(404).json({ error: 'No booking found for this email address.' });
    }
    res.json({ booking: bookingDoc.data() });
  } catch (err) {
    console.error("Firestore booking retrieval failed:", err);
    res.status(500).json({ error: "Failed to retrieve booking." });
  }
});

// 5. Start the exam, validating time windows
app.post('/api/start-exam', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const bookingDoc = await getDoc(doc(db, 'bookings', email.toLowerCase()));
    if (!bookingDoc.exists()) {
      return res.status(404).json({ error: 'No exam slot booking found for this email.' });
    }
    const booking = bookingDoc.data();

    const now = getNow(req);
    const slotStart = new Date(booking.startIso);
    const slotEnd = new Date(booking.endIso);

    const submissionDoc = await getDoc(doc(db, 'submissions', email.toLowerCase()));
    if (submissionDoc.exists() && submissionDoc.data().submittedAt) {
      return res.status(400).json({ error: 'Exam has already been submitted.' });
    }

    if (now < slotStart) {
      const diffMs = slotStart - now;
      const diffMins = Math.ceil(diffMs / 60000);
      return res.status(400).json({ 
        error: `Exam slot has not started yet. Starts in ${diffMins} minutes.`,
        notStarted: true,
        startsAt: booking.startIso
      });
    }

    if (!submissionDoc.exists()) {
      const startLimit = new Date(slotStart.getTime() + 30 * 60 * 1000);
      if (now > startLimit) {
        return res.status(400).json({ 
          error: 'You failed to start the exam within the first 30 minutes of your booked time slot. Access denied.',
          expired: true
        });
      }

      await setDoc(doc(db, 'submissions', email.toLowerCase()), {
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
      });
    }

    const currentSubDoc = await getDoc(doc(db, 'submissions', email.toLowerCase()));
    const submission = currentSubDoc.data();
    
    let questions = {};
    try {
      if (fs.existsSync(questionsPath)) {
        questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
      }
    } catch (e) {
      console.error("Failed to read questions.json", e);
    }

    const startedAt = new Date(submission.startedAt);
    const elapsedSeconds = Math.floor((now - startedAt) / 1000);
    const timeRemainingSeconds = Math.max(90 * 60 - elapsedSeconds, 0);

    res.json({
      message: 'Exam session initialized.',
      questions,
      timeRemainingSeconds,
      referencePhoto: booking.photo,
      startedAt: submission.startedAt
    });
  } catch (err) {
    console.error("Firestore exam start failed:", err);
    res.status(500).json({ error: "Failed to initialize exam." });
  }
});

// 6. Submit answers and logs
app.post('/api/submit-exam', async (req, res) => {
  const { email, answers, logs } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const submissionDoc = await getDoc(doc(db, 'submissions', email.toLowerCase()));
    if (!submissionDoc.exists()) {
      return res.status(404).json({ error: 'No active exam session found.' });
    }
    const submission = submissionDoc.data();

    if (submission.submittedAt) {
      return res.status(400).json({ error: 'Exam is already submitted.' });
    }

    const now = getNow(req);
    const updatedSubmission = {
      ...submission,
      answers: answers || {},
      logs: logs || [],
      submittedAt: now.toISOString()
    };

    await setDoc(doc(db, 'submissions', email.toLowerCase()), updatedSubmission);
    res.json({ message: 'Exam submitted successfully.', submission: updatedSubmission });
  } catch (err) {
    console.error("Firestore submission failed:", err);
    res.status(500).json({ error: "Failed to submit answers." });
  }
});

// 7. Get submissions list for Commandant
app.get('/api/submissions', async (req, res) => {
  try {
    const submissionsSnap = await getDocs(collection(db, 'submissions'));
    const submissionsList = [];
    submissionsSnap.forEach(doc => {
      submissionsList.push(doc.data());
    });

    const configDoc = await getDoc(doc(db, 'config', 'global'));
    const config = configDoc.exists() ? configDoc.data() : { resultsPublished: false };

    let questions = {};
    try {
      if (fs.existsSync(questionsPath)) {
        questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
      }
    } catch (e) {
      console.error("Failed to read questions.json", e);
    }

    res.json({ submissions: submissionsList, config, questions });
  } catch (err) {
    console.error("Firestore submissions list fetch failed:", err);
    res.status(500).json({ error: "Failed to retrieve submissions list." });
  }
});

// 8. Grade a submission
app.post('/api/grade-submission', async (req, res) => {
  const { email, questionGrades, feedback } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const submissionDoc = await getDoc(doc(db, 'submissions', email.toLowerCase()));
    if (!submissionDoc.exists()) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    const submission = submissionDoc.data();

    const qGrades = questionGrades || {};
    let totalMarks = 0;
    Object.values(qGrades).forEach(val => {
      totalMarks += Number(val) || 0;
    });

    const updatedSubmission = {
      ...submission,
      questionGrades: qGrades,
      marks: Math.round(totalMarks * 100) / 100,
      feedback: feedback || ""
    };

    await setDoc(doc(db, 'submissions', email.toLowerCase()), updatedSubmission);
    res.json({ message: 'Grades saved.', submission: updatedSubmission });
  } catch (err) {
    console.error("Firestore grading failed:", err);
    res.status(500).json({ error: "Failed to save grades." });
  }
});

// 9. Publish results (with email dispatch logs & 16-digit passcodes)
app.post('/api/publish-results', async (req, res) => {
  try {
    await setDoc(doc(db, 'config', 'global'), { resultsPublished: true });
    const submissionsSnap = await getDocs(collection(db, 'submissions'));
    const dispatches = [];

    for (const docSnap of submissionsSnap.docs) {
      const sub = docSnap.data();
      if (sub.marks !== null && !sub.passcode) {
        const p1 = Math.floor(1000 + Math.random() * 9000);
        const p2 = Math.floor(1000 + Math.random() * 9000);
        const p3 = Math.floor(1000 + Math.random() * 9000);
        const p4 = Math.floor(1000 + Math.random() * 9000);
        const passcode = `${p1}-${p2}-${p3}-${p4}`;

        const updatedSub = {
          ...sub,
          passcode,
          published: true
        };

        await setDoc(doc(db, 'submissions', docSnap.id), updatedSub);

        const emailBody = `Dear ${sub.name},\n\nYour results for the Python Masterclass Final Exam have been graded.\n\nScore: ${sub.marks}/30\nFeedback: ${sub.feedback || 'None'}\n\nPlease enter the following 16-digit password on the results portal to decrypt and download your official completion certificate:\n${passcode}\n\nCongratulations,\nDevShaala Invigilation Team`;

        dispatches.push({
          to: sub.email,
          from: 'devshaala@gmail.com',
          subject: 'DevShaala: Python MasterClass Final Exam Results Published',
          body: emailBody,
          passcode
        });

        sendEmail(sub.email, 'DevShaala: Python MasterClass Final Exam Results Published', emailBody);
      }
    }

    res.json({ message: 'Results published successfully!', dispatches });
  } catch (err) {
    console.error("Firestore publish results failed:", err);
    res.status(500).json({ error: "Failed to publish results." });
  }
});

// 10. Verify 16-digit passcode to unlock certificate
app.post('/api/verify-passcode', async (req, res) => {
  const { email, passcode } = req.body;
  if (!email || !passcode) {
    return res.status(400).json({ error: 'Email and Passcode are required.' });
  }

  try {
    const submissionDoc = await getDoc(doc(db, 'submissions', email.toLowerCase()));
    if (!submissionDoc.exists()) {
      return res.status(404).json({ error: 'No exam submission found for this email.' });
    }
    const submission = submissionDoc.data();

    const configDoc = await getDoc(doc(db, 'config', 'global'));
    const resultsPublished = configDoc.exists() && configDoc.data().resultsPublished;

    if (!resultsPublished || !submission.published) {
      return res.status(400).json({ error: 'Results have not been published by the invigilator yet.' });
    }

    if (submission.passcode.replace(/\s/g, '') !== passcode.replace(/\s/g, '')) {
      return res.status(400).json({ error: 'Incorrect 16-digit passcode. Access denied.' });
    }

    res.json({
      unlocked: true,
      scorecard: {
        name: submission.name,
        email: submission.email,
        marks: submission.marks,
        feedback: submission.feedback,
        submittedAt: submission.submittedAt
      }
    });
  } catch (err) {
    console.error("Firestore verify passcode failed:", err);
    res.status(500).json({ error: "Failed to verify passcode." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Exam Portal Backend running on port ${PORT}`);
});

export default app;
