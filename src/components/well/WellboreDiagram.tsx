"use client";

import React, { useMemo } from "react";

interface MGSWellData {
  formations?: Array<{
    from: number | null;
    to: number | null;
    name: string | null;
  }>;
  casing?: Array<{
    type: "Drive" | "Surface" | "Intermediate" | "Production" | null;
    size: number | null;
    Interval: number | null;
    cement_type?: string | null;
    bags_of_cement?: number | null;
  }>;
  perforation_intervals?: Array<{ from: number | null; to: number | null }>;
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

  // Size constants
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

  // Calculate depth scale
  const depthScale = (height - marginTop - marginBottom) / maxDepth;

  // Helper to convert depth to Y coordinate
  const depthToY = (depth: number) => marginTop + depth * depthScale;

  // Depth markers every 500ft
  const depthMarkers = useMemo(() => {
    return Array.from(
      { length: Math.ceil(maxDepth / 500) + 1 },
      (_, i) => i * 500
    );
  }, [maxDepth]);

  // Sort formations by depth
  const sortedFormations = useMemo(() => {
    return [...(data.formations || [])].sort(
      (a, b) => (a.from || 0) - (b.from || 0)
    );
  }, [data.formations]);

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

  // Check if formation is target zone
  const isTargetZone = (formationName: string | null): boolean => {
    return (
      data.target_zone?.toLowerCase() === formationName?.toLowerCase() || false
    );
  };

  return (
    <div className={`wellbore-diagram ${className} flex items-start gap-4`}>
      <svg width={width} height={height} className="bg-white">
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
        </defs>

        {/* Depth markers */}
        {depthMarkers.map((depth) => {
          const y = depthToY(depth);
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
            </g>
          );
        })}

        {/* Formation layers */}
        {sortedFormations.map((formation, idx) => {
          if (formation.from === null || formation.to === null) return null;
          const fromY = depthToY(formation.from);
          const toY = depthToY(formation.to);
          const formationHeight = toY - fromY;
          const color = getFormationColor(formation.name);
          const isTarget = isTargetZone(formation.name);

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
              />
            </g>
          );
        })}

        {/* Casing strings */}
        {sortedCasing.map((casing, idx) => {
          if (casing.Interval === null) return null;
          const casingDepth = casing.Interval;
          const casingY = depthToY(casingDepth);
          const casingWidth = casing.size ? (casing.size / 20) * 30 : 40; // Scale casing width
          const color = getCasingColor(casing.type);

          return (
            <g key={idx}>
              <rect
                x={wellCenterX - casingWidth / 2}
                y={marginTop}
                width={casingWidth}
                height={casingY - marginTop}
                fill={color}
                stroke="#333"
                strokeWidth="1"
                opacity={0.8}
              />
              {casing.type && (
                <text
                  x={wellCenterX}
                  y={casingY - 5}
                  textAnchor="middle"
                  fontSize={size === "small" ? "9" : "11"}
                  fill="#fff"
                  fontWeight="bold"
                >
                  {casing.type}
                </text>
              )}
            </g>
          );
        })}

        {/* Perforation intervals */}
        {(data.perforation_intervals || []).map((perf, idx) => {
          if (perf.from === null || perf.to === null) return null;
          const fromY = depthToY(perf.from);
          const toY = depthToY(perf.to);
          const perfWidth = 20;

          return (
            <g key={idx}>
              <rect
                x={wellCenterX - perfWidth / 2}
                y={fromY}
                width={perfWidth}
                height={toY - fromY}
                fill="none"
                stroke="#ff6b6b"
                strokeWidth="2"
                strokeDasharray="3,3"
              />
              {/* Perforation marks */}
              {Array.from({ length: Math.ceil((toY - fromY) / 10) }, (_, i) => (
                <circle
                  key={i}
                  cx={wellCenterX}
                  cy={fromY + i * 10}
                  r="2"
                  fill="#ff6b6b"
                />
              ))}
            </g>
          );
        })}

        {/* Pluggings - render as horizontal blocks spanning wellbore */}
        {(data.pluggings || []).map((plug, idx) => {
          if (plug.depth === null) return null;

          // Parse interval if available (e.g., "0-200 ft" or "surface to bridge")
          let plugFromY = depthToY(plug.depth);
          let plugToY = plugFromY;
          let plugHeight = 30; // Default height for single depth plugs

          if (plug.interval) {
            const intervalMatch = plug.interval.match(/(\d+)\s*[-–]\s*(\d+)/i);
            if (intervalMatch) {
              const fromDepth = parseFloat(intervalMatch[1]);
              const toDepth = parseFloat(intervalMatch[2]);
              if (!isNaN(fromDepth) && !isNaN(toDepth)) {
                plugFromY = depthToY(Math.min(fromDepth, toDepth));
                plugToY = depthToY(Math.max(fromDepth, toDepth));
                plugHeight = plugToY - plugFromY;
              }
            } else if (plug.interval.toLowerCase().includes("surface")) {
              plugFromY = marginTop;
              plugToY = depthToY(plug.depth);
              plugHeight = plugToY - plugFromY;
            }
          }

          const plugWidth = maxCasingWidth * 1.2; // Wider to span wellbore
          const plugCenterY = plugFromY + plugHeight / 2;

          return (
            <g key={idx}>
              <rect
                x={wellCenterX - plugWidth / 2}
                y={plugFromY}
                width={plugWidth}
                height={plugHeight}
                fill="#8b4513"
                stroke="#654321"
                strokeWidth="2"
                opacity={0.95}
              />
              {plug.type && (
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
                {plug.type || "Plug"} - {plug.interval || `${plug.depth}ft`}
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
          stroke="#333"
          strokeWidth="3"
          strokeDasharray={data.deviation === "Straight" ? "0" : "5,5"}
        />

        {/* Shows (oil/gas indicators) */}
        {(data.shows_depths || []).map((show, idx) => {
          if (show.depth === null) return null;
          const depth =
            typeof show.depth === "string"
              ? parseFloat(show.depth)
              : show.depth;
          if (isNaN(depth)) return null;
          const showY = depthToY(depth);
          const showsTextMargin = 120;
          const iconX = width - marginRight - showsTextMargin + 20;
          const iconColor = show.oil_or_gas === "oil" ? "#ffa500" : "#00ff00";
          const showText = `${show.oil_or_gas === "oil" ? "🛢️" : "⛽"} ${
            show.formation || ""
          }`;

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

      <div className="h-full flex flex-col justify-end">
        {/* Formation Legend - Beside the diagram */}
        {sortedFormations.length > 0 && (
          <div
            className="flex-shrink-0 bg-white border border-gray-300 rounded p-4"
            style={{ minWidth: "200px" }}
          >
            <h3 className="text-sm font-bold text-gray-800 mb-3">Formations</h3>
            <div className="space-y-2">
              {sortedFormations.map((formation, idx) => {
                if (!formation.name) return null;
                const color = getFormationColor(formation.name);
                const isTarget = isTargetZone(formation.name);

                return (
                  <div key={idx} className="flex items-center gap-2">
                    {/* Color swatch */}
                    <div
                      className="flex-shrink-0 border border-gray-400"
                      style={{
                        width: "16px",
                        height: "16px",
                        backgroundColor: isTarget ? "#ffd700" : color,
                        opacity: isTarget ? 0.9 : 0.85,
                        borderColor: isTarget ? "#ffd700" : "#999",
                        borderWidth: isTarget ? "2px" : "1px",
                      }}
                    />
                    {/* Formation name */}
                    <span
                      className="text-xs text-gray-700"
                      style={{
                        fontWeight: isTarget ? "bold" : "normal",
                      }}
                    >
                      {formation.name}
                      {isTarget && " (Target)"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
