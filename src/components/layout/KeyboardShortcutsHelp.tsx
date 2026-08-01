"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "antd";
import { Command } from "lucide-react";

type ShortcutAction = {
  keys: { mac: string; other: string };
  description: string;
};

type ShortcutSection = {
  title: string;
  scope?: string;
  actions: ShortcutAction[];
};

// Single source of truth for the app's keyboard shortcuts. Keep in sync with
// the keydown handlers in:
//  - layout/SidebarLayout.tsx        (⌘B sidebar)
//  - file/FileViewerLayout.tsx       (⌘B / ⌘⇧B panes)
//  - ui/TabbedDataViewer.tsx         (sections, approve, scroll, save)
//  - json/JsonViewer.tsx             (⌘S save)
//  - json/core/JsonCodeEditor.tsx    (⌘F search)
//  - FileTable.tsx                   (←/→/Esc file nav)
const SECTIONS: ShortcutSection[] = [
  {
    title: "General",
    actions: [
      {
        keys: { mac: "⌘B", other: "Ctrl+B" },
        description: "Toggle the navigation sidebar",
      },
      {
        keys: { mac: "⌘/", other: "Ctrl+/" },
        description: "Open this keyboard shortcuts guide",
      },
    ],
  },
  {
    title: "Files table",
    scope: "when the file viewer is open",
    actions: [
      {
        keys: { mac: "←", other: "←" },
        description: "Previous file",
      },
      {
        keys: { mac: "→", other: "→" },
        description: "Next file",
      },
      {
        keys: { mac: "Esc", other: "Esc" },
        description: "Close the file viewer",
      },
    ],
  },
  {
    title: "File viewer",
    scope: "when a file is open",
    actions: [
      {
        keys: { mac: "⌘B", other: "Ctrl+B" },
        description: "Show / hide the PDF panel",
      },
      {
        keys: { mac: "⌘⇧B", other: "Ctrl+Shift+B" },
        description: "Show / hide the QA panel",
      },
      {
        keys: { mac: "⌘⇧←", other: "Ctrl+Shift+←" },
        description: "Previous section",
      },
      {
        keys: { mac: "⌘⇧→", other: "Ctrl+Shift+→" },
        description: "Next section",
      },
      {
        keys: { mac: "⌘G", other: "Ctrl+G" },
        description: "Scroll the PDF to the section's page",
      },
      {
        keys: { mac: "⌘⇧↵", other: "Ctrl+Shift+Enter" },
        description: "Approve the current section",
      },
      {
        keys: { mac: "⌘↵", other: "Ctrl+Enter" },
        description: "Save edits (results tab)",
      },
      {
        keys: { mac: "⌘S", other: "Ctrl+S" },
        description: "Save JSON edits",
      },
      {
        keys: { mac: "⌘F", other: "Ctrl+F" },
        description: "Search in the JSON editor",
      },
    ],
  },
];

function useIsMac(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  }, []);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.4rem] rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-700 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      {children}
    </kbd>
  );
}

// Render a combo like "⌘⇧↵" / "Ctrl+Shift+Enter" as a run of keycaps.
function KeyCombo({ combo }: { combo: string }) {
  const parts = combo.split("+");
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((p, i) => (
        <Kbd key={i}>{p}</Kbd>
      ))}
    </span>
  );
}

export function useKeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  // ⌘/ (or Ctrl+/) toggles the guide — the conventional "show shortcuts" key.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      if (target.closest(".cm-editor")) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== "/") return;
      if (e.shiftKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export default function KeyboardShortcutsHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const isMac = useIsMac();
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Ant's Modal doesn't always move focus inside on open, which Esc needs to
  // close it. Focus the body when it becomes visible.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => contentRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <div className="flex items-center gap-2">
          <Command className="h-4 w-4 text-gray-500" aria-hidden />
          <span>Keyboard shortcuts</span>
        </div>
      }
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="max-h-[60vh] overflow-y-auto -mx-1 px-1 py-1 outline-none"
      >
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {section.title}
              </h3>
              {section.scope && (
                <span className="text-[11px] text-gray-400">{section.scope}</span>
              )}
            </div>
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
              {section.actions.map((action) => (
                <li
                  key={action.description}
                  className="flex items-center justify-between gap-4 px-3 py-2"
                >
                  <span className="text-[13px] text-gray-700">
                    {action.description}
                  </span>
                  <span className="flex-shrink-0">
                    <KeyCombo combo={isMac ? action.keys.mac : action.keys.other} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-3 text-[11px] text-gray-400">
          Shortcuts are paused while typing in an input or editor.
        </p>
      </div>
    </Modal>
  );
}
