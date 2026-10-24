"""
SkyTrack — OpenSky API Test Skripti
Məqsəd: Azərbaycan üzərində real ADS-B data varmı?
"""

import requests
import sys
from datetime import datetime
from time import sleep

# ─────────────────────────────────────────────
# Azərbaycan bbox (bütün ölkə)
# ─────────────────────────────────────────────
AZ_BBOX = {
    "lamin": 38.0,
    "lomin": 44.0,
    "lamax": 42.0,
    "lomax": 51.0,
}

# Test bölgələri (kiçik bbox-lar)
REGIONS = {
    "Bakı":     {"lamin": 40.2, "lomin": 49.6, "lamax": 40.6, "lomax": 50.3},
    "Gəncə":    {"lamin": 40.5, "lomin": 46.2, "lamax": 40.8, "lomax": 46.5},
    "Naxçıvan": {"lamin": 39.1, "lomin": 45.3, "lamax": 39.4, "lomax": 45.6},
}

OPENSKY_URL = "https://opensky-network.org/api/states/all"


def fetch_planes(bbox: dict, label: str = "") -> list:
    """OpenSky-dən təyyarələri çək."""
    try:
        r = requests.get(OPENSKY_URL, params=bbox, timeout=15)

        if r.status_code == 200:
            states = r.json().get("states") or []
            print(f"  ✅ {label}: {len(states)} təyyarə")
            return states

        elif r.status_code == 429:
            print(f"  ⚠️  {label}: Rate limit bitdi! 1 saat gözlə.")
            return []

        elif r.status_code == 503:
            print(f"  ⚠️  {label}: Server yüklüdür (503). 30s gözlə.")
            return []

        else:
            print(f"  ❌ {label}: Status {r.status_code}")
            return []

    except requests.exceptions.Timeout:
        print(f"  ⏱️  {label}: Timeout (15s)")
        return []

    except requests.exceptions.ConnectionError:
        print(f"  ❌ {label}: İnternet bağlantısı yoxdur")
        return []

    except requests.exceptions.RequestException as e:
        print(f"  ❌ {label}: Xəta — {e}")
        return []


def parse_plane(state: list) -> dict:
    """OpenSky state array-ını dict-ə çevir."""
    return {
        "icao24":      state[0],
        "callsign":    (state[1] or "").strip() or "—",
        "country":     state[2] or "—",
        "longitude":   state[5],
        "latitude":    state[6],
        "altitude_m":  round(state[7]) if state[7] is not None else None,
        "on_ground":   state[8],
        "velocity_ms": round(state[9]) if state[9] is not None else None,
        "heading":     round(state[10]) if state[10] is not None else None,
    }


def print_planes(planes: list, limit: int = 15):
    """Təyyarələri cədvəl şəklində çap et."""
    if not planes:
        print("  (boş)")
        return

    header = f"  {'Callsign':<10} {'Ölkə':<22} {'Hündürlük':>12} {'Sürət':>12} {'İstiqamət':>10}"
    print(header)
    print("  " + "-" * (len(header) - 2))

    for p in planes[:limit]:
        alt = f"{p['altitude_m']} m" if p['altitude_m'] is not None else "—"
        spd = f"{p['velocity_ms']} m/s" if p['velocity_ms'] is not None else "—"
        hdg = f"{p['heading']}°" if p['heading'] is not None else "—"
        print(f"  {p['callsign']:<10} {p['country']:<22} {alt:>12} {spd:>12} {hdg:>10}")

    if len(planes) > limit:
        print(f"  ... və daha {len(planes) - limit} təyyarə")


def main():
    print("=" * 65)
    print("  SkyTrack — OpenSky API Test")
    print(f"  Vaxt: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    # ── Test 1: Bütün Azərbaycan ──
    print("\n📍 TEST 1: Bütün Azərbaycan (lat 38-42, lon 44-51)")
    az_states = fetch_planes(AZ_BBOX, "Azərbaycan")
    az_planes = [parse_plane(s) for s in az_states]
    print_planes(az_planes, limit=15)

    # ── Test 2: Bölgələr ──
    print("\n📍 TEST 2: Bölgələr üzrə coverage")
    region_results = {}
    for name, bbox in REGIONS.items():
        states = fetch_planes(bbox, name)
        region_results[name] = len(states)
        sleep(2)  # rate limit qorumaq üçün

    # ── Test 3: Verdict ──
    print("\n" + "=" * 65)
    print("  📊 NƏTİCƏ")
    print("=" * 65)

    total = len(az_planes)
    print(f"\n  Azərbaycan üzərində: {total} təyyarə")
    for name, count in region_results.items():
        print(f"  {name:<12}: {count} təyyarə")

    print("\n  🎯 VERDICT:")
    if total >= 10:
        print("  ✅ ƏLA — real data kifayətdir, davam et!")
        print("     Simulyasiya lazım deyil.")
        verdict = "GOOD"
    elif total >= 3:
        print("  ⚠️  ORTA — real data var, amma az.")
        print("     Cache + geniş bbox tövsiyə olunur.")
        print("     Simulyasiya fallback hazırla.")
        verdict = "MEDIUM"
    elif total >= 1:
        print("  ⚠️  ZƏİF — data çox azdır.")
        print("     Simulyasiya fallback MÜTLƏQ lazımdır.")
        verdict = "WEAK"
    else:
        print("  ❌ BOŞ — heç bir təyyarə yoxdur.")
        print("     Səbəb: ya saat səhvdir, ya coverage yoxdur.")
        print("     Simulyasiya ilə davam et.")
        verdict = "EMPTY"

    print("\n  💡 Qeyd: OpenSky anonim limiti ~100-400 sorğu/gün.")
    print("     Backend-də cache (60s) MÜTLƏQ lazımdır.")
    print("=" * 65)

    if verdict in ("GOOD", "MEDIUM"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()