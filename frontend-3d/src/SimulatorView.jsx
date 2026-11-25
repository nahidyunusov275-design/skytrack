import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { FlightPhysics } from './physics';
import './SimulatorView.css';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

// Bulud teksturası (SVG)
const cloudSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <ellipse cx="50" cy="60" rx="40" ry="25" fill="white" opacity="0.85"/>
  <ellipse cx="100" cy="50" rx="50" ry="30" fill="white" opacity="0.85"/>
  <ellipse cx="150" cy="60" rx="40" ry="25" fill="white" opacity="0.85"/>
  <ellipse cx="80" cy="70" rx="30" ry="20" fill="white" opacity="0.85"/>
  <ellipse cx="130" cy="70" rx="30" ry="20" fill="white" opacity="0.85"/>
</svg>`;
const cloudUrl = 'data:image/svg+xml;base64,' + btoa(cloudSvg);

export default function SimulatorView() {
  const viewerRef = useRef(null);
  const physicsRef = useRef(null);
  const inputRef = useRef({ up: false, down: false, left: false, right: false, shift: false, ctrl: false });
  const cameraModeRef = useRef('chase');
  const camStateRef = useRef({ heading: 90, pitch: 0, roll: 0, initialized: false });
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

    // ✅ 3D BİNALAR (Bakı)
    Cesium.createOsmBuildingsAsync()
      .then((buildings) => {
        if (!viewer.isDestroyed()) viewer.scene.primitives.add(buildings);
      })
      .catch((e) => console.warn('OSM buildings failed:', e));

    // ✅ BULUDLAR (hərəkət hissi üçün)
    for (let i = 0; i < 40; i++) {
      const lat = 40.3 + Math.random() * 0.4;
      const lon = 49.4 + Math.random() * 1.2;
      const alt = 1500 + Math.random() * 4500;
      viewer.entities.add({
        id: `cloud-${i}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        billboard: {
          image: cloudUrl,
          width: 400 + Math.random() * 400,
          height: 200 + Math.random() * 200,
          color: Cesium.Color.WHITE.withAlpha(0.4 + Math.random() * 0.4),
        },
      });
    }

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
        camStateRef.current.initialized = false;
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

      // ── KAMERA ──
      const cam = camStateRef.current;

      if (cameraModeRef.current === 'cockpit') {
        // ✅ COCKPIT: modeli gizlət, kameranı təyyarənin içindən
        planeEntity.show = false;
        viewer.trackedEntity = undefined;

        viewer.camera.setView({
          destination: pos,
          orientation: {
            heading: Cesium.Math.toRadians(physics.heading),
            pitch: Cesium.Math.toRadians(physics.pitch),
            roll: Cesium.Math.toRadians(physics.roll),
          },
        });
      } else {
        // ✅ CHASE: modeli göstər, kamera lag ilə izlə
        planeEntity.show = true;

        if (!cam.initialized) {
          cam.heading = physics.heading;
          cam.pitch = physics.pitch;
          cam.roll = physics.roll;
          cam.initialized = true;
        }

        // Kamera lag (yumşaq izləmə)
        const lerpFactor = 1 - Math.exp(-dt * 3); // 3 = lag sürəti
        cam.heading += (physics.heading - cam.heading) * lerpFactor;
        cam.pitch += (physics.pitch - cam.pitch) * lerpFactor;
        cam.roll += (physics.roll - cam.roll) * lerpFactor;

        // Kamera mövqeyi: təyyarənin arxasında, bir az yuxarıda
        const camHpr = new Cesium.HeadingPitchRoll(
          Cesium.Math.toRadians(cam.heading),
          Cesium.Math.toRadians(cam.pitch),
          Cesium.Math.toRadians(cam.roll)
        );
        const camOffset = new Cesium.Cartesian3(0, -80, 30); // arxa + yuxarı
        const camTransform = Cesium.Transforms.headingPitchRollToFixedFrame(pos, camHpr);
        const camPos = Cesium.Matrix4.multiplyByPoint(camTransform, camOffset, new Cesium.Cartesian3());

        viewer.camera.setView({
          destination: camPos,
          orientation: {
            heading: Cesium.Math.toRadians(cam.heading),
            pitch: Cesium.Math.toRadians(cam.pitch - 10),
            roll: Cesium.Math.toRadians(cam.roll),
          },
        });
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