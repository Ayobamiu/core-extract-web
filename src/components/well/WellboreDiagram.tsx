"use client";

import React, { useMemo } from "react";
import { WellboreSummaryTables } from "./WellboreSummaryTables";

export interface MGSWellData {
  formations?: Array<{
    from: number | null;
    to: number | null;
    formation: string | null;
  }>;
  casing?: Array<{
    type: "Drive" | "Surface" | "Intermediate" | "Production" | null;
    size: number | null;
    Interval: number | null;
    cement_type?: string | null;
    bags_of_cement?: number | null;
    weight?: number | null; // lb/ft
    grade?: string | null; // e.g., "Q-125", "C-110"
    connection_type?: string | null; // e.g., "VAM SLIJ-II"
    top_of_cement?: number | null; // TOC in MD
    cement_sacks?: number | null;
  }>;
  perforation_intervals?: Array<{
    from: number | null;
    to: number | null;
    status?: "open" | "squeezed" | "closed" | null;
    formation?: string | null;
    shots?: number | null;
    date?: string | null;
  }>;
  pluggings?: Array<{
    depth: number | null;
    interval: string | null;
    type: string | null;
    details?: string | null;
  }>;
  shows_depths?: Array<{
    depth: number | string | null;
    formation: string | null;
    oil_or_gas: "oil" | "gas" | null;
  }>;
  target_zone?: string | null;
  true_depth?: number | null;
  measured_depth?: number | null;
  deviation?: "Straight" | "Deviated" | "Horizontal" | null;
  elevation?: number | null;
  elevation_datum?: string | null;
  // Well Header Information
  api_number?: string | null;
  permit_number?: string | null;
  lease_name?: string | null;
  well_number?: string | null;
  county?: string | null;
  state?: string | null;
  field_name?: string | null;
  township_range_section?: string | null;
  spud_date?: string | null;
  completion_date?: string | null;
  ground_level?: number | null;
  kelly_bushing?: number | null;
  // Downhole Tools
  downhole_tools?: Array<{
    type: string | null; // "Packer", "Valve", "Pump", "Nipple", etc.
    name?: string | null; // Full tool name/model
    depth: number | null; // Top MD
    bottom_depth?: number | null; // Bottom MD if applicable
    size?: number | null; // O.D. in inches
    inner_diameter?: number | null; // I.D. in inches
    status?: "open" | "closed" | null; // For valves
  }>;
  // Audit Trail
  prepared_by?: string | null;
  updated_by?: string | null;
  last_updated?: string | null;
  // Current Status
  current_status?: string | null; // Narrative description
}

interface WellboreDiagramProps {
  data: MGSWellData;
  size?: "small" | "medium" | "large";
  className?: string;
}

export const WellboreDiagram: React.FC<WellboreDiagramProps> = ({
  data,
  size = "medium",
  className = "",
}) => {
  // Calculate max depth
  const maxDepth = useMemo(() => {
    const depths = [
      data.true_depth,
      data.measured_depth,
      ...(data.formations || [])
        .map((f) => f.to)
        .filter((d): d is number => d !== null),
      ...(data.casing || [])
        .map((c) => c.Interval)
        .filter((d): d is number => d !== null),
      ...(data.pluggings || [])
        .map((p) => p.depth)
        .filter((d): d is number => d !== null),
    ].filter((d): d is number => d !== null && d !== undefined && d > 0);

    return depths.length > 0 ? Math.max(...depths) : 1000; // Default 1000ft if no depth data
  }, [data]);

  // Size constants - fixed dimensions for consistent printing
  // The depth scale will automatically adjust to fit all content in the fixed height
  const dimensions = useMemo(() => {
    switch (size) {
      case "small":
        return {
          width: 300,
          height: 400,
          marginLeft: 50,
          marginRight: 10,
          marginTop: 20,
          marginBottom: 15,
        };
      case "large":
        return {
          width: 600,
          height: 1000,
          marginLeft: 80,
          marginRight: 30,
          marginTop: 50,
          marginBottom: 30,
        };
      default: // medium
        return {
          width: 450,
          height: 700,
          marginLeft: 60,
          marginRight: 20,
          marginTop: 40,
          marginBottom: 20,
        };
    }
  }, [size]);

  const { width, height, marginLeft, marginRight, marginTop, marginBottom } =
    dimensions;
  const wellCenterX = width / 2;
  const formationWidth = width - marginLeft - marginRight;
  const maxCasingWidth = size === "large" ? 180 : size === "medium" ? 120 : 90;

  // Calculate depth scale to fit all content within the fixed height
  // This ensures all diagrams fit in the same space regardless of well depth,
  // making printing consistent across all wells
  // Formula: available height / max depth = pixels per foot
  const depthScale =
    maxDepth > 0 && isFinite(maxDepth)
      ? (height - marginTop - marginBottom) / maxDepth
      : 0;

  // Helper to convert depth to Y coordinate (safe - handles null/undefined/NaN)
  const depthToY = (depth: number | null | undefined): number => {
    if (
      depth === null ||
      depth === undefined ||
      isNaN(depth) ||
      !isFinite(depth)
    ) {
      return marginTop; // Default to top if invalid
    }
    return marginTop + depth * depthScale;
  };

  // Helper to get TVD from MD (simplified - assumes vertical well if TVD not provided)
  const getTVD = (md: number | null | undefined): number => {
    if (md === null || md === undefined || isNaN(md) || !isFinite(md)) {
      return 0;
    }
    // If we have both MD and TVD at max depth, calculate ratio
    if (data.measured_depth && data.true_depth && data.measured_depth > 0) {
      const ratio = data.true_depth / data.measured_depth;
      return md * ratio;
    }
    // For straight wells, MD = TVD
    if (data.deviation === "Straight") {
      return md;
    }
    // Default: assume MD = TVD (will be updated when we have deviation data)
    return md;
  };

  // Depth markers every 500ft
  const depthMarkers = useMemo(() => {
    return Array.from(
      { length: Math.ceil(maxDepth / 500) + 1 },
      (_, i) => i * 500
    );
  }, [maxDepth]);

  // Sort formations by depth and merge consecutive formations with the same name
  const sortedFormations = useMemo(() => {
    const sorted = [...(data.formations || [])].sort(
      (a, b) => (a.from || 0) - (b.from || 0)
    );

    // Merge consecutive formations with the same name
    const merged: typeof sorted = [];

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      if (merged.length === 0) {
        // First formation, just add it
        merged.push({ ...current });
      } else {
        const last = merged[merged.length - 1];
        const currentName = (current.formation || "").toLowerCase().trim();
        const lastName = (last.formation || "").toLowerCase().trim();

        // Check if consecutive and same name
        // For consecutive check: last.to should equal current.from (or very close)
        const lastTo = last.to ?? null;
        const currentFrom = current.from ?? null;
        const isConsecutive =
          lastTo != null &&
          currentFrom != null &&
          Math.abs(lastTo - currentFrom) < 1; // Allow up to 1 foot difference for consecutive formations

        const isSameName = currentName === lastName && currentName !== "";

        if (isConsecutive && isSameName) {
          // Merge: keep the first formation's 'from', use current formation's 'to'
          last.to = current.to;
          // Preserve other properties from the current formation if needed
          if (current.formation) last.formation = current.formation;
        } else {
          // Different formation or not consecutive, add as new
          merged.push({ ...current });
        }
      }
    }

    return merged;
  }, [data.formations]);

  // Unique formations for legend (by name, keeping first occurrence)
  const uniqueFormations = useMemo(() => {
    const seen = new Set<string>();
    return sortedFormations.filter((formation) => {
      if (!formation.formation || formation.formation.trim() === "")
        return false;
      const name = formation.formation.toLowerCase().trim();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [sortedFormations]);
  console.log({ sortedFormations, uniqueFormations, data });
  // Sort casing by depth
  const sortedCasing = useMemo(() => {
    return [...(data.casing || [])].sort(
      (a, b) => (a.Interval || 0) - (b.Interval || 0)
    );
  }, [data.casing]);

  // Get formation color
  const getFormationColor = (formationName: string | null): string => {
    if (!formationName) return "#f0f0f0";
    const name = formationName.toLowerCase();
    if (name.includes("sand") || name.includes("sandstone")) return "#d4a574";
    if (name.includes("shale")) {
      if (name.includes("gray")) return "#8b7355";
      if (name.includes("green")) return "#6b8e23";
      if (name.includes("brown")) return "#8b4513";
      if (name.includes("light brown")) return "#a0826d";
      return "#8b7355";
    }
    if (name.includes("mud")) {
      if (name.includes("blue")) return "#87ceeb";
      if (name.includes("gravel")) return "#d4a574";
      return "#c0c0c0";
    }
    if (name.includes("limestone") || name.includes("lime")) return "#e8e8e8";
    if (name.includes("dolomite")) return "#c0c0c0";
    if (name.includes("clay")) return "#6b5b4f";
    if (name.includes("gravel")) return "#d4a574";
    return "#e0e0e0";
  };

  // Get casing color
  const getCasingColor = (type: string | null): string => {
    switch (type) {
      case "Surface":
        return "#8b4513";
      case "Intermediate":
        return "#654321";
      case "Production":
        return "#4169e1";
      case "Drive":
        return "#a0522d";
      default:
        return "#808080";
    }
  };

  // Get casing width based on type and size (industry standard sizes)
  // Increased scaling for better visibility
  const getCasingWidth = (type: string | null, size: number | null): number => {
    // If size provided, use proportional scaling (1 inch = 4px for better visibility)
    // Minimum width of 12px to ensure visibility
    if (size !== null && size > 0) {
      return Math.max(size * 4, 12);
    }

    // Default industry standard sizes if size not provided (increased for visibility)
    switch (type) {
      case "Surface":
        return 60; // ~20" typical (was 40)
      case "Intermediate":
        return 40; // ~13.375" typical (was 27)
      case "Production":
        return 24; // ~7" typical (was 14)
      case "Drive":
        return 50; // ~15" typical (was 30)
      default:
        return 35; // (was 25)
    }
  };

  // Check if formation is target zone
  const isTargetZone = (formationName: string | null): boolean => {
    return (
      data.target_zone?.toLowerCase() === formationName?.toLowerCase() || false
    );
  };

  // Helper function to truncate formation text to fit within available width
  const truncateFormationText = (
    text: string,
    maxWidth: number,
    fontSize: number
  ): string => {
    if (!text) return "";
    // Approximate character width: fontSize * 0.6 (average for most fonts)
    const avgCharWidth = fontSize * 0.6;
    const maxChars = Math.floor((maxWidth - 10) / avgCharWidth); // -10 for padding
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 3) + "...";
  };

  return (
    <div className={`wellbore-diagram ${className} flex flex-col gap-4`}>
      {/* Three Column Layout: Diagram (3) | Legend (2) | Summary Tables (3) */}
      <div
        className="border border-gray-300 rounded-lg bg-white shadow-sm"
        style={{ overflow: "visible" }}
      >
        {/* Header Row - Aligned across all columns */}
        <div className="grid grid-cols-8 border-b-2 border-gray-400 bg-gray-50">
          <div className="col-span-3 px-4 py-3 border-r border-gray-300 flex items-center">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Wellbore Diagram
            </h2>
          </div>
          <div className="col-span-2 px-4 py-3 border-r border-gray-300 flex items-center">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Legend
            </h2>
          </div>
          <div className="col-span-3 px-4 py-3 flex items-center">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              Current Completion
            </h2>
          </div>
        </div>

        {/* Content Row - Equal height columns */}
        <div
          className="grid grid-cols-8 items-start"
          style={{ overflow: "visible" }}
        >
          {/* Column 1: Diagram (span 3) */}
          <div
            className="col-span-3 flex-shrink-0 border-r border-gray-300 p-3 bg-white"
            style={{ overflow: "visible" }}
          >
            <div
              style={{
                width: `${width}px`,
                height: `${height}px`,
                position: "relative",
              }}
            >
              <svg
                width={width}
                height={height}
                className="bg-white"
                style={{
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                  colorAdjust: "exact",
                  overflow: "visible",
                  display: "block",
                  shapeRendering: "geometricPrecision",
                  textRendering: "geometricPrecision",
                }}
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="xMidYMin meet"
              >
                <defs>
                  <pattern
                    id="sandstone"
                    patternUnits="userSpaceOnUse"
                    width="20"
                    height="20"
                  >
                    <circle cx="10" cy="10" r="1" fill="rgba(0,0,0,0.2)" />
                  </pattern>
                  <pattern
                    id="shale"
                    patternUnits="userSpaceOnUse"
                    width="20"
                    height="4"
                  >
                    <line
                      x1="0"
                      y1="2"
                      x2="20"
                      y2="2"
                      stroke="rgba(0,0,0,0.2)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                  <pattern
                    id="limestone"
                    patternUnits="userSpaceOnUse"
                    width="20"
                    height="20"
                  >
                    <path
                      d="M0 10 L20 10 M10 0 L10 20"
                      stroke="rgba(0,0,0,0.1)"
                      strokeWidth="0.5"
                    />
                  </pattern>
                  <linearGradient
                    id="targetZoneGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#ffd700" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ffd700" stopOpacity="0.1" />
                  </linearGradient>
                  {/* Plug patterns */}
                  <pattern
                    id="mudPattern"
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                  >
                    <rect width="8" height="8" fill="#8b4513" />
                    <circle cx="2" cy="2" r="1" fill="#654321" />
                    <circle cx="6" cy="6" r="1" fill="#654321" />
                  </pattern>
                  <pattern
                    id="cementPattern"
                    patternUnits="userSpaceOnUse"
                    width="4"
                    height="4"
                  >
                    <rect width="4" height="4" fill="#8b4513" />
                  </pattern>
                  <pattern
                    id="bridgePattern"
                    patternUnits="userSpaceOnUse"
                    width="10"
                    height="10"
                  >
                    <rect width="10" height="10" fill="#8b4513" />
                    <line
                      x1="0"
                      y1="0"
                      x2="10"
                      y2="10"
                      stroke="#654321"
                      strokeWidth="1"
                    />
                    <line
                      x1="10"
                      y1="0"
                      x2="0"
                      y2="10"
                      stroke="#654321"
                      strokeWidth="1"
                    />
                  </pattern>
                  {/* Squeezed perforation pattern (cross-hatch) */}
                  <pattern
                    id="squeezedPerfPattern"
                    patternUnits="userSpaceOnUse"
                    width="6"
                    height="6"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="6"
                      y2="6"
                      stroke="#ff4d4f"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>

                {/* Depth markers with MD and TVD */}
                {depthMarkers.map((depth) => {
                  const y = depthToY(depth);
                  const tvd = getTVD(depth);
                  const showTVD =
                    data.deviation !== "Straight" && data.true_depth !== null;
                  return (
                    <g key={depth}>
                      <line
                        x1={marginLeft}
                        y1={y}
                        x2={width - marginRight}
                        y2={y}
                        stroke="#e0e0e0"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={marginLeft - 15}
                        y={y + 4}
                        textAnchor="end"
                        fontSize={size === "small" ? "10" : "12"}
                        fill="#666"
                        fontWeight="500"
                      >
                        {depth}ft
                      </text>
                      {showTVD && (
                        <text
                          x={marginLeft - 15}
                          y={y + 16}
                          textAnchor="end"
                          fontSize={size === "small" ? "9" : "11"}
                          fill="#999"
                          fontStyle="italic"
                        >
                          TVD: {Math.round(tvd)}ft
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Formation layers */}
                {sortedFormations.map((formation, idx) => {
                  if (
                    formation.from === null ||
                    formation.to === null ||
                    isNaN(formation.from) ||
                    isNaN(formation.to)
                  )
                    return null;
                  const fromY = depthToY(formation.from);
                  const toY = depthToY(formation.to);
                  const formationHeight = Math.abs(toY - fromY);
                  const color = getFormationColor(formation.formation);
                  const isTarget = isTargetZone(formation.formation);

                  return (
                    <g key={idx}>
                      <rect
                        x={marginLeft}
                        y={fromY}
                        width={formationWidth}
                        height={formationHeight}
                        fill={isTarget ? "url(#targetZoneGradient)" : color}
                        stroke={isTarget ? "#ffd700" : "#999"}
                        strokeWidth={isTarget ? 2 : 1.5}
                        opacity={isTarget ? 0.9 : 0.85}
                        shapeRendering="geometricPrecision"
                      />
                      {/* Formation top marker (horizontal dashed line) */}
                      {idx === 0 ||
                      formation.from !== sortedFormations[idx - 1]?.to ? (
                        <line
                          x1={marginLeft}
                          y1={fromY}
                          x2={width - marginRight}
                          y2={fromY}
                          stroke="#ffd700"
                          strokeWidth="2"
                          strokeDasharray="5,3"
                          opacity={0.8}
                        />
                      ) : null}
                      {/* Formation name label at top - only show if height > 40px */}
                      {formation.formation && formationHeight > 40 && (
                        <text
                          x={marginLeft + 5}
                          y={fromY + 15}
                          fontSize={size === "small" ? "10" : "12"}
                          fill="#333"
                          fontWeight="500"
                        >
                          {truncateFormationText(
                            formation.formation,
                            formationWidth - 10,
                            size === "small" ? 10 : 12
                          )}
                        </text>
                      )}
                      <title>
                        Formation: {formation.formation || "Unknown"}
                        {formation.from !== null && formation.to !== null
                          ? ` (${formation.from}ft - ${formation.to}ft MD)`
                          : ""}
                        {isTarget ? " - Target Zone" : ""}
                      </title>
                    </g>
                  );
                })}

                {/* Casing strings - rendered as nested tubes with cement visualization */}
                {sortedCasing.map((casing, idx) => {
                  if (
                    casing.Interval === null ||
                    isNaN(casing.Interval) ||
                    !isFinite(casing.Interval)
                  )
                    return null;
                  const casingDepth = casing.Interval;
                  const casingY = depthToY(casingDepth);
                  const casingWidth = getCasingWidth(casing.type, casing.size);
                  const color = getCasingColor(casing.type);
                  const casingHeight = Math.max(0, casingY - marginTop);

                  // Get outer casing (larger width) for cement visualization
                  const outerCasing = idx > 0 ? sortedCasing[idx - 1] : null;
                  const outerCasingWidth = outerCasing
                    ? getCasingWidth(outerCasing.type, outerCasing.size)
                    : null;

                  // Cement between casings (gray shading)
                  const topOfCement = casing.top_of_cement;
                  const cementTop =
                    topOfCement !== null &&
                    topOfCement !== undefined &&
                    !isNaN(topOfCement) &&
                    isFinite(topOfCement)
                      ? depthToY(topOfCement)
                      : marginTop;
                  const cementBottom = casingY;
                  const cementHeight = Math.max(0, cementBottom - cementTop);

                  return (
                    <g key={idx}>
                      {/* Cement visualization between casing strings */}
                      {outerCasingWidth && cementHeight > 0 && (
                        <rect
                          x={wellCenterX - outerCasingWidth / 2}
                          y={cementTop}
                          width={outerCasingWidth}
                          height={cementHeight}
                          fill="#d3d3d3"
                          stroke="#999"
                          strokeWidth="0.5"
                          opacity={0.6}
                        />
                      )}

                      {/* Casing string */}
                      <rect
                        x={wellCenterX - casingWidth / 2}
                        y={marginTop}
                        width={casingWidth}
                        height={casingHeight}
                        fill={color}
                        stroke="#333"
                        strokeWidth="2"
                        opacity={0.9}
                        rx="2"
                        shapeRendering="geometricPrecision"
                      />
                      {/* Inner highlight for tubular effect */}
                      <rect
                        x={wellCenterX - casingWidth / 2 + 2}
                        y={marginTop + 2}
                        width={Math.max(casingWidth - 4, 2)}
                        height={casingHeight - 4}
                        fill="none"
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="1.5"
                        rx="1"
                      />

                      {/* Casing labels removed - now shown in dedicated column */}

                      {/* Top of Cement (TOC) marker */}
                      {casing.top_of_cement !== null && (
                        <g>
                          <line
                            x1={wellCenterX - casingWidth / 2 - 10}
                            y1={cementTop}
                            x2={wellCenterX - casingWidth / 2}
                            y2={cementTop}
                            stroke="#666"
                            strokeWidth="2"
                          />
                          <text
                            x={wellCenterX - casingWidth / 2 - 15}
                            y={cementTop + 4}
                            textAnchor="end"
                            fontSize={size === "small" ? "8" : "9"}
                            fill="#666"
                            fontWeight="500"
                          >
                            TOC
                          </text>
                        </g>
                      )}

                      <title>
                        Casing: {casing.type || "Unknown"}
                        {casing.size !== null ? ` - ${casing.size}"` : ""}
                        {casing.Interval !== null
                          ? ` - Depth: ${casing.Interval}ft MD`
                          : ""}
                        {casing.top_of_cement !== null
                          ? ` - TOC: ${casing.top_of_cement}ft MD`
                          : ""}
                        {casing.cement_type
                          ? ` - Cement: ${casing.cement_type}`
                          : ""}
                        {casing.bags_of_cement !== null
                          ? ` - Bags: ${casing.bags_of_cement}`
                          : ""}
                        {casing.weight !== null
                          ? ` - Weight: ${casing.weight} lb/ft`
                          : ""}
                        {casing.grade ? ` - Grade: ${casing.grade}` : ""}
                      </title>
                    </g>
                  );
                })}

                {/* Perforation intervals - Industry standard: Green for Open, Red for Squeezed */}
                {(data.perforation_intervals || []).map((perf, idx) => {
                  if (
                    perf.from === null ||
                    perf.to === null ||
                    isNaN(perf.from) ||
                    isNaN(perf.to)
                  )
                    return null;
                  const fromY = depthToY(perf.from);
                  const toY = depthToY(perf.to);
                  const perfWidth = 24; // Increased for better visibility
                  const status = perf.status || "open";
                  const isOpen = status === "open";
                  const isSqueezed =
                    status === "squeezed" || status === "closed";

                  // Industry standard colors: Green for Open, Red for Squeezed
                  const perfColor = isOpen
                    ? "#52c41a"
                    : isSqueezed
                    ? "#ff4d4f"
                    : "#ff6b6b";
                  const perfPattern = isSqueezed
                    ? "url(#squeezedPerfPattern)"
                    : "none";

                  return (
                    <g key={idx}>
                      {/* Perforation interval rectangle */}
                      <rect
                        x={wellCenterX - perfWidth / 2}
                        y={fromY}
                        width={perfWidth}
                        height={toY - fromY}
                        fill={isSqueezed ? "none" : perfColor}
                        fillOpacity={isOpen ? 0.25 : 0}
                        stroke={perfColor}
                        strokeWidth={isSqueezed ? "3.5" : "2.5"}
                        strokeDasharray={isSqueezed ? "4,2" : "3,3"}
                      />
                      {/* Perforation marks (dots for open, X for squeezed) */}
                      {Array.from(
                        { length: Math.ceil((toY - fromY) / 10) },
                        (_, i) => {
                          const cy = fromY + i * 10;
                          if (isSqueezed) {
                            // X marks for squeezed
                            return (
                              <g key={i}>
                                <line
                                  x1={wellCenterX - 3}
                                  y1={cy - 3}
                                  x2={wellCenterX + 3}
                                  y2={cy + 3}
                                  stroke={perfColor}
                                  strokeWidth="2"
                                />
                                <line
                                  x1={wellCenterX + 3}
                                  y1={cy - 3}
                                  x2={wellCenterX - 3}
                                  y2={cy + 3}
                                  stroke={perfColor}
                                  strokeWidth="2"
                                />
                              </g>
                            );
                          } else {
                            // Circles for open
                            return (
                              <circle
                                key={i}
                                cx={wellCenterX}
                                cy={cy}
                                r="2"
                                fill={perfColor}
                              />
                            );
                          }
                        }
                      )}
                      {/* Perforation label */}
                      <text
                        x={width - marginRight - 5}
                        y={fromY + (toY - fromY) / 2}
                        textAnchor="end"
                        fontSize={size === "small" ? "9" : "10"}
                        fill={perfColor}
                        fontWeight="bold"
                        dominantBaseline="middle"
                      >
                        {isOpen ? "Op" : "Sq"} Perfs {perf.from}-{perf.to}'
                      </text>
                      <title>
                        Perforations: {perf.from}ft - {perf.to}ft MD
                        {perf.status ? ` (${perf.status.toUpperCase()})` : ""}
                        {perf.formation
                          ? ` - Formation: ${perf.formation}`
                          : ""}
                        {perf.shots !== null ? ` - Shots: ${perf.shots}` : ""}
                      </title>
                    </g>
                  );
                })}

                {/* Pluggings - render as horizontal blocks with patterns based on type */}
                {(data.pluggings || []).map((plug, idx) => {
                  if (
                    plug.depth === null ||
                    isNaN(plug.depth) ||
                    !isFinite(plug.depth)
                  )
                    return null;

                  // Parse interval if available (e.g., "0-200 ft" or "surface to bridge")
                  let plugFromY = depthToY(plug.depth);
                  let plugToY = plugFromY;
                  let plugHeight = 0;

                  if (plug.interval) {
                    const intervalMatch =
                      plug.interval.match(/(\d+)\s*[-–]\s*(\d+)/i);
                    if (intervalMatch) {
                      const fromDepth = parseFloat(intervalMatch[1]);
                      const toDepth = parseFloat(intervalMatch[2]);
                      if (!isNaN(fromDepth) && !isNaN(toDepth)) {
                        plugFromY = depthToY(Math.min(fromDepth, toDepth));
                        plugToY = depthToY(Math.max(fromDepth, toDepth));
                        plugHeight = plugToY - plugFromY;
                      }
                    } else if (
                      plug.interval.toLowerCase().includes("surface")
                    ) {
                      plugFromY = marginTop;
                      plugToY = depthToY(plug.depth);
                      plugHeight = plugToY - plugFromY;
                    }
                  }

                  // If no interval, use small visual thickness (equivalent to 5-10ft)
                  if (plugHeight === 0) {
                    const visualThickness =
                      (10 / maxDepth) * (height - marginTop - marginBottom);
                    plugHeight = Math.max(visualThickness, 8); // Minimum 8px for visibility
                    plugFromY = depthToY(plug.depth) - plugHeight / 2;
                    plugToY = depthToY(plug.depth) + plugHeight / 2;
                  }

                  // Find the casing at this depth (the innermost casing that extends to or past this depth)
                  let plugWidth = 20; // Default open hole width if below all casing
                  const plugDepth = plug.depth;

                  // Find all casings that extend to or past this depth, then use the innermost (smallest width)
                  const casingsAtDepth = sortedCasing.filter(
                    (casing) =>
                      casing.Interval !== null &&
                      !isNaN(casing.Interval) &&
                      isFinite(casing.Interval) &&
                      casing.Interval >= plugDepth
                  );

                  if (casingsAtDepth.length > 0) {
                    // Use the innermost casing (smallest width)
                    const innermostCasing = casingsAtDepth.reduce(
                      (innermost, current) => {
                        const currentWidth = getCasingWidth(
                          current.type,
                          current.size
                        );
                        const innermostWidth = getCasingWidth(
                          innermost.type,
                          innermost.size
                        );
                        return currentWidth < innermostWidth
                          ? current
                          : innermost;
                      }
                    );
                    plugWidth = getCasingWidth(
                      innermostCasing.type,
                      innermostCasing.size
                    );
                  }

                  const plugCenterY = plugFromY + plugHeight / 2;

                  // Determine pattern based on plug type
                  const plugTypeLower = (plug.type || "").toLowerCase();
                  let plugPattern = "url(#cementPattern)"; // Default solid
                  if (plugTypeLower.includes("mud")) {
                    plugPattern = "url(#mudPattern)";
                  } else if (
                    plugTypeLower.includes("bridge") ||
                    plugTypeLower.includes("mechanical")
                  ) {
                    plugPattern = "url(#bridgePattern)";
                  } else {
                    plugPattern = "#8b4513"; // Solid cement
                  }

                  return (
                    <g key={idx}>
                      <rect
                        x={wellCenterX - plugWidth / 2}
                        y={plugFromY}
                        width={plugWidth}
                        height={plugHeight}
                        fill={plugPattern}
                        stroke="#654321"
                        strokeWidth="2"
                        opacity={0.95}
                      />
                      {plug.type && plugHeight > 15 && (
                        <text
                          x={wellCenterX}
                          y={plugCenterY}
                          textAnchor="middle"
                          fontSize={size === "small" ? "9" : "11"}
                          fill="#fff"
                          fontWeight="bold"
                          dominantBaseline="middle"
                        >
                          {plug.type}
                        </text>
                      )}
                      <title>
                        Plugging: {plug.type || "Plug"}
                        {plug.depth !== null ? ` - Depth: ${plug.depth}ft` : ""}
                        {plug.interval ? ` - Interval: ${plug.interval}` : ""}
                        {plug.details ? ` - ${plug.details}` : ""}
                      </title>
                    </g>
                  );
                })}

                {/* Downhole Tools */}
                {(data.downhole_tools || []).map((tool, idx) => {
                  if (
                    tool.depth === null ||
                    isNaN(tool.depth) ||
                    !isFinite(tool.depth)
                  )
                    return null;
                  const toolY = depthToY(tool.depth);
                  const toolType = (tool.type || "").toLowerCase();
                  const isPacker = toolType.includes("packer");
                  const isValve = toolType.includes("valve");
                  const isPump = toolType.includes("pump");
                  const isNipple = toolType.includes("nipple");

                  // Tool symbol size (increased for better visibility)
                  const toolSize =
                    size === "small" ? 16 : size === "large" ? 24 : 20;

                  return (
                    <g key={idx}>
                      {/* Packer symbol (chevron) */}
                      {isPacker && (
                        <g>
                          <path
                            d={`M ${wellCenterX} ${toolY - toolSize / 2} L ${
                              wellCenterX - toolSize / 2
                            } ${toolY} L ${wellCenterX} ${
                              toolY + toolSize / 2
                            } L ${wellCenterX + toolSize / 2} ${toolY} Z`}
                            fill="#4169e1"
                            stroke="#333"
                            strokeWidth="1.5"
                          />
                        </g>
                      )}
                      {/* Valve symbol (box with X) */}
                      {isValve && (
                        <g>
                          <rect
                            x={wellCenterX - toolSize / 2}
                            y={toolY - toolSize / 2}
                            width={toolSize}
                            height={toolSize}
                            fill="#ff6b6b"
                            stroke="#333"
                            strokeWidth="1.5"
                          />
                          <line
                            x1={wellCenterX - toolSize / 3}
                            y1={toolY - toolSize / 3}
                            x2={wellCenterX + toolSize / 3}
                            y2={toolY + toolSize / 3}
                            stroke="#fff"
                            strokeWidth="2"
                          />
                          <line
                            x1={wellCenterX + toolSize / 3}
                            y1={toolY - toolSize / 3}
                            x2={wellCenterX - toolSize / 3}
                            y2={toolY + toolSize / 3}
                            stroke="#fff"
                            strokeWidth="2"
                          />
                        </g>
                      )}
                      {/* Pump symbol (cylinder) */}
                      {isPump && (
                        <g>
                          <rect
                            x={wellCenterX - toolSize / 2}
                            y={toolY - toolSize}
                            width={toolSize}
                            height={toolSize * 2}
                            fill="#52c41a"
                            stroke="#333"
                            strokeWidth="1.5"
                            rx="2"
                          />
                          <circle
                            cx={wellCenterX}
                            cy={toolY}
                            r={toolSize / 4}
                            fill="#fff"
                          />
                        </g>
                      )}
                      {/* Nipple symbol (small rectangle) */}
                      {isNipple && (
                        <g>
                          <rect
                            x={wellCenterX - toolSize / 3}
                            y={toolY - toolSize / 2}
                            width={(toolSize * 2) / 3}
                            height={toolSize}
                            fill="#ffa500"
                            stroke="#333"
                            strokeWidth="1.5"
                          />
                        </g>
                      )}
                      {/* Default tool symbol (circle) */}
                      {!isPacker && !isValve && !isPump && !isNipple && (
                        <circle
                          cx={wellCenterX}
                          cy={toolY}
                          r={toolSize / 2}
                          fill="#808080"
                          stroke="#333"
                          strokeWidth="1.5"
                        />
                      )}
                      {/* Tool label */}
                      <text
                        x={width - marginRight - 5}
                        y={toolY}
                        textAnchor="end"
                        fontSize={size === "small" ? "9" : "10"}
                        fill="#333"
                        fontWeight="500"
                        dominantBaseline="middle"
                      >
                        {tool.name || tool.type} @ {tool.depth}'
                        {tool.status ? ` (${tool.status.toUpperCase()})` : ""}
                      </text>
                      <title>
                        Tool: {tool.name || tool.type || "Unknown"}
                        {tool.depth !== null
                          ? ` - Depth: ${tool.depth}ft MD`
                          : ""}
                        {tool.bottom_depth !== null
                          ? ` - Bottom: ${tool.bottom_depth}ft MD`
                          : ""}
                        {tool.size !== null ? ` - O.D.: ${tool.size}"` : ""}
                        {tool.inner_diameter !== null
                          ? ` - I.D.: ${tool.inner_diameter}"`
                          : ""}
                        {tool.status
                          ? ` - Status: ${tool.status.toUpperCase()}`
                          : ""}
                      </title>
                    </g>
                  );
                })}

                {/* Wellbore path - render after plugs so it's visible on top */}
                <line
                  x1={wellCenterX}
                  y1={marginTop}
                  x2={wellCenterX}
                  y2={depthToY(maxDepth)}
                  stroke="#666"
                  strokeWidth="2"
                  strokeDasharray={data.deviation === "Straight" ? "0" : "5,5"}
                  opacity={0.6}
                  shapeRendering="geometricPrecision"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Shows (oil/gas indicators) */}
                {(data.shows_depths || []).map((show, idx) => {
                  if (show.depth === null) return null;
                  const depth =
                    typeof show.depth === "string"
                      ? parseFloat(show.depth)
                      : show.depth;
                  if (depth === null || isNaN(depth) || !isFinite(depth))
                    return null;
                  const showY = depthToY(depth);
                  const showsTextMargin = 120;
                  const iconX = width - marginRight - showsTextMargin + 20;
                  const isGas = show.oil_or_gas === "gas";
                  const iconColor =
                    show.oil_or_gas === "oil" ? "#ffa500" : "#00ff00";
                  const showType = isGas ? "Gas Show" : "Oil Show";
                  const showText = show.formation || "Unknown Formation";

                  return (
                    <g key={idx}>
                      <circle
                        cx={iconX}
                        cy={showY}
                        r="6"
                        fill={iconColor}
                        stroke="#333"
                        strokeWidth="1"
                      />
                      <line
                        x1={wellCenterX}
                        y1={showY}
                        x2={iconX - 6}
                        y2={showY}
                        stroke="#999"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={iconX + 10}
                        y={showY + 4}
                        fontSize={size === "small" ? "9" : "11"}
                        fill="#333"
                      >
                        {showText}
                      </text>
                      <title>
                        {showType} detected at {depth}ft
                        {show.formation
                          ? ` in ${show.formation} formation`
                          : ""}
                        {isGas
                          ? " - Green dot indicates gas show"
                          : " - Orange dot indicates oil show"}
                      </title>
                    </g>
                  );
                })}

                {/* Surface/Elevation */}
                {data.elevation !== null && (
                  <g>
                    <line
                      x1={marginLeft}
                      y1={marginTop}
                      x2={width - marginRight}
                      y2={marginTop}
                      stroke="#333"
                      strokeWidth="3"
                    />
                    <text
                      x={wellCenterX}
                      y={marginTop - 8}
                      textAnchor="middle"
                      fontSize={size === "small" ? "11" : "13"}
                      fill="#333"
                      fontWeight="bold"
                    >
                      Surface {data.elevation}ft{" "}
                      {data.elevation_datum ? data.elevation_datum : ""}
                    </text>
                  </g>
                )}

                {/* Wellhead icon */}
                <circle
                  cx={wellCenterX}
                  cy={marginTop}
                  r="8"
                  fill="#4169e1"
                  stroke="#333"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>

          {/* Column 2: Legend (span 2) */}
          <div
            className="col-span-2 flex flex-col gap-2 border-r border-gray-300 p-3 bg-white"
            style={{ minHeight: `${height}px` }}
          >
            {/* Formation Legend */}
            {(uniqueFormations.length > 0 ||
              (data.formations && data.formations.length > 0)) && (
              <div
                className="flex-shrink-0 bg-white border border-gray-200 rounded p-2"
                style={{
                  minWidth: "150px",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                  colorAdjust: "exact",
                }}
              >
                <h3 className="text-xs font-bold text-gray-800 mb-2">
                  Formations
                </h3>
                <div className="space-y-1.5">
                  {uniqueFormations.map((formation, idx) => {
                    if (!formation.formation) return null;
                    const color = getFormationColor(formation.formation);
                    const isTarget = isTargetZone(formation.formation);

                    return (
                      <div
                        key={`${formation.formation}-${idx}`}
                        className="flex items-center gap-2"
                      >
                        {/* Color swatch */}
                        <div
                          className="flex-shrink-0 border border-gray-400"
                          style={{
                            width: "14px",
                            height: "14px",
                            backgroundColor: isTarget ? "#ffd700" : color,
                            opacity: isTarget ? 0.9 : 0.85,
                            borderColor: isTarget ? "#ffd700" : "#999",
                            borderWidth: isTarget ? "2px" : "1px",
                            WebkitPrintColorAdjust: "exact",
                            printColorAdjust: "exact",
                            colorAdjust: "exact",
                          }}
                        />
                        {/* Formation name */}
                        <span
                          className="text-[10px] text-gray-700"
                          style={{
                            fontWeight: isTarget ? "bold" : "normal",
                          }}
                        >
                          {formation.formation}
                          {isTarget && " (Target)"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shows Legend */}
            {(data.shows_depths || []).length > 0 && (
              <div
                className="flex-shrink-0 bg-white border border-gray-200 rounded p-2"
                style={{
                  minWidth: "150px",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                  colorAdjust: "exact",
                }}
              >
                <h3 className="text-xs font-bold text-gray-800 mb-2">Shows</h3>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-shrink-0 border border-gray-400 rounded-full"
                      style={{
                        width: "10px",
                        height: "10px",
                        backgroundColor: "#00ff00",
                        borderColor: "#333",
                        borderWidth: "1px",
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                        colorAdjust: "exact",
                      }}
                    />
                    <span className="text-[10px] text-gray-700">Gas Show</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-shrink-0 border border-gray-400 rounded-full"
                      style={{
                        width: "10px",
                        height: "10px",
                        backgroundColor: "#ffa500",
                        borderColor: "#333",
                        borderWidth: "1px",
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                        colorAdjust: "exact",
                      }}
                    />
                    <span className="text-[10px] text-gray-700">Oil Show</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Well Information, Tubular, Casing Cement, and Perforation Summary (span 3) */}
          <div className="col-span-3 p-3 bg-white min-h-full">
            <WellboreSummaryTables
              data={data}
              size={size}
              showFormationTops={false}
            />
          </div>
        </div>
      </div>

      {/* Formation Tops Summary - Separate on next page */}
      <div className="w-full mt-4">
        <div className="bg-white border border-gray-300 rounded p-2">
          <WellboreSummaryTables
            data={data}
            size={size}
            showFormationTopsOnly={true}
          />
        </div>
      </div>
    </div>
  );
};
