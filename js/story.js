/* ============================================================
 * 三亚大东海 · 节点设计方案 —— 滚动叙事主程序
 * MapLibre GL（白模底图 + 平面设计图层）+ three.js（设计体块）+ HTML（卡片/指标面板）
 * ============================================================ */
(async function () {
  const CFG = window.STORY_CONFIG, B = window.BASE_DATA, D = window.DESIGN_DATA, O = window.ORTHO_DATA, STEPS = window.STEPS, CAT = window.STEP_CATEGORIES;
  const params = new URLSearchParams(location.search);
  const SHOT = params.has('shot');                         // 截图模式：无动画
  const $ = s => document.querySelector(s);
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ---------------- coordinate system (WGS84 / GCJ-02) ----------------
  let crs = 'wgs84';
  const P = ll => crs === 'gcj02' ? Coord.wgs2gcj(ll[0], ll[1]) : ll;
  const fcCache = {};
  const FC = (key, fc) => { const id = key + '@' + crs; if (!fcCache[id]) fcCache[id] = crs === 'gcj02' ? Coord.convertFC(fc, Coord.wgs2gcj) : fc; return fcCache[id]; };
  const KX = 111320 * Math.cos(D.origin[1] * Math.PI / 180), KY = 110574;
  const fromLocal = (x, y) => [D.origin[0] + x / KX, D.origin[1] + y / KY];

  // ---------------- flat design data ----------------
  const flatFC = {};
  Object.entries(D.flat).forEach(([k, feats]) => flatFC[k] = { type: 'FeatureCollection', features: feats });
  const boundsFC = { type: 'FeatureCollection', features: Object.entries(D.bounds).map(([k, c]) => ({ type: 'Feature', properties: { k }, geometry: { type: 'LineString', coordinates: c.concat([c[0]]) } })) };
  const cutFC = { type: 'FeatureCollection', features: (D.meshes.s4_garage || []).filter(p => p.shell).map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: p.rings } })) };

  // ---------------- basemaps ----------------
  const basemaps = CFG.basemaps.slice();
  const style = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eeedeb' } }], transition: { duration: 1200, delay: 0 }, light: { anchor: 'map', color: '#ffffff', intensity: 0.28, position: [1.2, 225, 35] } };
  const vecLayers = [];
  const vb = basemaps.find(b => b.vector);
  if (vb && !params.has('offline')) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const vs = await (await fetch(vb.vector, { signal: ctl.signal })).json(); clearTimeout(t);
      Object.entries(vs.sources).forEach(([k, v]) => style.sources['ofm-' + k] = v);
      vs.layers.forEach(l => {
        if (l.type === 'background' || l.type === 'symbol' || l.type === 'fill-extrusion') return;   // 远景：只要面/线，不要标注
        const nl = JSON.parse(JSON.stringify(l)); nl.id = 'ofm-' + l.id; if (nl.source) nl.source = 'ofm-' + nl.source;
        nl.layout = Object.assign({}, nl.layout, { visibility: 'none' }); vecLayers.push(nl.id); style.layers.push(nl);
      });
    } catch (e) { console.warn('OSM 矢量远景不可用', e); vb._failed = true; }
  } else if (vb) vb._failed = true;
  basemaps.forEach(b => {
    if (!b.tiles) return;
    style.sources['bm-' + b.id] = { type: 'raster', tiles: b.tiles, tileSize: b.tileSize || 256, maxzoom: b.maxzoom || 19, attribution: b.attribution };
    style.layers.push({ id: 'bm-' + b.id, type: 'raster', source: 'bm-' + b.id, layout: { visibility: 'none' }, paint: Object.assign({ 'raster-fade-duration': 200 }, b.paint || {}) });
  });

  // ---------------- model ground + buildings (PPT palette) ----------------
  const GROUND = ['land', 'sea', 'ortho', 'landcover', 'green', 'roads'];
  const src = (id, data) => style.sources[id] = { type: 'geojson', data, tolerance: 0.2 };
  src('land', B.land); src('sea', B.seabands); src('landcover', B.landcover); src('green', D.green); src('roads', B.roads); src('buildings', B.buildings);
  Object.keys(flatFC).forEach(k => src(k, flatFC[k])); src('bounds', boundsFC); src('cut', cutFC);
  style.sources.ortho = { type: 'image', url: O.uri, coordinates: O.corners };
  // 道路宽度（米）→ 像素：随缩放按 2 的指数变化（1 m ≈ 2^(z-18)*2.6 px，北纬 18°）
  const roadW = (w) => ['interpolate', ['exponential', 2], ['zoom'], 12, ['match', ['get', 'c'], ...Object.entries(w).flatMap(([k, m]) => [k, m * Math.pow(2, 12 - 18) * 2.6]), 1 * Math.pow(2, -6) * 2.6],
    22, ['match', ['get', 'c'], ...Object.entries(w).flatMap(([k, m]) => [k, m * Math.pow(2, 4) * 2.6]), 2 * Math.pow(2, 4) * 2.6]];
  style.layers.push(
    { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#eeedeb' } },
    { id: 'sea', type: 'fill', source: 'sea', paint: { 'fill-color': ['get', 'c'], 'fill-antialias': false } },
    { id: 'landcover', type: 'fill', source: 'landcover', paint: { 'fill-color': ['match', ['get', 'k'], 'sea', 'rgba(0,0,0,0)', 'beach', '#efd8a8', 'wood', '#9db893', 'park', '#a6c39c', 'pitch', '#b5cfa9', 'water', '#7fcbd3', '#cfe0c6'] } },
    { id: 'ortho', type: 'raster', source: 'ortho', paint: { 'raster-fade-duration': 0, 'raster-opacity': 1 } },
    { id: 'green', type: 'fill', source: 'green', paint: { 'fill-color': '#a3bf98', 'fill-opacity': 0.95 } },
    { id: 'roads', type: 'line', source: 'roads', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'c'], 'major', '#d9d7d4', 'mid', '#dcdad7', 'path', '#e4e2df', '#dedcd9'],
               'line-width': roadW({ major: 9, mid: 7, minor: 5, service: 3.5, path: 2 }) } },
    // 平面设计图层
    { id: 'cut', type: 'fill', source: 'cut', paint: { 'fill-color': '#21384a', 'fill-opacity': 0 } },
    { id: 's5_lawn', type: 'fill', source: 's5_lawn', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0 } },
    { id: 's5_pave', type: 'fill', source: 's5_pave', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0 } },
    { id: 's5_red', type: 'fill', source: 's5_red', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0 } },
    { id: 's5_water', type: 'fill', source: 's5_water', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0 } },
    { id: 'bounds', type: 'line', source: 'bounds', paint: { 'line-color': '#111', 'line-width': 1.6, 'line-dasharray': [6, 2.5, 1, 2.5], 'line-opacity': 0 } },
    { id: 'buildings', type: 'fill-extrusion', source: 'buildings', filter: ['!', ['has', 'site']],
      paint: { 'fill-extrusion-color': '#f6f5f3', 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': ['get', 'mh'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } }
  );
  const FLAT = { bounds: [['bounds', 'line-opacity', 1]], s5: [['s5_lawn', 'fill-opacity', 1], ['s5_pave', 'fill-opacity', 1], ['s5_red', 'fill-opacity', 1], ['s5_water', 'fill-opacity', 1]], cut: [['cut', 'fill-opacity', 0.18]] };

  // ---------------- map ----------------
  const W0 = innerWidth, H0 = innerHeight, v0 = PPTCam.view(W0, H0);
  const map = new maplibregl.Map({
    container: 'map', style, center: v0.center, zoom: v0.zoom, bearing: v0.bearing, pitch: v0.pitch, maxPitch: 80, minZoom: 13, maxZoom: 21,
    attributionControl: { compact: true }, keyboard: false, fadeDuration: 0,
    canvasContextAttributes: { antialias: true, preserveDrawingBuffer: params.has('shot') || params.has('pdb') }
  });
  window._map = map;
  map.setVerticalFieldOfView(PPTCam.PPT.fov);
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
  await new Promise(r => map.on('load', r));

  const scene = new Scene3D(map, D); window._scene = scene;
  map.addLayer(scene.layer);

  // ---------------- basemap switching / CRS / auto-fallback ----------------
  let current = null, loaded = 0, errs = 0;
  function refreshCRS(nc) {
    if (nc === crs) return;
    const c = map.getCenter(); const w = crs === 'gcj02' ? Coord.gcj2wgs(c.lng, c.lat) : [c.lng, c.lat];
    crs = nc;
    ['land', 'sea', 'landcover', 'roads', 'buildings'].forEach(k => map.getSource(k).setData(FC(k, B[k === 'sea' ? 'seabands' : k])));
    map.getSource('green').setData(FC('green', D.green));
    Object.keys(flatFC).forEach(k => map.getSource(k).setData(FC(k, flatFC[k])));
    map.getSource('bounds').setData(FC('bounds', boundsFC)); map.getSource('cut').setData(FC('cut', cutFC));
    map.getSource('ortho').setCoordinates(O.corners.map(P));
    scene.setOriginLL(P(D.origin));
    map.jumpTo({ center: P(w) });
  }
  function setBasemap(id, why) {
    let b = basemaps.find(x => x.id === id && !x._failed) || basemaps.find(x => x.id === CFG.autoFallback) || basemaps[0];
    basemaps.forEach(x => x.tiles && map.setLayoutProperty('bm-' + x.id, 'visibility', x.id === b.id ? 'visible' : 'none'));
    vecLayers.forEach(l => map.setLayoutProperty(l, 'visibility', b.vector ? 'visible' : 'none'));
    GROUND.forEach(l => map.setLayoutProperty(l, 'visibility', b.ground ? 'visible' : 'none'));
    current = b.id; loaded = 0; errs = 0;
    refreshCRS(b.crs);
    document.querySelectorAll('input[name=bm]').forEach(r => r.checked = r.value === b.id);
    $('#crsinfo').textContent = b.crs === 'gcj02' ? '坐标：GCJ-02（白模与设计图层已自动偏移对齐高德）' : '坐标：WGS84';
    if (why) toast(why);
  }
  const srcOf = id => { const b = basemaps.find(x => x.id === id); return !b ? null : b.vector ? 'ofm-openmaptiles' : b.tiles ? 'bm-' + id : null; };
  map.on('sourcedata', e => { if (e.tile && e.sourceId === srcOf(current)) loaded++; });
  map.on('error', e => {
    if (e.sourceId && e.sourceId === srcOf(current)) { errs++;
      if (CFG.autoFallback && current !== CFG.autoFallback && errs >= 4 && loaded === 0) setBasemap(CFG.autoFallback, '远景底图加载失败，已自动切换到「高德」'); }
  });
  function watchSlow() {
    const id = current;
    setTimeout(() => { if (current === id && srcOf(id) && loaded === 0 && CFG.autoFallback && current !== CFG.autoFallback)
      setBasemap(CFG.autoFallback, '远景底图加载过慢，已自动切换到「高德」'); }, 9000);
  }

  // ---------------- UI scaffolding ----------------
  const elCards = $('#cards'), svg = $('#pointers');
  function frame() {                        // 视口中“PPT 16:9 画框”
    const W = innerWidth, H = innerHeight, s = PPTCam.frameScale(W, H), fw = 4000 * s, fh = 2250 * s;
    return { W, H, s, x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
  }
  function layoutFrame() {
    const f = frame(), fs = f.w / 1600 * 16; document.documentElement.style.setProperty('--fs', fs.toFixed(2) + 'px');
    document.documentElement.style.fontSize = Math.max(10.5, fs).toFixed(2) + 'px';   // rem 随 PPT 画框等比缩放（设下限保证小屏可读）
    const fr = $('#frame'); Object.assign(fr.style, { left: f.x + 'px', top: f.y + 'px', width: f.w + 'px', height: f.h + 'px' });
    $('#compare').style.cssText += `;left:${f.x}px;top:${f.y}px;width:${f.w}px;height:${f.h}px`;
  }
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 4200); }

  // ---------------- panel (right indicator) ----------------
  const ABOVE = ['hub', 'theatre', 'hotel', 'apt', 'com'], BELOW = ['ugcom', 'sunken', 'garage'];
  function buildPanel() {
    const seg = k => `<div class="seg" data-k="${k}"><i style="background:${CAT[k][1]}"></i><span><em>${CAT[k][0]}：</em><b>0</b></span></div>`;
    $('#panel').innerHTML = `<div class="tot top">地上计容面积：<br><b id="tA">0</b> 平方米</div>
      <div class="bars"><div class="above">${ABOVE.map(seg).join('')}</div><div class="axis"></div><div class="below">${BELOW.map(seg).join('')}</div></div>
      <div class="tot bot">地下空间面积：<br><b id="tB">0</b> 平方米</div>`;
  }
  const numState = {};
  function animNum(el, to, dur = 1100) {
    const key = el.id || el.dataset.key || (el.dataset.key = Math.random().toString(36));
    const from = numState[key] || 0; numState[key] = to; const t0 = performance.now();
    if (SHOT) { el.textContent = Math.round(to); return; }
    (function f(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
  }
  function setPanel(p) {
    const PX = 0.07;                         // rem / 1000㎡ —— 柱高与面积成正比（地上/地下同一比例）
    const vals = {}; p.above.concat(p.below).forEach(([k, v]) => vals[k] = v);
    document.querySelectorAll('#panel .seg').forEach(el => {
      const k = el.dataset.k, v = vals[k] || 0;
      el.style.height = v ? Math.max(0.42, v / 1000 * PX) + 'rem' : '0rem';
      el.classList.toggle('on', !!v); animNum(el.querySelector('b'), v);
    });
    // 标签避让：按目标柱高计算各段中心，保证相邻标签最小间距 G（rem），不与 0 轴线重叠
    const G = 0.92, hOf = k => vals[k] ? Math.max(0.42, vals[k] / 1000 * PX) : 0;
    const lay = (keys) => { let acc = 0, prev = -G / 2 + 0.05;
      keys.forEach(k => { const h = hOf(k), sp = document.querySelector(`#panel .seg[data-k="${k}"] span`);
        if (!h) { acc += 0; return; } const c = acc + h / 2; const y = Math.max(c, prev + G); prev = y; acc += h;
        sp.style.setProperty('--dy', (y - c).toFixed(3) + 'rem'); }); };
    lay(ABOVE.slice().reverse()); lay(BELOW);
    ABOVE.forEach(k => { const sp = document.querySelector(`#panel .seg[data-k="${k}"] span`); sp.style.setProperty('--dy', (-parseFloat(sp.style.getPropertyValue('--dy') || 0)).toFixed(3) + 'rem'); });
    animNum($('#tA'), p.above.reduce((a, x) => a + x[1], 0)); animNum($('#tB'), p.below.reduce((a, x) => a + x[1], 0));
  }

  // ---------------- cards ----------------
  let cards = [];
  function cardHTML(c) {
    if (c.strip) return `<div class="strip" style="--ac:${c.accent}"><img src="${c.photo}" alt="ACE HOTEL"></div>`;
    if (c.label) return `<div class="lbl"><b>${c.title}</b><i>${c.en}</i>${(c.lines || []).map(l => `<s>${l}</s>`).join('')}</div>`;
    return `<div class="card ${c.big ? 'big' : ''} ${c.small ? 'small' : ''}" style="--ac:${c.accent}"><div class="in">
      <div class="t"><b>${c.title}</b>${c.tag ? `<span class="bar">|</span><span class="tag">${c.tag}</span>` : ''}</div>
      <div class="e">${c.en}${c.gfa ? (c.big ? '' : ` <span class="bar">|</span> <span class="g">${c.gfa}</span>`) : ''}</div>
      ${c.big && c.gfa ? `<div class="g2">${c.gfa}</div>` : ''}
      ${(c.lines || []).map(l => `<div class="ln">${l}</div>`).join('')}
      ${c.desc ? `<div class="d">${c.desc}</div><div class="de">${c.descEn}</div>` : ''}
      </div>${c.photo ? `<img class="ph" src="${c.photo}">` : ''}</div>`;
  }
  function showCards(i) {
    const old = cards; old.forEach(c => { c.el.classList.remove('on'); c.el.classList.add('off'); });
    setTimeout(() => old.forEach(c => c.el.remove()), SHOT ? 0 : 600);
    cards = STEPS[i].cards.map((c, j) => {
      const el = document.createElement('div'); el.className = 'cw' + (c.label ? ' is-lbl' : '') + (c.strip ? ' is-strip' : ''); el.innerHTML = cardHTML(c);
      elCards.appendChild(el);
      const ll = PPTCam.pxToLngLat(c.anchor[0], c.anchor[1], c.anchor[2]);
      const o = { c, el, ll, h: c.anchor[2], j };
      setTimeout(() => { el.classList.add('on'); o.onT = performance.now(); }, SHOT ? 0 : 650 + j * 110);
      return o;
    });
    computeOffsets(); placeCards();
    [30, 120].concat(SHOT ? [] : [800, 1000, 1200, 1500, 2000]).forEach(t => setTimeout(placeCards, t));
  }
  function computeOffsets() {
    const f = frame();
    cards.forEach(o => {
      const a = PPTCam.projectInViewport(o.ll[0], o.ll[1], o.h, f.W, f.H);
      o.off = [f.x + o.c.box[0] / 100 * f.w - a[0], f.y + o.c.box[1] / 100 * f.h - a[1]];
    });
  }
  function placeCards() {
    const f = frame(); let paths = '';
    cards.concat(leaving).forEach(o => {
      const a = scene.screen(P(o.ll), o.h); if (!a) { o.el.style.visibility = 'hidden'; return; }
      let x = a[0] + o.off[0], y = a[1] + o.off[1];
      const w = o.el.offsetWidth, h = o.el.offsetHeight;
      x = Math.max(6, Math.min(f.W - w - 6, x)); y = Math.max(6, Math.min(f.H - h - 6, y));
      // 避让右下指标面板
      const pr = panelRect();
      if (pr && x < pr.right && x + w > pr.left && y < pr.bottom && y + h > pr.top) {
        const dY = y + h - (pr.top - 8), dX = x + w - (pr.left - 8);
        if (dX <= dY || pr.top - h - 8 < 6) x = pr.left - w - 8; else y = pr.top - h - 8;
      }
      o.el.style.visibility = ''; o.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      if (o.c.label || !o.el.classList.contains('on')) return;
      // 指示三角：从卡片边缘指向锚点
      const cx = Math.max(x, Math.min(x + w, a[0])), cy = Math.max(y, Math.min(y + h, a[1]));
      if (a[0] > x && a[0] < x + w && a[1] > y && a[1] < y + h) return;
      const dx = a[0] - cx, dy = a[1] - cy, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, bw = o.c.strip ? 16 : 11;
      const bx = cx - dx / L * 8, by = cy - dy / L * 8, op = SHOT ? 1 : Math.min(1, (performance.now() - (o.onT || 0)) / 550);
      paths += `<path d="M${(bx + nx * bw).toFixed(1)},${(by + ny * bw).toFixed(1)}L${a[0].toFixed(1)},${a[1].toFixed(1)}L${(bx - nx * bw).toFixed(1)},${(by - ny * bw).toFixed(1)}Z" fill="${o.c.accent}" opacity="${op.toFixed(2)}"/>` +
               `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="3.2" fill="#fff" stroke="${o.c.accent}" stroke-width="2" opacity="${op.toFixed(2)}"/>`;
    });
    svg.innerHTML = paths;
  }
  let _pr = null, _prT = 0;
  function panelRect() { const now = performance.now(); if (now - _prT > 500) { _prT = now; const el = $('#panel');
      _pr = el && getComputedStyle(el).display !== 'none' && !document.body.classList.contains('clean') ? el.getBoundingClientRect() : null; } return _pr; }
  const leaving = [];
  scene.onFrame = placeCards;

  // ---------------- steps ----------------
  let cur = -1, lockPPT = params.has('ppt'), userMoved = false, flying = false;
  function stepCamera(i) {
    const st = STEPS[i], W = innerWidth, H = innerHeight, v = PPTCam.view(W, H);
    if (lockPPT || st.camera.ppt) return { center: P(v.center), zoom: v.zoom, bearing: v.bearing, pitch: v.pitch };
    const c = st.camera; return { center: P(fromLocal(c.at[0], c.at[1])), zoom: v.zoom + (c.dz || 0), bearing: c.bearing, pitch: c.pitch };
  }
  function go(i, opt = {}) {
    i = Math.max(0, Math.min(STEPS.length - 1, i)); if (i === cur && !opt.force) return;
    const prev = cur; cur = i; const st = STEPS[i], instant = SHOT || opt.instant;
    // UI
    document.querySelectorAll('#dots li').forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
    $('#count').innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(STEPS.length).padStart(2, '0')}`;
    $('#progress i').style.width = ((i + 1) / STEPS.length * 100) + '%';
    const tt = $('#title'); tt.classList.remove('on');
    setTimeout(() => { tt.innerHTML = `<h1>${st.title}</h1><h2>${st.en}</h2>`; tt.classList.add('on'); }, instant ? 0 : 280);
    showCards(i); setPanel(st.panel);
    if ($('#compare').classList.contains('show')) $('#compare img').src = `assets/slide${i + 1}-render.jpg`;
    history.replaceState(null, '', '#' + (i + 1));
    // camera
    const cam = stepCamera(i); userMoved = false; flying = true;
    if (instant) map.jumpTo(cam); else map.flyTo(Object.assign({ duration: CFG.flyDuration, curve: 1.15, easing: ease, essential: true }, cam));
    // base
    map.setPaintProperty('buildings', 'fill-extrusion-opacity', st.base.opacity);
    map.setPaintProperty('buildings', 'fill-extrusion-color', st.base.color);
    // flat layers
    Object.entries(FLAT).forEach(([k, arr]) => arr.forEach(([id, prop, full]) => map.setPaintProperty(id, prop, (st.flat[k] || 0) * full)));
    // 3D layers: 先淡出/沉降，再生长/升起
    const dur = CFG.layerDuration;
    Object.keys(scene.groups).forEach(id => {
      if (id === 'extra') return;
      const def = layerDefault(id, i);
      const to = Object.assign({}, def, st.layers[id] || {}), from = scene.getState(id) || def;
      const rising = (to.g > from.g + 0.01) || (to.o > from.o + 0.01);
      scene.setState(id, to, { instant, duration: dur, delay: rising ? dur * 0.45 : 0 });
    });
  }
  // 未在 steps.js 里列出的图层的默认状态：ex_* 一直显示；s<N>_* 从第 N 步起显示（方便直接按命名放入 Rhino 新图层）
  function layerDefault(id, i) {
    if (id.startsWith('ex_')) return { o: 1, g: 1 };
    const m = /^s(\d)_/.exec(id); if (m && !scene.isPlaceholder(id)) return i + 1 >= +m[1] ? { o: 1, g: 1 } : { o: 0, g: 0 };
    return { o: 0, g: 0 };
  }
  scene.onNewGroup = id => { if (cur < 0) return; const to = Object.assign({}, layerDefault(id, cur), STEPS[cur].layers[id] || {}); scene.setState(id, to, { instant: true }); };
  window.storyGo = go;

  // ---------------- input: wheel / keys / buttons / dots ----------------
  let wheelMode = params.get('wheel') || CFG.wheelMode, acc = 0, locked = false, lastT = 0, lastMag = 0, stepT = 0;
  function setWheelMode(m) { wheelMode = m; $('#wheelmode').textContent = m === 'step' ? '滚轮：切换阶段' : '滚轮：缩放地图'; $('#wheelmode').classList.toggle('alt', m !== 'step');
    $('#hint-wheel').textContent = m === 'step' ? '滚轮 / ↑↓ 切换阶段 · Ctrl+滚轮或双指捏合缩放 · 拖拽平移 · 右键拖拽旋转' : '滚轮缩放地图 · ↑↓ / 按钮切换阶段 · 右键拖拽旋转'; }
  function onWheel(e) {
    const overMap = e.target.closest && e.target.closest('#map');
    if (overMap && (e.ctrlKey || e.metaKey || wheelMode === 'zoom')) return;       // 交给 MapLibre 缩放
    if (e.target.closest && e.target.closest('.scrollable')) return;
    e.preventDefault(); e.stopPropagation();
    const now = e.timeStamp || performance.now(), d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY, mag = Math.abs(d);
    const gap = now - lastT; lastT = now;
    // 一次手势只翻一页：手势结束（>220ms 无事件）或惯性衰减后出现新的明显加速，才解锁
    if (locked && (gap > 220 || (mag > lastMag * 2.2 && mag > 12 && now - stepT > 450))) { locked = false; acc = 0; }
    lastMag = mag * 0.6 + lastMag * 0.4;
    if (locked || now - stepT < 650) return;        // 冷却：两次翻页至少间隔 650ms，防止低帧率设备上手势被拆成多次
    acc += d;
    if (Math.abs(acc) > 28) { go(cur + (acc > 0 ? 1 : -1)); locked = true; stepT = now; acc = 0; }
  }
  window.addEventListener('wheel', onWheel, { passive: false, capture: true });
  window.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    const k = e.key;
    if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(k)) { go(cur + 1); e.preventDefault(); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k)) { go(cur - 1); e.preventDefault(); }
    else if (k === 'Home') go(0); else if (k === 'End') go(STEPS.length - 1);
    else if (/^[1-7]$/.test(k)) go(+k - 1);
    else if (k === 'r' || k === 'R') go(cur, { force: true });
    else if (k === 'm' || k === 'M') setWheelMode(wheelMode === 'step' ? 'zoom' : 'step');
  });
  // touch swipe (on UI chrome, not on the map)
  let ty = null; document.addEventListener('touchstart', e => { if (!e.target.closest('#map')) ty = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', e => { if (ty === null) return; const dy = e.changedTouches[0].clientY - ty; if (Math.abs(dy) > 40) go(cur + (dy < 0 ? 1 : -1)); ty = null; }, { passive: true });
  $('#next').onclick = () => go(cur + 1); $('#prev').onclick = () => go(cur - 1);
  $('#dots').innerHTML = STEPS.map((s, k) => `<li title="${k + 1} · ${s.title}"><span>${k + 1}</span><em>${s.title}</em></li>`).join('');
  document.querySelectorAll('#dots li').forEach((li, k) => li.onclick = () => go(k));
  $('#wheelmode').onclick = () => setWheelMode(wheelMode === 'step' ? 'zoom' : 'step');
  $('#recenter').onclick = () => go(cur, { force: true });
  map.on('movestart', e => { if (e.originalEvent) userMoved = true; });
  map.on('moveend', () => { flying = false; });
  addEventListener('resize', () => { layoutFrame(); computeOffsets(); if (!userMoved) map.jumpTo(stepCamera(cur)); });

  // ---------------- settings panel ----------------
  $('#bm-list').innerHTML = basemaps.filter(b => !b._failed).map(b => `<label><input type="radio" name="bm" value="${b.id}"> ${b.name}</label>`).join('');
  $('#bm-list').addEventListener('change', e => { setBasemap(e.target.value); watchSlow(); });
  $('#ly-list').innerHTML = window.LAYER_CATALOG.map(([id, n]) => `<label title="Rhino 图层名：${id.toUpperCase()}"><input type="checkbox" data-id="${id}" checked> ${n}</label>`).join('');
  $('#ly-list').addEventListener('change', e => { const g = scene.groups[e.target.dataset.id]; if (g) { g.group.userData.hidden = !e.target.checked; g.group.traverse(o => o.layers.set(e.target.checked ? 0 : 1)); map.triggerRepaint(); } });
  $('#lockppt').checked = lockPPT; $('#lockppt').onchange = e => { lockPPT = e.target.checked; go(cur, { force: true }); };
  $('#axo').onchange = e => { const t0 = performance.now(), a = map.getVerticalFieldOfView ? map.getVerticalFieldOfView() : 12.9, b = e.target.checked ? PPTCam.PPT.fov : 40;
    (function f(now) { const k = Math.min(1, (now - t0) / 700); map.setVerticalFieldOfView(a + (b - a) * ease(k)); if (k < 1) requestAnimationFrame(f); })(t0); };
  $('#cmp').onchange = e => { const on = e.target.checked; $('#compare').classList.toggle('show', on); $('#compare img').src = `assets/slide${cur + 1}-render.jpg`;
    if (on && !lockPPT) { lockPPT = true; $('#lockppt').checked = true; go(cur, { force: true }); } };
  $('#cmpop').oninput = e => $('#compare').style.opacity = e.target.value / 100;
  $('#gear').onclick = () => $('#settings').classList.toggle('open');
  $('#fs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  // drag & drop GLB
  addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drop'); });
  addEventListener('dragleave', e => { if (e.target === document.documentElement || e.clientX <= 0) document.body.classList.remove('drop'); });
  addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('drop');
    [...e.dataTransfer.files].filter(f => /\.(glb|gltf)$/i.test(f.name)).forEach(f => f.arrayBuffer().then(buf => {
      const layer = f.name.replace(/\.(glb|gltf)$/i, '');
      scene.loadGLB(buf, { layer }, (ids, err) => toast(err ? `模型解析失败：${f.name}` : `已载入 ${f.name} → ${ids.join(', ')}`));
    })); });

  // ---------------- start ----------------
  buildPanel(); layoutFrame(); setWheelMode(wheelMode);
  setBasemap(params.get('basemap') || (params.has('offline') ? 'model' : CFG.defaultBasemap), vb && vb._failed && (params.get('basemap') || CFG.defaultBasemap) === 'model-ofm' && !params.has('offline') ? 'OSM 矢量远景不可用，已自动切换到「高德」' : null);
  watchSlow();
  scene.loadRegistered();
  const h = parseInt((location.hash || '').replace('#', '')) || parseInt(params.get('step')) || 1;
  go(h - 1, { instant: true });
  if (params.has('nopanel')) document.body.classList.add('clean');
  const setReady = () => { document.body.dataset.ready = '1'; };
  map.once('idle', setReady);
  (function poll(n) { if (document.body.dataset.ready) return; if ((!map.isMoving() && map.areTilesLoaded()) || n > 60) return setReady(); setTimeout(() => poll(n + 1), 500); })(0);
})();
