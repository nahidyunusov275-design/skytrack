// Uçuş fizikası — sadələşdirilmiş, amma realistik
export class FlightPhysics {
  constructor(startLat, startLon, startAlt = 3000, startHeading = 90) {
    this.lat = startLat;
    this.lon = startLon;
    this.alt = startAlt;          // feet
    this.speed = 200;             // knots
    this.heading = startHeading;  // degrees (0=N, 90=E)
    this.pitch = 0;               // degrees (+ = burun yuxarı)
    this.roll = 0;                // degrees (+ = sağ qanad aşağı)
    this.throttle = 0.5;          // 0-1
    this.crashed = false;
    this.landed = false;
  }

  update(dt, input) {
    if (this.crashed || this.landed) return;

    // ── THROTTLE ──
    if (input.shift) this.throttle = Math.min(1, this.throttle + dt * 0.5);
    if (input.ctrl)  this.throttle = Math.max(0, this.throttle - dt * 0.5);

    // ── PITCH (burun) ──
    const pitchRate = 30;
    if (input.up)        this.pitch = Math.min(45, this.pitch + pitchRate * dt);
    else if (input.down) this.pitch = Math.max(-45, this.pitch - pitchRate * dt);
    else                 this.pitch *= (1 - dt * 2); // avtomatik səviyyələşmə

    // ── ROLL (yan əyilmə) ──
    const rollRate = 60;
    if (input.left)       this.roll = Math.max(-60, this.roll - rollRate * dt);
    else if (input.right) this.roll = Math.min(60, this.roll + rollRate * dt);
    else                  this.roll *= (1 - dt * 2);

    // ── SÜRƏT ──
    const targetSpeed = 100 + this.throttle * 300; // 100-400 kt
    const speedChange = (targetSpeed - this.speed) * dt * 0.5;
    const pitchEffect = -Math.sin(this.pitch * Math.PI / 180) * 50 * dt;
    this.speed = Math.max(80, Math.min(500, this.speed + speedChange + pitchEffect));

    // ── HÜNDÜRLÜK ──
    const altChange = this.speed * 1.68781 * Math.sin(this.pitch * Math.PI / 180) * dt;
    this.alt = Math.max(0, this.alt + altChange);

    // ── İSTİQAMƏT (roll → dönüş) ──
    const turnRate = Math.sin(this.roll * Math.PI / 180) * 30;
    this.heading = (this.heading + turnRate * dt + 360) % 360;

    // ── MÖVQE ──
    const speedMs = this.speed * 0.514444;
    const distNM = (speedMs * dt) / 1852;
    const latChange = (distNM / 60) * Math.cos(this.heading * Math.PI / 180);
    const lonChange = (distNM / (60 * Math.cos(this.lat * Math.PI / 180))) * Math.sin(this.heading * Math.PI / 180);
    this.lat += latChange;
    this.lon += lonChange;

    // ── YERƏ TOXUNMA ──
    if (this.alt <= 0) {
      this.alt = 0;
      if (this.speed > 150) {
        this.crashed = true;
      } else {
        this.landed = true;
        this.speed = 0;
      }
    }
  }
}