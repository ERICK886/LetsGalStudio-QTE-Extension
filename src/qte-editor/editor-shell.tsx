/**
 * 文件名：editor-shell.tsx
 * 作者：池水三两升
 * 日期：2026-08-06
 * 版本：1.0.0
 * 描述：QTE 编辑器 —— 编辑器外壳（顶栏 + 三栏布局 / 预览页布局）
 *
 * 本组件是编辑器的最外层容器，负责：
 * - 顶部页签切换（设计 / 预览）
 * - 顶部标题与可选工具条
 * - 设计页：左 / 中 / 右 三栏布局
 * - 预览页：仅渲染 `center`（全宽），顶栏仍保留页签
 *
 * 视觉基调：深炭黑底 + 品红强调选中，对标 Studio 气质，
 * 刻意避免紫白渐变模板风。
 */

import React from "react";
import { FONT_SIZE_UI, FONT_UI } from "../ui-fonts";

/**
 * EditorShell 的 props 类型。
 *
 * @property tab         - 当前页签：`"design"` 或 `"preview"`
 * @property onTabChange - 页签切换回调
 * @property title       - 顶部标题（可选）
 * @property left        - 左栏内容（设计页：图层列表）
 * @property center      - 中栏内容（设计页：预览舞台；预览页：全宽预览）
 * @property right       - 右栏内容（设计页：属性面板）
 * @property toolbar     - 顶部工具条（可选，渲染在标题右侧）
 */
export interface EditorShellProps {
  tab: "design" | "preview";
  onTabChange: (t: "design" | "preview") => void;
  title?: string;
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  toolbar?: React.ReactNode;
}

/**
 * 编辑器外壳。
 *
 * 顶部固定高度的页签栏 + 标题/工具条；下方根据 `tab` 切换布局：
 * - `design`：CSS Grid 三栏（左 220px / 中 1fr / 右 260px）
 * - `preview`：单栏全宽渲染 `center`
 *
 * @returns 编辑器外壳 React 节点
 *
 * @example
 * <EditorShell
 *   tab={tab}
 *   onTabChange={setTab}
 *   title="QTE 编辑器"
 *   left={<LayerList ... />}
 *   center={<PreviewStage ... />}
 *   right={<PropertyPanel ... />}
 * />
 */
export const EditorShell: React.FC<EditorShellProps> = ({
  tab,
  onTabChange,
  title,
  left,
  center,
  right,
  toolbar,
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#15151a",
        color: "#d8d8e0",
        fontFamily: FONT_UI,
        fontSize: FONT_SIZE_UI,
        overflow: "hidden",
      }}
      data-qte-editor-shell=""
    >
      {/* 顶栏：页签 + 标题 + 工具条 */}
      <header
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          background: "#1a1a20",
        }}
      >
        <TabSwitcher tab={tab} onTabChange={onTabChange} />

        {title && (
          <span
            style={{
              fontFamily: FONT_UI,
              fontSize: FONT_SIZE_UI,
              fontWeight: 600,
              color: "#e8e8ea",
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {toolbar && <div style={{ flex: "0 0 auto" }}>{toolbar}</div>}
      </header>

      {/* 主体：根据页签切换布局 */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: tab === "design" ? "grid" : "flex",
          gridTemplateColumns:
            tab === "design" ? "220px 1fr 260px" : undefined,
          flexDirection: tab === "preview" ? "column" : undefined,
        }}
      >
        {tab === "design" ? (
          <>
            <Pane title="图层">{left}</Pane>
            <Pane title="预览" bare>
              {center}
            </Pane>
            <Pane title="属性" last>
              {right}
            </Pane>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
            }}
          >
            {center}
          </div>
        )}
      </main>
    </div>
  );
};

/**
 * 顶部页签切换器的 props 类型。
 *
 * @property tab         - 当前页签
 * @property onTabChange - 切换回调
 */
interface TabSwitcherProps {
  tab: "design" | "preview";
  onTabChange: (t: "design" | "preview") => void;
}

/**
 * 页签切换器：设计 / 预览。
 *
 * 选中态用品红高亮 + 底部色条；未选中态为浅灰。
 *
 * @returns 页签切换器 React 节点
 */
const TabSwitcher: React.FC<TabSwitcherProps> = ({ tab, onTabChange }) => {
  const tabs: { id: "design" | "preview"; label: string }[] = [
    { id: "design", label: "设计" },
    { id: "preview", label: "预览" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 2,
        background: "rgba(255, 255, 255, 0.03)",
        borderRadius: 8,
      }}
    >
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            style={{
              padding: "6px 14px",
              fontFamily: FONT_UI,
              fontSize: FONT_SIZE_UI,
              fontWeight: active ? 600 : 400,
              color: active ? "#ff6b9f" : "#9a9aa3",
              background: active
                ? "rgba(255, 77, 143, 0.14)"
                : "transparent",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              transition:
                "background 120ms ease, color 120ms ease",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * 单栏面板容器的 props 类型。
 *
 * @property title - 面板标题（小标题，渲染在面板顶部）
 * @property bare  - 是否去除内边距与标题（用于预览舞台等需铺满的内容）
 * @property last  - 是否为最右栏（不渲染右侧分隔线）
 * @property children - 面板内容
 */
interface PaneProps {
  title?: string;
  bare?: boolean;
  last?: boolean;
  children: React.ReactNode;
}

/**
 * 单栏面板：带可选小标题与边距分隔。
 *
 * `bare` 模式不渲染标题与内边距，让子内容（如预览舞台）铺满整栏。
 *
 * @returns 面板容器 React 节点
 */
const Pane: React.FC<PaneProps> = ({
  title,
  bare = false,
  last = false,
  children,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderRight:
          bare || last ? "none" : "1px solid rgba(255, 255, 255, 0.06)",
        background: bare ? "transparent" : "#18181d",
      }}
    >
      {!bare && title && (
        <div
          style={{
            flex: "0 0 auto",
            padding: "10px 12px",
            fontFamily: FONT_UI,
            fontSize: FONT_SIZE_UI,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#7a7a84",
            borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
          }}
        >
          {title}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          // 属性栏（last）需露出 ColorPicker 弹出层；其余栏可滚动
          overflow: last ? "visible" : bare ? "hidden" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
};
