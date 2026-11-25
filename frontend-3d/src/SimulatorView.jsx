import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { FlightPhysics } from './physics';
import './SimulatorView.css';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

export default function SimulatorView() {
  const viewerRef = useRef(null);
  const physicsRef = useRef(null);
  const inputRef = useRef({ up: false, down: false, left: false, right: false, shift: false, ctrl: false });
  const cameraModeRef = useRef('chase');
  const [hud, setHud] = useState({ speed: 200, alt: 3000, heading: 90, pitch: 0, roll: 0, throttle: 50 });
  const [cameraMode, setCameraMode] = useState('chase');
  const [status, setStatus] = useState('flying');

  useEffect(() => {
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

    // Başlanğıc: Bakıdan ~20 km qərbdə, 3000 ft, şərqə (90°)
    physicsRef.current = new FlightPhysics(40.4675, 49.8, 3000, 90);

    const planeEntity = viewer.entities.add({
      id: 'player-plane',
      name: 'Player',
      position: Cesium.Cartesian3.fromDegrees(49.8, 40.4675, 3000 * 0.3048),
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

      // Kamera rejimi
      if (cameraModeRef.current === 'cockpit') {
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
        if (viewer.trackedEntity !== planeEntity) {
          viewer.trackedEntity = planeEntity;
          viewer.trackedEntityOffset = new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-15), 100);
        }
      }

      // HUD (10 fps)
      if (now - lastHudUpdate > 100) {
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

      if (physics.crashed && status !== 'crashed') setStatus('crashed');
      else if (physics.landed && status !== 'landed') setStatus('landed');

      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  return (
    <div className="sim-container">
      <div ref={viewerRef} className="cesium-container" />

      <div className="sim-hud">
        <div className="hud-row"><span>SPEED</span><span>{hud.speed} kt</span></div>
        <div className="hud-row"><span>ALT</span><span>{hud.alt.toLocaleString()} ft</span></div>
        <div className="hud-row"><span>HDG</span><span>{hud.heading}°</span></div>
        <div className="hud-row"><span>PITCH</span><span>{hud.pitch}°</span></div>
        <div className="hud-row"><span>ROLL</span><span>{hud.roll}°</span></div>
        <div className="hud-row"><span>THR</span><span>{hud.throttle}%</span></div>
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
          <p>Sürət çox yüksək idi eniş zamanı</p>
          <button onClick={() => window.location.reload()}>Yenidən başla</button>
        </div>
      )}
      {status === 'landed' && (
        <div className="sim-status landed">
          <h1>✅ LANDED</h1>
          <p>Təhlükəsiz eniş!</p>
          <button onClick={() => window.location.reload()}>Yenidən başla</button>
        </div>
      )}
    </div>
  );
}