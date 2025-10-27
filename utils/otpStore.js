// utils/otpStore.js
// En producción usa Redis/DB. Aquí, Map en memoria:
const store = new Map(); // tempToken -> { email, codigo, expira, intentos }

export function guardarOTP(tempToken, { email, codigo, ttlSeg = 300 }) {
  store.set(tempToken, { email, codigo, expira: Date.now() + ttlSeg * 1000, intentos: 0 });
}
export function obtenerOTP(tempToken) {
  return store.get(tempToken);
}
export function eliminarOTP(tempToken) {
  store.delete(tempToken);
}
