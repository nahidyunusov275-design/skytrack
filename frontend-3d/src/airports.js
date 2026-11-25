// src/airports.js
export const AIRPORTS = {
  GYD: {
    code: 'GYD',
    city: 'Bakı',
    name: 'Heydər Əliyev Beynəlxalq Hava Limanı',
    lat: 40.4675,
    lon: 50.0467,
    elevation: 3,
  },
  TBS: {
    code: 'TBS',
    city: 'Tbilisi',
    name: 'Tbilisi Beynəlxalq Hava Limanı',
    lat: 41.6692,
    lon: 44.9547,
    elevation: 490,
  },
  EVN: {
    code: 'EVN',
    city: 'Yerevan',
    name: 'Zvartnots Beynəlxalq Hava Limanı',
    lat: 40.1473,
    lon: 44.3959,
    elevation: 865,
  },
  IST: {
    code: 'IST',
    city: 'İstanbul',
    name: 'İstanbul Hava Limanı',
    lat: 41.2753,
    lon: 28.7519,
    elevation: 99,
  },
  DXB: {
    code: 'DXB',
    city: 'Dubai',
    name: 'Dubai Beynəlxalq Hava Limanı',
    lat: 25.2532,
    lon: 55.3657,
    elevation: 19,
  },
  ALA: {
    code: 'ALA',
    city: 'Almatı',
    name: 'Almatı Beynəlxalq Hava Limanı',
    lat: 43.3521,
    lon: 77.0405,
    elevation: 681,
  },
  ASB: {
    code: 'ASB',
    city: 'Aşqabad',
    name: 'Aşqabad Beynəlxalq Hava Limanı',
    lat: 37.9868,
    lon: 58.3610,
    elevation: 211,
  },
  TAS: {
    code: 'TAS',
    city: 'Daşkənd',
    name: 'İslam Kərimov Beynəlxalq Hava Limanı',
    lat: 41.2579,
    lon: 69.2812,
    elevation: 432,
  },
  THR: {
    code: 'THR',
    city: 'Tehran',
    name: 'İmam Xomeyni Beynəlxalq Hava Limanı',
    lat: 35.4161,
    lon: 51.1522,
    elevation: 1007,
  },
  FRU: {
    code: 'FRU',
    city: 'Bişkek',
    name: 'Manas Beynəlxalq Hava Limanı',
    lat: 43.0613,
    lon: 74.4776,
    elevation: 637,
  },
};

// Haversine düsturu ilə hava limanına olan məsafə (dəniz mili / NM)
const EARTH_RADIUS_NM = 3440.065;

export function distanceToAirportNM(lat, lon, airport) {
  const ap = typeof airport === 'string' ? AIRPORTS[airport] : airport;
  if (!ap || ap.lat == null || ap.lon == null) return null;

  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat);
  const φ2 = toRad(ap.lat);
  const Δφ = toRad(ap.lat - lat);
  const Δλ = toRad(ap.lon - lon);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}