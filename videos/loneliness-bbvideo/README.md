# 看见孤独：BB-Video版（从515人到个体）

**180秒、1920×1080、30fps、静音。** 本版先讲515人整体，再到子群、一个人和两人对照。它使用 BB-Video 原生 core/promo/Swiss 运行时与渲染器；不是给上一版MP4换名。图表来自仓库真实数据，网页逻辑和排版不改。

## 叙事顺序

515人/75天 → 人群背景 → 515人日记总览 → 五组3D填写轨迹 → 低覆盖记录 → 编号478的日记 → 八项单题圆图 → 478与498对照 → 收束。

- **00:53**：进入3D段落。
- **01:40**：从总览走近一个人。
- **02:23**：才引入两人对照，不用两个人开场。

[新分镜](storyboard.md) · [事实表](brief.md) · [审阅说明](review-notes.md) · [本地成片验证](preview-validation.json)

## 仓库包含什么

- `index.html` / `film.js`：完整画面入口和九段绘图代码，包括真实3D几何、相机、日格排序和径向图。
- `prepare.mjs`：从当前仓库和本机已安装的BB-Video生成运行输入。
- `render.mjs`：调用BB-Video原生渲染器的小型入口。
- `audit.mjs`：30个构图时点检查，以及真实数据/原稿柱数检查。
- `brief*.md` / `storyboard.md`：事实依据与叙事分镜。
- `provenance.json`：本版数据来源SHA-256；输入变化时停止准备，避免混用版本。

**不提交MP4、渲染缓存、重复的人物数据、字体或第三方运行时副本。** `assets/`、`lib/`、`review/`、`out/`均为本地生成目录，已忽略。BB-Video运行时继续由其原项目提供，作者为BubbleBrainBB，来源为用户指定的[BB-Video仓库](https://github.com/BubbleBrainBB/BB-Video)；不将其代码冒充本项目原创。

## 环境与准备

在仓库根目录执行，Node.js 22+（本机验证为24）。需本机安装BB-Video Skill、Chrome/Chromium和ffmpeg。准备脚本不下载任何内容，也不修改网站数据。

```powershell
node videos/loneliness-bbvideo/prepare.mjs
node videos/loneliness-bbvideo/audit.mjs
node videos/loneliness-bbvideo/render.mjs --check --no-motion
node videos/loneliness-bbvideo/render.mjs --stills 12,29,50,62,78,96,111,138,166,177
node videos/loneliness-bbvideo/render.mjs --fps 30
```

默认使用**单路、单子帧**以减少Windows Chrome并行截图超时。需要与交付版相同的双子帧运动模糊，可指定：

```powershell
node videos/loneliness-bbvideo/render.mjs --workers 2 --blur 2 --fps 30
```

4路曾在本地生成交付版，但出现过Chrome截图超时并由原生渲染器重拍；不建议把高并发当作质量要求。输出位于 `videos/loneliness-bbvideo/out/video-16x9.mp4`，不会自动上传GitHub。

## 路径配置

默认BB-Video位于 `$CODEX_HOME/skills/bb-video`，未设置CODEX_HOME时使用用户主目录 `.codex/skills/bb-video`。可覆盖：

```powershell
$env:BB_VIDEO_SKILL_DIR='D:\Skills\bb-video'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:ATLAS_FONT_REGULAR='C:\Fonts\NotoSansSC-Regular.otf'
$env:ATLAS_FONT_BOLD='C:\Fonts\NotoSansSC-Bold.otf'
```

本机默认中文字体为Windows字体目录中的Noto Sans SC常规/粗体。其他机器请指定自己的中文OpenType字体。生成文件若已被修改，准备脚本默认拒绝覆盖；仅在确认要刷新生成输入后使用 `prepare.mjs --refresh`。

## 数据口径

- 515×75＝38,625个可能人日格；27,785格双题有效，10,840格不可计算。缺失不补零。
- 总览用双题复合分；圆图八项各取对应单题；对照只用孤独感单题。
- 478与498的孤独感单题均值均3.44，SD分别1.89、2.51；不能与双题均值混读。
- 五组3D人数为192/14/242/38/29，保留28,019根原稿柱。Z轴是连续段高度编码，不是孤独分或单日问卷完成率；原稿组内行号没有人物ID映射。
- ≤15有效双题日的49人占样本9.5%，对应所有不可计算格31.3%；阈值为探索性选择，不推断缺失原因。
- D01是各自入组首日，不是共同日历日期。

## 验证与保留事项

已完成本地成片的5400帧/30fps/约180秒元信息和完整解码检查。分镜、图表输入和旧片保留。原生promo检查对静音、Canvas内部动作及阅读停留会产生提醒，详见审阅说明；不声称自动提醒全部清零。

本目录不会在运行时推送或修改Git；未包含本机绝对交付路径或凭证。生成字体、第三方运行时仅留在本地。
