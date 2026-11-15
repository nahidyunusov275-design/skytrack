import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const API_BASE = 'https://skytrack-backend-j6az.onrender.com';
const AZ_AIRPORTS = ['GYD', 'KVD', 'GBB', 'LLK', 'FZL', 'NAJ', 'IST', 'JFK', 'SVO', 'DXB'];
const BACKEND_AIRPORTS = ['GYD', 'KVD', 'GBB', 'LLK', 'FZL', 'NAJ'];

// Təyyarə ikonları
const getPlaneIcon = (heading, isSimulated = false) => {
  return L.divIcon({
    className: 'custom-plane-icon',
    html: `<div style="transform: rotate(${heading || 0}deg); font-size: 24px; line-height: 1; color: ${isSimulated ? '#ef4444' : '#2563eb'};">✈️</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// --- KÖMƏKÇI FUNKSİYA: Yeni koordinat hesablama ---
const calculateNewPosition = (lat, lon, heading, speedKmh, dtSeconds) => {
  const distanceKm = (speedKmh / 3600) * dtSeconds;
  const R = 6371; // Yer kürəsinin radiusu (km)
  const d = distanceKm / R;
  const brng = (heading * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
  };
};

const PlanePopupContent = ({ plane, onStartSimulation }) => {
  const [route, setRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [transportData, setTransportData] = useState(null);
  const [flightInfo, setFlightInfo] = useState(null);
  const [flightInfoLoading, setFlightInfoLoading] = useState(false);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!plane.callsign || plane.callsign === "Naməlum") return;
      setLoadingRoute(true);
      try {
        const res = await axios.get(`${API_BASE}/api/flight-route/${plane.callsign.trim()}`);
        if (!res.data.error) setRoute(res.data);
      } catch (err) {
        console.error("Marşrut xətası:", err);
      } finally {
        setLoadingRoute(false);
      }
    };
    fetchRoute();
  }, [plane.callsign]);

  useEffect(() => {
    if (!route || !route.destination_iata) { setFlightInfo(null); return; }
    const dest = route.destination_iata.toUpperCase().trim();
    if (!BACKEND_AIRPORTS.includes(dest)) { setFlightInfo(null); return; }

    setFlightInfoLoading(true);
    axios.post(`${API_BASE}/api/flight-info`, {
      icao24: plane.icao24, lat: plane.latitude, lon: plane.longitude,
      velocity: plane.velocity_ms, vertical_rate: plane.vertical_rate,
      on_ground: plane.on_ground || false, destination: dest, callsign: plane.callsign,
    }).then(res => setFlightInfo(res.data)).catch(() => {}).finally(() => setFlightInfoLoading(false));
  }, [route, plane.icao24, plane.latitude, plane.longitude, plane.velocity_ms, plane.vertical_rate, plane.on_ground]);

  const loadTransport = async () => {
    if (!transportData && route?.destination_iata) {
      try {
        const res = await axios.get(`${API_BASE}/api/transport/${route.destination_iata}`);
        setTransportData(res.data);
      } catch (error) {
        setTransportData({ error: "Məlumat yüklənə bilmədi" });
      }
    }
  };

  const isGoingToAZ = route && AZ_AIRPORTS.includes(route.destination_iata);

  return (
    <div style={{ minWidth: '240px' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#1e3a8a' }}>{plane.callsign}</h3>

      <button 
        onClick={() => onStartSimulation(plane)}
        style={{ width: '100%', padding: '8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }}
      >
        🎮 Bu təyyarəni idarə et
      </button>

      <div style={{ marginBottom: '10px', padding: '8px', background: '#e0f2fe', borderRadius: '5px' }}>
        {loadingRoute ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#0284c7' }}>Marşrut axtarılır... ⏳</p>
        ) : route ? (
          <div style={{ fontSize: '13px' }}>
            <p style={{ margin: '0 0 5px 0' }}><b>🛫 Hardan:</b> {route.origin_city} ({route.origin_iata})</p>
            <p style={{ margin: 0 }}><b>🛬 Hara:</b> {route.destination_city} ({route.destination_iata})</p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Marşrut məlumatı tapılmadı.</p>
        )}
      </div>

      {flightInfoLoading && !flightInfo && (
        <div className="eta-card"><p style={{ margin: 0, fontSize: '13px', color: '#0284c7' }}>🛬 Eniş məlumatı yüklənir... ⏳</p></div>
      )}

      {flightInfo?.eta && (
        <div className="eta-card">
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e3a8a' }}>🛬 Eniş məlumatı</h4>
          <div className="eta-row"><span>Status:</span><strong className={`status-${flightInfo.eta.status}`}>{flightInfo.eta.status_label}</strong></div>
          <div className="eta-row"><span>Məsafə:</span><strong>{flightInfo.eta.distance_km} km</strong></div>
          <div className="eta-row"><span>Enişə qalan:</span><strong>{flightInfo.eta.eta_human}</strong></div>
        </div>
      )}

      <p style={{ margin: '5px 0' }}><b>Ölkə:</b> {plane.country}</p>
      <p style={{ margin: '5px 0' }}><b>Hündürlük:</b> {plane.altitude_m ? `${plane.altitude_m} m` : '—'}</p>

      {isGoingToAZ && (
        <>
          <hr style={{ margin: '10px 0' }} />
          <details onToggle={loadTransport} style={{ cursor: 'pointer' }}>
            <summary style={{ fontWeight: 'bold', color: '#2563eb' }}>🛬 {route.destination_city} hava limanından necə çıxım?</summary>
            {transportData ? (
              transportData.error ? <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>{transportData.error}</p> : (
                <div style={{ marginTop: '10px', fontSize: '13px' }}>
                  <p style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>{transportData.airport}</p>
                  {transportData.options.map((opt, i) => (
                    <div key={i} style={{ marginBottom: '8px', padding: '5px', background: '#f3f4f6', borderRadius: '5px' }}>
                      <b>{opt.type}</b><br />Qiymət: {opt.price} | Vaxt: {opt.time}<br />
                      <span style={{ color: '#666' }}>{opt.schedule}</span>
                    </div>
                  ))}
                </div>
              )
            ) : <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>Yüklənir...</p>}
          </details>
        </>
      )}
    </div>
  );
};

function App() {
  const [planes, setPlanes] = useState([]);
  const [showList, setShowList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef(null);

  // --- SİMULYASİYA STATE-LƏRİ ---
  const [simulatedPlane, setSimulatedPlane] = useState(null);
  const [trail, setTrail] = useState([]);
  const [keys, setKeys] = useState({ up: false, down: false, left: false, right: false });

  // API-dən təyyarələri çək
  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/planes`);
        if (res.data.planes && res.data.planes.length > 0) setPlanes(res.data.planes);
      } catch (error) { console.error("Data xətası:", error); }
    };
    fetchPlanes();
    const interval = setInterval(fetchPlanes, 5000);
    return () => clearInterval(interval);
  }, []);

  // Klaviatura hadisələri
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!simulatedPlane) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowUp') setKeys(k => ({ ...k, up: true }));
      if (e.key === 'ArrowDown') setKeys(k => ({ ...k, down: true }));
      if (e.key === 'ArrowLeft') setKeys(k => ({ ...k, left: true }));
      if (e.key === 'ArrowRight') setKeys(k => ({ ...k, right: true }));
    };
    const handleKeyUp = (e) => {
      if (e.key === 'ArrowUp') setKeys(k => ({ ...k, up: false }));
      if (e.key === 'ArrowDown') setKeys(k => ({ ...k, down: false }));
      if (e.key === 'ArrowLeft') setKeys(k => ({ ...k, left: false }));
      if (e.key === 'ArrowRight') setKeys(k => ({ ...k, right: false }));
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [simulatedPlane]);

  // Simulyasiya dövrü (hərəkət)
  useEffect(() => {
    if (!simulatedPlane) return;
    const interval = setInterval(() => {
      setSimulatedPlane(prev => {
        if (!prev) return prev;
        let newHeading = prev.heading || 0;
        let newSpeed = prev.velocity_ms ? prev.velocity_ms * 3.6 : 800; // km/s

        if (keys.left) newHeading -= 5;
        if (keys.right) newHeading += 5;
        if (keys.up) newSpeed += 20;
        if (keys.down) newSpeed -= 20;
        if (newSpeed < 100) newSpeed = 100;

        const newPos = calculateNewPosition(prev.latitude, prev.longitude, newHeading, newSpeed, 1);
        
        setTrail(t => [...t.slice(-100), [newPos.lat, newPos.lon]]); // Son 100 nöqtəni saxla

        return { ...prev, latitude: newPos.lat, longitude: newPos.lon, heading: newHeading, velocity_ms: newSpeed / 3.6 };
      });
    }, 1000); // Hər saniyə
    return () => clearInterval(interval);
  }, [simulatedPlane, keys]);

  const startSimulation = (plane) => {
    setSimulatedPlane({ ...plane });
    setTrail([[plane.latitude, plane.longitude]]);
    if (mapRef.current) mapRef.current.flyTo([plane.latitude, plane.longitude], 8, { duration: 1.5 });
  };

  const stopSimulation = () => {
    setSimulatedPlane(null);
    setTrail([]);
    setKeys({ up: false, down: false, left: false, right: false });
  };

  const flyToPlane = (lat, lng) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 10, { duration: 2 });
      setShowList(false);
    }
  };

  // Simulyasiya olunan təyyarəni real siyahıdan çıxarırıq
  const filteredPlanes = planes.filter((plane) => {
    if (simulatedPlane && plane.icao24 === simulatedPlane.icao24) return false;
    return plane.callsign.toLowerCase().startsWith(searchQuery.toLowerCase());
  });

  const totalPlanes = planes.length;
  const highestPlane = planes.reduce((max, p) => (p.altitude_m || 0) > (max.altitude_m || 0) ? p : max, {});

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="main-header">
        <div className="logo-area">
          <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1px' }}>✈️ SkyTrack</h1>
          <span style={{ fontSize: '14px', opacity: 0.8 }}>Azərbaycan Real-vaxt İzləmə</span>
        </div>
        <div className="search-container">
          <input type="text" placeholder="Reys axtar (məs: THY, AHY...)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
        </div>
        <div className="stats-container">
          <div onClick={() => setShowList(!showList)} style={{ cursor: 'pointer', padding: '5px 10px', borderRadius: '5px', background: showList ? '#2563eb' : 'transparent', transition: '0.3s' }}>
            Havada: <b style={{ color: '#60a5fa', fontSize: '18px' }}>{totalPlanes}</b> təyyarə
          </div>
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        {showList && (
          <div className="sidebar">
            <h3 style={{ margin: '0 0 15px 0', color: '#1e3a8a' }}>Təyyarələr ({filteredPlanes.length})</h3>
            {filteredPlanes.map((plane) => (
              plane.latitude && plane.longitude && (
                <div key={plane.icao24} onClick={() => flyToPlane(plane.latitude, plane.longitude)} className="plane-list-item">
                  <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{plane.callsign}</div>
                </div>
              )
            ))}
          </div>
        )}

        <div style={{ flex: 1 }}>
          <MapContainer center={[40.4093, 49.8671]} zoom={7} style={{ height: '100%', width: '100%' }} ref={mapRef}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            
            {/* Real təyyarələr */}
            {filteredPlanes.map((plane) => (
              plane.latitude && plane.longitude && (
                <Marker key={plane.icao24} position={[plane.latitude, plane.longitude]} icon={getPlaneIcon(plane.heading)}>
                  <Popup><PlanePopupContent plane={plane} onStartSimulation={startSimulation} /></Popup>
                </Marker>
              )
            ))}

            {/* Simulyasiya olunan təyyarə və izi */}
            {simulatedPlane && (
              <>
                <Polyline positions={trail} color="red" weight={3} opacity={0.7} />
                <Marker position={[simulatedPlane.latitude, simulatedPlane.longitude]} icon={getPlaneIcon(simulatedPlane.heading, true)}>
                  <Popup>
                    <b>🎮 İdarə olunur: {simulatedPlane.callsign}</b><br/>
                    Sürət: {Math.round(simulatedPlane.velocity_ms * 3.6)} km/s<br/>
                    İstiqamət: {Math.round(simulatedPlane.heading)}°
                  </Popup>
                </Marker>
              </>
            )}
          </MapContainer>
        </div>

        {/* SİMULYASİYA İDARƏETMƏ PANELİ */}
        {simulatedPlane && (
          <div className="simulation-panel">
            <h3>🎮 Simulyasiya: {simulatedPlane.callsign}</h3>
            <p>Sürət: <b>{Math.round(simulatedPlane.velocity_ms * 3.6)} km/s</b></p>
            <p>İstiqamət: <b>{Math.round(simulatedPlane.heading)}°</b></p>
            
            <div className="sim-controls">
              <button onClick={() => setKeys(k => ({ ...k, up: !k.up }))} className={keys.up ? 'active' : ''}>⬆️ Sürət Artır</button>
              <button onClick={() => setKeys(k => ({ ...k, down: !k.down }))} className={keys.down ? 'active' : ''}>⬇️ Sürət Azalt</button>
              <button onClick={() => setKeys(k => ({ ...k, left: !k.left }))} className={keys.left ? 'active' : ''}>⬅️ Sola Dön</button>
              <button onClick={() => setKeys(k => ({ ...k, right: !k.right }))} className={keys.right ? 'active' : ''}>➡️ Sağa Dön</button>
            </div>
            
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>Klaviaturdan da istifadə edə bilərsən (↑ ↓ ← →)</p>
            <button onClick={stopSimulation} className="stop-btn">🛑 Simulyasiyanı Bitir</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;