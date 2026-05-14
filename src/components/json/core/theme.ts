"use client";

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const baseFont =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/**
 * AntD-token-derived CodeMirror theme. We keep two flavors (light/dark) and
 * pick one at runtime. The styling consciously stays low-contrast and close
 * to AntD defaults so the editor blends into both Drawer and Modal shells.
 */
export const jsonCmLightTheme = EditorView.theme(
  {
    "&": {
      color: "var(--ant-color-text, #1f2937)",
      backgroundColor: "transparent",
      fontFamily: baseFont,
      fontSize: "13px",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "var(--ant-color-primary, #1677ff)",
      padding: "12px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--ant-color-text-quaternary, #9ca3af)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor:
        "var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02))",
    },
    ".cm-activeLine": {
      backgroundColor:
        "var(--ant-color-fill-quaternary, rgba(0, 0, 0, 0.02))",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor:
        "var(--ant-color-primary-bg, rgba(22, 119, 255, 0.15)) !important",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--ant-color-primary, #1677ff)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--ant-color-bg-elevated, #ffffff)",
      border: "1px solid var(--ant-color-border, #d9d9d9)",
      borderRadius: "6px",
      color: "var(--ant-color-text, #1f2937)",
    },
    ".cm-panels": {
      backgroundColor: "var(--ant-color-bg-container, #fafafa)",
      color: "var(--ant-color-text, #1f2937)",
      borderTop: "1px solid var(--ant-color-border, #e5e7eb)",
    },
    ".cm-panel input, .cm-panel button": {
      fontFamily: "inherit",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(250, 219, 20, 0.35)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(250, 173, 20, 0.55)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor:
        "var(--ant-color-fill-tertiary, rgba(0, 0, 0, 0.04))",
      color: "var(--ant-color-text-tertiary, #6b7280)",
      border: "none",
      padding: "0 4px",
      borderRadius: "3px",
    },
    ".cm-diagnostic-error": {
      borderLeftColor: "var(--ant-color-error, #ff4d4f)",
    },
  },
  { dark: false },
);

export const jsonCmDarkTheme = EditorView.theme(
  {
    "&": {
      color: "var(--ant-color-text, #e5e7eb)",
      backgroundColor: "transparent",
      fontFamily: baseFont,
      fontSize: "13px",
      height: "100%",
    },
    ".cm-content": {
      caretColor: "var(--ant-color-primary, #4096ff)",
      padding: "12px 0",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--ant-color-text-quaternary, #6b7280)",
      border: "none",
      paddingRight: "8px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.03)",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(64, 150, 255, 0.25) !important",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--ant-color-primary, #4096ff)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--ant-color-bg-elevated, #1f1f1f)",
      border: "1px solid var(--ant-color-border, #303030)",
      borderRadius: "6px",
      color: "var(--ant-color-text, #e5e7eb)",
    },
    ".cm-panels": {
      backgroundColor: "var(--ant-color-bg-container, #141414)",
      color: "var(--ant-color-text, #e5e7eb)",
      borderTop: "1px solid var(--ant-color-border, #303030)",
    },
    ".cm-searchMatch": {
      backgroundColor: "rgba(250, 219, 20, 0.25)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(250, 173, 20, 0.45)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      color: "var(--ant-color-text-tertiary, #9ca3af)",
      border: "none",
      padding: "0 4px",
      borderRadius: "3px",
    },
  },
  { dark: true },
);

export const jsonHighlightLight = HighlightStyle.define([
  { tag: t.propertyName, color: "#0550ae" },
  { tag: t.string, color: "#0a7d4d" },
  { tag: t.number, color: "#9a3412" },
  { tag: t.bool, color: "#9333ea" },
  { tag: t.null, color: "#6b7280" },
  { tag: t.punctuation, color: "#4b5563" },
  { tag: t.bracket, color: "#4b5563" },
  { tag: t.invalid, color: "#dc2626" },
]);

export const jsonHighlightDark = HighlightStyle.define([
  { tag: t.propertyName, color: "#7dd3fc" },
  { tag: t.string, color: "#86efac" },
  { tag: t.number, color: "#fdba74" },
  { tag: t.bool, color: "#c4b5fd" },
  { tag: t.null, color: "#9ca3af" },
  { tag: t.punctuation, color: "#d4d4d8" },
  { tag: t.bracket, color: "#d4d4d8" },
  { tag: t.invalid, color: "#f87171" },
]);

export function getCodeMirrorTheme(theme: "light" | "dark") {
  return theme === "dark"
    ? [jsonCmDarkTheme, syntaxHighlighting(jsonHighlightDark)]
    : [jsonCmLightTheme, syntaxHighlighting(jsonHighlightLight)];
}
