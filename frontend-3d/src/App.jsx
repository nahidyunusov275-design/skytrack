import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './App.css'

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Ik5MQ3oxdXNMVmJEVnNFY1IiLCJqdGkiOiJkMjQ4YTU2";

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

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(49.8671, 40.4093, 1500000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
    })

    const fetchAndDrawPlanes = async () => {
      try {
        const response = await fetch("https://skytrack-backend-j6az.onrender.com/api/planes-3d")
        const data = await response.json()
        
        if (viewer.isDestroyed()) return;

        viewer.entities.removeAll()

        if (data.planes && data.planes.length > 0) {
          data.planes.forEach((plane) => {
            viewer.entities.add({
              name: plane.callsign,
              position: Cesium.Cartesian3.fromDegrees(plane.longitude, plane.latitude, plane.altitude_m || 10000),
              point: {
                pixelSize: 8,
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
          console.log(`✅ ${data.planes.length} təyyarə çəkildi.`)
        } else {
          console.warn("⚠️ Backend boş data qaytardı:", data.error)
        }
      } catch (error) {
        console.error("❌ Backend-ə qoşulma xətası:", error)
      }
    }

    fetchAndDrawPlanes()
    const intervalId = setInterval(fetchAndDrawPlanes, 15000)

    return () => {
      clearInterval(intervalId)
      if (!viewer.isDestroyed()) viewer.destroy()
    }
  }, [])

  return (
    <div className="app-container">
      <div ref={viewerRef} className="cesium-container" />
      <div className="hud">
        <h1>🌍 SkyTrack 3D</h1>
        <p>Real vaxt rejimində təyyarələr</p>
      </div>
    </div>
  )
}