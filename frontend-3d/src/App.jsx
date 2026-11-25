import LandedPanel from './LandedPanel';
import InboundPanel from './InboundPanel';
import SimulatorTest from './SimulatorTest';
import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './App.css'


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
    // Test rejimi: ?test=1 ilə açılır
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('test') === '1') return <SimulatorTest />;
  const viewerRef = useRef(null)
  const viewerInstanceRef = useRef(null)
  const planesMapRef = useRef(new Map())      // hex -> plane data
  const entitiesMapRef = useRef(new Map())    // hex -> { entity, positionProperty, trailEntity }
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
      baseLayer: new Cesium.ImageryLayer(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://tile.openstreetmap.org/'
        })
      ),
    })
    viewerInstanceRef.current = viewer;

    // ✅ Saat real vaxtla sinxron işləsin (smooth movement üçün vacib)
    viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
    viewer.clock.shouldAnimate = true;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(49.8671, 40.4093, 1500000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    })

    // ✅ HAVA LİMANLARINI BİR DƏFƏ ÇƏK (hər poll-da yenidən çəkmirik)
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

    const fetchAndDrawPlanes = async () => {
      try {
        const response = await fetch("https://skytrack-backend-j6az.onrender.com/api/planes-az")
        if (!response.ok) throw new Error(`Server xətası: ${response.status}`)

        const data = await response.json()
        if (viewer.isDestroyed()) return;

        if (!data.planes || data.planes.length === 0) {
          console.warn("⚠️ Backend boş data qaytardı, köhnə təyyarələr saxlanılır.")
          return;
        }

        const currentIds = new Set();
        const now = Cesium.JulianDate.now();

        data.planes.forEach((plane) => {
          // ✅ Sərt yoxlama
          if (!plane.hex) return;
          if (typeof plane.lat !== 'number' || typeof plane.lon !== 'number') return;
          if (!isFinite(plane.lat) || !isFinite(plane.lon)) return;

          currentIds.add(plane.hex);
          planesMapRef.current.set(plane.hex, plane);

          const headingRad = Cesium.Math.toRadians(plane.heading || 0)
          const altMeters = (typeof plane.alt === 'number' ? plane.alt : 10000) * FEET_TO_METERS;
          const color = STATUS_COLORS[plane.status] || Cesium.Color.CYAN;
          const position = Cesium.Cartesian3.fromDegrees(plane.lon, plane.lat, altMeters);

          let entry = entitiesMapRef.current.get(plane.hex);

          if (!entry) {
            // ── YENİ TƏYYARƏ ──
            const positionProperty = new Cesium.SampledPositionProperty();
            positionProperty.addSample(now, position);
            positionProperty.setInterpolationOptions({
              interpolationDegree: 2,
              interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
            });
            // Son sample-dan sonra yerində qalsın (uçub getməsin)
            positionProperty.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
            positionProperty.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;

            const entity = viewer.entities.add({
              id: plane.hex,
              name: plane.callsign || plane.hex,
              position: positionProperty,
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
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 400000)
              },
            });

            entitiesMapRef.current.set(plane.hex, {
              entity,
              positionProperty,
              trailEntity: null,
            });
          } else {
            // ── MÖVCUD TƏYYARƏ: yeni sample əlavə et ──
            entry.positionProperty.addSample(now, position);
            // Billboard-u yenilə (rəng, istiqamət dəyişə bilər)
            if (entry.entity.billboard) {
              entry.entity.billboard.rotation = -headingRad;
              entry.entity.billboard.color = color;
            }
          }

          // ── TRAYEKTORİYA (Bütün hədəfi olan təyyarələr üçün) ──
          const entry2 = entitiesMapRef.current.get(plane.hex);

          if (plane.target_airport && AZ_AIRPORTS[plane.target_airport]) {
            const target = AZ_AIRPORTS[plane.target_airport];

            if (entry2.trailEntity) {
              // Mövcud xətti yenilə
              entry2.trailEntity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: color.withAlpha(0.8)
              });
            } else {
              // Yeni parlaq xətt yarat
              const trailEntity = viewer.entities.add({
                id: `trail-${plane.hex}`,
                polyline: {
                  positions: new Cesium.CallbackProperty(() => {
                    const currentTime = viewer.clock.currentTime;
                    const pos = entry2.positionProperty.getValue(currentTime);
                    if (!pos) return [];
                    return [pos, Cesium.Cartesian3.fromDegrees(target.lon, target.lat, 0)];
                  }, false),
                  width: 2.0,
                  material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: color.withAlpha(0.8)
                  }),
                  arcType: Cesium.ArcType.GEODESIC
                }
              });
              entry2.trailEntity = trailEntity;
            }
          } else if (entry2.trailEntity) {
            // Hədəf yoxdursa, xətti sil
            viewer.entities.remove(entry2.trailEntity);
            entry2.trailEntity = null;
          }
        });

        // ── SİLİNMİŞ TƏYYARƏLƏRİ TƏMİZLƏ ──
        entitiesMapRef.current.forEach((entry, hex) => {
          if (!currentIds.has(hex)) {
            viewer.entities.remove(entry.entity);
            if (entry.trailEntity) viewer.entities.remove(entry.trailEntity);
            entitiesMapRef.current.delete(hex);
            planesMapRef.current.delete(hex);
          }
        });

        console.log(`✅ ${data.planes.length} təyyarə yeniləndi.`);
      } catch (error) {
        console.error("❌ Backend-ə qoşulma xətası (köhnə təyyarələr saxlanılır):", error.message)
      }
    }

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click) => {
      const pickedObject = viewer.scene.pick(click.position)

      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;
        const plane = planesMapRef.current.get(entity.id);

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
      entitiesMapRef.current.clear()
      planesMapRef.current.clear()
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

      {/* YENİ: Enmiş təyyarələrin paneli (Sağ aşağıda görünəcək) */}
      <LandedPanel />

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