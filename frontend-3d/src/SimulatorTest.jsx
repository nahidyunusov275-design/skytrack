import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './App.css';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

export default function SimulatorTest() {
  const viewerRef = useRef(null);

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

    // Bakı üzərində kameranı yerləşdir
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(50.0467, 40.4675, 3000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-20),
        roll: 0,
      },
    });

    // Təyyarə modelini yüklə
    const planeEntity = viewer.entities.add({
      id: 'test-plane',
      name: 'Test Plane',
      position: Cesium.Cartesian3.fromDegrees(50.0467, 40.4675, 500),
      model: {
        uri: 'https://raw.githubusercontent.com/CesiumGS/cesium/main/Apps/SampleData/models/CesiumAir/Cesium_Air.glb',
        minimumPixelSize: 64,
        maximumScale: 200,
        scale: 1.0,
      },
    });

    // Kameranı təyyarəyə izlə (arxadan, bir az yuxarıdan)
    viewer.trackedEntity = planeEntity;
    viewer.trackedEntityOffset = new Cesium.HeadingPitchRange(
      0,                          // heading (arxadan)
      Cesium.Math.toRadians(-15), // pitch (bir az aşağı bax)
      100                         // məsafə (metr)
    );

    // Təyyarəni hərəkət etdir (şimala doğru, yavaş-yavaş qalxır)
    let lat = 40.4675;
    let alt = 500;
    let heading = 0;

    const interval = setInterval(() => {
      lat += 0.00005;
      alt += 0.3;
      heading = (heading + 0.5) % 360;

      const position = Cesium.Cartesian3.fromDegrees(50.0467, lat, alt);
      planeEntity.position = position;

      const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(heading),
        0,
        0
      );
      planeEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
        position,
        hpr
      );
    }, 50);

    return () => {
      clearInterval(interval);
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, []);

  return (
    <div className="app-container">
      <div ref={viewerRef} className="cesium-container" />
      <div className="hud">
        <h1>🧪 3D Model Test</h1>
        <p>Model yüklənir... Kamera təyyarəni izləyir</p>
        <p style={{ fontSize: '12px', opacity: 0.7 }}>
          Model görünmürsə, 5-10 saniyə gözlə
        </p>
      </div>
    </div>
  );
}