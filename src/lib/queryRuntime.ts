import type { AppSchema, ParamDef, RangeValue, State } from "./schema";

const BOOLEAN_TRUE = new Set(["1", "true", "yes", "y", "on"]);
const BOOLEAN_FALSE = new Set(["0", "false", "no", "n", "off"]);

const toSearchParams = (input: string | URLSearchParams): URLSearchParams => {
  if (input instanceof URLSearchParams) {
    return input;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return new URLSearchParams();
  }

  try {
    if (trimmed.includes("://")) {
      const url = new URL(trimmed);
      return new URLSearchParams(url.search);
    }
  } catch {
    return new URLSearchParams();
  }

  if (trimmed.startsWith("?")) {
    return new URLSearchParams(trimmed.slice(1));
  }

  return new URLSearchParams(trimmed);
};

const firstPresentKey = (
  def: ParamDef,
  params: URLSearchParams,
  isRange = false
): string | undefined => {
  const candidates = [def.key, ...(def.alias ?? [])];
  for (const key of candidates) {
    if (isRange) {
      if (params.has(`${key}Min`) || params.has(`${key}Max`)) {
        return key;
      }
    } else if (params.has(key)) {
      return key;
    }
  }
  return undefined;
};

const parseNumber = (value: string | null): number | undefined => {
  if (value === null) {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const normalizeArray = (values: string[]): string[] =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

export const buildDefaultState = (schema: AppSchema): State => {
  const state: State = {};
  for (const param of schema.params) {
    switch (param.type) {
      case "boolean":
        state[param.key] = param.default ?? false;
        break;
      case "string[]":
      case "enum[]":
        state[param.key] = param.default ?? [];
        break;
      case "range":
        state[param.key] = param.default ?? {};
        break;
      default:
        state[param.key] = param.default;
    }
  }
  return state;
};

export const parseSearch = (
  schema: AppSchema,
  search: string | URLSearchParams
): State => {
  const params = toSearchParams(search);
  const state: State = {};

  for (const def of schema.params) {
    switch (def.type) {
      case "string": {
        const foundKey = firstPresentKey(def, params);
        const value = foundKey ? params.get(foundKey) : null;
        if (value === null) {
          state[def.key] = def.default;
          break;
        }
        if (value === "" && def.empty !== "keep") {
          state[def.key] = def.default;
          break;
        }
        state[def.key] = value;
        break;
      }
      case "number": {
        const foundKey = firstPresentKey(def, params);
        const value = foundKey ? params.get(foundKey) : null;
        if (value === null) {
          state[def.key] = def.default;
          break;
        }
        if (value === "" && def.empty !== "keep") {
          state[def.key] = def.default;
          break;
        }
        const parsed = parseNumber(value);
        state[def.key] = parsed ?? def.default;
        break;
      }
      case "boolean": {
        const foundKey = firstPresentKey(def, params);
        const value = foundKey ? params.get(foundKey) : null;
        if (value === null) {
          state[def.key] = def.default ?? false;
          break;
        }
        const lower = value.toLowerCase();
        if (BOOLEAN_TRUE.has(lower)) {
          state[def.key] = true;
          break;
        }
        if (BOOLEAN_FALSE.has(lower)) {
          state[def.key] = false;
          break;
        }
        state[def.key] = def.default ?? false;
        break;
      }
      case "enum": {
        const foundKey = firstPresentKey(def, params);
        const value = foundKey ? params.get(foundKey) : null;
        if (value === null) {
          state[def.key] = def.default;
          break;
        }
        if (def.values.includes(value)) {
          state[def.key] = value;
        } else {
          state[def.key] = def.default;
        }
        break;
      }
      case "string[]": {
        const foundKey = firstPresentKey(def, params);
        let values: string[] = [];
        if (foundKey) {
          if (def.multi === "comma") {
            const raw = params.get(foundKey);
            values = raw ? raw.split(",") : [];
          } else {
            values = params.getAll(foundKey);
          }
        }
        const normalized = normalizeArray(values);
        state[def.key] =
          normalized.length > 0 ? normalized : def.default ?? [];
        break;
      }
      case "enum[]": {
        const foundKey = firstPresentKey(def, params);
        let values: string[] = [];
        if (foundKey) {
          if (def.multi === "comma") {
            const raw = params.get(foundKey);
            values = raw ? raw.split(",") : [];
          } else {
            values = params.getAll(foundKey);
          }
        }
        const normalized = normalizeArray(values).filter((value) =>
          def.values.includes(value)
        );
        state[def.key] =
          normalized.length > 0 ? normalized : def.default ?? [];
        break;
      }
      case "range": {
        const foundKey = firstPresentKey(def, params, true);
        const key = foundKey ?? def.key;
        const minValue = parseNumber(params.get(`${key}Min`));
        const maxValue = parseNumber(params.get(`${key}Max`));
        const range: RangeValue = {};
        if (minValue !== undefined) {
          range.min = minValue;
        }
        if (maxValue !== undefined) {
          range.max = maxValue;
        }
        const hasRange = range.min !== undefined || range.max !== undefined;
        state[def.key] = hasRange ? range : def.default ?? {};
        break;
      }
    }
  }

  return state;
};

export const serializeState = (
  schema: AppSchema,
  state: State
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const def of schema.params) {
    const value = state[def.key];
    if (value === undefined) {
      continue;
    }

    switch (def.type) {
      case "string": {
        if (value === "" && def.empty !== "keep") {
          break;
        }
        params.set(def.key, String(value));
        break;
      }
      case "number": {
        if (value === "" && def.empty !== "keep") {
          break;
        }
        params.set(def.key, String(value));
        break;
      }
      case "boolean": {
        params.set(def.key, value ? "1" : "0");
        break;
      }
      case "enum": {
        params.set(def.key, String(value));
        break;
      }
      case "string[]": {
        const items = Array.isArray(value) ? value : [];
        if (items.length === 0) {
          break;
        }
        if (def.multi === "comma") {
          params.set(def.key, items.join(","));
        } else {
          items.forEach((item) => params.append(def.key, item));
        }
        break;
      }
      case "enum[]": {
        const items = Array.isArray(value) ? value : [];
        if (items.length === 0) {
          break;
        }
        if (def.multi === "comma") {
          params.set(def.key, items.join(","));
        } else {
          items.forEach((item) => params.append(def.key, item));
        }
        break;
      }
      case "range": {
        const range = value as RangeValue;
        if (range.min !== undefined) {
          params.set(`${def.key}Min`, String(range.min));
        }
        if (range.max !== undefined) {
          params.set(`${def.key}Max`, String(range.max));
        }
        break;
      }
    }
  }

  return params;
};
