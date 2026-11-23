import InboundPanel from './InboundPanel';
import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './App.css'

Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IkxnV2Z0NEttQWtYNnh3WWIiLCJqdGkiOiIxYzU0NThjYS1iZDBiLTQzNDYtYTQ5Mi1hYzhhMGQwYzNkNmQiLCJpZCI6NTUwODczLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3OTQ4NTczMzd9.ZEEO9u5tDjaaYShCOeeI_7WsKMDlR-kGsYL8y4-GjGM";

// Təyyarə ikonu (SVG)
const planeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M21,16V14L13,9V3.5A1.5,1.5 0 0,0 11.5,2A1.5,1.5 0 0,0 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/></svg>`;
const planeIconUrl = 'data:image/svg+xml;base64,' + btoa(planeSvg);

// Hava limanı ikonu (Dairə)
const airportSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00d4ff"><circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/></svg>`;
const airportIconUrl = 'data:image/svg+xml;base64,' + btoa(airportSvg);

const FEET_TO_METERS = 0.3048;

// Azərbaycan Hava Limanları
const AZ_AIRPORTS = {
  GYD: { name: 'Bakı', lat: 40.4675, lon: 50.0467 },
  NAJ: { name: 'Naxçıvan', lat: 39.1888, lon: 45.4584 },
  GAN: { name: 'Gəncə', lat: 40.7377, lon: 46.3176 },
  LLK: { name: 'Lənkəran', lat: 38.7464, lon: 48.8180 },
  GBB: { name: 'Qəbələ', lat: 40.8267, lon: 47.7125 },
  ZTU: { name: 'Zaqatala', lat: 41.5622, lon: 46.6672 },
};

// Status rəngləri
const STATUS_COLORS = {
  landing: Cesium.Color.LIME,
  approach: Cesium.Color.LIME,
  descending: Cesium.Color.YELLOW,
  inbound: Cesium.Color.ORANGE,
  cruise: Cesium.Color.CYAN,
  ground: Cesium.Color.GRAY,
};

const STATUS_LABELS = {
  landing: 'Enir',
  approach: 'Yaxınlaşır',
  descending: 'Aşağı düşür',
  inbound: 'Gəlir',
  cruise: 'Tranzit',
  ground: 'Yerdə',
};

export default function App() {
  const viewerRef = useRef(null)
  const viewerInstanceRef = useRef(null)
  const planesMapRef = useRef(new Map())
  const [selectedPlane, setSelectedPlane] = useState(null)

  const focusOnPlane = (plane) => {
    const viewer = viewerInstanceRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    
    const entity = viewer.entities.getById(plane.hex);
    if (entity) {
      viewer.flyTo(entity, {
        duration: 1.5,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 30000)
      });
    }
  }

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
    viewerInstanceRef.current = viewer;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(49.8671, 40.4093, 1500000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    })

    const fetchAndDrawPlanes = async () => {
      try {
        const response = await fetch("https://skytrack-backend-j6az.onrender.com/api/planes-az")
        const data = await response.json()
        if (viewer.isDestroyed()) return;

        viewer.entities.removeAll()
        planesMapRef.current.clear()

        // 1. HAVA LİMANLARINI ÇƏK
        Object.entries(AZ_AIRPORTS).forEach(([code, ap]) => {
          viewer.entities.add({
            id: `airport-${code}`,
            position: Cesium.Cartesian3.fromDegrees(ap.lon, ap.lat, 0),
            billboard: {
              image: airportIconUrl,
              width: 16,
              height: 16,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
            },
            label: {
              text: `${code} - ${ap.name}`,
              font: 'bold 11px sans-serif',
              fillColor: Cesium.Color.CYAN,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 3,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -12),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 800000)
            }
          })
        })

        // 2. TƏYYARƏLƏRİ VƏ TRAYEKTORİYALARI ÇƏK
        if (data.planes && data.planes.length > 0) {
          data.planes.forEach((plane) => {
            if (plane.lat == null || plane.lon == null) return;

            planesMapRef.current.set(plane.hex, plane);

            const headingRad = Cesium.Math.toRadians(plane.heading || 0)
            const altMeters = (plane.alt ?? 10000) * FEET_TO_METERS;
            const color = STATUS_COLORS[plane.status] || Cesium.Color.CYAN;

            // Təyyarə Entity
            viewer.entities.add({
              id: plane.hex,
              name: plane.callsign || plane.hex,
              position: Cesium.Cartesian3.fromDegrees(plane.lon, plane.lat, altMeters),
              billboard: {
                image: planeIconUrl,
                width: 24,
                height: 24,
                rotation: -headingRad,
                alignedAxis: Cesium.Cartesian3.ZERO,
                color: color,
              },
              label: {
                text: plane.callsign || plane.hex,
                font: '11px monospace',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                // YENİLİK: Adlar yalnız 400 km-dən yaxın məsafədə görünsün
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 400000)
              },
            })

            // Trayektoriya Xətti (YALNIZ ENƏN TƏYYARƏLƏR ÜÇÜN)
            const isLanding = ['landing', 'approach', 'descending'].includes(plane.status);
            
            if (isLanding && plane.target_airport && AZ_AIRPORTS[plane.target_airport]) {
              const target = AZ_AIRPORTS[plane.target_airport];
              
              viewer.entities.add({
                id: `trail-${plane.hex}`,
                polyline: {
                  positions: Cesium.Cartesian3.fromDegreesArrayHeights([                    plane.lon, plane.lat, altMeters,                    target.lon, target.lat, 0                  ]),
                  width: 1.5, // Daha nazik
                  material: new Cesium.PolylineDashMaterialProperty({
                    color: color.withAlpha(0.4), // Daha şəffaf
                    dashLength: 12.0
                  }),
                  arcType: Cesium.ArcType.GEODESIC
                }
              })
            }
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
      
      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;
        const hex = entity.id;
        const plane = planesMapRef.current.get(hex);
        
        if (plane) {
          setSelectedPlane(plane);
          viewer.flyTo(entity, {
            duration: 1.5,
            offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 30000)
          });
          return;
        }
      }
      setSelectedPlane(null)
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    fetchAndDrawPlanes()
    const intervalId = setInterval(fetchAndDrawPlanes, 10000)

    return () => {
      clearInterval(intervalId)
      handler.destroy()
      if (!viewer.isDestroyed()) viewer.destroy()
    }
  }, [])

  return (
    <div className="app-container">
      <div ref={viewerRef} className="cesium-container" />

      <InboundPanel
        onPlaneClick={(plane) => {
          setSelectedPlane(plane);
          focusOnPlane(plane);
        }}
      />

      <div className="hud">
        <h1>🌍 SkyTrack 3D</h1>
        <p>Real vaxt rejimində təyyarələr</p>
      </div>

      {selectedPlane && (
        <div className="info-panel">
          <button className="close-btn" onClick={() => setSelectedPlane(null)}>✕</button>
          <h2>✈️ {selectedPlane.callsign || selectedPlane.hex}</h2>
          <p><strong>Ölkə:</strong> {selectedPlane.country || '—'}</p>
          <p><strong>Hündürlük:</strong> {selectedPlane.alt ? Math.round(selectedPlane.alt).toLocaleString() + ' ft' : '—'}</p>
          <p><strong>Sürət:</strong> {selectedPlane.speed ? Math.round(selectedPlane.speed) + ' kts' : '—'}</p>
          <p><strong>İstiqamət:</strong> {selectedPlane.heading != null ? Math.round(selectedPlane.heading) + '°' : '—'}</p>
          <p><strong>Status:</strong> {STATUS_LABELS[selectedPlane.status] || selectedPlane.status || '—'}</p>
          {selectedPlane.target_airport && (
            <p><strong>Hədəf:</strong> {selectedPlane.target_airport} ({selectedPlane.airport_city})</p>
          )}
          {selectedPlane.distance_nm != null && (
            <p><strong>Məsafə:</strong> {selectedPlane.distance_nm} NM</p>
          )}
          {selectedPlane.eta_minutes != null && (
            <p><strong>ETA:</strong> {selectedPlane.eta_minutes} dəq</p>
          )}
          <p><strong>Koordinat:</strong> {selectedPlane.lat?.toFixed(3)}, {selectedPlane.lon?.toFixed(3)}</p>
        </div>
      )}
    </div>
  )
}