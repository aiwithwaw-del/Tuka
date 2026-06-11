const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images and videos allowed'));
    }
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/', (req, res) => {
  res.json({ status: '🟢 Tuka Backend Running' });
});

// GET Challenges with filters
app.get('/api/challenges', async (req, res) => {
  const { filter = 'around', lat, lng, radius = 20, city } = req.query;
  
  let challenges = await prisma.challenge.findMany({
    where: { status: 'ACTIVE' },
    include: { 
      sponsor: { select: { name: true } },
      _count: { select: { submissions: true } }
    }
  });

  const getDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const toRad = v => v * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  let results = [];
  if (filter === 'anywhere') {
    results = challenges.filter(c => c.locationType === 'REMOTE');
  } else if (filter === 'only' && city) {
    results = challenges.filter(c => c.city && c.city.toLowerCase() === city.toLowerCase());
  } else if (filter === 'around' && lat && lng) {
    const uLat = parseFloat(lat);
    const uLng = parseFloat(lng);
    results = challenges
      .filter(c => c.locationType !== 'REMOTE' && c.lat && c.lng)
      .map(c => ({
        ...c,
        distance: getDistance(uLat, uLng, c.lat, c.lng).toFixed(1)
      }))
      .filter(c => parseFloat(c.distance) <= parseFloat(radius));
  }

  res.json(results);
});

// POST Submission with file upload
app.post('/api/submissions', upload.single('proofFile'), async (req, res) => {
  const { challengeId, userId, proofText, userLat, userLng } = req.body;
  
  try {
    const proofFileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const proofType = req.file ? (req.file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE') : 'TEXT';
    
    const submission = await prisma.submission.create({
      data: { 
        challengeId, 
        userId, 
        proofText, 
        proofFileUrl,
        proofType,
        userLat, 
        userLng, 
        status: 'PENDING' 
      }
    });
    
    await prisma.auditLog.create({
      data: { action: 'SUBMISSION_CREATED', details: JSON.stringify({ id: submission.id }) }
    });
    
    res.status(201).json({ success: true, message: 'Submitted! Awaiting approval.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET Sponsor submissions
app.get('/api/sponsor/:sponsorId/submissions', async (req, res) => {
  const { sponsorId } = req.params;
  
  try {
    const submissions = await prisma.submission.findMany({
      where: { challenge: { sponsorId } },
      include: {
        user: { select: { name: true, phone: true } },
        challenge: { select: { title: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    res.json(submissions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Approve submission
app.post('/api/submissions/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { sponsorId } = req.body;
  
  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { challenge: true }
    });
    
    if (submission.challenge.sponsorId !== sponsorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await prisma.submission.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() }
    });
    
    res.json({ success: true, message: 'Approved! User will be paid.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST Reject submission
app.post('/api/submissions/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { sponsorId, reason } = req.body;
  
  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { challenge: true }
    });
    
    if (submission.challenge.sponsorId !== sponsorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await prisma.submission.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason }
    });
    
    res.json({ success: true, message: 'Rejected.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));