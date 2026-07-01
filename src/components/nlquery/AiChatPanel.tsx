"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Table, Tag, Alert, Spin, Tooltip } from "antd";
import { Send, Download, Sparkles, X } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  apiClient,
  type NlChatScope,
  type NlChatView,
  type NlChatResultSummary,
} from "@/lib/api";

// The agent replies in GitHub-flavoured markdown (headers, **bold**, tables).
// Render it compactly to fit the chat bubble rather than showing raw syntax.
const mdComponents: Components = {
  p: ({ ...p }) => <p className="mb-2 leading-relaxed last:mb-0" {...p} />,
  strong: ({ ...p }) => <strong className="font-semibold" {...p} />,
  h1: ({ ...p }) => <h1 className="mb-1 mt-2 text-[13px] font-semibold" {...p} />,
  h2: ({ ...p }) => <h2 className="mb-1 mt-2 text-[13px] font-semibold" {...p} />,
  h3: ({ ...p }) => <h3 className="mb-1 mt-2 text-[13px] font-semibold" {...p} />,
  ul: ({ ...p }) => <ul className="mb-2 list-disc space-y-0.5 pl-4" {...p} />,
  ol: ({ ...p }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4" {...p} />,
  li: ({ ...p }) => <li className="leading-snug" {...p} />,
  a: ({ ...p }) => (
    <a className="text-violet-600 underline" target="_blank" rel="noreferrer" {...p} />
  ),
  hr: ({ ...p }) => <hr className="my-2 border-gray-200" {...p} />,
  code: ({ ...p }) => (
    <code className="rounded bg-gray-200 px-1 py-0.5 text-[12px]" {...p} />
  ),
  blockquote: ({ ...p }) => (
    <blockquote className="mb-2 border-l-2 border-gray-300 pl-2 text-gray-600" {...p} />
  ),
  table: ({ ...p }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" {...p} />
    </div>
  ),
  th: ({ ...p }) => (
    <th className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-semibold" {...p} />
  ),
  td: ({ ...p }) => <td className="border border-gray-200 px-2 py-1 align-top" {...p} />,
};

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  );
}

/** A message as rendered in the panel. `view` is the detail table the agent rendered. */
interface UiMessage {
  role: "user" | "assistant";
  content: string;
  view?: NlChatView | null;
  resultSummary?: NlChatResultSummary | null;
  error?: boolean;
}

interface AiChatPanelProps {
  /** Structural scope this chat is bound to (preview / file / record / slug). */
  scope: NlChatScope;
  /** Header title — usually the same context label as the launching button. */
  title?: string;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

function DetailTable({ view }: { view: NlChatView }) {
  const columns = view.columns.map((c) => ({
    title: c,
    dataIndex: c,
    key: c,
    render: (v: unknown) => (v === null || v === undefined ? "" : String(v)),
  }));
  const rows = view.rows.map((r, i) => ({ key: i, ...r }));

  const downloadCsv = () => {
    const blob = new Blob([view.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="text-xs text-gray-500">{view.rowCount} records</span>
        <Button size="small" icon={<Download size={13} />} onClick={downloadCsv} disabled={!view.rowCount}>
          CSV
        </Button>
      </div>
      <Table
        columns={columns}
        dataSource={rows}
        size="small"
        scroll={{ x: true, y: 240 }}
        pagination={view.rowCount > 25 ? { pageSize: 25, size: "small" } : false}
      />
    </div>
  );
}

const AiChatPanel: React.FC<AiChatPanelProps> = ({ scope, title, onClose, className, style }) => {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [starters, setStarters] = useState<string[]>([]);
  const [scopeLabel, setScopeLabel] = useState<string>("");
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Re-load whenever the bound scope changes (a different file/record/type).
  const scopeKey = useMemo(() => JSON.stringify(scope), [scope]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    setError(null);
    apiClient
      .nlChatHistory(scope)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "success" && res.data) {
          setScopeLabel(res.data.scopeLabel);
          setRecordCount(res.data.recordCount);
          setStarters(res.data.starters ?? []);
          setMessages(
            (res.data.messages ?? []).map((m) => ({
              role: m.role,
              content: m.content ?? "",
              resultSummary: m.resultSummary,
            })),
          );
        } else {
          setError(res.message || "Could not load this conversation.");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this conversation.");
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // Keep the latest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || sending) return;
      setInput("");
      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setSending(true);
      try {
        const res = await apiClient.nlChat(question, scope);
        if (res.status === "success" && res.data) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: res.data!.reply,
              view: res.data!.view,
              resultSummary: res.data!.resultSummary,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: res.message || "Something went wrong.", error: true },
          ]);
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: e instanceof Error ? e.message : "Something went wrong.",
            error: true,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [scope, sending],
  );

  const hasConversation = messages.length > 0;

  return (
    <div className={`flex h-full min-h-0 flex-col bg-white ${className ?? ""}`} style={style}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
            <Sparkles size={15} className="text-violet-500" />
            <span className="truncate">{title || "Ask AI"}</span>
          </div>
          {scopeLabel && (
            <div className="truncate text-xs text-gray-400">
              {scopeLabel}
              {recordCount != null && ` · ${recordCount} records`}
            </div>
          )}
        </div>
        {onClose && (
          <Tooltip title="Close">
            <Button type="text" size="small" icon={<X size={15} />} onClick={onClose} />
          </Tooltip>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <Spin />
          </div>
        ) : (
          <>
            {!hasConversation && (
              <div className="text-sm text-gray-500">
                Ask a question about {scopeLabel || "this data"} in plain English.
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user" ? "max-w-[85%]" : "max-w-[95%]"}>
                  {m.role === "assistant" && !m.error ? (
                    <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">
                      <MarkdownMessage content={m.content} />
                    </div>
                  ) : (
                    <div
                      className={
                        m.role === "user"
                          ? "rounded-2xl rounded-br-sm bg-violet-600 px-3 py-2 text-sm text-white"
                          : "rounded-2xl rounded-bl-sm bg-red-50 px-3 py-2 text-sm text-red-700"
                      }
                      style={{ whiteSpace: "pre-wrap" }}
                    >
                      {m.content}
                    </div>
                  )}
                  {m.view && <DetailTable view={m.view} />}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-400">
                  <Spin size="small" /> <span className="ml-1">Thinking…</span>
                </div>
              </div>
            )}

            {/* Starter chips, only before the conversation begins. */}
            {!hasConversation && starters.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {starters.map((s) => (
                  <Tag
                    key={s}
                    className="cursor-pointer"
                    style={{ borderRadius: 999, padding: "3px 10px", margin: 0 }}
                    onClick={() => send(s)}
                  >
                    {s}
                  </Tag>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {error && <Alert type="error" showIcon message={error} className="mx-3" />}

      {/* Composer */}
      <div className="border-t border-gray-200 p-2">
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loadingHistory}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <div className="mt-1.5 flex justify-end">
          <Button
            type="primary"
            size="small"
            icon={<Send size={14} />}
            loading={sending}
            disabled={!input.trim() || loadingHistory}
            onClick={() => send(input)}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AiChatPanel;
