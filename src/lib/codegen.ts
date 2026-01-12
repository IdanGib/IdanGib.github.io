import type { AppSchema, ParamDef } from "./schema";

const zodForParam = (param: ParamDef): string => {
  switch (param.type) {
    case "string":
      return "z.string().optional()";
    case "number":
      return "z.number().optional()";
    case "boolean":
      return "z.boolean().optional()";
    case "enum":
      return `z.enum(${JSON.stringify(param.values)}).optional()`;
    case "string[]":
      return "z.array(z.string()).optional()";
    case "enum[]":
      return `z.array(z.enum(${JSON.stringify(param.values)})).optional()`;
    case "range":
      return "z.object({ min: z.number().optional(), max: z.number().optional() }).optional()";
  }
};

export const generateSchemaTs = (schema: AppSchema): string => {
  const lines = schema.params.map((param) =>
    `  ${JSON.stringify(param.key)}: ${zodForParam(param)},`
  );

  return [
    "import { z } from \"zod\";",
    "",
    "export const schema = z.object({",
    ...lines,
    "});",
    "",
    "export type QueryState = z.infer<typeof schema>;",
  ].join("\n");
};

export const generateHookTs = (): string => {
  return [
    "import { useCallback, useEffect, useState } from \"react\";",
    "import { parseSearch, serializeState } from \"./queryRuntime\";",
    "import type { AppSchema, State } from \"./schema\";",
    "",
    "export const useQueryState = (schema: AppSchema) => {",
    "  const parse = useCallback(() => parseSearch(schema, window.location.search), [schema]);",
    "  const [state, setState] = useState<State>(() => parse());",
    "",
    "  useEffect(() => {",
    "    const handlePop = () => setState(parse());",
    "    window.addEventListener(\"popstate\", handlePop);",
    "    return () => window.removeEventListener(\"popstate\", handlePop);",
    "  }, [parse]);",
    "",
    "  const setStateOptimistic = useCallback((patch: Partial<State>) => {",
    "    setState((prev) => {",
    "      const next = { ...prev, ...patch };",
    "      const params = serializeState(schema, next);",
    "      const query = params.toString();",
    "      const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;",
    "      window.history.pushState({}, \"\", url);",
    "      return next;",
    "    });",
    "  }, [schema]);",
    "",
    "  return { state, setStateOptimistic };",
    "};",
  ].join("\n");
};
