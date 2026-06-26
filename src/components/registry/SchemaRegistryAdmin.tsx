"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  App,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  apiClient,
  DocumentTypeInfo,
  RegistryDocumentTypeDetail,
  RegistrySchemaVersionSummary,
} from "@/lib/api";
import { ReloadOutlined, PlusOutlined } from "@ant-design/icons";
import { JsonViewer } from "@/components/json";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const EXTRACTORS = [
  { label: "ExtendAI", value: "extendai" },
  // { label: "MinerU", value: "mineru" },
  { label: "PaddleOCR", value: "paddleocr" },
  // { label: "Document AI", value: "documentai" },
];

/** Shown when the hints editor is empty; mirrors real slug-specific guidance shape. */
const CLASSIFIER_HINTS_PLACEHOLDER = `{
  "skip_when": [
    "If the page is an administrative permit/application (e.g. 'Application for Permit to Drill'), use document_type_slug='none'.",
    "Skip sections that duplicate the same factual data elsewhere in the packet (cover-only or index pages)."
  ],
  "keep_when": [
    "Keep tabular logs with depth intervals, lithology, and well construction.",
    "Keep factual records titled like 'Well Plugging Record' or 'Completion Log'; they are distinct from abandonment permission forms."
  ]
}`;

export default function SchemaRegistryAdmin() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<DocumentTypeInfo[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  const [manageSlug, setManageSlug] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<RegistryDocumentTypeDetail | null>(null);
  const [versions, setVersions] = useState<RegistrySchemaVersionSummary[]>([]);
  const [editForm] = Form.useForm();
  const [hintsText, setHintsText] = useState("");
  // Post-processing defaults for the managed slug: registered services + the
  // per-service enabled map (name → enabled) seeded from the document type.
  const [ppServices, setPpServices] = useState<{ name: string; version: string }[]>([]);
  const [ppEnabled, setPpEnabled] = useState<Record<string, boolean>>({});
  const [ppSaving, setPpSaving] = useState(false);
  // Per-type record identifier dot-paths (preview ID column), one per line.
  const [idFieldsText, setIdFieldsText] = useState("");
  const [idSaving, setIdSaving] = useState(false);
  const [newSchemaText, setNewSchemaText] = useState("");
  const [newSchemaOpen, setNewSchemaOpen] = useState(false);
  const [schemaView, setSchemaView] = useState<{
    slug: string;
    version: number;
    json: string;
  } | null>(null);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getDocumentTypes({ includeDeprecated: true });
      if (res.success && res.documentTypes) setTypes(res.documentTypes);
      else message.error(res.message || "Failed to load document types");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  // AntD warns if we call form instance methods before the Form mounts.
  // Hydrate fields after `detail` is rendered instead of during fetch.
  useEffect(() => {
    if (!detail) return;
    editForm.setFieldsValue({
      displayName: detail.display_name,
      description: detail.description ?? "",
      defaultExtractor: detail.default_extractor,
      routingConfidenceThreshold: detail.routing_confidence_threshold,
      status: detail.status,
    });
  }, [detail, editForm]);

  const openManage = async (slug: string) => {
    setManageSlug(slug);
    setDetail(null);
    setVersions([]);
    setDetailLoading(true);
    try {
      const res = await apiClient.registryGetDocumentTypeDetail(slug);
      if (!res.success || !res.documentType) {
        message.error(res.message || "Failed to load detail");
        setManageSlug(null);
        return;
      }
      setDetail(res.documentType);
      setVersions(res.schemaVersions || []);
      setHintsText(
        res.documentType.classifier_hints
          ? JSON.stringify(res.documentType.classifier_hints, null, 2)
          : "",
      );
      // Seed post-processing defaults (name → enabled) from the document type.
      const seeded: Record<string, boolean> = {};
      for (const d of res.documentType.post_processing_defaults ?? []) {
        if (d && typeof d.name === "string") seeded[d.name] = d.enabled !== false;
      }
      setPpEnabled(seeded);
      setIdFieldsText((res.documentType.identifier_fields ?? []).join("\n"));
    } finally {
      setDetailLoading(false);
    }

    // Load the registered service list once per manage-open (best-effort).
    try {
      const sres = await apiClient.registryGetServices();
      const services = (sres.data as { services?: { name: string; version: string }[] })?.services;
      if (sres.success && Array.isArray(services)) setPpServices(services);
    } catch {
      /* non-fatal: tab shows no services */
    }
  };

  const savePostProcessing = async () => {
    if (!manageSlug) return;
    setPpSaving(true);
    try {
      // Persist only the services with an explicit toggle; absence = inherit/off.
      const defaults = ppServices
        .filter((s) => s.name in ppEnabled)
        .map((s) => ({ name: s.name, enabled: !!ppEnabled[s.name] }));
      const res = await apiClient.registryPutPostProcessingDefaults(manageSlug, defaults);
      if (res.success) {
        message.success("Post-processing defaults saved");
        openManage(manageSlug);
        loadTypes();
      } else message.error(res.message || "Save failed");
    } finally {
      setPpSaving(false);
    }
  };

  const saveMeta = async () => {
    if (!manageSlug) return;
    try {
      const v = await editForm.validateFields();
      console.log({ v });
      const res = await apiClient.registryPatchDocumentType(manageSlug, {
        displayName: v.displayName,
        description: v.description || null,
        defaultExtractor: v.defaultExtractor,
        routingConfidenceThreshold: v.routingConfidenceThreshold,
        status: v.status,
      });
      if (res.success) {
        message.success("Document type saved");
        loadTypes();
        openManage(manageSlug);
      } else message.error(res.message || "Save failed");
    } catch {
      /* form validation */
    }
  };

  const saveHints = async () => {
    if (!manageSlug) return;
    const trimmed = hintsText.trim();
    if (!trimmed) {
      const res = await apiClient.registryPutClassifierHints(manageSlug, null);
      if (res.success) {
        message.success("Classifier hints cleared");
        openManage(manageSlug);
        loadTypes();
      } else message.error(res.message || "Clear failed");
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        message.error("Hints must be a JSON object");
        return;
      }
      const res = await apiClient.registryPutClassifierHints(
        manageSlug,
        parsed,
      );
      if (res.success) {
        message.success("Classifier hints saved");
        openManage(manageSlug);
        loadTypes();
      } else message.error(res.message || "Save failed");
    } catch {
      message.error("Invalid JSON in classifier hints");
    }
  };

  const saveIdentifierFields = async () => {
    if (!manageSlug) return;
    // One dot-path per line; blank lines ignored. Empty list clears (→ heuristic).
    const fields = idFieldsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    setIdSaving(true);
    try {
      const res = await apiClient.registryPutIdentifierFields(manageSlug, fields);
      if (res.success) {
        message.success(
          fields.length ? "Record ID field saved" : "Record ID field cleared",
        );
        openManage(manageSlug);
        loadTypes();
      } else message.error(res.message || "Save failed");
    } finally {
      setIdSaving(false);
    }
  };

  const submitNewSchema = async () => {
    if (!manageSlug) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(newSchemaText.trim());
    } catch {
      message.error("Invalid schema JSON");
      return;
    }
    setCreateSubmitting(true);
    try {
      const res = await apiClient.registryRegisterSchemaVersion(manageSlug, {
        jsonSchema: parsed,
        setActive: true,
      });
      if (res.success) {
        message.success(
          `Registered schema ${(res.schema as any)?.version || ""}`,
        );
        setNewSchemaOpen(false);
        setNewSchemaText("");
        openManage(manageSlug);
        loadTypes();
      } else message.error(res.message || "Register failed");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const promote = async (version: number) => {
    if (!manageSlug) return;
    const res = await apiClient.registryPromoteSchemaVersion(
      manageSlug,
      version,
    );
    if (res.success) {
      message.success(`Promoted v${version} to current`);
      openManage(manageSlug);
      loadTypes();
    } else message.error(res.message || "Promote failed");
  };

  const viewSchema = async (slug: string, version: number) => {
    const res = await apiClient.registryGetSchemaVersion(slug, version);
    if (res.success && res.schema?.schema) {
      setSchemaView({
        slug,
        version,
        json: JSON.stringify(res.schema.schema, null, 2),
      });
    } else message.error(res.message || "Could not load schema");
  };

  const submitCreateType = async () => {
    try {
      const v = await createForm.validateFields();
      let initialSchema:
        | { jsonSchema: Record<string, unknown>; schemaName?: string | null }
        | undefined;
      const raw = (v.initialSchemaJson as string)?.trim();
      if (raw) {
        initialSchema = { jsonSchema: JSON.parse(raw) };
      }
      setCreateSubmitting(true);
      console.log({ v, initialSchema });

      const res = await apiClient.registryCreateDocumentType({
        slug: v.slug,
        displayName: v.displayName,
        description: v.description || null,
        defaultExtractor: v.defaultExtractor || "extendai",
        routingConfidenceThreshold: v.routingConfidenceThreshold ?? 0.75,
        initialSchema: initialSchema ?? null,
      });
      if (res.success) {
        message.success("Document type created");
        setCreateOpen(false);
        createForm.resetFields();
        loadTypes();
      } else message.error(res.message || "Create failed");
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || "Invalid optional schema JSON");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const destroyType = async () => {
    if (!manageSlug) return;
    const res = await apiClient.registryDeleteDocumentType(manageSlug);
    if (res.success) {
      message.success("Deleted (all schema versions removed)");
      setManageSlug(null);
      loadTypes();
    } else message.error(res.message || "Delete failed");
  };

  const columns: ColumnsType<DocumentTypeInfo> = [
    {
      title: "Slug",
      dataIndex: "slug",
      key: "slug",
      render: (s: string) => <span className="font-mono text-sm">{s}</span>,
    },
    { title: "Display name", dataIndex: "display_name", key: "display_name" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={s === "active" ? "green" : "default"}>{s}</Tag>
      ),
    },
    {
      title: "Hints",
      key: "hints",
      render: (_, r) => <Tag>{r.has_classifier_hints ? "Yes" : "No"}</Tag>,
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_, r) => (
        <Button type="link" onClick={() => openManage(r.slug)}>
          Manage
        </Button>
      ),
    },
  ];

  const versionCols: ColumnsType<RegistrySchemaVersionSummary> = [
    { title: "Ver.", dataIndex: "version", key: "v", width: 64 },
    {
      title: "Name",
      dataIndex: "schema_name",
      key: "name",
      ellipsis: true,
      render: (n: string | null) => n || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "st",
      width: 100,
      render: (s: string) => <Tag>{s}</Tag>,
    },
    {
      title: "",
      key: "a",
      width: 220,
      render: (_, row) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => viewSchema(manageSlug!, row.version)}
          >
            View
          </Button>
          {!row.is_current && row.status !== "deprecated" ? (
            <Button
              type="link"
              size="small"
              onClick={() => promote(row.version)}
            >
              Promote current
            </Button>
          ) : row.is_current ? (
            <Tag color="blue">Current</Tag>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <Text type="secondary" className="block max-w-2xl">
            Register document types for the visual classifier and per-section
            extraction. Each type has versioned JSON Schemas (OpenAI strict
            mode). Deletes remove all schema history for that slug — use only
            when intentional.
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadTypes}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            New document type
          </Button>
        </Space>
      </div>

      <Table
        rowKey="slug"
        loading={loading}
        dataSource={types}
        columns={columns}
        pagination={{ pageSize: 25 }}
      />

      <Modal
        title="New document type"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={submitCreateType}
        confirmLoading={createSubmitting}
        width={640}
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Paragraph type="secondary" className="!text-xs !mb-2">
            Slug rules: lowercase, start with a letter, then letters, digits, or
            underscores (<code>mgs_well_log</code>,{" "}
            <code>aecom_field_borehole_log</code>).
          </Paragraph>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[
              { required: true },
              {
                pattern: /^[a-z][a-z0-9_]{0,99}$/,
                message: "Invalid slug format",
              },
            ]}
          >
            <Input placeholder="my_document_type" className="font-mono" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="Display name"
            rules={[{ required: true }]}
          >
            <Input placeholder="Human-readable name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Optional" />
          </Form.Item>
          <Form.Item
            name="defaultExtractor"
            label="Default extractor"
            initialValue="extendai"
          >
            <Select options={EXTRACTORS} />
          </Form.Item>
          <Form.Item
            name="routingConfidenceThreshold"
            label="Routing confidence threshold"
            initialValue={0.75}
          >
            <InputNumber min={0} max={1} step={0.05} className="w-full" />
          </Form.Item>
          <Form.Item
            name="initialSchemaJson"
            label="Initial schema JSON (optional)"
            extra="Paste a full OpenAI-strict schema object, or a wrapper { schemaName, schema }."
          >
            <JsonFormField
              placeholder="{}"
              height={260}
              defaultMode="code"
              mode="code"
              toolbar={["mode", "format", "minify", "search", "copy", "upload"]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={
          detail ? (
            <span>
              Manage: <span className="font-mono">{detail.slug}</span>
            </span>
          ) : (
            "…"
          )
        }
        width={720}
        open={!!manageSlug}
        onClose={() => setManageSlug(null)}
        destroyOnHidden
      >
        {detailLoading ? (
          <Text type="secondary">Loading…</Text>
        ) : detail ? (
          <Tabs
            items={[
              {
                key: "meta",
                label: "Settings",
                children: (
                  <div className="space-y-4 pt-2">
                    <Form form={editForm} layout="vertical">
                      <Form.Item
                        name="displayName"
                        label="Display name"
                        rules={[{ required: true }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item name="description" label="Description">
                        <TextArea rows={3} />
                      </Form.Item>
                      <Form.Item
                        name="defaultExtractor"
                        label="Default extractor"
                      >
                        <Select options={EXTRACTORS} />
                      </Form.Item>
                      <Form.Item
                        name="routingConfidenceThreshold"
                        label="Routing threshold"
                      >
                        <InputNumber
                          min={0}
                          max={1}
                          step={0.05}
                          className="w-full"
                        />
                      </Form.Item>
                      <Form.Item name="status" label="Status">
                        <Select
                          options={[
                            { value: "active", label: "Active" },
                            {
                              value: "deprecated",
                              label: "Deprecated (hidden by default)",
                            },
                          ]}
                        />
                      </Form.Item>
                    </Form>
                    <Space wrap>
                      <Button type="primary" onClick={saveMeta}>
                        Save settings
                      </Button>
                      <Popconfirm
                        title={`Delete '${detail.slug}' and all schemas?`}
                        description="This cannot be undone."
                        okText="Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        onConfirm={destroyType}
                      >
                        <Button danger>Delete type</Button>
                      </Popconfirm>
                    </Space>
                  </div>
                ),
              },
              {
                key: "schemas",
                label: `Schemas (${versions.length})`,
                children: (
                  <div className="space-y-3 pt-2">
                    <Paragraph type="secondary" className="!text-xs">
                      Current extraction uses the promoted &quot;current&quot;
                      version. Add a version as clean JSON — x-* keys are
                      stripped into prompt hints like the CLI importer.
                    </Paragraph>
                    <Button
                      type="dashed"
                      onClick={() => setNewSchemaOpen(true)}
                      block
                    >
                      Register new schema version
                    </Button>
                    <Table
                      rowKey="id"
                      size="small"
                      dataSource={versions}
                      columns={versionCols}
                      pagination={false}
                    />
                  </div>
                ),
              },
              {
                key: "hints",
                label: "Classifier hints",
                children: (
                  <div className="space-y-3 pt-2">
                    <Paragraph type="secondary" className="!text-xs">
                      JSON merged into the VLM prompt for this slug (e.g.
                      skip_when / keep_when). Leave empty and save to clear.
                    </Paragraph>
                    <JsonViewer
                      text={hintsText}
                      onChange={({ text: t }) => setHintsText(t)}
                      placeholder={CLASSIFIER_HINTS_PLACEHOLDER}
                      defaultMode="code"
                      mode="code"
                      height={360}
                      toolbar={[
                        "mode",
                        "format",
                        "minify",
                        "search",
                        "copy",
                        "upload",
                      ]}
                    />
                    <Space>
                      <Button type="primary" onClick={saveHints}>
                        Save hints
                      </Button>
                    </Space>
                  </div>
                ),
              },
              {
                key: "post_processing",
                label: "Post-processing",
                children: (
                  <div className="space-y-3 pt-2">
                    <Paragraph type="secondary" className="!text-xs">
                      Services that run automatically after extraction for this
                      document type. These are the defaults — a job can override
                      any of them from its own settings (job override wins).
                    </Paragraph>
                    {ppServices.length === 0 ? (
                      <Text type="secondary">No services registered.</Text>
                    ) : (
                      <div className="space-y-2">
                        {ppServices.map((svc) => (
                          <div
                            key={svc.name}
                            className="flex items-center justify-between gap-3"
                          >
                            <div className="text-sm">
                              <span className="font-mono">{svc.name}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                v{svc.version}
                              </span>
                            </div>
                            <Switch
                              checked={!!ppEnabled[svc.name]}
                              onChange={(checked) =>
                                setPpEnabled((prev) => ({
                                  ...prev,
                                  [svc.name]: checked,
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <Space>
                      <Button
                        type="primary"
                        loading={ppSaving}
                        onClick={savePostProcessing}
                      >
                        Save defaults
                      </Button>
                    </Space>
                  </div>
                ),
              },
              {
                key: "identifier",
                label: "Record ID field",
                children: (
                  <div className="space-y-3 pt-2">
                    <Paragraph type="secondary" className="!text-xs">
                      Which field labels a record in the preview&apos;s ID column
                      (and the record drawer header). Enter one dot-path per line,
                      tried in order — the first with a value wins. Example:{" "}
                      <span className="font-mono">
                        site_identification.boring_well_id
                      </span>
                      . Leave empty to fall back to the automatic heuristic.
                    </Paragraph>
                    <TextArea
                      value={idFieldsText}
                      onChange={(e) => setIdFieldsText(e.target.value)}
                      placeholder={"site_identification.boring_well_id\nboring_well_id"}
                      autoSize={{ minRows: 4, maxRows: 10 }}
                      className="font-mono !text-xs"
                    />
                    <Space>
                      <Button
                        type="primary"
                        loading={idSaving}
                        onClick={saveIdentifierFields}
                      >
                        Save ID field
                      </Button>
                    </Space>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>

      <Modal
        title="Register new schema version"
        open={newSchemaOpen}
        onCancel={() => setNewSchemaOpen(false)}
        onOk={submitNewSchema}
        confirmLoading={createSubmitting}
        width="90vw"
        style={{ maxWidth: 960 }}
      >
        <div className="mt-4">
          <JsonViewer
            text={newSchemaText}
            onChange={({ text: t }) => setNewSchemaText(t)}
            placeholder="{ type: object, properties: ..., additionalProperties: false, required: [...] }"
            defaultMode="code"
            mode="code"
            height={420}
            toolbar={["mode", "format", "minify", "search", "copy", "upload"]}
          />
        </div>
      </Modal>

      <Modal
        title={
          schemaView
            ? `Schema JSON — ${schemaView.slug} v${schemaView.version}`
            : ""
        }
        open={!!schemaView}
        footer={null}
        onCancel={() => setSchemaView(null)}
        width="90vw"
        style={{ maxWidth: 900 }}
      >
        {schemaView && (
          <JsonViewer
            text={schemaView.json}
            readOnly
            defaultMode="tree"
            height="70vh"
            toolbar={["mode", "search", "copy", "download"]}
          />
        )}
      </Modal>
    </div>
  );
}

/**
 * AntD `Form.Item` value adapter for `JsonViewer`. Stores the field as a
 * string so the existing schema submission/import flow keeps working (it
 * parses the string itself).
 */
function JsonFormField({
  value,
  onChange,
  ...rest
}: {
  value?: string;
  onChange?: (next: string) => void;
} & Omit<
  React.ComponentProps<typeof JsonViewer>,
  "value" | "onChange" | "text"
>) {
  const text =
    typeof value === "string"
      ? value
      : value != null
        ? JSON.stringify(value, null, 2)
        : "";
  return (
    <JsonViewer
      {...rest}
      text={text}
      onChange={({ text: t }) => onChange?.(t)}
    />
  );
}
