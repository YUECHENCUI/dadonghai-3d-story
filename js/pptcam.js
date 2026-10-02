/* PPT 效果图相机（由 work/fit2.py 根据 OSM 与第1页效果图拟合）。
   提供：在当前视口下复现 PPT 视角的 MapLibre 参数，以及“效果图像素 ↔ 经纬度”换算（用于卡片锚点）。 */
(function () {
  const R = 6378137, D2R = Math.PI / 180;
  const PPT = { lng: 109.52067, lat: 18.22397, zoom4000: 18.5128, bearing: -34.69042, pitch: 50.83331, fov: 12.93216, W: 4000, H: 2250 };
  // 视口内“等效 PPT 画框”的缩放（contain：16:9 画框完整放进视口）
  function frameScale(w, h) { return Math.min(w / PPT.W, h / PPT.H); }
  function view(w, h) {
    return { center: [PPT.lng, PPT.lat], zoom: PPT.zoom4000 + Math.log2(frameScale(w, h)), bearing: PPT.bearing, pitch: PPT.pitch };
  }
  // 与 MapLibre 一致的针孔相机（W,H 为视口像素）
  function cam(c) {
    const F = (c.H / 2) / Math.tan(c.fov * D2R / 2);
    const mpp = 2 * Math.PI * R * Math.cos(c.lat * D2R) / (512 * Math.pow(2, c.zoom));
    const d = F * mpp, b = c.bearing * D2R, p = c.pitch * D2R;
    const pos = [-Math.sin(b) * Math.sin(p) * d, -Math.cos(b) * Math.sin(p) * d, Math.cos(p) * d];
    const n = Math.hypot(...pos), f = pos.map(v => -v / n), r = [Math.cos(b), -Math.sin(b), 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const k = R * Math.cos(c.lat * D2R), y0 = Math.log(Math.tan(Math.PI / 4 + c.lat * D2R / 2));
    return {
      project(lng, lat, h = 0) {
        const x = (lng - c.lng) * D2R * k, y = (Math.log(Math.tan(Math.PI / 4 + lat * D2R / 2)) - y0) * k;
        const v = [x - pos[0], y - pos[1], h - pos[2]], zc = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
        return [c.W / 2 + F * (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) / zc, c.H / 2 - F * (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) / zc];
      },
      unproject(px, py, h = 0) {
        const a = (px - c.W / 2) / F, bb = -(py - c.H / 2) / F;
        const dv = [f[0] + a * r[0] + bb * u[0], f[1] + a * r[1] + bb * u[1], f[2] + a * r[2] + bb * u[2]];
        const t = (h - pos[2]) / dv[2], X = pos[0] + t * dv[0], Y = pos[1] + t * dv[1];
        return [c.lng + X / k / D2R, (2 * Math.atan(Math.exp(y0 + Y / k)) - Math.PI / 2) / D2R];
      }
    };
  }
  const ref = cam({ lng: PPT.lng, lat: PPT.lat, zoom: PPT.zoom4000, bearing: PPT.bearing, pitch: PPT.pitch, fov: PPT.fov, W: PPT.W, H: PPT.H });
  window.PPTCam = {
    PPT, frameScale, view,
    /** 效果图像素(4000×2250) + 高度(m) → 经纬度 (WGS84) */
    pxToLngLat: (px, py, h = 0) => ref.unproject(px, py, h),
    /** 当前视口下（PPT 视角）经纬度+高度 → 屏幕像素 */
    projectInViewport(lng, lat, h, w, hgt) {
      const v = view(w, hgt);
      return cam({ lng: PPT.lng, lat: PPT.lat, zoom: v.zoom, bearing: PPT.bearing, pitch: PPT.pitch, fov: PPT.fov, W: w, H: hgt }).project(lng, lat, h);
    }
  };
})();
