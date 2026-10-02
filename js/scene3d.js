/* ============================================================
 * 设计体块 3D 图层（three.js 自定义图层，嵌入 MapLibre 同一 WebGL 上下文，与白模共享深度）
 *  - 每个“设计图层”= 一个 THREE.Group：占位体块（由 design-data.js 生成）或 Rhino 导出的 GLB
 *  - 图层状态 {o 不透明度, g 生长, c 着色, ca 着色强度} 可平滑过渡（缓动）
 *  - GLB：window.DDH_MODELS（models/models.js）或拖拽 .glb 到页面；按图层名自动替换占位体块
 * ============================================================ */
(function () {
  const T = window.THREE;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = t => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function Scene3D(map, D) {
    const self = this;
    this.map = map; this.D = D;
    let originLL = D.origin.slice(), originMerc = null, s = 1;
    this.lastMatrix = null;
    const groups = {};                      // id -> {group, mats:[], placeholder:[], state, tw}
    const scene = new T.Scene(), camera = new T.Camera();
    let renderer = null;
    this.groups = groups;

    // ---------- coordinates ----------
    function setOrigin(ll) {
      originLL = ll; originMerc = maplibregl.MercatorCoordinate.fromLngLat(ll, 0);
      s = originMerc.meterInMercatorCoordinateUnits();
    }
    this.setOriginLL = ll => { setOrigin(ll); map.triggerRepaint(); };
    const wgsOrigin = D.origin;
    // 本地米坐标（相对设计原点，x 东 y 北）。数据为 WGS84，局部范围内与 GCJ 偏移为平移，故始终以 WGS 原点计算局部坐标
    const o0 = maplibregl.MercatorCoordinate.fromLngLat(wgsOrigin, 0), s0 = o0.meterInMercatorCoordinateUnits();
    function local(ll) { const m = maplibregl.MercatorCoordinate.fromLngLat(ll, 0); return [(m.x - o0.x) / s0, -(m.y - o0.y) / s0]; }
    this.local = local;

    // ---------- materials ----------
    function mat(color, opt = {}) {
      const m = opt.glass
        ? new T.MeshPhongMaterial({ color, transparent: true, opacity: 0.32, shininess: 90, specular: 0xffffff, side: T.DoubleSide, depthWrite: false })
        : new T.MeshLambertMaterial({ color, transparent: true, opacity: 1, side: opt.double ? T.DoubleSide : T.FrontSide });
      if (opt.xray) { m.depthTest = false; m.depthWrite = false; m.opacity = opt.shell ? 0.28 : 0.82; m.side = T.DoubleSide; }
      m.userData = { base: new T.Color(color), baseOpacity: m.opacity, glass: !!opt.glass, xray: !!opt.xray };
      return m;
    }
    function edgeMat(xray) {
      const m = new T.LineBasicMaterial({ color: xray ? 0x16324a : 0x7d7873, transparent: true, opacity: xray ? 0.7 : 0.45 });
      if (xray) { m.depthTest = false; m.depthWrite = false; }
      m.userData = { base: m.color.clone(), baseOpacity: m.opacity, edge: true };
      return m;
    }

    // ---------- geometry from parts ----------
    function ringsToShapes(rings) {
      return rings.map(poly => {
        const pts = poly[0].map(c => new T.Vector2(...local(c)));
        const sh = new T.Shape(pts);
        poly.slice(1).forEach(h => sh.holes.push(new T.Path(h.map(c => new T.Vector2(...local(c))))));
        return sh;
      });
    }
    function circleOf(shapes) {
      const box = new T.Box2(); shapes.forEach(sh => sh.getPoints().forEach(p => box.expandByPoint(p)));
      const c = box.getCenter(new T.Vector2()), sz = box.getSize(new T.Vector2());
      return { c, r: Math.max(sz.x, sz.y) / 2 };
    }
    function buildPart(p, g) {
      const shapes = ringsToShapes(p.rings); if (!shapes.length) return;
      const h = p.z1 - p.z0; let geom;
      if (p.shape_ === 'dome' || p.shape_ === 'sphere') {
        const { c, r } = circleOf(shapes);
        if (p.shape_ === 'dome') { geom = new T.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2); geom.rotateX(Math.PI / 2); geom.scale(1, 1, h / r); geom.translate(c.x, c.y, p.z0); }
        else { geom = new T.SphereGeometry(1, 48, 24); geom.rotateX(Math.PI / 2); geom.scale(r, r * 0.8, h / 2); geom.translate(c.x, c.y, p.z0 + h / 2); }
      } else if (p.ring) {
        const { c, r } = circleOf(shapes);
        const sh = new T.Shape(); sh.absarc(c.x, c.y, r, 0, Math.PI * 2, false);
        const hole = new T.Path(); hole.absarc(c.x, c.y, r * 0.58, 0, Math.PI * 2, true); sh.holes.push(hole);
        geom = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 48 }); geom.translate(0, 0, p.z0);
        shapes.splice(0, shapes.length, sh);
      } else if (p.shell) {          // 基坑：只有侧壁 + 底板（剖切效果）
        const pos = [];
        shapes.forEach(sh => { const pts = sh.getPoints(); for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length];
          pos.push(a.x, a.y, p.z0, b.x, b.y, p.z0, b.x, b.y, p.z1, a.x, a.y, p.z0, b.x, b.y, p.z1, a.x, a.y, p.z1); } });
        geom = new T.BufferGeometry(); geom.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geom.computeVertexNormals();
        const bottom = new T.ShapeGeometry(shapes); bottom.translate(0, 0, p.z0);
        const m2 = mat('#16222d', { xray: true, shell: true }); m2.opacity = m2.userData.baseOpacity = 0.35;
        addMesh(g, bottom, m2, false);
      } else {
        geom = new T.ExtrudeGeometry(shapes, { depth: h, bevelEnabled: false, curveSegments: 24 }); geom.translate(0, 0, p.z0);
      }
      const m = mat(p.color, { glass: p.glass, xray: p.xray, shell: p.shell, double: !!p.shell });
      addMesh(g, geom, m, !p.shell);
      if (p.roof) {
        const cap = new T.ShapeGeometry(shapes); cap.translate(0, 0, p.z1 + 0.08);
        const rm = mat(p.roof); rm.polygonOffset = true; rm.polygonOffsetFactor = -2;
        addMesh(g, cap, rm, false);
      }
      if (p.glass) {        // 玻璃壳：加一层格栅线，像 PPT 里的网格屋面
        const lines = []; const { c, r } = circleOf(shapes);
        for (let k = -r; k <= r; k += 4.5) lines.push(c.x + k, c.y - r, p.z1 + 0.1, c.x + k, c.y + r, p.z1 + 0.1);
        const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(lines, 3));
        // 裁剪到轮廓：用 stencil 太重，这里用简化方式——只保留落在轮廓内的线段端点
        const inside = (x, y) => shapes.some(sh => pointInPoly(x, y, sh.getPoints()));
        const keep = []; for (let i = 0; i < lines.length; i += 6) {
          const x = lines[i], y0 = lines[i + 1], y1 = lines[i + 4]; let a = null;
          for (let y = y0; y <= y1; y += 1) { const ins = inside(x, y); if (ins && a === null) a = y; if ((!ins || y + 1 > y1) && a !== null) { keep.push(x, a, p.z1 + 0.1, x, y, p.z1 + 0.1); a = null; } }
        }
        lg.setAttribute('position', new T.Float32BufferAttribute(keep, 3));
        const lm = edgeMat(false); lm.color.set(0x9aaab5); lm.userData.base = lm.color.clone(); lm.opacity = lm.userData.baseOpacity = 0.7;
        const ls = new T.LineSegments(lg, lm); ls.frustumCulled = false; g.group.add(ls); g.mats.push(lm); g.placeholder.push(ls);
      }
    }
    function pointInPoly(x, y, pts) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j];
      if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) ins = !ins; } return ins; }
    function addMesh(g, geom, m, edges) {
      const mesh = new T.Mesh(geom, m); mesh.frustumCulled = false; mesh.renderOrder = m.userData.xray ? -10 : (m.userData.glass ? 5 : 0);
      g.group.add(mesh); g.mats.push(m); g.placeholder.push(mesh);
      if (edges) {
        const em = edgeMat(m.userData.xray), e = new T.LineSegments(new T.EdgesGeometry(geom, 28), em);
        e.frustumCulled = false; e.renderOrder = mesh.renderOrder + 1; g.group.add(e); g.mats.push(em); g.placeholder.push(e);
      }
    }
    function ensureGroup(id, def) {
      if (groups[id]) return groups[id];
      const g = { id, group: new T.Group(), mats: [], placeholder: [], state: Object.assign({ o: 0, g: 0, c: null, ca: 0 }, def || {}), tw: null, trees: null };
      g.group.name = id; scene.add(g.group); groups[id] = g; return g;
    }

    // ---------- trees (instanced) ----------
    function buildTrees(id, data) {
      const g = ensureGroup(id);
      const n = data.length, canopyG = new T.IcosahedronGeometry(1, 1), trunkG = new T.CylinderGeometry(0.18, 0.28, 1, 6);
      canopyG.rotateX(Math.PI / 2); trunkG.rotateX(Math.PI / 2); trunkG.translate(0, 0, 0.5);
      const cm = mat('#ffffff'); cm.flatShading = true; const tm = mat('#8a6a4a');
      const canopy = new T.InstancedMesh(canopyG, cm, n), trunk = new T.InstancedMesh(trunkG, tm, n);
      const pal = ['#4c7a37', '#5b8c42', '#6c9b4b', '#3e6a31', '#77a556'].map(c => new T.Color(c));
      const ctr = local([109.5212, 18.2232]);
      const info = data.map((d, i) => {
        const [x, y] = local([d[0], d[1]]); const r = Math.max(1.6, Math.min(5.5, d[2] * 0.9));
        canopy.setColorAt(i, pal[(i * 7919) % pal.length]);
        const dist = Math.hypot(x - ctr[0], y - ctr[1]);
        return { x, y, r, h: 1.6 + r * 0.9, delay: Math.min(0.6, dist / 520) + ((i * 37) % 10) / 100 };
      });
      canopy.instanceColor.needsUpdate = true;
      [canopy, trunk].forEach(m => { m.frustumCulled = false; g.group.add(m); g.placeholder.push(m); });
      g.mats.push(tm); g.mats.push(cm); cm.userData.base = new T.Color('#ffffff');
      g.trees = { canopy, trunk, info, lastG: -1 };
      updateTrees(g, 0);
    }
    const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3();
    function updateTrees(g, gv) {
      const t = g.trees; if (!t || Math.abs(t.lastG - gv) < 1e-4) return; t.lastG = gv;
      t.info.forEach((d, i) => {
        const k = clamp01((gv * 1.65 - d.delay) / 0.55), sc = k <= 0 ? 0.0001 : easeOutBack(k);
        _p.set(d.x, d.y, d.h * sc); _s.set(d.r * sc, d.r * sc, d.r * 0.85 * sc); _m.compose(_p, _q, _s); t.canopy.setMatrixAt(i, _m);
        _p.set(d.x, d.y, 0); _s.set(sc, sc, d.h * sc); _m.compose(_p, _q, _s); t.trunk.setMatrixAt(i, _m);
      });
      t.canopy.instanceMatrix.needsUpdate = true; t.trunk.instanceMatrix.needsUpdate = true;
    }

    // ---------- build all ----------
    Object.entries(D.meshes).forEach(([id, parts]) => {
      const def = id.startsWith('ex_') ? { o: 1, g: 1 } : { o: 0, g: 0 };
      const g = ensureGroup(id, def); parts.forEach(p => buildPart(p, g));
    });
    buildTrees('s5_trees', D.trees);
    Object.values(groups).forEach(g => applyState(g, g.state));

    // ---------- state & tweening ----------
    function targetColor(m, st) {
      const c = m.userData.base.clone(); if (m.userData.edge) return c;
      if (st.c && st.ca > 0) c.lerp(new T.Color(st.c), st.ca); return c;
    }
    function applyState(g, st, colors) {
      const o = st.o;
      g.group.visible = o > 0.004;
      g.group.scale.z = g.trees ? 1 : Math.max(0.0015, st.g);
      g.mats.forEach((m, i) => {
        m.opacity = m.userData.baseOpacity * (m.userData.edge ? Math.min(1, o * 1.6) : o);
        if (!m.userData.xray && !m.userData.glass && !m.userData.edge) m.depthWrite = o > 0.9;
        if (colors) m.color.copy(colors[i]);
      });
      if (g.trees) updateTrees(g, st.g);
    }
    this.setState = function (id, target, opt = {}) {
      const g = groups[id]; if (!g) return;
      const from = Object.assign({}, g.state), to = Object.assign({ c: null, ca: 0 }, target);
      if (to.c && to.ca === undefined) to.ca = 1;
      const fromCols = g.mats.map(m => m.color.clone()), toCols = g.mats.map(m => targetColor(m, to));
      const dur = opt.instant ? 0 : (opt.duration || 1500), delay = opt.instant ? 0 : (opt.delay || 0);
      g.tw = { from, to, fromCols, toCols, t0: performance.now() + delay, dur };
      if (dur === 0) { g.state = to; applyState(g, to, toCols); g.tw = null; }
      map.triggerRepaint();
    };
    this.getState = id => groups[id] && groups[id].state;
    this.isPlaceholder = id => !!(D.meshes[id] || id === 's5_trees');
    this.animating = () => Object.values(groups).some(g => g.tw);
    function tick(now) {
      Object.values(groups).forEach(g => {
        const tw = g.tw; if (!tw) return;
        const k = tw.dur ? clamp01((now - tw.t0) / tw.dur) : 1; if (now < tw.t0) return;
        const e = ease(k), st = { o: tw.from.o + (tw.to.o - tw.from.o) * e, g: tw.from.g + (tw.to.g - tw.from.g) * e, c: tw.to.c, ca: tw.to.ca };
        const cols = tw.fromCols.map((c, i) => c.clone().lerp(tw.toCols[i], e));
        g.state = k >= 1 ? Object.assign({}, tw.to) : st; applyState(g, g.state, cols);
        if (k >= 1) g.tw = null;
      });
    }

    // ---------- GLB replacement ----------
    const loader = new T.GLTFLoader();
    function b64ToBuf(uri) { const b = atob(uri.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; }
    function placeModel(root, cfg) {
      const wrap = new T.Group(); wrap.add(root);
      root.rotation.x = Math.PI / 2;                       // glTF Y-up → 本地 Z-up
      const o = cfg.origin ? local(cfg.origin) : [0, 0];   // 模型原点对应的经纬度（默认=设计原点）
      wrap.position.set(o[0] + (cfg.offset ? cfg.offset[0] : 0), o[1] + (cfg.offset ? cfg.offset[1] : 0), cfg.offset ? cfg.offset[2] || 0 : 0);
      wrap.rotation.z = (cfg.rotation || 0) * Math.PI / 180;
      if (cfg.scale) wrap.scale.setScalar(cfg.scale);
      return wrap;
    }
    function adopt(g, obj) {
      obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { m.transparent = true; m.side = T.DoubleSide; m.userData = { base: m.color ? m.color.clone() : new T.Color(1, 1, 1), baseOpacity: m.opacity == null ? 1 : m.opacity }; g.mats.push(m); }); } });
      g.placeholder.forEach(p => p.visible = false);
      g.group.add(obj); applyState(g, g.state, g.mats.map(m => targetColor(m, g.state)));
      map.triggerRepaint();
    }
    const norm = s => String(s || '').toLowerCase().replace(/\.glb$/, '').replace(/[^a-z0-9_]/g, '_');
    this.loadGLB = function (buf, cfg = {}, cb) {
      loader.parse(buf, '', gltf => {
        const id = cfg.layer && norm(cfg.layer);
        if (id) { const fresh = !groups[id]; adopt(ensureGroup(id), placeModel(gltf.scene, cfg)); if (fresh && self.onNewGroup) self.onNewGroup(id); cb && cb([id]); return; }
        // 多图层 GLB：按顶层节点名（= Rhino 图层名）分配
        const hit = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.children.slice().forEach(ch => {
          const nid = norm(ch.name).replace(/^ddh_/, '').replace(/__\d+$/, '');   // rhino2glb：同图层多材质节点名为 layer__1、layer__2
          const key = Object.keys(groups).find(k => nid === k || nid.startsWith(k + '_'));
          // 新图层：名称以 s<N>_ / ex_ 开头的，自动建组（s<N>_ 从第 N 步起显示，见 story.js）
          const nk = key || (/^(s\d_|ex_)/.test(nid) ? nid : null);
          if (nk) { const fresh = !groups[nk], wrapScene = new T.Group(); wrapScene.add(ch); adopt(ensureGroup(nk), placeModel(wrapScene, cfg)); hit.push(nk);
            if (fresh && self.onNewGroup) self.onNewGroup(nk); }
        });
        if (gltf.scene.children.length) {      // 未匹配的节点：作为“附加模型”始终显示
          const g = ensureGroup('extra', { o: 1, g: 1 }); adopt(g, placeModel(gltf.scene, cfg)); hit.push('extra');
        }
        cb && cb(hit);
      }, err => { console.error('GLB 解析失败', err); cb && cb([], err); });
    };
    this.loadRegistered = function () {
      const reg = window.DDH_MODELS || {};
      Object.entries(reg).forEach(([layer, cfg]) => {
        const c = typeof cfg === 'string' ? { uri: cfg } : cfg; c.layer = c.layer || (layer === 'all' ? null : layer);
        if (c.uri && c.uri.startsWith('data:')) self.loadGLB(b64ToBuf(c.uri), c, ids => console.info('GLB 已载入', layer, ids));
        else if (c.url) fetch(c.url).then(r => r.arrayBuffer()).then(b => self.loadGLB(b, c, ids => console.info('GLB 已载入', layer, ids)))
          .catch(e => console.warn('GLB 无法通过 file:// 读取，请用 models/models.js（base64）或拖拽 .glb 到页面', e));
      });
    };

    // ---------- custom layer ----------
    this.layer = {
      id: 'design3d', type: 'custom', renderingMode: '3d',
      onAdd(m, gl) {
        renderer = new T.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
        renderer.autoClear = false;
        const hemi = new T.HemisphereLight(0xffffff, 0xc4bfb8, 2.5); hemi.position.set(0, 0, 1); scene.add(hemi);
        const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(-0.55, -0.75, 1.0); scene.add(sun);
        const fill = new T.DirectionalLight(0xffffff, 0.6); fill.position.set(0.6, 0.5, 0.4); scene.add(fill);
      },
      render(gl, args) {
        const now = performance.now(); tick(now);
        const mm = args && args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args;
        self.lastMatrix = mm;
        const M = new T.Matrix4().fromArray(mm);
        const L = new T.Matrix4().makeTranslation(originMerc.x, originMerc.y, 0).scale(new T.Vector3(s, -s, s));
        camera.projectionMatrix = M.multiply(L);
        renderer.resetState(); renderer.render(scene, camera);
        if (self.animating()) map.triggerRepaint();
        self.onFrame && self.onFrame();
      }
    };
    setOrigin(originLL);

    // 屏幕坐标（含高度）：用于卡片锚点
    this.screen = function (ll, h) {
      const mm = self.lastMatrix; if (!mm) return null;
      const mc = maplibregl.MercatorCoordinate.fromLngLat(ll, h || 0);
      const x = mc.x, y = mc.y, z = mc.z;
      const cx = mm[0] * x + mm[4] * y + mm[8] * z + mm[12], cy = mm[1] * x + mm[5] * y + mm[9] * z + mm[13], cw = mm[3] * x + mm[7] * y + mm[11] * z + mm[15];
      if (cw <= 0) return null;
      const c = map.getCanvas(); const W = c.clientWidth, H = c.clientHeight;
      return [(cx / cw + 1) / 2 * W, (1 - cy / cw) / 2 * H];
    };
  }
  window.Scene3D = Scene3D;
})();
