/* ============================================================
 * 三亚大东海 · 节点设计方案 —— 配置（底图 / 相机 / 交互）
 * 想换底图、改默认交互，只改这个文件。
 * ============================================================ */
window.STORY_CONFIG = {
  // 默认底图：白模（本地离线数据）+ OSM 矢量远景。远景若 9 秒内加载不出来（国内常见），自动切到高德。
  defaultBasemap: 'model-ofm',
  autoFallback: 'amap-std',

  // 底图列表。crs：'wgs84' 国际坐标；'gcj02' 国测局坐标（高德）——切换时全部设计图层/白模自动偏移，保证对位。
  // ground：是否绘制本地“PPT 配色”地面（草地/道路/沙滩/海面纹理）；卫星底图下关闭，让影像透出来。
  basemaps: [
    { id: 'model', name: '白模 · PPT 配色（纯离线）', crs: 'wgs84', ground: true },
    { id: 'model-ofm', name: '白模 + OSM 矢量远景', crs: 'wgs84', ground: true, vector: 'https://tiles.openfreemap.org/styles/positron',
      attribution: '© OpenStreetMap contributors · OpenFreeMap' },
    { id: 'amap-std', name: '白模 + 高德 标准（国内快）', crs: 'gcj02', ground: true, tileSize: 256, maxzoom: 18,
      tiles: [1, 2, 3, 4].map(n => `https://webrd0${n}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}`),
      paint: { 'raster-saturation': -0.85, 'raster-brightness-min': 0.18, 'raster-contrast': -0.15 },
      attribution: '© 高德地图 AutoNavi' },
    { id: 'amap-sat', name: '高德 卫星（国内快）', crs: 'gcj02', ground: false, tileSize: 256, maxzoom: 18,
      tiles: [1, 2, 3, 4].map(n => `https://webst0${n}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`),
      paint: { 'raster-saturation': -0.1 }, attribution: '© 高德地图 AutoNavi' },
    { id: 'esri-sat', name: 'Esri 卫星（海外）', crs: 'wgs84', ground: false, tileSize: 256, maxzoom: 19,
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      paint: { 'raster-saturation': -0.1 }, attribution: 'Imagery © Esri' }
  ],

  // 动画时长（毫秒）
  flyDuration: 2200,
  layerDuration: 1500,

  // 滚轮：'step' = 滚轮切换阶段（Ctrl/⌘+滚轮或触控板双指捏合 = 缩放地图）；'zoom' = 滚轮缩放地图
  wheelMode: 'step'
};
