import { useEffect, useState, useRef } from 'react';
import './LandedPanel.css';

const API_URL = 'https://skytrack-backend-j6az.onrender.com/api/planes-az';

export default function LandedPanel() {
  const [landedPlanes, setLandedPlanes] = useState([]);
  const prevPlanesRef = useRef([]);

  useEffect(() => {
    const fetchPlanes = async () => {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        const currentPlanes = data.planes || [];

        // Əvvəlki siyahıda olub, indi yox olan və ya yerə enən təyyarələri tapırıq
        const newlyLanded = prevPlanesRef.current.filter(prevPlane => {
          // Əgər əvvəl havada idisə (istənilən status)
          const wasInAir = ['inbound', 'landing', 'approach', 'descending', 'cruise'].includes(prevPlane.status);
          if (!wasInAir) return false;

          // İndiki siyahıda həmin təyyarəyə baxırıq
          const currentPlane = currentPlanes.find(p => p.hex === prevPlane.hex);

          // Əgər indiki siyahıda YOXDURSA və ya statusu "ground" (yerdə) OLUBBSA
          if (!currentPlane || currentPlane.status === 'ground') {
            console.log("✅ Təyyarə endi:", prevPlane.callsign);
            return true;
          }
          return false;
        });

        if (newlyLanded.length > 0) {
          setLandedPlanes(prev => {
            const combined = [...newlyLanded, ...prev];
            // Təkrarlananları silirik
            const unique = Array.from(new Map(combined.map(p => [p.hex, p])).values());
            // Son 5 enişi saxlayırıq
            return unique.slice(0, 5);
          });
        }

        prevPlanesRef.current = currentPlanes;
      } catch (err) {
        console.error('Landed Panel xətası:', err);
      }
    };

    fetchPlanes();
    const interval = setInterval(fetchPlanes, 10000);
    return () => clearInterval(interval);
  }, []);

  // Panelin həmişə görünməsini istəyiriksə, bu sətri silirik.
  // Amma boş olanda da görünməsini istəyiriksə, sadəcə siyahını boş göstəririk.
  
  return (
    <div className="landed-panel">
      <div className="landed-header">
        <h2>✅ Son Eniş Edənlər</h2>
        <span className="landed-count">{landedPlanes.length}</span>
      </div>
      
      {landedPlanes.length === 0 ? (
        <div className="landed-empty">Hələ ki, eniş qeydə alınmayıb...</div>
      ) : (
        <ul className="landed-list">
          {landedPlanes.map(p => (
            <li key={p.hex} className="landed-item">
              <div className="landed-row">
                <span className="landed-callsign">
                  {p.callsign || p.hex}
                </span>
                <span className="landed-status">Eniş etdi</span>
              </div>
              <div className="landed-row landed-sub">
                <span>Hava Limanı: {p.target_airport || 'Bilinmir'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}