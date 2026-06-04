const express = require('express');
const router = express.Router();

// Helper: Haversine distance (km)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = v => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Mock DB
const challenges = [
  { id: '1', title: 'Kampala Store Promo', sponsor: 'BrandX', type: 'PHYSICAL', city: 'Kampala', lat: 0.3136, lng: 32.5811 },
  { id: '2', title: 'Share on Twitter', sponsor: 'TechCo', type: 'REMOTE', city: 'Global', lat: null, lng: null },
  { id: '3', title: 'Nakasero Survey', sponsor: 'RetailPlus', type: 'GEO_FENCED', city: 'Kampala', lat: 0.3210, lng: 32.5780 },
  { id: '4', title: 'Entebbe Event Staff', sponsor: 'EventsUG', type: 'PHYSICAL', city: 'Entebbe', lat: 0.0526, lng: 32.4435 },
];

// 🌍 GET /api/challenges?filter=around&lat=0.34&lng=32.58&radius=20
// 🌍 GET /api/challenges?filter=anywhere
// 🌍 GET /api/challenges?filter=only&city=Kampala
router.get('/challenges', (req, res) => {
  const { filter = 'around', lat, lng, radius = 20, city } = req.query;
  let results = [];

  if (filter === 'anywhere') {
    results = challenges.filter(c => c.type === 'REMOTE');
  } 
  else if (filter === 'only' && city) {
    results = challenges.filter(c => c.city && c.city.toLowerCase() === city.toLowerCase());
  } 
  else if (filter === 'around' && lat && lng) {
    const uLat = parseFloat(lat);
    const uLng = parseFloat(lng);
    results = challenges
      .filter(c => c.type !== 'REMOTE' && c.lat && c.lng)
      .map(c => ({
        ...c,
        distance: getDistance(uLat, uLng, c.lat, c.lng).toFixed(1)
      }))
      .filter(c => parseFloat(c.distance) <= parseFloat(radius));
  }

  res.json(results);
});

module.exports = router;
