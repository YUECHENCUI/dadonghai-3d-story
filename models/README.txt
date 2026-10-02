把 Rhino 转出的模型放这里：
  work/rhino2glb.py 会生成  models/<图层名>.glb  以及  models/models.js（base64 内嵌，双击 file:// 也能读）。
  页面启动时自动加载 models.js 里登记的模型，并替换同名图层的占位体块。
  当前 models.js 为空（window.DDH_MODELS = {}）= 全部使用占位体块。
  示例：work/sample_models/models.js（复制到这里即可看到第 3 步酒店被替换、第 5 步出现新图层 S5_KIOSK）。
  说明：work/RHINO_NOTES.md 与 web/README.md 第 5 节。
