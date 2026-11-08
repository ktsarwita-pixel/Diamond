/** Deterministic low-hull thruster fault used by the gameplay rig.
 * This is visual only: it never changes fuel, velocity or collision. The two
 * nozzles cough out of phase, the hull lists toward the weak jet, and a misfire
 * leaves smoke/embers instead of a clean healthy flame. */
export interface FaultFlightState {
  left: number;
  right: number;
  asym: number;
  roll: number;
  lift: number;
  smoke: number;
  spark: boolean;
  warning: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const cough = (phase: number, width: number) => phase < width ? Math.sin((phase / width) * Math.PI) : 0;

export function faultFlightAt(time: number, power: number): FaultFlightState {
  const p = clamp01(power);
  const leftPhase = ((time % 1.9) + 1.9) % 1.9;
  const rightPhase = (((time + 0.63) % 2.3) + 2.3) % 2.3;
  const misfireL = cough(leftPhase, 0.3);
  const misfireR = cough(rightPhase, 0.24);
  const surge = Math.pow(Math.max(0, Math.sin(time * 2.05 + 0.4)), 8);
  const flickL = 0.62 + 0.38 * Math.pow(Math.sin(time * 41), 2);
  const flickR = 0.62 + 0.38 * Math.pow(Math.sin(time * 37 + 1.7), 2);
  const left = p * flickL * (1 - 0.82 * misfireL) * (1 - 0.28 * surge);
  const right = p * flickR * (1 - 0.82 * misfireR) * (1 - 0.22 * surge);
  const asym = p > 0 ? (left - right) / p : 0;
  return {
    left, right, asym,
    roll: asym * 0.085 + Math.sin(time * 29) * 0.01 * p,
    lift: -surge * 1.1 + Math.sin(time * 23) * 0.2 * p,
    smoke: Math.max(misfireL, misfireR, surge * 0.65),
    spark: misfireL > 0.55 || misfireR > 0.55 || surge > 0.82,
    warning: 0.45 + 0.55 * Math.pow(Math.sin(time * 9), 2),
  };
}
