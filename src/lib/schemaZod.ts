import { z } from "zod";

const aliasSchema = z.array(z.string().min(1)).optional();
const baseSchema = {
  key: z.string().min(1),
  alias: aliasSchema,
};

const stringParam = z.object({
  ...baseSchema,
  type: z.literal("string"),
  default: z.string().optional(),
  empty: z.enum(["drop", "keep"]).optional(),
});

const numberParam = z.object({
  ...baseSchema,
  type: z.literal("number"),
  default: z.number().optional(),
  empty: z.enum(["drop", "keep"]).optional(),
});

const booleanParam = z.object({
  ...baseSchema,
  type: z.literal("boolean"),
  default: z.boolean().optional(),
});

const enumParam = z.object({
  ...baseSchema,
  type: z.literal("enum"),
  values: z.array(z.string().min(1)).min(1),
  default: z.string().optional(),
});

const stringArrayParam = z.object({
  ...baseSchema,
  type: z.literal("string[]"),
  default: z.array(z.string()).optional(),
  multi: z.enum(["repeat", "comma"]).optional(),
});

const enumArrayParam = z.object({
  ...baseSchema,
  type: z.literal("enum[]"),
  values: z.array(z.string().min(1)).min(1),
  default: z.array(z.string()).optional(),
  multi: z.enum(["repeat", "comma"]).optional(),
});

const rangeParam = z.object({
  ...baseSchema,
  type: z.literal("range"),
  default: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
});

export const ParamDefZod = z.discriminatedUnion("type", [
  stringParam,
  numberParam,
  booleanParam,
  enumParam,
  stringArrayParam,
  enumArrayParam,
  rangeParam,
]);

export const AppSchemaZ = z.object({
  version: z.literal(1),
  params: z.array(ParamDefZod).min(1),
});
