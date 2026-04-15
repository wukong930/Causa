// Centralized mock data index.
// All mock data should be imported from this file rather than individual @/mocks/* files.

export { mockAlerts } from "@/mocks/alerts";
export { mockStrategies } from "@/mocks/strategies";
// Backwards-compatible alias (strategies and setups share the same data)
export { mockStrategies as mockSetups } from "@/mocks/strategies";
export { mockRecommendations } from "@/mocks/recommendations";
export { mockSuggestions } from "@/mocks/suggestions";
export { mockPositionSnapshot, mockExecutionFeedbacks } from "@/mocks/positions";
export { mockReports, mockHypotheses } from "@/mocks/research";
export { mockNodes, mockEdges } from "@/mocks/graph";
