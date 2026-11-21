// Угол дуги в градусах (0, 360], ccw — против часовой.
export function arcSweepDeg(from, to, center, ccw) {
  const a1 = Math.atan2(from.y - center.y, from.x - center.x);
  const a2 = Math.atan2(to.y - center.y, to.x - center.x);
  let s = ccw ? a2 - a1 : a1 - a2;
  s = ((s % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (s < 1e-9) s = 2 * Math.PI;
  return (s * 180) / Math.PI;
}
