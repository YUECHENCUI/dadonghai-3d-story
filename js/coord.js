/* WGS84 <-> GCJ-02（火星坐标）转换。高德等国内底图使用 GCJ-02，与 WGS84 在深圳相差约 500 m。 */
(function () {
  const PI = Math.PI, A = 6378245.0, EE = 0.00669342162296594323;
  function tLat(x, y) { let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3; return r; }
  function tLon(x, y) { let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3; return r; }
  function wgs2gcj(lon, lat) {
    let dLat = tLat(lon - 105, lat - 35), dLon = tLon(lon - 105, lat - 35);
    const rl = lat / 180 * PI; let m = Math.sin(rl); m = 1 - EE * m * m; const sm = Math.sqrt(m);
    dLat = (dLat * 180) / ((A * (1 - EE)) / (m * sm) * PI); dLon = (dLon * 180) / (A / sm * Math.cos(rl) * PI);
    return [lon + dLon, lat + dLat];
  }
  function gcj2wgs(lon, lat) { let w = [lon, lat];
    for (let i = 0; i < 5; i++) { const g = wgs2gcj(w[0], w[1]); w = [w[0] - (g[0] - lon), w[1] - (g[1] - lat)]; } return w; }
  function mapCoords(c, f) { return typeof c[0] === 'number' ? f(c[0], c[1]) : c.map(x => mapCoords(x, f)); }
  function convertFC(fc, f) { return { type: 'FeatureCollection', features: fc.features.map(ft => ({ ...ft,
      geometry: { type: ft.geometry.type, coordinates: mapCoords(ft.geometry.coordinates, f) } })) }; }
  window.Coord = { wgs2gcj, gcj2wgs, convertFC, mapCoords };
})();
