const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 SECURITY MIDDLEWARE
app.use(helmet()); // Security headers
app.use(cors({
  origin: '*', // For MVP - restrict in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 1 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpg, png) and videos (mp4, mov, avi) allowed'));
    }
  }
});

// 📍 ROUTES

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: '🟢 Tuka Backend Running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// GET Challenges with filters
app.get('/api/challenges', async (req, res) => {
  try {
    const { filter = 'around', lat, lng, radius = 20, city } = req.query;
    
    let challenges = await prisma.challenge.findMany({
      where: { status: 'ACTIVE' },
      include: { 
        sponsor: { select: { name: true, phone: false } },
        _count: { select: { submissions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Haversine distance calculation
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
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

// POST Submission with file upload
app.post('/api/submissions', upload.single('proofFile'), async (req, res) => {
  try {
    const { challengeId, userId, proofText, userLat, userLng } = req.body;
    
    if (!challengeId || !userId) {
      return res.status(400).json({ error: 'challengeId and userId are required' });
    }

    const proofFileUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const proofType = req.file ? (req.file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE') : 'TEXT';
    
    const submission = await prisma.submission.create({
      data: { 
        challengeId, 
        userId, 
        proofText, 
        proofFileUrl,
        proofType,
        userLat: userLat ? parseFloat(userLat) : null,
        userLng: userLng ? parseFloat(userLng) : null,
        status: 'PENDING' 
      }
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: { 
        action: 'SUBMISSION_CREATED', 
        details: JSON.stringify({ id: submission.id, challengeId, userId }),
        userId
      }
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Submission received! Awaiting sponsor approval.',
      submissionId: submission.id
    });
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

// GET Sponsor submissions
app.get('/api/sponsor/:sponsorId/submissions', async (req, res) => {
  try {
    const { sponsorId } = req.params;
    const { challengeId, status } = req.query;
    
    const where = {
      challenge: { sponsorId }
    };
    
    if (challengeId) {
      where.challengeId = challengeId;
    }
    
    if (status) {
      where.status = status;
    }
    
    const submissions = await prisma.submission.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true } },
        challenge: { select: { title: true, rewardPool: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// POST Approve submission
app.post('/api/submissions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { sponsorId } = req.body;
    
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { challenge: true }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    if (submission.challenge.sponsorId !== sponsorId) {
      return res.status(403).json({ error: 'Unauthorized - Not your submission' });
    }
    
    await prisma.submission.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() }
    });
    
    await prisma.auditLog.create({
      data: { 
        action: 'SUBMISSION_APPROVED', 
        details: JSON.stringify({ submissionId: id, sponsorId }),
        userId: sponsorId
      }
    });
    
    res.json({ success: true, message: 'Approved! User will receive payout.' });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

// POST Reject submission
app.post('/api/submissions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { sponsorId, reason } = req.body;
    
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { challenge: true }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    if (submission.challenge.sponsorId !== sponsorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await prisma.submission.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason }
    });
    
    await prisma.auditLog.create({
      data: { 
        action: 'SUBMISSION_REJECTED', 
        details: JSON.stringify({ submissionId: id, reason }),
        userId: sponsorId
      }
    });
    
    res.json({ success: true, message: 'Submission rejected.' });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    res.status(500).json({ error: 'Failed to reject submission' });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tuka Backend running on port ${PORT}`);
  console.log(`🔒 Security: Helmet + Rate Limiting enabled`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});