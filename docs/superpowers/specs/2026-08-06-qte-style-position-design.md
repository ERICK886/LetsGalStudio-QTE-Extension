# QTE 样式与百分比定位（增强）

> 版本：1.0.0
> 基于：`2026-08-06-qte-design.md`
> 扩展 id：`ink.zenly.qte-f9e583`

## 目标

1. **扩展项目设置**：可配置 QTE 颜色与尺寸（方案 B）
2. **方法参数**：`posX` / `posY` 为舞台百分比（0–100），默认 50/50；带 min/max/step 供 Studio 范围控件（常见为滑块）

## 设置字段

| key | 类型 | 默认 |
|-----|------|------|
| outerRingColor | color(+alpha) | `#FFFFFFB8` |
| perfectColor | color(+alpha) | `#FFD66B` |
| buttonBgColor | color(+alpha) | `#1E2838D1` |
| buttonTextColor | color | `#FFFFFF` |
| flashColor | color(+alpha) | `#FFD66BB3` |
| ringDiameter | number 120–600 | `320` |
| ringStroke | number 2–20 | `6` |
| buttonSize | number 48–200 | `88` |

## 方法参数

| 字段 | 范围 | 默认 | 含义 |
|------|------|------|------|
| posX | 0–100 step 1 | 50 | QTE 中心水平位置（% 舞台宽） |
| posY | 0–100 step 1 | 50 | QTE 中心垂直位置（% 舞台高） |

CSS：`left: posX%; top: posY%; transform: translate(-50%, -50%)`

## 数据流

- 设置：`static settings = settings(...)`；Overlay 用 `ctx.settings.useSnapshot()` 读取
- 位置：写入 `QteConfigInput` → session 快照 → Overlay 定位
