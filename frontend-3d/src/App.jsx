import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './App.css'

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkxnV2Z0NEttQWtYNnh3WWIiLCJqdGkiOiIxYzU0NThjYS1iZDBiLTQzNDYtYTQ5Mi1hYzhhMGQwYzNkNmQiLCJpZCI6NTUwODczLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3OTQ4NTczMzd9.ZEEO9u5tDjaaYShCOeeI_7WsKMDlR-kGsYL8y4-GjGM";

// Təyyarə ikonu (SVG)
const planeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/></svg>`;
const planeIconUrl = 'data:image/svg+xml;base64,' + btoa(planeSvg);

export default function App() {
  const viewerRef = useRef(null)
  const [selectedPlane, setSelectedPlane] = useState(null)

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
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    })

    const fetchAndDrawPlanes = async () => {
      try {
        const response = await fetch("https://skytrack-backend-j6az.onrender.com/api/planes-3d")
        const data = await response.json()
        if (viewer.isDestroyed()) return;
        viewer.entities.removeAll()

        if (data.planes && data.planes.length > 0) {
          data.planes.forEach((plane) => {
            const headingRad = Cesium.Math.toRadians(plane.heading || 0)
            viewer.entities.add({
              id: plane.icao24,
              name: plane.callsign,
              position: Cesium.Cartesian3.fromDegrees(plane.longitude, plane.latitude, plane.altitude_m || 10000),
              billboard: {
                image: planeIconUrl,
                width: 26,
                height: 26,
                rotation: -headingRad,
                alignedAxis: Cesium.Cartesian3.ZERO,
                color: Cesium.Color.CYAN,
              },
              label: {
                text: plane.callsign,
                font: '11px monospace',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -22),
              },
              properties: {
                callsign: plane.callsign,
                country: plane.country,
                altitude: plane.altitude_m,
                velocity: plane.velocity_ms,
                heading: plane.heading,
                lat: plane.latitude,
                lon: plane.longitude,
              }
            })
          })
          console.log(`✅ ${data.planes.length} təyyarə çəkildi.`)
        }
      } catch (error) {
        console.error("❌ Backend-ə qoşulma xətası:", error)
      }
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click) => {
      const pickedObject = viewer.scene.pick(click.position)
      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        const p = pickedObject.id.properties
        setSelectedPlane({
          callsign: p.callsign.getValue(),
          country: p.country.getValue(),
          altitude: p.altitude.getValue(),
          velocity: p.velocity.getValue(),
          heading: p.heading.getValue(),
          lat: p.lat.getValue(),
          lon: p.lon.getValue(),
        })
      } else {
        setSelectedPlane(null)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    fetchAndDrawPlanes()
    const intervalId = setInterval(fetchAndDrawPlanes, 15000)

    return () => {
      clearInterval(intervalId)
      handler.destroy()
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
      {selectedPlane && (
        <div className="info-panel">
          <button className="close-btn" onClick={() => setSelectedPlane(null)}>✕</button>
          <h2>✈️ {selectedPlane.callsign}</h2>
          <p><strong>Ölkə:</strong> {selectedPlane.country}</p>
          <p><strong>Hündürlük:</strong> {selectedPlane.altitude} m</p>
          <p><strong>Sürət:</strong> {Math.round(selectedPlane.velocity * 3.6)} km/s</p>
          <p><strong>İstiqamət:</strong> {Math.round(selectedPlane.heading)}°</p>
          <p><strong>Koordinat:</strong> {selectedPlane.lat.toFixed(3)}, {selectedPlane.lon.toFixed(3)}</p>
        </div>
      )}
    </div>
  )
}