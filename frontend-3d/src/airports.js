// Yalnız Azərbaycan Hava Limanları
export const AIRPORTS = {
  GYD: {
    code: 'GYD',
    city: 'Bakı',
    name: 'Heydər Əliyev Beynəlxalq Hava Limanı',
    lat: 40.4675,
    lon: 50.0467,
    runways: [{ start: { lat: 40.4575, lon: 50.0367 }, end: { lat: 40.4775, lon: 50.0567 } }]
  },
  NAJ: {
    code: 'NAJ',
    city: 'Naxçıvan',
    name: 'Naxçıvan Beynəlxalq Hava Limanı',
    lat: 39.1888,
    lon: 45.4584,
    runways: [{ start: { lat: 39.1788, lon: 45.4484 }, end: { lat: 39.1988, lon: 45.4684 } }]
  },
  GAN: {
    code: 'GAN',
    city: 'Gəncə',
    name: 'Gəncə Beynəlxalq Hava Limanı',
    lat: 40.7377,
    lon: 46.3176,
    runways: [{ start: { lat: 40.7277, lon: 46.3076 }, end: { lat: 40.7477, lon: 46.3276 } }]
  },
  LLK: {
    code: 'LLK',
    city: 'Lənkəran',
    name: 'Lənkəran Beynəlxalq Hava Limanı',
    lat: 38.7464,
    lon: 48.8180,
    runways: [{ start: { lat: 38.7364, lon: 48.8080 }, end: { lat: 38.7564, lon: 48.8280 } }]
  },
  GBB: {
    code: 'GBB',
    city: 'Qəbələ',
    name: 'Qəbələ Beynəlxalq Hava Limanı',
    lat: 40.8267,
    lon: 47.7125,
    runways: [{ start: { lat: 40.8167, lon: 47.7025 }, end: { lat: 40.8367, lon: 47.7225 } }]
  },
  ZTU: {
    code: 'ZTU',
    city: 'Zaqatala',
    name: 'Zaqatala Beynəlxalq Hava Limanı',
    lat: 41.5622,
    lon: 46.6672,
    runways: [{ start: { lat: 41.5522, lon: 46.6572 }, end: { lat: 41.5722, lon: 46.6772 } }]
  }
};

// Məsafə hesablama funksiyası (Dəniz mili - NM ilə)
export function distanceToAirportNM(lat, lon, airport) {
  const R = 3440.065; // Yerin radiusu (NM)
  const dLat = (airport.lat - lat) * Math.PI / 180;
  const dLon = (airport.lon - lon) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat * Math.PI / 180) * Math.cos(airport.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}