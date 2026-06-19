// @ts-nocheck
// User-facing driver settings, persisted to <configDir>/config/claude-code.json
// (with a flat-file fallback). configDir is resolved via core-auth's getConfigDir
// so we write to the same place as the rest of the hub. Distinct from config.ts,
// which holds the OAuth client config.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getConfigDir } from "../../core-auth/dist/index.js";

const PACKAGE_NAME = "claude-code";
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_SELECTION = "hybrid";
const SELECTION_STRATEGIES = ["sticky", "round-robin", "hybrid"];
const DEFAULT_COOLDOWN_SECONDS = 60;
const MAX_COOLDOWN_SECONDS = 900;

function preferredPath() {
  return join(getConfigDir(), "config", PACKAGE_NAME + ".json");
}

function fallbackPath() {
  return join(getConfigDir(), PACKAGE_NAME + ".json");
}

// The file we read from: preferred if present, else fallback if present, else preferred.
function readPath() {
  const preferred = preferredPath();
  if (existsSync(preferred)) return preferred;
  const fallback = fallbackPath();
  if (existsSync(fallback)) return fallback;
  return preferred;
}

function readJson() {
  try {
    const path = readPath();
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
  } catch {
    return {};
  }
}

export function getSetting(key, fallback) {
  const data = readJson();
  const value = data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
  return value === undefined ? fallback : value;
}

export function setSetting(key, value) {
  try {
    const data = readJson();
    // Always write to the preferred (config/) location.
    const target = existsSync(fallbackPath()) && !existsSync(preferredPath()) ? fallbackPath() : preferredPath();
    if (value === undefined) delete data[key];
    else data[key] = value;
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, JSON.stringify(data, null, 2) + "\n");
  } catch {
    // never throw on persistence failure
  }
}

// Typed getter for the one wired setting: how many accounts to try per request.
export function getMaxAttempts(): number {
  const value = Number(getSetting("max_account_attempts", DEFAULT_MAX_ATTEMPTS));
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_MAX_ATTEMPTS;
}

// Account selection strategy passed to core-auth's AccountManager at construction.
export function getSelection(): string {
  const value = getSetting("account_selection_strategy", DEFAULT_SELECTION);
  return SELECTION_STRATEGIES.includes(value) ? value : DEFAULT_SELECTION;
}

// Base cooldown (seconds) for a 429/529 without a retry-after header; doubles per attempt.
export function getDefaultCooldownSeconds(): number {
  const value = Number(getSetting("default_cooldown_seconds", DEFAULT_COOLDOWN_SECONDS));
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_COOLDOWN_SECONDS;
}

// Maximum cooldown (seconds) the exponential backoff can grow to.
export function getMaxCooldownSeconds(): number {
  const value = Number(getSetting("max_cooldown_seconds", MAX_COOLDOWN_SECONDS));
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : MAX_COOLDOWN_SECONDS;
}
