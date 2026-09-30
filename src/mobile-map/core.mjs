/* Pure presentation helpers. Native evidence periods and source ids stay intact. */
export const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
export function fractionAt(clientX, rect, inset = 12) {
  return clamp((clientX - rect.left - inset) / Math.max(1, rect.width - inset * 2));
}
export function periodAt(periods, fraction) {
  return periods[Math.round(clamp(fraction) * Math.max(0, periods.length - 1))] ?? null;
}
export function pickProjects(features, point, project, radius = 22) {
  const found = new Map();
  for (const feature of features || []) {
    const id = feature.properties?.id ?? feature.id, coordinates = feature.geometry?.coordinates;
    if (id == null || feature.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite)) continue;
    let screen;try { screen = project(coordinates); } catch { continue; }
    const distance = Math.hypot(screen.x - point.x, screen.y - point.y);
    if (!Number.isFinite(distance) || distance > radius) continue;
    const key = String(id), previous = found.get(key);
    if (!previous || distance < previous.distance) found.set(key, {id: key, feature, distance});
  }
  return [...found.values()].sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}
export function viewportPadding(height, headerBottom, dockTop, sheetTop) {
  const top = Math.max(0, Math.min(height * .3, headerBottom + 12));
  const obstruction = Math.min(dockTop, Number.isFinite(sheetTop) ? sheetTop : height);
  const bottom = Math.max(0, Math.min(height - top - 96, height - obstruction + 12));
  return {top, bottom, left: 12, right: 12};
}
