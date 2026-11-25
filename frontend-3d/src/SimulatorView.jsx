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
  <ellipse cx="130" cy="70" rx="30" ry="20" fill="white" opacity="0.85"/>
</svg>`;

// Səsli xəbərdarlıq funksiyası
const speak = (text) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Əvvəlki səsləri ləğv et ki, üst-üstə yığılmasın
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  }
};

export default function SimulatorView({ targetAirport = 'GYD' }) {
  const viewerRef = useRef(null);
  const physicsRef = useRef(null);
  const inputRef = useRef({ up: false, down: false, left: false, right: false, shift: false, ctrl: false });
  const cameraModeRef = useRef('chase');
  const statusRef = useRef('flying'); // Statusu ref-də saxlayırıq ki, useEffect təkrar işləməsin
  
  const [hud, setHud] = useState({ speed: 200, alt: 3000, heading: 90, pitch: 0, roll: 0, throttle: 50 });
  const [cameraMode, setCameraMode] = useState('chase');
  const [status, setStatus] = useState('flying');
  const [distance, setDistance] = useState(0);
  const [warnings, setWarnings] = useState([]);

  const airport = AIRPORTS[targetAirport] || AIRPORTS.GYD;

  useEffect(() => {
    // ✅ BTOA XƏTASI HƏLLİ: cloudUrl-i burada yaradırıq
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

    // ✅ BULUDLAR
    for (let i = 0; i < 25; i++) {
      const lat = 40.3 + Math.random() * 0.4;
      const lon = 49.4 + Math.random() * 1.2;
      const alt = 5000 + Math.random() * 4000;
      viewer.entities.add({
        id: `cloud-${i}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        billboard: {
          image: cloudUrl,
          width: 150 + Math.random() * 150,
          height: 75 + Math.random() * 75,
          color: Cesium.Color.WHITE.withAlpha(0.15 + Math.random() * 0.2),
        },
      });
    }

    // ✅ RUNWAY (Uçuş Zolağı) ÇƏKMƏK
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

    // Runway mərkəzinə marker
    viewer.entities.add({
      id: 'runway-marker',
      position: Cesium.Cartesian3.fromDegrees(airport.lon, airport.lat, 0),
      point: {
        pixelSize: 12,
        color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: `${airport.code} - ${airport.name}`,
        font: 'bold 14px monospace',
        fillColor: Cesium.Color.LIME,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -20),
      },
    });

    // Başlanğıc: Hava limanından 30 NM uzaqda
    physicsRef.current = new FlightPhysics(airport.lat + 0.3, airport.lon - 0.3, 5000, 90);

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

    viewer.trackedEntity = planeEntity;
    viewer.trackedEntityOffset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 100);

    // ── KLAVİATURA ──
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

    // ── UPDATE LOOP ──
    let lastTime = performance.now();
    let lastHudUpdate = 0;
    let rafId;
    let hasWarnedTooHigh = false;
    let hasWarnedTooFast = false;

    const update = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const physics = physicsRef.current;
      physics.update(dt, inputRef.current);

      const pos = Cesium.Cartesian3.fromDegrees(physics.lon, physics.lat, physics.alt * 0.3048);
      planeEntity.position = pos;

      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(physics.heading),
        Cesium.Math.toRadians(physics.pitch),
        Cesium.Math.toRadians(physics.roll)
      );
      planeEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

      // ── KAMERA ──
      if (cameraModeRef.current === 'cockpit') {
        planeEntity.show = false;
        if (viewer.trackedEntity) viewer.trackedEntity = undefined;
        viewer.camera.setView({
          destination: pos,
          orientation: {
            heading: Cesium.Math.toRadians(physics.heading),
            pitch: Cesium.Math.toRadians(physics.pitch),
            roll: Cesium.Math.toRadians(physics.roll),
          },
        });
      } else {
        planeEntity.show = true;
        if (viewer.trackedEntity !== planeEntity) {
          viewer.trackedEntity = planeEntity;
          viewer.trackedEntityOffset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 100);
        }
      }

      // ── MƏSAFƏ VƏ ENİŞ MƏNTİQİ ──
      const distNM = distanceToAirportNM(physics.lat, physics.lon, airport);
      
      if (now - lastHudUpdate > 100) {
        setDistance(Math.round(distNM));
        setHud({
          speed: Math.round(physics.speed),
          alt: Math.round(physics.alt),
          heading: Math.round(physics.heading),
          pitch: Math.round(physics.pitch),
          roll: Math.round(physics.roll),
          throttle: Math.round(physics.throttle * 100),
        });
        lastHudUpdate = now;
      }

      // Səsli xəbərdarlıqlar (hava limanına yaxınlaşanda)
      if (distNM < 10 && distNM > 2) {
        if (physics.alt > 5000 && !hasWarnedTooHigh) {
          speak("Warning: too high. Descend.");
          setWarnings(w => [...w, "Too high!"]);
          hasWarnedTooHigh = true;
        }
        if (physics.speed > 250 && !hasWarnedTooFast) {
          speak("Warning: too fast. Reduce speed.");
          setWarnings(w => [...w, "Too fast!"]);
          hasWarnedTooFast = true;
        }
      }

      // Eniş yoxlaması
      if (distNM < 1 && physics.alt < 50) {
        if (physics.speed > 180) {
          physics.crashed = true;
          speak("Crash! You landed too fast.");
        } else if (physics.speed < 50) {
          physics.crashed = true;
          speak("Crash! You stalled.");
        } else {
          physics.landed = true;
          speak("Landing successful. Welcome to " + airport.city);
        }
      }

      // ✅ STATUS XƏTASI HƏLLİ: statusRef istifadə edirik
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
  }, [airport]); // ✅ STATUS-U BURADAN SİLDİK

  return (
    <div className="sim-container">
      <div ref={viewerRef} className="cesium-container" />

      <div className="sim-hud">
        <div className="hud-row"><span>SPEED</span><span>{hud.speed} kt</span></div>
        <div className="hud-row"><span>ALT</span><span>{hud.alt.toLocaleString()} ft</span></div>
        <div className="hud-row"><span>HDG</span><span>{hud.heading}°</span></div>
        <div className="hud-row"><span>DIST</span><span>{distance} NM</span></div>
        <div className="hud-row"><span>TARGET</span><span>{airport.code}</span></div>
      </div>

      <div className="sim-camera-mode">
        Camera: {cameraMode === 'chase' ? 'Chase' : 'Cockpit'} [C]
      </div>

      <div className="sim-controls">
        ↑↓ Pitch · ←→ Roll · Shift Throttle+ · Ctrl Throttle− · C Camera
      </div>

      {status === 'crashed' && (
        <div className="sim-status crashed">
          <h1>💥 CRASHED</h1>
          <p>Eniş uğursuz oldu.</p>
          <button onClick={() => window.location.reload()}>Yenidən başla</button>
        </div>
      )}
      {status === 'landed' && (
        <div className="sim-status landed">
          <h1>✅ LANDED</h1>
          <p>Xoş gəldiniz, {airport.city}!</p>
          <button onClick={() => window.location.reload()}>Yenidən başla</button>
        </div>
      )}
    </div>
  );
}