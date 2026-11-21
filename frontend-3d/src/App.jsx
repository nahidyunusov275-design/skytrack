import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './App.css'

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

// 🛩️ MÜVƏQQƏTİ MOCK DATA (Backend düzələndə silinəcək)
const MOCK_PLANES = [
  { callsign: "THY123", latitude: 40.4093, longitude: 49.8671, altitude: 10000, heading: 90 },
  { callsign: "AFL456", latitude: 41.0000, longitude: 48.0000, altitude: 11000, heading: 180 },
  { callsign: "BAW789", latitude: 39.5000, longitude: 50.5000, altitude: 9000, heading: 270 },
  { callsign: "AZA001", latitude: 40.2000, longitude: 47.5000, altitude: 12000, heading: 45 },
];

export default function App() {
  const viewerRef = useRef(null)

  useEffect(() => {
    const viewer = new Cesium.Viewer(viewerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: true,
      sceneModePicker: true,
      navigationHelpButton: false,
      fullscreenButton: true,
      infoBox: false,
      selectionIndicator: false,
      terrain: Cesium.Terrain.fromWorldTerrain()
    })

    // Kamera Bakıya yönəlsin
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(49.8671, 40.4093, 1500000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    })

    // 🛩️ Təyyarələri Yer kürəsinə əlavə et
    MOCK_PLANES.forEach((plane) => {
      viewer.entities.add({
        name: plane.callsign,
        position: Cesium.Cartesian3.fromDegrees(plane.longitude, plane.latitude, plane.altitude),
        point: {
          pixelSize: 10,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: plane.callsign,
          font: '12px monospace',
          fillColor: Cesium.Color.WHITE,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -15),
        }
      })
    })

    return () => {
      if (!viewer.isDestroyed()) viewer.destroy()
    }
  }, [])

  return (
    <div className="app-container">
      <div ref={viewerRef} className="cesium-container" />
      <div className="hud">
        <h1>🌍 SkyTrack 3D</h1>
        <p>Təyyarələr (Mock Data)</p>
      </div>
    </div>
  )
}