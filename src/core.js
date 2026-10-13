export const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));
export function calibration(input) {
  const out = {};
  for (const key of ['bed_height','capacity_height','yellow_alert','red_alert']) {
    if (input[key] === '' || input[key] === null || input[key] === undefined) throw Error('Completa las cuatro medidas.');
    out[key] = Number(input[key]);
  }
  if (!Object.values(out).every(Number.isFinite) || out.bed_height <= 20 || out.bed_height > 600 || out.capacity_height <= 0 || out.capacity_height > out.bed_height || out.yellow_alert < 0 || out.yellow_alert >= out.red_alert || out.red_alert > out.capacity_height) throw Error('Usa sensor a fondo > 20 y ≤ 600 cm; 0 < fondo a tope ≤ sensor a fondo; amarilla < roja ≤ fondo a tope.');
  return out;
}
export function measurement(station, reading, now = Date.now()) {
  if (!reading) return {state:'waiting',label:'Sin lecturas'};
  const age = now - Date.parse(reading.received_at);
  if (!Number.isFinite(age) || age < -5000 || age > 90000) return {state:'offline',label:'Sin señal reciente'};
  if (reading.sensor_status !== 'OK' || !Number.isFinite(Number(reading.distance_cm)) || Number(reading.distance_cm) <= 20 || Number(reading.distance_cm) > 600) return {state:'error',label:'Error de sensor'};
  if (station.bed_height === null || station.bed_height === undefined) return {state:'uncalibrated',label:'Configura las medidas'};
  let cfg;
  try { cfg = calibration(station); } catch (_) { return {state:'uncalibrated',label:'Configura las medidas'}; }
  const level = Math.max(0, cfg.bed_height - Number(reading.distance_cm));
  const percent = Math.min(100, level / cfg.capacity_height * 100);
  const state = level >= cfg.red_alert ? 'red' : level >= cfg.yellow_alert ? 'yellow' : 'normal';
  return {state,label:{red:'Alerta roja',yellow:'Aviso amarillo',normal:'Normal'}[state],level,percent};
}
export function text(value, limit=120) {
  const clean = String(value ?? '').trim();
  if (!clean || clean.length > limit) throw Error('Completa el texto sin superar '+limit+' caracteres.');
  return clean;
}
export function validCode(value) { return /^KIT-[A-F0-9]{32}$/.test(String(value)); }
export const sensorStates = new Set(['OK','ERR_CABLE','ERR_CORTO','SIN_ECO','MUY_CERCA','FUERA_RANGO','ERR_DESBORDE']);
