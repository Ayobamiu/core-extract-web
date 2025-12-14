"use client";

import React from "react";
import { Table, Descriptions } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { MGSWellData } from "./WellboreDiagram";

// Re-export for convenience
export type { MGSWellData };

// Keep the interface definition here for reference, but use the imported one
interface WellboreSummaryTablesProps {
  data: MGSWellData;
  size?: "small" | "medium" | "large";
}

export const WellboreSummaryTables: React.FC<WellboreSummaryTablesProps> = ({
  data,
  size = "medium",
}) => {
  const tableSize =
    size === "small" ? "small" : size === "large" ? "middle" : "small";

  // Well Information Table
  const wellInfoData = [
    {
      key: "field",
      label: "Field Name",
      value: data.field_name || "—",
    },
    {
      key: "lease",
      label: "Lease Name",
      value: data.lease_name || "—",
    },
    {
      key: "well",
      label: "Well No.",
      value: data.well_number || "—",
    },
    {
      key: "county",
      label: "County, State",
      value: [data.county, data.state].filter(Boolean).join(", ") || "—",
    },
    {
      key: "api",
      label: "API No.",
      value: data.api_number || "—",
    },
    {
      key: "location",
      label: "Location",
      value: data.township_range_section || "—",
    },
    {
      key: "gl",
      label: "G.L. (ft)",
      value:
        data.ground_level !== null &&
        data.ground_level !== undefined &&
        typeof data.ground_level === "number" &&
        !isNaN(data.ground_level)
          ? `${data.ground_level.toLocaleString()}`
          : "—",
    },
    {
      key: "kb",
      label: "K.B. (ft)",
      value:
        data.kelly_bushing !== null &&
        data.kelly_bushing !== undefined &&
        typeof data.kelly_bushing === "number" &&
        !isNaN(data.kelly_bushing)
          ? `${data.kelly_bushing.toLocaleString()}`
          : "—",
    },
    {
      key: "spud",
      label: "Spud Date",
      value: data.spud_date || "—",
    },
    {
      key: "completion",
      label: "Comp. Date",
      value: data.completion_date || "—",
    },
  ];

  // Tubular Summary Table
  const tubularColumns: ColumnsType<any> = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 60,
    },
    {
      title: "O.D.",
      dataIndex: "od",
      key: "od",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toFixed(2) : "—",
    },
    {
      title: "Wt",
      dataIndex: "weight",
      key: "weight",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toFixed(1) : "—",
    },
    {
      title: "Grade",
      dataIndex: "grade",
      key: "grade",
      width: 55,
      render: (val) => val || "—",
    },
    {
      title: "Top",
      dataIndex: "top",
      key: "top",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Bottom",
      dataIndex: "bottom",
      key: "bottom",
      width: 55,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
  ];

  const tubularData = (data.casing || []).map((casing, idx) => ({
    key: idx,
    type: casing.type || "—",
    od: casing.size,
    weight: casing.weight,
    grade: casing.grade,
    top: 0, // Surface
    bottom: casing.Interval,
  }));

  // Cement Summary Table
  const cementColumns: ColumnsType<any> = [
    {
      title: "O.D.",
      dataIndex: "casingOd",
      key: "casingOd",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toFixed(2) : "—",
    },
    {
      title: "Sx",
      dataIndex: "sacks",
      key: "sacks",
      width: 40,
      render: (val) => (val !== null && val !== undefined ? val : "—"),
    },
    {
      title: "Top",
      dataIndex: "top",
      key: "top",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Bottom",
      dataIndex: "bottom",
      key: "bottom",
      width: 55,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Comments",
      dataIndex: "comments",
      key: "comments",
      width: 80,
      render: (val) => val || "—",
    },
  ];

  const cementData = (data.casing || [])
    .filter(
      (c) =>
        c.bags_of_cement !== null ||
        c.cement_sacks !== null ||
        c.top_of_cement !== null
    )
    .map((casing, idx) => ({
      key: idx,
      casingOd: casing.size,
      sacks: casing.bags_of_cement ?? casing.cement_sacks,
      top: casing.top_of_cement ?? 0,
      bottom: casing.Interval,
      comments: casing.cement_type
        ? `${casing.cement_type}${
            casing.bags_of_cement ? `, ${casing.bags_of_cement} sx` : ""
          }`
        : casing.bags_of_cement
        ? `${casing.bags_of_cement} sx`
        : "—",
    }));

  // Perforation Summary Table
  const perforationColumns: ColumnsType<any> = [
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 55,
      render: (status: string) => {
        const color =
          status === "open"
            ? "#52c41a"
            : status === "squeezed"
            ? "#ff4d4f"
            : "#999";
        return (
          <span style={{ color, fontWeight: "bold", fontSize: "10px" }}>
            {status?.toUpperCase() || "—"}
          </span>
        );
      },
    },
    {
      title: "Formation",
      dataIndex: "formation",
      key: "formation",
      width: 65,
      render: (val) => val || "—",
    },
    {
      title: "Top",
      dataIndex: "top",
      key: "top",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Bottom",
      dataIndex: "bottom",
      key: "bottom",
      width: 55,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Shots",
      dataIndex: "shots",
      key: "shots",
      width: 40,
      render: (val) => (val !== null && val !== undefined ? val : "—"),
    },
  ];

  const perforationData = (data.perforation_intervals || []).map(
    (perf, idx) => ({
      key: idx,
      status: perf.status || "open",
      formation: perf.formation || "—",
      top: perf.from,
      bottom: perf.to,
      shots: perf.shots,
    })
  );

  // Formation Tops Summary Table
  const formationTopsColumns: ColumnsType<any> = [
    {
      title: "Formation",
      dataIndex: "name",
      key: "name",
      width: 80,
    },
    {
      title: "Top",
      dataIndex: "top",
      key: "top",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Bottom",
      dataIndex: "bottom",
      key: "bottom",
      width: 55,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
  ];

  const formationTopsData = (data.formations || [])
    .sort((a, b) => (a.from || 0) - (b.from || 0))
    .map((formation, idx) => ({
      key: idx,
      name: formation.name || "—",
      top: formation.from,
      bottom: formation.to,
    }));

  // Tools/Equipment Summary Table
  const toolsColumns: ColumnsType<any> = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 60,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 80,
      render: (val) => val || "—",
    },
    {
      title: "O.D.",
      dataIndex: "od",
      key: "od",
      width: 45,
      render: (val) =>
        val !== null && val !== undefined ? val.toFixed(2) : "—",
    },
    {
      title: "I.D.",
      dataIndex: "id",
      key: "id",
      width: 45,
      render: (val) =>
        val !== null && val !== undefined ? val.toFixed(2) : "—",
    },
    {
      title: "Top",
      dataIndex: "top",
      key: "top",
      width: 50,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Bottom",
      dataIndex: "bottom",
      key: "bottom",
      width: 55,
      render: (val) =>
        val !== null && val !== undefined ? val.toLocaleString() : "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 50,
      render: (status: string) => {
        if (!status) return "—";
        const color = status === "open" ? "#52c41a" : "#ff4d4f";
        return (
          <span style={{ color, fontWeight: "bold", fontSize: "10px" }}>
            {status.toUpperCase()}
          </span>
        );
      },
    },
  ];

  const toolsData = (data.downhole_tools || []).map((tool, idx) => ({
    key: idx,
    type: tool.type || "—",
    name: tool.name,
    od: tool.size,
    id: tool.inner_diameter,
    top: tool.depth,
    bottom: tool.bottom_depth,
    status: tool.status,
  }));

  return (
    <div
      className="wellbore-summary-tables space-y-2"
      style={{ minWidth: "280px", maxWidth: "400px" }}
    >
      <style jsx global>{`
        .wellbore-summary-tables .ant-table-thead > tr > th {
          font-size: 10px !important;
          padding: 4px 8px !important;
          font-weight: 600 !important;
        }
        .wellbore-summary-tables .ant-table-tbody > tr > td {
          font-size: 10px !important;
          padding: 4px 8px !important;
        }
      `}</style>
      {/* Title */}
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-800">CURRENT COMPLETION</h2>
        {data.last_updated && (
          <p className="text-[10px] text-gray-600">
            Last Updated: {data.last_updated}
          </p>
        )}
      </div>

      {/* Well Information - Using Ant Design Descriptions */}
      <div className="bg-white border border-gray-300 rounded p-2">
        <h3 className="text-xs font-bold text-gray-800 mb-1.5">
          Well Information
        </h3>
        <Descriptions
          size="small"
          column={2}
          items={wellInfoData.map((item) => ({
            key: item.key,
            label: item.label,
            children: item.value,
          }))}
          labelStyle={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#374151",
            padding: "2px 8px",
          }}
          contentStyle={{
            fontSize: "10px",
            color: "#111827",
            padding: "2px 8px",
          }}
        />
      </div>

      {/* Current Status */}
      {data.current_status && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1">
            Current Status
          </h3>
          <p className="text-[10px] text-gray-700">{data.current_status}</p>
        </div>
      )}

      {/* Tubular Summary */}
      {tubularData.length > 0 && (
        <div className="bg-white border border-gray-300 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1.5">
            Tubular Summary
          </h3>
          <Table
            columns={tubularColumns}
            dataSource={tubularData}
            pagination={false}
            size="small"
            scroll={{ y: 150 }}
            className="text-[10px]"
          />
        </div>
      )}

      {/* Cement Summary */}
      {cementData.length > 0 && (
        <div className="bg-white border border-gray-300 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1.5">
            Casing Cement Summary
          </h3>
          <Table
            columns={cementColumns}
            dataSource={cementData}
            pagination={false}
            size="small"
            scroll={{ y: 150 }}
            className="text-[10px]"
          />
        </div>
      )}

      {/* Perforation Summary */}
      {perforationData.length > 0 && (
        <div className="bg-white border border-gray-300 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1.5">
            Perforation Summary
          </h3>
          <Table
            columns={perforationColumns}
            dataSource={perforationData}
            pagination={false}
            size="small"
            scroll={{ y: 150 }}
            className="text-[10px]"
          />
        </div>
      )}

      {/* Formation Tops Summary */}
      {formationTopsData.length > 0 && (
        <div className="bg-white border border-gray-300 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1.5">
            Formation Tops Summary
          </h3>
          <Table
            columns={formationTopsColumns}
            dataSource={formationTopsData}
            pagination={false}
            size="small"
            scroll={{ y: 150 }}
            className="text-[10px]"
          />
        </div>
      )}

      {/* Tools/Equipment Summary */}
      {toolsData.length > 0 && (
        <div className="bg-white border border-gray-300 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1.5">
            Tools/Equipment Summary
          </h3>
          <Table
            columns={toolsColumns}
            dataSource={toolsData}
            pagination={false}
            size="small"
            scroll={{ y: 150 }}
            className="text-[10px]"
          />
        </div>
      )}

      {/* Audit Trail */}
      {(data.prepared_by || data.updated_by || data.last_updated) && (
        <div className="bg-gray-50 border border-gray-300 rounded p-2">
          <h3 className="text-xs font-bold text-gray-800 mb-1.5">
            Audit Trail
          </h3>
          <table className="w-full text-[10px]">
            <tbody>
              {data.prepared_by && (
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 pr-3 font-semibold text-gray-700 w-20">
                    Prepared By:
                  </td>
                  <td className="py-0.5 text-gray-900">{data.prepared_by}</td>
                </tr>
              )}
              {data.updated_by && (
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 pr-3 font-semibold text-gray-700 w-20">
                    Updated By:
                  </td>
                  <td className="py-0.5 text-gray-900">{data.updated_by}</td>
                </tr>
              )}
              {data.last_updated && (
                <tr>
                  <td className="py-0.5 pr-3 font-semibold text-gray-700 w-20">
                    Last Updated:
                  </td>
                  <td className="py-0.5 text-gray-900">{data.last_updated}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
