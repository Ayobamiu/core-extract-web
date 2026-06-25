"use client";

import React, { useState } from "react";
import { Card, Typography, Input, Button, Table, Alert, Tag, Empty, Space } from "antd";
import { Search, Download } from "lucide-react";
import SidebarLayout from "@/components/layout/SidebarLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { apiClient } from "@/lib/api";

const { Title, Text, Paragraph } = Typography;

interface QueryData {
  interpreted: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  csv: string;
}

const EXAMPLES = [
  "Show all wells in Livingston County",
  "Wells in Jackson County deeper than 4000 feet",
  "Wells completed after 2010",
  "Injection wells with H2S present",
];

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QueryData | null>(null);

  const run = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.nlQuery(text);
      if (res.status === "success" && res.data) {
        setData(res.data as QueryData);
      } else {
        setError(res.message || "Query failed");
        setData(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!data) return;
    const blob = new Blob([data.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const tableColumns = (data?.columns ?? []).map((c) => ({
    title: c,
    dataIndex: c,
    key: c,
    render: (v: unknown) => (v === null || v === undefined ? "" : String(v)),
  }));
  const tableRows = (data?.rows ?? []).map((r, i) => ({ key: i, ...r }));

  return (
    <ProtectedRoute>
      <SidebarLayout>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
          <Title level={3}>Ask your data</Title>
          <Paragraph type="secondary">
            Ask a question in plain English about your well records. Results come back as a table you can export.
          </Paragraph>

          <Input.Search
            placeholder="e.g. Wells in Jackson County deeper than 4000 feet"
            enterButton={<><Search size={16} style={{ marginRight: 6 }} /> Ask</>}
            size="large"
            value={question}
            loading={loading}
            onChange={(e) => setQuestion(e.target.value)}
            onSearch={run}
          />

          <Space size={[8, 8]} wrap style={{ marginTop: 12 }}>
            <Text type="secondary">Try:</Text>
            {EXAMPLES.map((ex) => (
              <Tag
                key={ex}
                style={{ cursor: "pointer" }}
                onClick={() => { setQuestion(ex); run(ex); }}
              >
                {ex}
              </Tag>
            ))}
          </Space>

          {error && <Alert style={{ marginTop: 16 }} type="error" showIcon message={error} />}

          {data && (
            <Card style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  {/* The interpreted-filter echo — what was actually searched. */}
                  <Tag color="blue">{data.interpreted}</Tag>
                  <Text type="secondary" style={{ marginLeft: 8 }}>{data.rowCount} records</Text>
                </div>
                <Button icon={<Download size={16} />} onClick={downloadCsv} disabled={!data.rowCount}>
                  Export CSV
                </Button>
              </div>
              {data.rowCount === 0 ? (
                <Empty description="No records matched" />
              ) : (
                <Table
                  columns={tableColumns}
                  dataSource={tableRows}
                  size="small"
                  scroll={{ x: true }}
                  pagination={{ pageSize: 25, showSizeChanger: true }}
                />
              )}
            </Card>
          )}
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
