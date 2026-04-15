"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { CommodityNode, RelationshipEdge, CommodityCluster, RelationshipType } from "@/types/domain";
import { getCommodityNodes, getRelationshipEdges } from "@/lib/api-client";
import { CATEGORY_LABEL } from "@/lib/constants";
import { useRouter } from "next/navigation";

// ─── Layout constants ──────────────────────────────────────────────────────────

const CLUSTER_CONFIGS: Record<CommodityCluster, { cx: number; cy: number; label: string; color: string }> = {
  ferrous:     { cx: 300, cy: 220, label: "黑色",    color: "#6366f1" },
  nonferrous:  { cx: 580, cy: 150, label: "有色",    color: "#f59e0b" },
  energy:      { cx: 750, cy: 380, label: "能化",    color: "#ef4444" },
  agriculture: { cx: 180, cy: 480, label: "农产品",  color: "#22c55e" },
  overseas:    { cx: 580, cy: 500, label: "海外",    color: "#3b82f6" },
};

const CLUSTER_ORDER: CommodityCluster[] = ["ferrous", "nonferrous", "energy", "agriculture", "overseas"];

const NODE_RADIUS = 22;
const LABEL_OFFSET = 32;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNodeById(id: string, nodes: CommodityNode[]): CommodityNode | undefined {
  return nodes.find((n) => n.id === id);
}

function getClusterNodes(cluster: CommodityCluster, nodes: CommodityNode[]): CommodityNode[] {
  return nodes.filter((n) => n.cluster === cluster);
}

// Simple circular layout within a cluster
function getNodePosition(node: CommodityNode, nodes: CommodityNode[], clusterCx: number, clusterCy: number): { x: number; y: number } {
  const idx = nodes.indexOf(node);
  const total = nodes.length;
  const angleStep = (2 * Math.PI) / total;
  const angle = idx * angleStep - Math.PI / 2;
  const radius = Math.max(60, total * 18);
  return {
    x: clusterCx + radius * Math.cos(angle),
    y: clusterCy + radius * Math.sin(angle),
  };
}

const NODE_STATUS_COLOR: Record<string, { fill: string; stroke: string; glow: string }> = {
  normal:  { fill: "var(--surface-raised)",  stroke: "var(--border)",        glow: "none" },
  warning: { fill: "#fef3c7",               stroke: "#f59e0b",              glow: "#f59e0b" },
  alert:   { fill: "#fee2e2",               stroke: "#ef4444",              glow: "#ef4444" },
  unknown:  { fill: "var(--surface-overlay)", stroke: "var(--border-subtle)", glow: "none" },
};

const EDGE_TYPE_COLOR: Record<RelationshipType, string> = {
  upstream_downstream: "#6366f1",
  substitute:          "#22c55e",
  inventory_transfer:  "#f59e0b",
  domestic_overseas:   "#3b82f6",
  cost_driven:         "#ef4444",
};

const EDGE_TYPE_LABEL: Record<RelationshipType, string> = {
  upstream_downstream: "上下游",
  substitute:          "替代品",
  inventory_transfer:  "库存转移",
  domestic_overseas:   "内外联动",
  cost_driven:         "成本驱动",
};

// ─── SVG Components ───────────────────────────────────────────────────────────

function NodeMarker({
  node,
  x,
  y,
  onClick,
  selected,
}: {
  node: CommodityNode;
  x: number;
  y: number;
  onClick: () => void;
  selected: boolean;
}) {
  const statusStyle = NODE_STATUS_COLOR[node.status];
  const isActive = node.activeAlertCount > 0;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* Glow for alert nodes */}
      {node.status === "alert" && (
        <circle
          r={NODE_RADIUS + 6}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          opacity="0.3"
        />
      )}
      {node.status === "warning" && (
        <circle
          r={NODE_RADIUS + 4}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          opacity="0.25"
        />
      )}

      {/* Selection ring */}
      {selected && (
        <circle
          r={NODE_RADIUS + 4}
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="2"
        />
      )}

      {/* Node circle */}
      <circle
        r={NODE_RADIUS}
        fill={statusStyle.fill}
        stroke={statusStyle.stroke}
        strokeWidth="1.5"
      />

      {/* Symbol */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="700"
        fontFamily="var(--font-mono)"
        fill={node.status === "alert" ? "#ef4444" : node.status === "warning" ? "#d97706" : "var(--foreground)"}
      >
        {node.symbol}
      </text>

      {/* Alert badge */}
      {isActive && (
        <g transform="translate(14, -14)">
          <circle r="8" fill="#ef4444" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontWeight="700"
            fill="#fff"
          >
            {node.activeAlertCount}
          </text>
        </g>
      )}

      {/* Name label */}
      <text
        x={0}
        y={LABEL_OFFSET}
        textAnchor="middle"
        fontSize="10"
        fill="var(--foreground-muted)"
      >
        {node.name}
      </text>

      {/* Price change */}
      {node.priceChange24h != null && (
        <text
          x={0}
          y={LABEL_OFFSET + 13}
          textAnchor="middle"
          fontSize="9"
          fontFamily="var(--font-mono)"
          fill={node.priceChange24h >= 0 ? "var(--positive)" : "var(--negative)"}
        >
          {node.priceChange24h >= 0 ? "+" : ""}{node.priceChange24h.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

function EdgeLine({
  edge,
  sourceNode,
  targetNode,
  sourceX,
  sourceY,
  targetX,
  targetY,
  onClick,
}: {
  edge: RelationshipEdge;
  sourceNode: CommodityNode;
  targetNode: CommodityNode;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  onClick: () => void;
}) {
  const color = EDGE_TYPE_COLOR[edge.type] ?? "var(--border)";
  const isActive = edge.activeAlertCount > 0;
  const isSameCluster = sourceNode.cluster === targetNode.cluster;

  // Curved path for same-cluster edges
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const perpX = -dy * 0.15;
  const perpY = dx * 0.15;

  const d = isSameCluster
    ? `M ${sourceX} ${sourceY} Q ${midX + perpX} ${midY + perpY} ${targetX} ${targetY}`
    : `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Wider invisible hit area */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth="12"
      />
      {/* Visible line */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={isActive ? "1.5" : "1"}
        opacity={isActive ? 0.9 : 0.5}
        strokeDasharray={edge.type === "domestic_overseas" ? "4 3" : undefined}
        markerEnd={`url(#arrow-${edge.type})`}
      />
    </g>
  );
}

// ─── Node Detail Panel ─────────────────────────────────────────────────────────

function NodeDetailPanel({
  node,
  edges,
  allNodes,
  onClose,
  onNavigate,
}: {
  node: CommodityNode;
  edges: RelationshipEdge[];
  allNodes: CommodityNode[];
  onClose: () => void;
  onNavigate: (type: "alerts" | "strategies", id?: string) => void;
}) {
  const relatedEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
  const relatedNodes = relatedEdges.map((e) => {
    const otherId = e.source === node.id ? e.target : e.source;
    return allNodes.find((n) => n.id === otherId);
  }).filter(Boolean) as CommodityNode[];

  return (
    <div
      className="absolute top-4 right-4 w-72 rounded-xl border shadow-xl z-10"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono"
            style={{
              background: NODE_STATUS_COLOR[node.status].fill,
              color: node.status === "alert" ? "#ef4444" : node.status === "warning" ? "#d97706" : "var(--foreground)",
            }}
          >
            {node.symbol}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {node.name}
            </div>
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
              {node.exchange} · {CATEGORY_LABEL[node.cluster]}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: "var(--foreground-muted)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="flex divide-x" style={{ borderBottom: "1px solid var(--border)" }}>
        {[
          { label: "状态", value: node.regime },
          { label: "24h变化", value: node.priceChange24h != null ? `${node.priceChange24h >= 0 ? "+" : ""}${node.priceChange24h.toFixed(1)}%` : "—" },
          { label: "预警数", value: node.activeAlertCount > 0 ? `${node.activeAlertCount} 条` : "无" },
        ].map((item) => (
          <div key={item.label} className="flex-1 px-3 py-2.5 text-center">
            <div className="text-xs" style={{ color: "var(--foreground-subtle)" }}>{item.label}</div>
            <div
              className="text-sm font-medium font-mono mt-0.5"
              style={{
                color: item.label === "24h变化" && node.priceChange24h != null
                  ? node.priceChange24h >= 0 ? "var(--positive)" : "var(--negative)"
                  : "var(--foreground)"
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Related nodes */}
      {relatedNodes.length > 0 && (
        <div className="p-3">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-subtle)" }}>
            关联品种
          </div>
          <div className="flex flex-col gap-1.5">
            {relatedNodes.map((n) => {
              const edge = relatedEdges.find((e) => e.source === node.id && e.target === n.id || e.source === n.id && e.target === node.id)!;
              return (
                <div key={n.id} className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium" style={{ color: "var(--accent-blue)" }}>
                    {n.symbol}
                  </span>
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                    {n.name}
                  </span>
                  <span
                    className="ml-auto text-xs px-1.5 py-0.5 rounded"
                    style={{ background: "var(--surface-overlay)", color: "var(--foreground-subtle)", fontSize: "9px" }}
                  >
                    {EDGE_TYPE_LABEL[edge.type]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-2 p-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => onNavigate("alerts")}
          className="flex-1 text-xs py-2 rounded-lg font-medium"
          style={{ background: "var(--accent-blue)", color: "#fff" }}
        >
          查看预警
        </button>
        <button
          onClick={() => onNavigate("strategies")}
          className="flex-1 text-xs py-2 rounded-lg"
          style={{ background: "var(--surface-overlay)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
        >
          查看策略
        </button>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({
  selectedCluster,
  onToggleCluster,
}: {
  selectedCluster: CommodityCluster | null;
  onToggleCluster: (c: CommodityCluster | null) => void;
}) {
  return (
    <div
      className="absolute bottom-4 left-4 rounded-xl border shadow-lg z-10 p-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Node status legend */}
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-subtle)" }}>
          节点状态
        </div>
        <div className="flex gap-3">
          {[
            { label: "正常", color: "var(--border)" },
            { label: "预警", color: "#f59e0b" },
            { label: "告警", color: "#ef4444" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ border: `1.5px solid ${item.color}`, background: "var(--surface-raised)" }}
              />
              <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge type legend */}
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-subtle)" }}>
          关系类型
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {CLUSTER_ORDER.map((c) => {
            const config = CLUSTER_CONFIGS[c];
            const active = selectedCluster === c || selectedCluster === null;
            return (
              <button
                key={c}
                onClick={() => onToggleCluster(selectedCluster === c ? null : c)}
                className="flex items-center gap-1.5 text-left"
                style={{ opacity: active ? 1 : 0.4 }}
              >
                <div
                  className="w-5 h-0.5 rounded-full"
                  style={{ background: EDGE_TYPE_COLOR[c === "ferrous" ? "upstream_downstream" : c === "nonferrous" ? "substitute" : c === "energy" ? "cost_driven" : "domestic_overseas"] }}
                />
                <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                  {config.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cluster filter */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-subtle)" }}>
          集群筛选
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => onToggleCluster(null)}
            className="text-xs px-2 py-1 rounded border transition-colors"
            style={{
              background: selectedCluster === null ? "var(--accent-blue)" : "var(--surface-overlay)",
              color: selectedCluster === null ? "#fff" : "var(--foreground-muted)",
              borderColor: selectedCluster === null ? "var(--accent-blue)" : "var(--border)",
            }}
          >
            全部
          </button>
          {CLUSTER_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => onToggleCluster(selectedCluster === c ? null : c)}
              className="text-xs px-2 py-1 rounded border transition-colors"
              style={{
                background: selectedCluster === c ? "var(--accent-blue)" : "var(--surface-overlay)",
                color: selectedCluster === c ? "#fff" : "var(--foreground-muted)",
                borderColor: selectedCluster === c ? "var(--accent-blue)" : "var(--border)",
              }}
            >
              {CLUSTER_CONFIGS[c].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Map Page ─────────────────────────────────────────────────────────────────

export default function MapPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<CommodityNode[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<CommodityCluster | null>(null);
  const [selectedNode, setSelectedNode] = useState<CommodityNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCommodityNodes(), getRelationshipEdges()]).then(([n, e]) => {
      setNodes(n);
      setEdges(e);
      setLoading(false);
    });
  }, []);

  const visibleNodes = useMemo(() => {
    if (selectedCluster === null) return nodes;
    return getClusterNodes(selectedCluster, nodes);
  }, [selectedCluster, nodes]);

  const visibleEdges = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [visibleNodes, edges]);

  // Compute node positions
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    CLUSTER_ORDER.forEach((cluster) => {
      const clusterConfig = CLUSTER_CONFIGS[cluster];
      const clusterNodes = getClusterNodes(cluster, visibleNodes);
      clusterNodes.forEach((node) => {
        positions[node.id] = getNodePosition(node, clusterNodes, clusterConfig.cx, clusterConfig.cy);
      });
    });
    return positions;
  }, [visibleNodes]);

  const handleNavigate = useCallback((type: "alerts" | "strategies", _id?: string) => {
    if (type === "alerts") {
      router.push("/alerts");
    } else {
      router.push("/strategies");
    }
  }, [router]);

  const stats = useMemo(() => ({
    totalNodes: nodes.length,
    totalEdges: edges.length,
    alertNodes: nodes.filter((n) => n.status === "alert").length,
    warningNodes: nodes.filter((n) => n.status === "warning").length,
    totalAlerts: nodes.reduce((sum, n) => sum + n.activeAlertCount, 0),
  }), [nodes, edges]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-3 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              市场图谱
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-muted)" }}>
              {stats.totalNodes} 个品种 · {stats.totalEdges} 条关系
              {stats.alertNodes + stats.warningNodes > 0 && (
                <span className="ml-2">
                  <span style={{ color: "var(--alert-high)" }}>⚠ {stats.warningNodes} 预警</span>
                  {stats.alertNodes > 0 && (
                    <span className="ml-1" style={{ color: "var(--alert-critical)" }}>· {stats.alertNodes} 告警</span>
                  )}
                </span>
              )}
            </p>
          </div>

          {/* Cluster quick stats */}
          <div className="flex items-center gap-2">
            {CLUSTER_ORDER.map((c) => {
              const count = nodes.filter((n) => n.cluster === c).length;
              return (
                <div key={c} className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: CLUSTER_CONFIGS[c].color }}
                  />
                  <span className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
                    {CLUSTER_CONFIGS[c].label} {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map canvas */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: "var(--surface)" }}>
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2"
                style={{ borderColor: "var(--border)", borderTopColor: "var(--accent-blue)", animation: "spin 0.8s linear infinite" }}
              />
              <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>加载市场图谱...</span>
            </div>
          </div>
        )}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 900 620"
          style={{ display: "block" }}
        >
          <defs>
            {/* Arrow markers per edge type */}
            {Object.entries(EDGE_TYPE_COLOR).map(([type, color]) => (
              <marker
                key={type}
                id={`arrow-${type}`}
                markerWidth="6"
                markerHeight="6"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L6,3 z" fill={color} opacity="0.7" />
              </marker>
            ))}
          </defs>

          {/* Cluster labels */}
          {CLUSTER_ORDER.map((cluster) => {
            const config = CLUSTER_CONFIGS[cluster];
            const isActive = selectedCluster === null || selectedCluster === cluster;
            return (
              <g key={cluster} style={{ opacity: isActive ? 1 : 0.2 }}>
                {/* Cluster region background */}
                <rect
                  x={config.cx - 120}
                  y={config.cy - 90}
                  width={240}
                  height={180}
                  rx={12}
                  fill={config.color}
                  opacity={0.03}
                />
                {/* Cluster label */}
                <text
                  x={config.cx}
                  y={config.cy - 72}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={config.color}
                  opacity={0.7}
                >
                  {config.label}
                </text>
              </g>
            );
          })}

          {/* Edges */}
          {visibleEdges.map((edge) => {
            const sourceNode = getNodeById(edge.source, nodes);
            const targetNode = getNodeById(edge.target, nodes);
            if (!sourceNode || !targetNode) return null;
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            if (!sourcePos || !targetPos) return null;

            return (
              <EdgeLine
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                sourceX={sourcePos.x}
                sourceY={sourcePos.y}
                targetX={targetPos.x}
                targetY={targetPos.y}
                onClick={() => {}}
              />
            );
          })}

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            return (
              <NodeMarker
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                selected={selectedNode?.id === node.id}
                onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
              />
            );
          })}
        </svg>

        {/* Node detail panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            edges={edges}
            allNodes={nodes}
            onClose={() => setSelectedNode(null)}
            onNavigate={handleNavigate}
          />
        )}

        {/* Legend */}
        <Legend
          selectedCluster={selectedCluster}
          onToggleCluster={setSelectedCluster}
        />
      </div>
    </div>
  );
}
