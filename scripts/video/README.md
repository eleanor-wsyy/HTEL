# 看见孤独：180 秒重剪制作脚本

本目录提供可执行绘图脚本和必要的小型数据输入。分镜已经用户确认，目标为 **180 秒 / 1920×1080 / 30fps / 静音**。原脚本包由用户提供（Kimi Code），这里保留其数据来源并重新组织绘图与叙事，不覆盖用户原文件。

**视频、抽帧、编码分段和渲染缓存不纳入 Git。此提交是制作源码，不代表仓库内附带已完成的 MP4。** 网页逻辑未修改。

## 文件

- `film3.py`：九个场景、原稿 3D 柱投影、逐帧渲染及并行编码。
- `verify.py`：数据口径、桑基联合计数、圆图单题、完整 515 人矩阵、3D 几何和抽帧验证。
- `data/video_data.npz`：仅保留电影所需的 `heat / mean / sd` 三个数组。
- `data/derived.json`：原脚本十个双题均值分箱的摘要。
- `data/provenance.json`：输入文件 SHA-256 与计数口径；JSON/JS 哈希先统一 LF 换行，兼容 Windows 和其他系统的 Git 检出。
- 人物资料与八指标共用仓库 `data/study.json`；原稿模型共用 `figma-model-data.js`，不复制整份网页数据。
- [180 秒分镜](../../docs/video/storyboard-180s.md)
- [原片审阅与修改意见](../../docs/video/review-notes.md)

## 运行

以下命令从仓库根目录执行。已在 Windows、Python 3.13 上测试。Python 依赖为 NumPy、Pillow；完整编码还需系统 `ffmpeg` 可执行文件位于 PATH。

```powershell
python -m pip install -r scripts/video/requirements.txt
python scripts/video/verify.py
python scripts/video/film3.py --stills 7,27,42,61,87,109,124,127,138,146,169,178
python scripts/video/film3.py --render --workers 8
```

默认输出位于 `scripts/video/film3_output/`，已忽略：

- `still_*.png`：抽帧。
- `parts/part_*.mp4`：每 300 帧一个独立编码分段。
- `render_audit.json`：各分段帧数、耗时及文字越界记录。
- `loneliness_recut_180s_1080p.mp4`：完成后合并的成片。

每段只编码一次，最终 concat 使用 `-c copy`，不再次压缩。8 个 worker 是并行渲染进程，不是外部 AI 代理。可按内存与 CPU 情况降低为 2 或 4。

使用 `--outdir <目录>` 指定输出位置；使用 `--frames 3360 4500` 只编码 112—150 秒的 3D 片段。片段模式的输出不应误认为完整 180 秒电影。

## 字体

默认优先使用本机 Noto Sans SC、宋体及 Georgia；微软雅黑可作中文回退。缺少中文字体会明确报错，不静默生成方框。其他系统可指定本机字体的绝对路径：

```powershell
$env:LONELINESS_FONT_REGULAR = 'C:\Fonts\NotoSansSC-Regular.otf'
$env:LONELINESS_FONT_BOLD = 'C:\Fonts\NotoSansSC-Bold.otf'
$env:LONELINESS_FONT_SERIF = 'C:\Fonts\NotoSerifSC-Regular.otf'
$env:LONELINESS_FONT_NUM = 'C:\Fonts\Georgia.ttf'
```

只配置 `LONELINESS_FONT_REGULAR` 也可运行，缺少的其他字形将回退至该字体；排版可能随字体改变，仍需视觉检查。

## 本版修正与口径

1. 圆图八项分别读取对应单题，并在扇区内按日次展开；不再把前两项都画成双题复合分。
2. 覆盖图完整包含 515×75 个格子；排序移动真实人物列，不用前 75 人替代全体。
3. 3D 使用网页原稿五组，人数为 **192 / 14 / 242 / 38 / 29**，保留全部 **28,019 根柱**，不重新聚类或抽 11 人。
4. 原稿正值编码与所在连续正值段长度一致，515 行、3,907 段全部核验。Z 轴为原稿连续段高度编码，不能解释成孤独分或单日问卷完成率；组内行序号没有人物 ID 映射。
5. 总览、散点用双题复合分；人物对照用孤独感单题。478 与 498 的单题均值同为 3.44，双题均值则为 3.80 与 2.16。
6. 27,785 个有效双题格 + 10,840 个不可计算格 = 38,625；≤15 有效双题日的 49 人占样本 9.5%，对应全部不可计算格的 31.3%。
7. D01 是各自入组首日，不是统一日历日。缺失不补零、不从缺失推断退出动机。

若更新网页基础数据，请同步重算电影的冻结数组与分箱，并更新 provenance；`verify.py` 会检测输入哈希与矩阵不一致，避免把新旧版本混合使用。

## 输出后检查

```powershell
ffprobe -v error -show_entries stream=codec_type,width,height,r_frame_rate,nb_frames -show_entries format=duration -of json scripts/video/film3_output/loneliness_recut_180s_1080p.mp4
ffmpeg -v error -i scripts/video/film3_output/loneliness_recut_180s_1080p.mp4 -f null -
```

完整片预期 180 秒、5,400 帧、1920×1080、30fps，只有视频流。脚本的文字越界检测不能替代视觉验收，尤其需检查圆图底部、桑基小类标签及五个 3D 模型。
