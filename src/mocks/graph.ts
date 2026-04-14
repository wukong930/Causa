import type { CommodityNode, RelationshipEdge } from "@/types/domain";

export const mockNodes: CommodityNode[] = [
  // Ferrous
  { id: "RB", name: "螺纹钢", symbol: "RB", cluster: "ferrous", exchange: "SHFE", status: "alert", activeAlertCount: 2, regime: "熊市", priceChange24h: -0.8 },
  { id: "HC", name: "热卷", symbol: "HC", cluster: "ferrous", exchange: "SHFE", status: "alert", activeAlertCount: 2, regime: "中性", priceChange24h: 0.3 },
  { id: "I", name: "铁矿石", symbol: "I", cluster: "ferrous", exchange: "DCE", status: "warning", activeAlertCount: 1, regime: "中性", priceChange24h: -0.2 },
  { id: "J", name: "焦炭", symbol: "J", cluster: "ferrous", exchange: "DCE", status: "warning", activeAlertCount: 1, regime: "熊市", priceChange24h: -0.5 },
  { id: "JM", name: "焦煤", symbol: "JM", cluster: "ferrous", exchange: "DCE", status: "warning", activeAlertCount: 1, regime: "熊市", priceChange24h: -0.3 },
  // Non-ferrous
  { id: "CU", name: "铜", symbol: "CU", cluster: "nonferrous", exchange: "SHFE", status: "alert", activeAlertCount: 1, regime: "震荡", priceChange24h: 0.4 },
  { id: "AL", name: "铝", symbol: "AL", cluster: "nonferrous", exchange: "SHFE", status: "normal", activeAlertCount: 0, regime: "中性", priceChange24h: 0.1 },
  { id: "ZN", name: "锌", symbol: "ZN", cluster: "nonferrous", exchange: "SHFE", status: "normal", activeAlertCount: 0, regime: "中性", priceChange24h: 0.2 },
  // Energy
  { id: "SC", name: "原油", symbol: "SC", cluster: "energy", exchange: "INE", status: "alert", activeAlertCount: 1, regime: "下跌", priceChange24h: -2.1 },
  { id: "PP", name: "聚丙烯", symbol: "PP", cluster: "energy", exchange: "DCE", status: "warning", activeAlertCount: 1, regime: "中性", priceChange24h: -1.2 },
  { id: "TA", name: "PTA", symbol: "TA", cluster: "energy", exchange: "ZCE", status: "warning", activeAlertCount: 1, regime: "中性", priceChange24h: -1.8 },
  { id: "MEG", name: "乙二醇", symbol: "MEG", cluster: "energy", exchange: "DCE", status: "normal", activeAlertCount: 0, regime: "中性", priceChange24h: -0.9 },
  // Agriculture
  { id: "P", name: "棕榈油", symbol: "P", cluster: "agriculture", exchange: "DCE", status: "warning", activeAlertCount: 1, regime: "上涨", priceChange24h: 1.8 },
  { id: "Y", name: "豆油", symbol: "Y", cluster: "agriculture", exchange: "DCE", status: "normal", activeAlertCount: 0, regime: "中性", priceChange24h: 0.4 },
  { id: "M", name: "豆粕", symbol: "M", cluster: "agriculture", exchange: "DCE", status: "normal", activeAlertCount: 0, regime: "中性", priceChange24h: -0.1 },
];

export const mockEdges: RelationshipEdge[] = [
  { id: "e-RB-HC", source: "RB", target: "HC", type: "substitute", strength: 0.85, label: "替代品", activeAlertCount: 2 },
  { id: "e-I-RB", source: "I", target: "RB", type: "upstream_downstream", strength: 0.9, label: "原料", activeAlertCount: 1 },
  { id: "e-I-HC", source: "I", target: "HC", type: "upstream_downstream", strength: 0.9, label: "原料", activeAlertCount: 1 },
  { id: "e-JM-J", source: "JM", target: "J", type: "upstream_downstream", strength: 0.95, label: "炼焦", activeAlertCount: 1 },
  { id: "e-J-RB", source: "J", target: "RB", type: "cost_driven", strength: 0.75, label: "成本", activeAlertCount: 0 },
  { id: "e-SC-PP", source: "SC", target: "PP", type: "cost_driven", strength: 0.8, label: "成本", activeAlertCount: 1 },
  { id: "e-SC-TA", source: "SC", target: "TA", type: "cost_driven", strength: 0.78, label: "成本", activeAlertCount: 1 },
  { id: "e-SC-MEG", source: "SC", target: "MEG", type: "cost_driven", strength: 0.72, label: "成本", activeAlertCount: 0 },
  { id: "e-P-Y", source: "P", target: "Y", type: "substitute", strength: 0.8, label: "替代品", activeAlertCount: 1 },
  { id: "e-CU-LME", source: "CU", target: "AL", type: "domestic_overseas", strength: 0.6, label: "有色联动", activeAlertCount: 0 },
];
