# Rhino → 网页 3D 模型 替换说明（大东海节点设计）

## 1. 坐标与单位（最重要）
| 项 | 约定 |
|---|---|
| 单位 | **米**（文件单位是毫米也可以，转换器按 `ModelUnitSystem` 自动换算） |
| 坐标轴 | X = 正东，Y = 正北，Z = 向上（Rhino 默认 Top 视图即可，**不要**把场地旋转成"顺手"的角度；若已旋转，用 `--rotation` 补回） |
| 原点（三选一） | ① 默认：Rhino 世界原点 (0,0,0) = **东经 109.5205°，北纬 18.2240°（WGS84）**，即网页设计原点 <br>② `--ref x,y,lng,lat`：告诉转换器 Rhino 里某个点对应的经纬度（如场地角点）。若经纬度是在高德地图上拾取的，加 `--gcj` <br>③ `--crs EPSG:4547`：Rhino 用的是测绘投影坐标（CGCS2000 3° 带 108E 等），自动换算，并纠正子午线收敛角 <br>（若文件里设置了 Rhino 的 EarthAnchorPoint，也会自动读取） |
| 高程 | Z=0 = 现状地面；地下部分用负值（地库 -4 ~ -12 m 等） |

## 2. 图层命名（= 网页图层 id，不区分大小写）
顶层图层名决定模型替换哪个占位体块；子图层随意（会并入顶层，保留各自颜色）。

| Rhino 顶层图层 | 网页含义 | 出现的步骤 / 动画 |
|---|---|---|
| `EX_XIARI` | 现状 · 夏日百货 | 1–6 显示；2 变粉色（保留继续运营）；4 半透明；7 隐藏，由 S7_* "打开盒子"方案替换 |
| `EX_LEISURE` | 现状 · 娱乐城（含穹顶） | 1 显示；2 下沉为场地压痕（拆除） |
| `EX_SLAB_W` | 现状 · 带状建筑西段（拆除段） | 1；2 下沉 |
| `EX_SLAB_E` | 现状 · 带状建筑东段（保留改造段） | 1；2 变蓝；3 起由酒店替换 |
| `EX_ARCS` | 现状 · 附属小建筑 | 1 显示；2 淡化；3 起隐藏 |
| `S3_HOTEL` | ACE 酒店（改造加建） | 3 起升起；4 X 光半透明 |
| `S4_GARAGE` | 地下停车库&设备（整体底板/坑） | 仅第 4 步（地面建筑变透明、地面开挖、X 光显示） |
| `S4_STREET` | 下沉式商业街 | 仅第 4 步（第 5 步以景观平面表达） |
| `S4_SUNKEN` | 下沉广场 | 仅第 4 步 |
| `S4_HUB` | 小型交通东枢纽 | 仅第 4 步 |
| `S4_RAMP` | 车行坡道 | 仅第 4 步 |
| `S5_MOUND` | 地标观景塔 / 山丘 | 5 起 |
| `S5_TREES` | 乔木（建议仍用网页实例化树；如要导出，务必用低面数） | 5 起 |
| `S6_TOWER` | 瞰海公寓塔楼（西） | 6 起 |
| `S6_APTS` | 公寓板楼（东） | 6 起 |
| `S6_PAVILIONS` | 商业社区小体量 | 6 起 |
| `S6_BRIDGE` | 连桥 | 6 起 |
| `S7_GLASS` | 夏日百货 · 玻璃顶 | 7 |
| `S7_TERRACES` | 立体花园退台 | 7 |
| `S7_ROUND` | 圆形中庭体量 | 7 |
| `S7_SPHERE` | SUMMER SPHERE 球体 | 7 |
| `S7_BOXES` | 盒子单元 | 7 |

**新增图层**：名字以 `S<N>_` 开头（例 `S5_KIOSK`）会自动在第 N 步及之后出现（带升起动画）；以 `EX_` 开头始终显示；其它名字作为附加模型始终显示。如需更精细的控制（颜色变化、X 光、只在某几步出现），在 `web/js/steps.js` 相应步骤的 `layers` 里加一行 `s5_kiosk: { o: 1, g: 1 }` 即可。

颜色：用 **图层颜色**（或对象颜色）表达材质，网页按颜色分组成材质（PBR，粗糙 0.85，不透明）。玻璃建议单独子图层并设浅蓝色；需要透明可以在 steps.js 中设 `o`（透明度）。想要 PPT 那种统一白模，加 `--white`。

## 3. 推荐流程 A（最省事）：rhino2glb.py
```bash
cd /workspace/dadonghai
.venv/bin/python work/rhino2glb.py 你的模型.3dm            # 输出 web/models/<图层>.glb + web/models/models.js
.venv/bin/python work/rhino2glb.py 你的模型.3dm --single   # 另外输出 all.glb（可直接拖进网页预览）
```
然后双击 `web/story.html` 即可（models.js 已把 GLB 以 base64 内嵌，file:// 下也能加载）。

转换器支持 Mesh / Extrusion / Brep（读取文件里缓存的**渲染网格**）/ 图块实例（递归展开）。
rhino3dm 本身不能把 NURBS 曲面网格化，所以：
- 保存 .3dm 前，在 Rhino 里**着色/渲染模式**下看一眼模型（生成渲染网格），**不要**用 `SaveSmall` / "仅保存几何"；
- 或者对复杂曲面、SubD 先 `_Mesh`（推荐，可控面数）/ `_ExtractRenderMesh`；
- 转换器会列出被跳过的对象数量（"Brep 无渲染网格"等）。

面数建议：整个场地 < 50 万三角面；单层 GLB < 10 MB（base64 后约 ×1.33 进入 models.js）。

## 4. 推荐流程 B：Rhino 8 直接导出 glTF
1. Rhino 8 → 文件 → 导出选取物件 → 格式选 `glTF Binary (*.glb)`；勾选 "Y-up"（默认）、"导出材质"；网格设置选"平滑/较少多边形"。
2. 每个图层单独导出，文件名 = 图层 id（例 `s3_hotel.glb`），或整模型导出为一个 glb（节点名需保留图层名：在导出选项里选 "按图层分组" / 物件命名为图层名）。
3. 用法：直接把 glb **拖进网页**（文件名或顶层节点名匹配图层 id）；或者运行
   `python work/rhino2glb.py --help` 中的 glb 登记方式：把 glb 转成 models.js：
   ```bash
   .venv/bin/python - <<'PY'
   import base64,json,glob,os
   reg={os.path.basename(p)[:-4].lower():{'uri':'data:model/gltf-binary;base64,'+base64.b64encode(open(p,'rb').read()).decode(),'origin':[109.5205,18.2240]} for p in glob.glob('web/models/*.glb')}
   open('web/models/models.js','w').write('window.DDH_MODELS='+json.dumps(reg)+';')
   PY
   ```
   注意：Rhino 原生导出时，坐标仍需遵守第 1 节（原点 = 109.5205E,18.2240N，或在 models.js 里把 `origin` 改为你 Rhino 原点的经纬度）。

## 5. 测试样例
- `work/make_sample_3dm.py` 生成 `work/sample_model.3dm`（S3_HOTEL 含子图层"立面"、新图层 S5_KIOSK、一个无网格 Brep）
- `work/sample_models/` 为其转换结果；把 `sample_models/models.js` 复制到 `web/models/` 即可在第 3、5 步看到替换效果（截图：`web/screenshots/glb-swap-step3.png`）。
- 还原：把 `web/models/models.js` 改回 `window.DDH_MODELS = {};`

## 6. 我需要的模型格式（给设计方）
- `.3dm`（Rhino 7/8），单位米，X 东 Y 北，Z=0 为地面；
- 场地原点：最好在 Rhino 里标一个参考点（例如夏日百货某个角点）并告知其经纬度，或直接用测绘坐标（告知 EPSG / 坐标系名称）；
- 按第 2 节命名顶层图层（现状 EX_*、各阶段 S3_*–S7_*），一个图层 = 一个可动画的"元素"；
- 每个阶段要新增/拆除/变色的元素，分别放在不同图层；
- 曲面已网格化或保存了渲染网格；不需要贴图（如有，请用图层颜色代替，或另行提供贴图）。
