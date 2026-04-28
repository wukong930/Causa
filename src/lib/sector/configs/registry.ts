import type { SectorConfig } from "./types";
import { ferrousSector } from "./ferrous";
import { energySector } from "./energy";
import { agricultureSector } from "./agriculture";

/** All registered sector configs */
const SECTOR_CONFIGS: SectorConfig[] = [
  ferrousSector,
  energySector,
  agricultureSector,
];

/** symbol → SectorConfig lookup */
const symbolToSector = new Map<string, SectorConfig>();
for (const config of SECTOR_CONFIGS) {
  for (const symbol of config.symbols) {
    symbolToSector.set(symbol, config);
  }
}

/** Get sector config for a symbol. Returns undefined for uncovered symbols (nonferrous, overseas, financial). */
export function getSectorConfig(symbol: string): SectorConfig | undefined {
  return symbolToSector.get(symbol.toUpperCase());
}

/** Get all registered sector configs */
export function getAllSectorConfigs(): SectorConfig[] {
  return SECTOR_CONFIGS;
}

/** Get sector config by sector id */
export function getSectorConfigById(sectorId: string): SectorConfig | undefined {
  return SECTOR_CONFIGS.find((c) => c.id === sectorId);
}
