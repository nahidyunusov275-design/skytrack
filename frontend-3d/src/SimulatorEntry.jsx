import { useState } from 'react';
import { AIRPORTS } from './airports';
import './SimulatorEntry.css';

export default function SimulatorEntry({ onStart }) {
  const [selected, setSelected] = useState('GYD');

  return (
    <div className="entry-container">
      <div className="entry-modal">
        <h1>✈️ SkyTrack Simulator</h1>
        <p>Hədəf hava limanını seçin</p>

        <div className="airport-grid">
          {Object.values(AIRPORTS).map((ap) => (
            <div
              key={ap.code}
              className={`airport-card ${selected === ap.code ? 'active' : ''}`}
              onClick={() => setSelected(ap.code)}
            >
              <h3>{ap.code}</h3>
              <p>{ap.city}</p>
              <small>{ap.name}</small>
            </div>
          ))}
        </div>

        <button className="start-btn" onClick={() => onStart(selected)}>
          Simulyasiyaya Başla 🚀
        </button>
      </div>
    </div>
  );
}