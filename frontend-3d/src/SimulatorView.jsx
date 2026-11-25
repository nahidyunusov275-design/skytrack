import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { FlightPhysics } from './physics';
import { AIRPORTS, distanceToAirportNM } from './airports';
import './SimulatorView.css';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

const cloudSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <ellipse cx="50" cy="60" rx="40" ry="25" fill="white" opacity="0.85"/>
  <ellipse cx="100" cy="50" rx="50" ry="30" fill="white" opacity="0.85"/>
  <ellipse cx="150" cy="60" rx="40" ry="25" fill="white" opacity="0.85"/>
  <ellipse cx="80" cy="70" rx="30" ry="20" fill="white" opacity="0.85"/>
  <ellipse cx="130" cy="70" rx="30" ry="20" fill="white" opacity="0.85"/></
svg>`;

const speak = (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'az-AZ';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
};

export default function SimulatorView({ targetAirport = 'GYD', onExit }) {
  const viewerRef = useRef(null);
  const physicsRef = useRef(null);
  const inputRef = useRef({ up: false, down: false, left: false, right: false, shift: false, ctrl: false });
  const cameraModeRef = useRef('chase');
  const statusRef = useRef('flying');
  
  const [hud, setHud] = useState({ speed: 200, alt: 3000, heading: 90, relativeBearing: 0 });
  const [cameraMode, setCameraMode] = useState('chase');
  const [status, setStatus] = useState('flying');
  const [distance, setDistance] = useState(0);
  const [warnings, setWarnings] = useState([]);

  const airport = AIRPORTS[targetAirport] || AIRPORTS.GYD;

  useEffect(() => {
    const cloudUrl = 'data:image/svg+xml;base64,' + btoa(cloudSvg);

    const viewer = new Cesium.Viewer(viewerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      terrain: Cesium.Terrain.fromWorldTerrain(),
    });

    Cesium.createOsmBuildingsAsync()
      .then((buildings) => {
        if (!viewer.isDestroyed()) viewer.scene.primitives.add(buildings);
      })
      .catch((e) => console.warn('OSM buildings failed:', e));

    // Buludlar
    for (let i = 0; i < 40; i++) {
      const lat = 40.3 + Math.random() * 1.5;
      const lon = 48.5 + Math.random() * 2.5;
      const alt = 3000 + Math.random() * 6000;
      viewer.entities.add({
        id: `cloud-${i}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        billboard: {
          image: cloudUrl,
          width: 200 + Math.random() * 200,
          height: 100 + Math.random() * 100,
          color: Cesium.Color.WHITE.withAlpha(0.3 + Math.random() * 0.3),
        },
      });
    }

    // ── NƏHƏNG İŞIQ DİRƏYİ (20 km hündürlük) ──
    // Kabinədən belə uzaqdan görünməsi üçün
    viewer.entities.add({
      id: 'airport-beacon',
      position: Cesium.Cartesian3.fromDegrees(airport.lon, airport.lat, 10000), // Mərkəzi 10km-də
      cylinder: {
        length: 20000, // 20 km hündürlük
        topRadius: 150,
        bottomRadius: 150,
        material: Cesium.Color.LIME.withAlpha(0.7),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    });

    // Uçuş Zolağı
    const runway = airport.runways[0];
    viewer.entities.add({
      id: 'runway',
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(
          Cesium.Cartesian3.fromDegreesArray([
            runway.start.lon, runway.start.lat,
            runway.end.lon, runway.end.lat,
            runway.end.lon + 0.001, runway.end.lat + 0.001,
            runway.start.lon + 0.001, runway.start.lat + 0.001,
          ])
        ),
        material: Cesium.Color.GRAY.withAlpha(0.8),
        classificationType: Cesium.ClassificationType.TERRAIN,
      },
    });

    viewer.entities.add({
      id: 'runway-marker',
      position: Cesium.Cartesian3.fromDegrees(airport.lon, airport.lat, 0),
      point: { pixelSize: 20, color: Cesium.Color.LIME, outlineColor: Cesium.Color.WHITE, outlineWidth: 3 },
      label: {
        text: `HƏDƏF: ${airport.code}`,
        font: 'bold 20px monospace',
        fillColor: Cesium.Color.LIME,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 4,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000)
      },
    });

    // Başlanğıc nöqtəsi
    const startLat = airport.lat + 0.3;
    const startLon = airport.lon - 0.3;
    const dLon = airport.lon - startLon;
    const dLat = airport.lat - startLat;
    const bearing = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;

    physicsRef.current = new FlightPhysics(startLat, startLon, 5000, bearing);

    const planeEntity = viewer.entities.add({
      id: 'player-plane',
      name: 'Player',
      position: Cesium.Cartesian3.fromDegrees(physicsRef.current.lon, physicsRef.current.lat, 5000 * 0.3048),
      model: {
        uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb',
        minimumPixelSize: 64,
        maximumScale: 200,
        scale: 1.0,
      },
    });

    // Bələdçi xətti
    viewer.entities.add({
      id: 'flight-guide',
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const pos = planeEntity.position.getValue(viewer.clock.currentTime);
          if (!pos) return [];
          return [pos, Cesium.Cartesian3.fromDegrees(airport.lon, airport.lat, 0)];
        }, false),
        width: 4,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.LIME.withAlpha(0.8),
          dashLength: 30,
        }),
      },
    });

    viewer.trackedEntity = planeEntity;
    viewer.trackedEntityOffset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-25), 400);

    const onKeyDown = (e) => {
      const input = inputRef.current;
      if (e.key === 'ArrowUp') input.up = true;
      if (e.key === 'ArrowDown') input.down = true;
      if (e.key === 'ArrowLeft') input.left = true;
      if (e.key === 'ArrowRight') input.right = true;
      if (e.key === 'Shift') input.shift = true;
      if (e.key === 'Control') input.ctrl = true;
      if (e.key === 'c' || e.key === 'C') {
        const next = cameraModeRef.current === 'chase' ? 'cockpit' : 'chase';
        cameraModeRef.current = next;
        setCameraMode(next);
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    const onKeyUp = (e) => {
      const input = inputRef.current;
      if (e.key === 'ArrowUp') input.up = false;
      if (e.key === 'ArrowDown') input.down = false;
      if (e.key === 'ArrowLeft') input.left = false;
      if (e.key === 'ArrowRight') input.right = false;
      if (e.key === 'Shift') input.shift = false;
      if (e.key === 'Control') input.ctrl = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let lastTime = performance.now();
    let lastHudUpdate = 0;
    let rafId;
    
    let hasWarnedTooHigh = false;
    let hasWarnedTooFast = false;
    let hasWarnedAway = false;
    let initialDist = null;

    const update = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const physics = physicsRef.current;
      
      // ASAN İDARƏETMƏ
      if (inputRef.current.up) physics.throttle = Math.min(1, physics.throttle + 0.5 * dt);
      if (inputRef.current.down) physics.throttle = Math.max(0, physics.throttle - 0.5 * dt);
      if (inputRef.current.left) physics.heading -= 45 * dt;
      if (inputRef.current.right) physics.heading += 45 * dt;
      if (inputRef.current.shift) physics.alt += 150 * dt;
      if (inputRef.current.ctrl) physics.alt -= 150 * dt;

      physics.update(dt, inputRef.current);

      const pos = Cesium.Cartesian3.fromDegrees(physics.lon, physics.lat, physics.alt * 0.3048);
      planeEntity.position = pos;

      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(physics.heading),
        Cesium.Math.toRadians(0),
        Cesium.Math.toRadians(0)
      );
      planeEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

      if (cameraModeRef.current === 'cockpit') {
        planeEntity.show = false;
        if (viewer.trackedEntity) viewer.trackedEntity = undefined;
        viewer.camera.setView({
          destination: pos,
          orientation: {
            heading: Cesium.Math.toRadians(physics.heading),
            pitch: Cesium.Math.toRadians(-15), // Bir az aşağı baxır ki, yeri görəsən
            roll: 0,
          },
        });
      } else {
        planeEntity.show = true;
        if (viewer.trackedEntity !== planeEntity) {
          viewer.trackedEntity = planeEntity;
          viewer.trackedEntityOffset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-25), 400);
        }
      }

      const distNM = distanceToAirportNM(physics.lat, physics.lon, airport);
      if (initialDist === null) initialDist = distNM;

      // ── HƏDƏF OXU ÜÇÜN RİYAZİ HESABLAMA ──
      const dLon = airport.lon - physics.lon;
      const dLat = airport.lat - physics.lat;
      const bearingToAirport = (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
      const relativeBearing = (bearingToAirport - physics.heading + 360) % 360;

      if (now - lastHudUpdate > 100) {
        setDistance(Math.round(distNM));
        setHud({
          speed: Math.round(physics.speed),
          alt: Math.round(physics.alt),
          heading: Math.round(physics.heading),
          relativeBearing: relativeBearing, // Hədəfin təyyarəyə görə bucağı
        });
        lastHudUpdate = now;
      }

      if (distNM > initialDist + 3 && !hasWarnedAway) {
        speak("Diqqət! Təyinat hava limanından uzaqlaşırsınız. Geri qayıdın!");
        setWarnings(w => [...w, "Uzaqlaşırsınız! Geri qayıdın!"]);
        hasWarnedAway = true;
        setTimeout(() => { hasWarnedAway = false; }, 10000); 
      }

      if (distNM < 10 && distNM > 2) {
        if (physics.alt > 5000 && !hasWarnedTooHigh) {
          speak("Diqqət! Hündürlük çoxdur. Aşağı enin.");
          setWarnings(w => [...w, "Hündürlük çoxdur!"]);
          hasWarnedTooHigh = true;
        }
        if (physics.speed > 250 && !hasWarnedTooFast) {
          speak("Diqqət! Sürət çoxdur. Sürəti azaldın.");
          setWarnings(w => [...w, "Sürət çoxdur!"]);
          hasWarnedTooFast = true;
        }
      }

      if (distNM < 1 && physics.alt < 50) {
        if (physics.speed > 180) {
          physics.crashed = true;
          speak("Qəza! Çox sürətli eniş etdiniz.");
        } else if (physics.speed < 50) {
          physics.crashed = true;
          speak("Qəza! Təyyarə dayandı.");
        } else {
          physics.landed = true;
          speak(`Təbriklər! Uğurlu eniş etdiniz. Xoş gəldiniz, ${airport.city}!`);
        }
      }

      if (physics.crashed && statusRef.current !== 'crashed') {
        statusRef.current = 'crashed';
        setStatus('crashed');
      } else if (physics.landed && statusRef.current !== 'landed') {
        statusRef.current = 'landed';
        setStatus('landed');
      }

      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [airport]); 

  return (
    <div className="sim-container">
      <div ref={viewerRef} className="cesium-container" />

      <button className="exit-sim-btn" onClick={onExit}>✕ Çıxış</button>

      <div className="sim-big-distance">
        <span>HƏDƏFƏ QALAN MƏSAFƏ</span>
        <h1>{distance} NM</h1>
      </div>

      {/* HƏDƏF OXU (Directional Arrow) */}
      <div className="sim-target-arrow-container">
        <div 
          className="sim-target-arrow" 
          style={{ transform: `rotate(${hud.relativeBearing}deg)` }}
        >
          ⬆️
        </div>
        <span>HƏDƏF</span>
      </div>

      <div className="sim-hud">
        <div className="hud-row"><span>SÜRƏT</span><span>{hud.speed} kt</span></div>
        <div className="hud-row"><span>HÜNDÜRLÜK</span><span>{hud.alt.toLocaleString()} ft</span></div>
        <div className="hud-row"><span>İSTİQAMƏT</span><span>{hud.heading}°</span></div>
        <div className="hud-row"><span>HƏDƏF</span><span>{airport.code}</span></div>
      </div>

      <div className="sim-camera-mode">
        Kamera: {cameraMode === 'chase' ? 'Arxadan' : 'Kabin'} [C]
      </div>

      <div className="sim-controls">
        ↑ Sürəti artır · ↓ Sürəti azalt · ← Sola dön · → Sağa dön · Shift Qalx · Ctrl En
      </div>

      {warnings.length > 0 && (
        <div className="sim-warnings">
          {warnings.map((w, i) => <div key={i} className="warning-item">{w}</div>)}
        </div>
      )}

      {status === 'crashed' && (
        <div className="sim-status crashed">
          <h1>💥 QƏZA</h1>
          <p>Eniş uğursuz oldu.</p>
          <button onClick={() => window.location.reload()}>Yenidən başla</button>
        </div>
      )}
      {status === 'landed' && (
        <div className="sim-status landed">
          <h1>✅ UĞURLU ENİŞ</h1>
          <p>Xoş gəldiniz, {airport.city}!</p>
          <button onClick={() => window.location.reload()}>Yenidən başla</button>
        </div>
      )}
    </div>
  );
}