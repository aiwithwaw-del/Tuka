const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// 📍 GET /api/challenges?filter=around&lat=0.34&lng=32.58&radius=20
// 📍 GET /api/challenges?filter=anywhere
// 📍 GET /api/challenges?filter=only&city=Kampala
app.get('/api/challenges', async (req, res) => {
  const { filter = 'around', lat, lng, radius = 20, city } = req.query;
  
  let challenges = await prisma.challenge.findMany({
    where: { status: 'ACTIVE' },
    include: { sponsor: { select: { name: true } } }
  });

  // Helper: Haversine distance (km)
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

// 📝 POST /api/submissions
app.post('/api/submissions', async (req, res) => {
  const { challengeId, userId, proofText, userLat, userLng } = req.body;
  
  try {
    const submission = await prisma.submission.create({
      data: { challengeId, userId, proofText, userLat, userLng, status: 'PENDING' }
    });
    
    // Audit log
    await prisma.auditLog.create({
      data: { action: 'SUBMISSION_CREATED', details: JSON.stringify({ id: submission.id, challengeId }) }
    });
    
    res.status(201).json({ success: true, message: 'Submission received!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ POST /api/admin/approve (Simple mock admin action)
app.post('/api/admin/approve', async (req, res) => {
  const { submissionId } = req.body;
  try {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'APPROVED' }
    });
    await prisma.auditLog.create({
      data: { action: 'SUBMISSION_APPROVED', details: submissionId }
    });
    res.json({ success: true, message: 'Approved & queued for payout' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Tuka Backend running on http://localhost:${PORT}`));
