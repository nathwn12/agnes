import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as logger from "./logger.js";
import {
  type ModelRoutingConfig,
  DEFAULT_MODEL,
  generateDefaultConfig,
  populateAgentList,
  applyModelRouting as applyModelRoutingPolicy,
} from "./model-routing-policy.js";

export function getConfigPath(): string {
  const home = process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "opencode", "agnes.json");
}

export function writeConfig(configPath: string, config: ModelRoutingConfig): void {
  const dir = path.dirname(configPath);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    logger.warn(`Failed to write model routing config at ${configPath}`, err);
  }
}

export function loadModelRoutingConfig(): ModelRoutingConfig {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8").trim();
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ModelRoutingConfig>;
        if (parsed.enabled === undefined) parsed.enabled = false;
        return parsed as ModelRoutingConfig;
      }
    }
  } catch (err) {
    logger.warn(`Failed to read model routing config at ${configPath}; regenerating defaults`, err);
  }
  // Auto-heal: generate default and write it
  const defaults = generateDefaultConfig();
  writeConfig(configPath, defaults);
  return defaults;
}

export function applyModelRouting(config: any, routing?: ModelRoutingConfig): void {
  applyModelRoutingPolicy(config, routing || loadModelRoutingConfig());
}

export { DEFAULT_MODEL, generateDefaultConfig, populateAgentList };
