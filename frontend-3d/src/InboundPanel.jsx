import { useEffect, useState } from 'react';
import './InboundPanel.css';

const API_URL = 'https://skytrack-backend-j6az.onrender.com/api/planes-az';

const STATUS_COLORS = {
  landing: '#22c55e',
  approach: '#22c55e',
  descending: '#eab308',
  inbound: '#f97316',
};

const STATUS_LABELS = {
  landing: 'Enir',
  approach: 'Yaxınlaşır',
  descending: 'Aşağı düşür',
  inbound: 'Gəlir',
};

export default function InboundPanel({ onPlaneClick }) {
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();

        const relevant = (data.planes || []).filter(p =>
          ['landing', 'approach', 'descending', 'inbound'].includes(p.status)
        );

        setPlanes(relevant);
        setLastUpdate(new Date().toLocaleTimeString('az-AZ'));
      } catch (err) {
        console.error('API xətası:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanes();
    const interval = setInterval(fetchPlanes, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inbound-panel">
      <div className="inbound-header">
        <h2>🛬 Azərbaycana gələnlər</h2>
        <span className="inbound-count">{planes.length}</span>
      </div>

      {loading ? (
        <div className="inbound-loading">Yüklənir...</div>
      ) : planes.length === 0 ? (
        <div className="inbound-empty">Hazırda gələn təyyarə yoxdur</div>
      ) : (
        <ul className="inbound-list">
          {planes.map(p => (
            <li
              key={p.hex}
              className="inbound-item"
              onClick={() => onPlaneClick && onPlaneClick(p)}
            >
              <div className="inbound-row">
                <span
                  className="inbound-dot"
                  style={{ background: STATUS_COLORS[p.status] || '#666' }}
                />
                <span className="inbound-callsign">
                  {p.callsign || p.hex}
                </span>
                <span className="inbound-eta">
                  {p.eta_minutes ? `${p.eta_minutes} dəq` : '—'}
                </span>
              </div>
              <div className="inbound-row inbound-sub">
                <span className="inbound-airport">
                  → {p.target_airport} ({p.airport_city})
                </span>
                <span className="inbound-status">
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </div>
              <div className="inbound-row inbound-sub">
                <span>{p.alt ? `${Math.round(p.alt).toLocaleString()} ft` : '—'}</span>
                <span>{p.distance_nm ? `${p.distance_nm} NM` : '—'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lastUpdate && (
        <div className="inbound-footer">
          Son yenilənmə: {lastUpdate}
        </div>
      )}
    </div>
  );
}