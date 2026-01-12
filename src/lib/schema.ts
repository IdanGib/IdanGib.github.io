export type MultiEncoding = "repeat" | "comma";
export type EmptyBehavior = "drop" | "keep";
export type ParamType =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "string[]"
  | "enum[]"
  | "range";

export type RangeValue = { min?: number; max?: number };

export type ParamDef =
  | {
      key: string;
      type: "string";
      default?: string;
      empty?: EmptyBehavior;
      alias?: string[];
    }
  | {
      key: string;
      type: "number";
      default?: number;
      empty?: EmptyBehavior;
      alias?: string[];
    }
  | {
      key: string;
      type: "boolean";
      default?: boolean;
      alias?: string[];
    }
  | {
      key: string;
      type: "enum";
      values: string[];
      default?: string;
      alias?: string[];
    }
  | {
      key: string;
      type: "string[]";
      default?: string[];
      multi?: MultiEncoding;
      alias?: string[];
    }
  | {
      key: string;
      type: "enum[]";
      values: string[];
      default?: string[];
      multi?: MultiEncoding;
      alias?: string[];
    }
  | {
      key: string;
      type: "range";
      default?: RangeValue;
      alias?: string[];
    };

export type AppSchema = {
  version: 1;
  params: ParamDef[];
};

export type StateValue =
  | string
  | number
  | boolean
  | string[]
  | RangeValue
  | undefined;
export type State = Record<string, StateValue>;
