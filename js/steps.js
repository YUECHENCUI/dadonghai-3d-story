/* ============================================================
 * 七个阶段 = 七条配置。每条包含：
 *   title / en       左上角标题（中文 + 英文小型大写）
 *   camera           相机：{ ppt:true } 用 PPT 原视角；或 { at:[x,y] 本地米坐标（以设计原点为准）, dz 相对 PPT 缩放增量, bearing, pitch }
 *   base             白模底图：opacity 不透明度、color 颜色（原生过渡动画）
 *   layers           设计图层状态：o 不透明度、g 生长(0=沉入地下/未建 1=建成)、c 着色、ca 着色强度
 *                    未写出的图层：现状(ex_*)默认显示白色，其余默认隐藏
 *   flat             平面图层（MapLibre 填充/线）：{ 图层id: 不透明度 }
 *   cards            卡片：anchor=[效果图像素x, y, 高度m]（4000×2250 原图坐标），box=[左%, 上%]（PPT 中卡片位置）
 *   panel            右侧指标：above 地上（自上而下），below 地下（自上而下），单位 ㎡（数字取自 PPT 原文）
 * 图层 id 同时也是 Rhino 图层名（大写）。放入同名 GLB 后会自动替换占位体块（见 README）。
 * ============================================================ */
(function () {
  const PINK = '#FE5783', NAVY = '#1F3A5C', BLACK = '#111111', ORANGE = '#FF5E3C', GREEN = '#00B050';
  const C = { com: ['商业', '#FF0000'], hotel: ['酒店（自持）', '#2E6AFA'], hub: ['交通集散中心', '#FF7AFC'], theatre: ['演艺剧场', '#B153D9'], apt: ['公寓（销售）', '#FFC000'],
              ugcom: ['地下商业', '#FF0000'], sunken: ['下沉广场', '#00B050'], garage: ['地下停车库&设备', '#89D1DF'] };
  const UG = [['ugcom', 2400], ['sunken', 4600], ['garage', 68000]];
  const GHOST = { o: 0.6, g: 0.035, c: '#d9d4ce', ca: 1 };   // 拆除：体量下沉为地面“压痕”（与 PPT 一致，仅留场地轮廓）

  window.STEP_CATEGORIES = C;
  window.STEPS = [
    { // 1
      key: 'status', title: '现状建筑运营情况', en: 'CURRENT BUILDING OPERATION STATUS',
      camera: { ppt: true },
      base: { opacity: 1, color: '#f6f5f3' },
      layers: {},
      flat: { bounds: 1 },
      cards: [
        { title: '夏日百货', tag: '在运营', en: 'Xiari Mall', gfa: 'GFA: 30000㎡', accent: PINK, anchor: [2063, 535, 22], box: [51.58, 8.04] },
        { title: '娱乐城', tag: '低效闲置', en: 'Leisure Mall', gfa: 'GFA: 13000㎡', accent: NAVY, anchor: [2205, 800, 16], box: [55.5, 21.43] },
        { title: '带状建筑', tag: '低效闲置', en: 'Bar Building', gfa: 'GFA: 18000㎡', accent: NAVY, anchor: [1396, 803, 24], box: [17.51, 44.36] },
        { label: true, title: '瑞海购物商城', en: 'Ruihai Shopping Park', lines: ['规模：3.77公顷'], anchor: [1780, 715, 0], box: [40.07, 28.01] },
        { label: true, title: '大东海广场', en: 'Dadonghai Plaza', lines: ['规模：5.44公顷'], anchor: [2400, 1330, 0], box: [55.5, 55.37] }
      ],
      panel: { above: [['com', 61000]], below: [] }
    },
    { // 2
      key: 'strategy', title: '拆·改·留更新策略', en: 'DISMANTLE-MODIFY-RETAIN UPDATE STRATEGY',
      camera: { at: [-95, 70], dz: 0.32, bearing: -30, pitch: 52 },
      base: { opacity: 1, color: '#f3f2f0' },
      layers: { ex_xiari: { o: 1, g: 1, c: '#d7a3c9', ca: 1 }, ex_slab_e: { o: 1, g: 1, c: '#8d9fce', ca: 1 },
                ex_slab_w: GHOST, ex_leisure: GHOST, ex_arcs: { o: 0.15, g: 1, c: '#ffffff', ca: 1 } },
      flat: {},
      cards: [
        { title: '保留继续运营', en: 'Keep Operating', gfa: 'GFA: 30000㎡', accent: PINK, anchor: [2039, 560, 22], box: [51.58, 8.04] },
        { title: '部分拆除重建', en: 'Demolish Partially', gfa: 'GFA: 19000㎡', accent: BLACK, anchor: [2150, 800, 14], box: [57.3, 23.17] },
        { title: '部分保留·改造提升', en: 'Adaptive Reuse', gfa: 'GFA: 12000㎡', accent: NAVY, anchor: [1560, 800, 24], box: [22.18, 46.26],
          photo: 'assets/photo-adaptive-reuse.jpg' }
      ],
      panel: { above: [['com', 42000]], below: [] }
    },
    { // 3
      key: 'hotel', title: '通过改造加建打造都市潮流酒店', en: 'TRANSFORMING AND EXPANDING INTO A TRENDY URBAN HOTEL',
      camera: { at: [-80, 20], dz: 0.75, bearing: -14, pitch: 56 },
      base: { opacity: 1, color: '#f3f2f0' },
      layers: { ex_slab_e: { o: 0, g: 0 }, ex_slab_w: { o: 0, g: 0 }, ex_leisure: { o: 0, g: 0 }, ex_arcs: { o: 0, g: 0 }, s3_hotel: { o: 1, g: 1 } },
      flat: {},
      cards: [
        { title: '都市潮流酒店', en: 'ACE HOTEL SANYA', gfa: 'GFA：16000㎡', accent: PINK, anchor: [1820, 880, 26], box: [57.08, 16.12], big: true,
          desc: '引入中国第一家顶流都市潮流酒店：Ace Hotel，既融入三亚文化又与全球审美保持联系。', descEn: 'Introducing China First Ace Hotel. Embracing Sanya in spaces built for gathering' },
        { strip: true, photo: 'assets/photo-ace-hotel.jpg', accent: PINK, anchor: [1650, 930, 10], box: [4.0, 62.59] }
      ],
      panel: { above: [['hotel', 16000], ['com', 30000]], below: [] }
    },
    { // 4
      key: 'underground', title: '地下空间集约化开发', en: 'INTEGRATED DEVELOPMENT OF UNDERGROUND SPACE',
      camera: { at: [-40, 55], dz: 0.38, bearing: -40, pitch: 44 },
      base: { opacity: 0.32, color: '#f3f2f0' },
      layers: { ex_slab_e: { o: 0, g: 0 }, ex_slab_w: { o: 0, g: 0 }, ex_leisure: { o: 0, g: 0 }, ex_arcs: { o: 0, g: 0 },
                ex_xiari: { o: 0.45, g: 1 }, s3_hotel: { o: 0.55, g: 1 },
                s4_garage: { o: 1, g: 1 }, s4_street: { o: 1, g: 1 }, s4_sunken: { o: 1, g: 1 }, s4_hub: { o: 1, g: 1 }, s4_ramp: { o: 1, g: 1 } },
      flat: { cut: 1 },
      cards: [
        { title: '小型交通东枢纽', en: 'East Transit Hub', gfa: 'GFA: 2500㎡', accent: PINK, anchor: [2240, 745, 6], box: [58.93, 14.96] },
        { title: '下沉式商业街', en: 'Sunken Comm Street', gfa: 'GFA: 2400㎡', accent: ORANGE, anchor: [2700, 1080, 0], box: [69.4, 32.7] },
        { title: '地下停车库', en: 'Basement Garage', accent: NAVY, anchor: [1900, 880, 0], box: [30.71, 52.24],
          lines: ['共提供车位：1365个', '• 配建车位：965个', '• 公共车位：400个'] }
      ],
      panel: { above: [['hub', 2500], ['hotel', 16000], ['com', 30000]], below: UG }
    },
    { // 5
      key: 'landscape', title: '大东海广场整体景观提升', en: 'OVERALL LANDSCAPE IMPROVEMENT OF DADONGHAI SQUARE',
      camera: { at: [-10, -15], dz: 0.08, bearing: -34.7, pitch: 50 },
      base: { opacity: 1, color: '#f6f5f3' },
      layers: { ex_slab_e: { o: 0, g: 0 }, ex_slab_w: { o: 0, g: 0 }, ex_leisure: { o: 0, g: 0 }, ex_arcs: { o: 0, g: 0 },
                s3_hotel: { o: 1, g: 1 }, s5_trees: { o: 1, g: 1 }, s5_mound: { o: 1, g: 1 } },
      flat: { s5: 1 },
      cards: [
        { title: '地标观景塔', en: 'Landmark View Deck', accent: ORANGE, anchor: [2236, 673, 10], box: [60.5, 25.0], small: true },
        { title: '下沉式商业街', en: 'Sunken Comm Street', accent: ORANGE, anchor: [2596, 986, 0], box: [68.1, 37.4], small: true },
        { title: '山海超线广场', en: 'Superline Plaza', accent: PINK, anchor: [2885, 1290, 0], box: [78.1, 48.7], small: true },
        { title: '音乐舞会草坪', en: 'Music Lawn', accent: GREEN, anchor: [2476, 1130, 0], box: [40.6, 38.9], small: true },
        { title: '都市雨林乐园', en: 'Rainforest Park', accent: GREEN, anchor: [2043, 1322, 0], box: [32.2, 49.1], small: true },
        { title: '清凉水乐园', en: 'Cool Park', accent: GREEN, anchor: [2380, 1577, 0], box: [67.0, 69.4], small: true },
        { title: '沙滩节庆剧场', en: 'Beach Festival Theater', accent: PINK, anchor: [2317, 1885, 0], box: [65.5, 79.5], small: true }
      ],
      panel: { above: [['hub', 2500], ['hotel', 16000], ['com', 30000]], below: UG }
    },
    { // 6
      key: 'summertown', title: '落位瞰海公寓产品', en: 'SEAVIEW APARTMENT PRODUCTS',
      camera: { at: [-70, 40], dz: 0.42, bearing: -52, pitch: 55 },
      base: { opacity: 1, color: '#f6f5f3' },
      layers: { ex_slab_e: { o: 0, g: 0 }, ex_slab_w: { o: 0, g: 0 }, ex_leisure: { o: 0, g: 0 }, ex_arcs: { o: 0, g: 0 },
                s3_hotel: { o: 1, g: 1 }, s5_trees: { o: 1, g: 1 }, s5_mound: { o: 1, g: 1 },
                s6_tower: { o: 1, g: 1 }, s6_apts: { o: 1, g: 1 }, s6_pavilions: { o: 1, g: 1 }, s6_bridge: { o: 1, g: 1 } },
      flat: { s5: 1 },
      cards: [
        { title: '瞰海公寓与商业社区', en: 'SUMMER TOWN', accent: PINK, anchor: [2110, 850, 30], box: [64.69, 15.93], big: true,
          desc: '兼具时尚感、先锋生活方式与本土商业聚集的潮流商业社区。', descEn: 'A trendy commercial community seamlessly blends fashion' }
      ],
      panel: { above: [['hub', 2500], ['theatre', 6000], ['hotel', 16000], ['apt', 33000], ['com', 34000]], below: UG }
    },
    { // 7
      key: 'sphere', title: '打开盒子，夏日百货改造提升', en: 'SUMMER DEPARTMENT STORE RENOVATION AND UPGRADE',
      camera: { at: [-115, 105], dz: 0.78, bearing: -22, pitch: 56 },
      base: { opacity: 1, color: '#f6f5f3' },
      layers: { ex_slab_e: { o: 0, g: 0 }, ex_slab_w: { o: 0, g: 0 }, ex_leisure: { o: 0, g: 0 }, ex_arcs: { o: 0, g: 0 }, ex_xiari: { o: 0, g: 1 },
                s3_hotel: { o: 1, g: 1 }, s5_trees: { o: 1, g: 1 }, s5_mound: { o: 1, g: 1 },
                s6_tower: { o: 1, g: 1 }, s6_apts: { o: 1, g: 1 }, s6_pavilions: { o: 1, g: 1 }, s6_bridge: { o: 1, g: 1 },
                s7_glass: { o: 1, g: 1 }, s7_terraces: { o: 1, g: 1 }, s7_round: { o: 1, g: 1 }, s7_sphere: { o: 1, g: 1 }, s7_boxes: { o: 1, g: 1 } },
      flat: { s5: 1 },
      cards: [
        { title: '夏日娱乐消费中心', en: 'SUMMER SPHERE', accent: PINK, anchor: [1900, 640, 12], box: [58.61, 9.89], big: true,
          desc: '升级夏日百货，打破了室内和户外的边界，创造一座三亚娱乐消费新地标-立体花园购物村。', descEn: 'A new landmark for entertainment and consumption.' }
      ],
      panel: { above: [['hub', 2500], ['theatre', 6000], ['hotel', 16000], ['apt', 33000], ['com', 38000]], below: UG }
    }
  ];
  // 图层目录（用于图层面板 / Rhino 图层命名）
  window.LAYER_CATALOG = [
    ['ex_xiari', '现状 · 夏日百货'], ['ex_leisure', '现状 · 娱乐城'], ['ex_slab_w', '现状 · 带状建筑（拆除段）'], ['ex_slab_e', '现状 · 带状建筑（保留段）'], ['ex_arcs', '现状 · 附属小建筑'],
    ['s3_hotel', '③ ACE 酒店'], ['s4_garage', '④ 地下停车库'], ['s4_street', '④ 下沉商业街'], ['s4_sunken', '④ 下沉广场'], ['s4_hub', '④ 交通东枢纽'], ['s4_ramp', '④ 出入口/坡道'],
    ['s5_trees', '⑤ 树木'], ['s5_mound', '⑤ 地标观景塔'], ['s6_tower', '⑥ 瞰海公寓塔楼'], ['s6_apts', '⑥ 东侧公寓'], ['s6_pavilions', '⑥ 商业社区'], ['s6_bridge', '⑥ 连桥'],
    ['s7_glass', '⑦ 夏日百货玻璃壳'], ['s7_terraces', '⑦ 退台花园'], ['s7_round', '⑦ 圆形中庭'], ['s7_sphere', '⑦ SUMMER SPHERE 球体'], ['s7_boxes', '⑦ 花园购物村']
  ];
})();
