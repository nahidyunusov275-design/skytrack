import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const API_BASE = 'https://skytrack-backend-j6az.onrender.com';

const AZ_AIRPORTS = ['GYD', 'KVD', 'GBB', 'LLK', 'FZL', 'NAJ', 'IST', 'JFK', 'SVO', 'DXB'];
const BACKEND_AIRPORTS = ['GYD', 'KVD', 'GBB', 'LLK', 'FZL', 'NAJ'];

const getPlaneIcon = (heading) => {
  return L.divIcon({
    className: 'custom-plane-icon',
    html: `<div style="transform: rotate(${heading || 0}deg); font-size: 24px; line-height: 1;">✈️</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const PlanePopupContent = ({ plane }) => {
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
        if (!res.data.error) {
          setRoute(res.data);
        }
      } catch (err) {
        console.error("Marşrut xətası:", err);
      } finally {
        setLoadingRoute(false);
      }
    };
    fetchRoute();
  }, [plane.callsign]);

  useEffect(() => {
    if (!route || !route.destination_iata) {
      setFlightInfo(null);
      return;
    }
    const dest = route.destination_iata.toUpperCase().trim();
    if (!BACKEND_AIRPORTS.includes(dest)) {
      setFlightInfo(null);
      return;
    }

    setFlightInfoLoading(true);
    axios.post(`${API_BASE}/api/flight-info`, {
      icao24: plane.icao24,
      lat: plane.latitude,
      lon: plane.longitude,
      velocity: plane.velocity_ms,
      vertical_rate: plane.vertical_rate,
      on_ground: plane.on_ground || false,
      destination: dest,
      callsign: plane.callsign,
    })
      .then(res => setFlightInfo(res.data))
      .catch(() => {})
      .finally(() => setFlightInfoLoading(false));
  }, [route, plane.icao24, plane.latitude, plane.longitude, plane.velocity_ms, plane.vertical_rate, plane.on_ground]);

  // YENİ: Dinamik transport yükləmə
  const loadTransport = async () => {
    if (!transportData && route?.destination_iata) {
      try {
        const res = await axios.get(`${API_BASE}/api/transport/${route.destination_iata}`);
        setTransportData(res.data);
      } catch (error) {
        console.error("Transport xətası:", error);
        setTransportData({ error: "Məlumat yüklənə bilmədi" });
      }
    }
  };

  const isGoingToAZ = route && AZ_AIRPORTS.includes(route.destination_iata);

  return (
    <div style={{ minWidth: '240px' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#1e3a8a' }}>{plane.callsign}</h3>

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
        <div className="eta-card">
          <p style={{ margin: 0, fontSize: '13px', color: '#0284c7' }}>🛬 Eniş məlumatı yüklənir... ⏳</p>
        </div>
      )}

      {flightInfo?.eta && (
        <div className="eta-card">
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e3a8a' }}>🛬 Eniş məlumatı</h4>
          <div className="eta-row"><span>Status:</span><strong className={`status-${flightInfo.eta.status}`}>{flightInfo.eta.status_label}</strong></div>
          <div className="eta-row"><span>Məsafə:</span><strong>{flightInfo.eta.distance_km} km</strong></div>
          <div className="eta-row"><span>Enişə qalan:</span><strong>{flightInfo.eta.eta_human}</strong></div>
          {flightInfo.eta.speed_kmh && <div className="eta-row"><span>Sürət:</span><strong>{flightInfo.eta.speed_kmh} km/s</strong></div>}
          {flightInfo.schedule && (
            <div className={`delay-box ${flightInfo.schedule.is_delayed ? 'delayed' : 'ontime'}`}>
              {flightInfo.schedule.is_delayed ? (
                <>⚠️ <strong>Gecikmə: {flightInfo.schedule.delay_minutes} dəq</strong></>
              ) : (
                <>✅ Vaxtında</>
              )}
            </div>
          )}
        </div>
      )}

      <p style={{ margin: '5px 0' }}><b>Ölkə:</b> {plane.country}</p>
      <p style={{ margin: '5px 0' }}><b>Hündürlük:</b> {plane.altitude_m ? `${plane.altitude_m} m` : '—'}</p>
      <p style={{ margin: '5px 0' }}><b>Sürət:</b> {plane.velocity_ms ? `${plane.velocity_ms} m/s` : '—'}</p>

      {isGoingToAZ && (
        <>
          <hr style={{ margin: '10px 0' }} />
          <details onToggle={loadTransport} style={{ cursor: 'pointer' }}>
            <summary style={{ fontWeight: 'bold', color: '#2563eb' }}>
              🛬 {route.destination_city} hava limanından necə çıxım?
            </summary>
            {transportData ? (
              transportData.error ? (
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>{transportData.error}</p>
              ) : (
                <div style={{ marginTop: '10px', fontSize: '13px' }}>
                  <p style={{ fontWeight: 'bold', margin: '0 0 5px 0' }}>{transportData.airport}</p>
                  {transportData.options.map((opt, i) => (
                    <div key={i} style={{ marginBottom: '8px', padding: '5px', background: '#f3f4f6', borderRadius: '5px' }}>
                      <b>{opt.type}</b><br />
                      Qiymət: {opt.price} | Vaxt: {opt.time}<br />
                      <span style={{ color: '#666' }}>{opt.schedule}</span><br />
                      <span style={{ color: '#888', fontSize: '11px' }}>{opt.note}</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>Yüklənir...</p>
            )}
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

  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/planes`);
        setPlanes(res.data.planes);
      } catch (error) {
        console.error("Data çəkilərkən xəta:", error);
      }
    };
    fetchPlanes();
    const interval = setInterval(fetchPlanes, 5000);
    return () => clearInterval(interval);
  }, []);

  const flyToPlane = (lat, lng) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 10, { duration: 2 });
      setShowList(false);
    }
  };

  const filteredPlanes = planes.filter((plane) =>
    plane.callsign.toLowerCase().startsWith(searchQuery.toLowerCase())
  );

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
          {highestPlane.callsign && (
            <div>Ən yüksək: <b style={{ color: '#60a5fa' }}>{highestPlane.callsign}</b> ({highestPlane.altitude_m} m)</div>
          )}
        </div>
      </header>

      <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
        {showList && (
          <div className="sidebar">
            <h3 style={{ margin: '0 0 15px 0', color: '#1e3a8a' }}>Təyyarələr ({filteredPlanes.length})</h3>
            {filteredPlanes.length === 0 && <p style={{ color: '#666' }}>Heç bir təyyarə tapılmadı.</p>}
            {filteredPlanes.map((plane) => (
              plane.latitude && plane.longitude && (
                <div key={plane.icao24} onClick={() => flyToPlane(plane.latitude, plane.longitude)} className="plane-list-item">
                  <div style={{ fontWeight: 'bold', color: '#1e3a8a' }}>{plane.callsign}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{plane.country} | {plane.altitude_m ? `${plane.altitude_m} m` : '—'}</div>
                </div>
              )
            ))}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <MapContainer center={[40.4093, 49.8671]} zoom={7} style={{ height: '100%', width: '100%' }} ref={mapRef}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            {filteredPlanes.map((plane) => (
              plane.latitude && plane.longitude && (
                <Marker key={plane.icao24} position={[plane.latitude, plane.longitude]} icon={getPlaneIcon(plane.heading)}>
                  <Popup><PlanePopupContent plane={plane} /></Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;