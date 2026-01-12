import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppSchema, ParamDef, RangeValue, State } from "../lib/schema";
import { AppSchemaZ } from "../lib/schemaZod";
import { buildDefaultState, parseSearch, serializeState } from "../lib/queryRuntime";
import { generateHookTs, generateSchemaTs } from "../lib/codegen";

const DEFAULT_SCHEMA_TEXT = `{
  "version": 1,
  "params": [
    { "key": "q", "type": "string", "default": "" },
    { "key": "shape", "type": "enum", "values": ["round", "oval", "emerald"], "default": "round" },
    { "key": "materials", "type": "string[]", "multi": "repeat", "default": ["gold"] },
    { "key": "inStock", "type": "boolean", "default": true },
    { "key": "price", "type": "range", "default": { "min": 100, "max": 500 } }
  ]
}`;

const DEFAULT_URL_TEXT = "?q=hello&shape=oval&materials=gold&materials=platinum&inStock=1&priceMin=150&priceMax=750";

const SCHEMA_STORAGE_KEY = "pm_schemaText";
const URL_STORAGE_KEY = "pm_urlText";

type TabKey = "schema" | "playground" | "code";

type SchemaState = {
  schema: AppSchema | null;
  error: string | null;
};

const parseSchemaText = (text: string): SchemaState => {
  try {
    const parsed = JSON.parse(text) as unknown;
    const result = AppSchemaZ.safeParse(parsed);
    if (result.success) {
      return { schema: result.data, error: null };
    }
    return {
      schema: null,
      error: result.error.issues.map((issue) => issue.message).join("\n"),
    };
  } catch (error) {
    return {
      schema: null,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
};

const safeStringify = (value: unknown) => JSON.stringify(value, null, 2);

const buildMergedState = (schema: AppSchema, urlText: string): State => {
  const defaults = buildDefaultState(schema);
  const parsed = parseSearch(schema, urlText);
  return { ...defaults, ...parsed };
};

const updateStateValue = (
  state: State,
  key: string,
  value: State[keyof State]
): State => ({
  ...state,
  [key]: value,
});

const copyToClipboard = async (text: string) => {
  if (!navigator.clipboard) {
    return;
  }
  await navigator.clipboard.writeText(text);
};

const renderParamInput = (
  param: ParamDef,
  value: State[keyof State],
  onChange: (next: State[keyof State]) => void
) => {
  switch (param.type) {
    case "string":
      return (
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={param.key}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={typeof value === "number" ? String(value) : ""}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? undefined : Number(next));
          }}
          placeholder={param.key}
        />
      );
    case "boolean":
      return (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{param.key}</span>
        </label>
      );
    case "enum":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "" ? undefined : next);
          }}
        >
          <option value="">(unset)</option>
          {param.values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "string[]":
      return (
        <input
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(event) => {
            const next = event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean);
            onChange(next);
          }}
          placeholder="comma,separated"
        />
      );
    case "enum[]":
      return (
        <input
          value={Array.isArray(value) ? value.join(", ") : ""}
          onChange={(event) => {
            const next = event.target.value
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
              .filter((entry) => param.values.includes(entry));
            onChange(next);
          }}
          placeholder={param.values.join(", ")}
        />
      );
    case "range": {
      const range = (value as RangeValue) ?? {};
      return (
        <div className="range">
          <input
            type="number"
            value={range.min ?? ""}
            placeholder="min"
            onChange={(event) => {
              const nextMin = event.target.value;
              onChange({
                ...range,
                min: nextMin === "" ? undefined : Number(nextMin),
              });
            }}
          />
          <span>to</span>
          <input
            type="number"
            value={range.max ?? ""}
            placeholder="max"
            onChange={(event) => {
              const nextMax = event.target.value;
              onChange({
                ...range,
                max: nextMax === "" ? undefined : Number(nextMax),
              });
            }}
          />
        </div>
      );
    }
  }
};

const App = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("schema");
  const [schemaText, setSchemaText] = useState(
    () => localStorage.getItem(SCHEMA_STORAGE_KEY) ?? DEFAULT_SCHEMA_TEXT
  );
  const [urlText, setUrlText] = useState(
    () => localStorage.getItem(URL_STORAGE_KEY) ?? DEFAULT_URL_TEXT
  );
  const [{ schema, error }, setSchemaState] = useState<SchemaState>(() =>
    parseSchemaText(schemaText)
  );
  const [state, setState] = useState<State>({});
  const [stateText, setStateText] = useState("");
  const [stateError, setStateError] = useState<string | null>(null);
  const [schemaCode, setSchemaCode] = useState("");
  const [hookCode, setHookCode] = useState("");

  useEffect(() => {
    localStorage.setItem(SCHEMA_STORAGE_KEY, schemaText);
  }, [schemaText]);

  useEffect(() => {
    localStorage.setItem(URL_STORAGE_KEY, urlText);
  }, [urlText]);

  useEffect(() => {
    const next = parseSchemaText(schemaText);
    setSchemaState(next);
  }, [schemaText]);

  useEffect(() => {
    if (!schema) {
      setState({});
      setStateText("");
      return;
    }
    const mergedState = buildMergedState(schema, urlText);
    setState(mergedState);
    setStateText(safeStringify(mergedState));
  }, [schema, urlText]);

  useEffect(() => {
    if (!schema) {
      setSchemaCode("");
      setHookCode("");
      return;
    }
    setSchemaCode(generateSchemaTs(schema));
    setHookCode(generateHookTs());
  }, [schema]);

  const updateStateAndText = useCallback((nextState: State) => {
    setState(nextState);
    setStateText(safeStringify(nextState));
  }, []);

  const handleParse = useCallback(() => {
    if (!schema) {
      return;
    }
    const nextState = parseSearch(schema, urlText);
    updateStateAndText(nextState);
  }, [schema, updateStateAndText, urlText]);

  const handleSerialize = useCallback(() => {
    if (!schema) {
      return;
    }
    const params = serializeState(schema, state);
    const query = params.toString();
    setUrlText(query ? `?${query}` : "");
  }, [schema, state]);

  const handleApplyJson = useCallback(() => {
    try {
      const parsed = JSON.parse(stateText) as State;
      setStateError(null);
      updateStateAndText(parsed);
    } catch (error) {
      setStateError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }, [stateText, updateStateAndText]);

  const playgroundDisabled = !schema;

  return (
    <div className="app">
      <header>
        <div>
          <h1>ParamMirror</h1>
          <p>
            Define a query-string schema, parse URLs into typed state, and
            serialize state back to search params.
          </p>
        </div>
        <div className="tabs">
          {([
            ["schema", "Schema"],
            ["playground", "Playground"],
            ["code", "Code"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
              disabled={key !== "schema" && playgroundDisabled}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "schema" && (
        <section className="panel">
          <label className="field">
            <span>Schema JSON</span>
            <textarea
              value={schemaText}
              onChange={(event) => setSchemaText(event.target.value)}
            />
          </label>
          {error && (
            <div className="error">
              <strong>Schema error</strong>
              <pre>{error}</pre>
            </div>
          )}
          {!error && (
            <div className="success">Schema is valid and ready.</div>
          )}
        </section>
      )}

      {activeTab === "playground" && schema && (
        <section className="panel">
          <div className="field">
            <span>URL or query string</span>
            <input
              value={urlText}
              onChange={(event) => setUrlText(event.target.value)}
              placeholder="?q=ring"
            />
          </div>
          <div className="row">
            <button onClick={handleParse}>Parse → State</button>
            <button onClick={handleSerialize}>State → Serialize</button>
          </div>

          <div className="grid">
            <div className="panel">
              <h3>State JSON</h3>
              <textarea
                value={stateText}
                onChange={(event) => setStateText(event.target.value)}
              />
              <div className="row">
                <button onClick={handleApplyJson}>Apply JSON</button>
                {stateError && <span className="error-text">{stateError}</span>}
              </div>
            </div>
            <div className="panel">
              <h3>Controls</h3>
              <div className="controls">
                {schema.params.map((param) => (
                  <label key={param.key} className="control">
                    <span>{param.key}</span>
                    {renderParamInput(param, state[param.key], (next) => {
                      updateStateAndText(updateStateValue(state, param.key, next));
                    })}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "code" && schema && (
        <section className="panel">
          <div className="code-block">
            <div className="row space">
              <h3>schema.ts</h3>
              <button onClick={() => void copyToClipboard(schemaCode)}>
                Copy
              </button>
            </div>
            <pre>{schemaCode}</pre>
          </div>
          <div className="code-block">
            <div className="row space">
              <h3>useQueryState.ts</h3>
              <button onClick={() => void copyToClipboard(hookCode)}>
                Copy
              </button>
            </div>
            <pre>{hookCode}</pre>
          </div>
        </section>
      )}
    </div>
  );
};

export default App;
