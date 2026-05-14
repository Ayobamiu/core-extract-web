"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonChangePayload, JsonValue } from "../types";

interface ParseResult {
  value: JsonValue;
  isValid: boolean;
  error?: string;
}

function safeParse(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { value: undefined, isValid: true };
  }
  try {
    return { value: JSON.parse(text), isValid: true };
  } catch (e) {
    return {
      value: undefined,
      isValid: false,
      error: e instanceof Error ? e.message : "Invalid JSON",
    };
  }
}

function safeStringify(value: JsonValue): string {
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

interface UseJsonEditorOptions {
  value?: JsonValue;
  defaultValue?: JsonValue;
  text?: string;
  defaultText?: string;
  readOnly?: boolean;
  onChange?: (payload: JsonChangePayload) => void;
  onValueChange?: (value: JsonValue) => void;
}

export function useJsonEditor(options: UseJsonEditorOptions) {
  const {
    value: controlledValue,
    defaultValue,
    text: controlledText,
    defaultText,
    readOnly,
    onChange,
    onValueChange,
  } = options;

  const isTextControlled = controlledText !== undefined;
  const isValueControlled = controlledValue !== undefined;

  const initialText = useMemo(() => {
    if (isTextControlled) return controlledText!;
    if (defaultText !== undefined) return defaultText;
    if (isValueControlled) return safeStringify(controlledValue);
    if (defaultValue !== undefined) return safeStringify(defaultValue);
    return "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [internalText, setInternalText] = useState<string>(initialText);
  const [pristineText, setPristineText] = useState<string>(initialText);

  // Sync from controlled `text`
  useEffect(() => {
    if (isTextControlled && controlledText !== internalText) {
      setInternalText(controlledText!);
      setPristineText((prev) =>
        prev === "" || prev === initialText ? controlledText! : prev,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledText, isTextControlled]);

  // Sync from controlled `value`
  const lastSyncedValueRef = useRef<JsonValue>(controlledValue);
  useEffect(() => {
    if (!isValueControlled || isTextControlled) return;
    if (Object.is(lastSyncedValueRef.current, controlledValue)) {
      // Identity-equal — but JSON.stringify content might still differ if the
      // ref hasn't changed. Compare stringified form to be safe.
    }
    lastSyncedValueRef.current = controlledValue;
    const nextText = safeStringify(controlledValue);
    if (nextText !== internalText) {
      // Only overwrite if the current text parses to something different.
      const parsed = safeParse(internalText);
      const currentSerialized = parsed.isValid
        ? safeStringify(parsed.value)
        : internalText;
      if (currentSerialized !== nextText) {
        setInternalText(nextText);
        setPristineText(nextText);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledValue]);

  const parsed = useMemo(() => safeParse(internalText), [internalText]);

  const setText = useCallback(
    (next: string) => {
      if (readOnly) return;
      setInternalText(next);
      const p = safeParse(next);
      const payload: JsonChangePayload = {
        text: next,
        value: p.value,
        isValid: p.isValid,
        error: p.error,
      };
      onChange?.(payload);
      if (p.isValid) {
        onValueChange?.(p.value);
      }
    },
    [readOnly, onChange, onValueChange],
  );

  const format = useCallback(() => {
    const p = safeParse(internalText);
    if (!p.isValid) return false;
    const next = safeStringify(p.value);
    if (next !== internalText) setText(next);
    return true;
  }, [internalText, setText]);

  const minify = useCallback(() => {
    const p = safeParse(internalText);
    if (!p.isValid) return false;
    try {
      const next = JSON.stringify(p.value);
      if (next !== internalText) setText(next);
      return true;
    } catch {
      return false;
    }
  }, [internalText, setText]);

  const reset = useCallback(() => {
    setText(pristineText);
  }, [pristineText, setText]);

  const markPristine = useCallback((next?: string) => {
    setPristineText(next ?? internalText);
  }, [internalText]);

  const dirty = internalText !== pristineText;

  const stats = useMemo(() => {
    const bytes = new Blob([internalText]).size;
    return {
      bytes,
      lines: internalText ? internalText.split("\n").length : 0,
      chars: internalText.length,
    };
  }, [internalText]);

  return {
    text: internalText,
    setText,
    value: parsed.value,
    isValid: parsed.isValid,
    error: parsed.error,
    dirty,
    pristineText,
    markPristine,
    reset,
    format,
    minify,
    stats,
  };
}

export type UseJsonEditorReturn = ReturnType<typeof useJsonEditor>;
