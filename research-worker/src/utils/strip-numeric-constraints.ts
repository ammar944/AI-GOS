import { z } from 'zod';

/**
 * Recursively strip .min()/.max()/.nonnegative()/.positive() from z.number()
 * types in a Zod schema. The Anthropic API does not support `minimum`/`maximum`
 * in JSON Schema output_config. Only affects `generateObject()` — post-hoc
 * validation uses the original schema from contracts.ts.
 *
 * Uses Zod v4's `_zod.def.type` string discriminant for reliable type
 * identification across the $ZodType / ZodType class boundary.
 */
export function stripNumericConstraints<T extends z.ZodType>(schema: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._zod?.def;
  if (!def || typeof def.type !== 'string') return schema;

  const typeName: string = def.type;

  if (typeName === 'number') {
    // Return a bare z.number() — even .int() is stripped because Zod v4's
    // integer format adds safe-integer min/max bounds to the JSON Schema,
    // which the Anthropic API also rejects. Post-hoc validation with the
    // original schema from contracts.ts will still enforce .int().
    return z.number() as unknown as T;
  }

  if (typeName === 'optional') {
    const inner = stripNumericConstraints((schema as any).unwrap());
    return z.optional(inner) as unknown as T;
  }

  if (typeName === 'default') {
    const inner = stripNumericConstraints(def.innerType);
    return inner.default(def.defaultValue) as unknown as T;
  }

  if (typeName === 'nullable') {
    const inner = stripNumericConstraints((schema as any).unwrap());
    return z.nullable(inner) as unknown as T;
  }

  if (typeName === 'object') {
    const shape = (schema as any).shape;
    if (shape && typeof shape === 'object') {
      const newShape: Record<string, z.ZodType> = {};
      for (const [key, value] of Object.entries(shape)) {
        newShape[key] = stripNumericConstraints(value as z.ZodType);
      }
      return z.object(newShape) as unknown as T;
    }
    return schema;
  }

  if (typeName === 'array') {
    const element = (schema as any).element;
    if (element) {
      return z.array(stripNumericConstraints(element)) as unknown as T;
    }
    return schema;
  }

  if (typeName === 'record') {
    // z.record() generates `propertyNames` in JSON Schema which Anthropic
    // rejects. Replace with a permissive z.object({}).passthrough() so the
    // model can emit arbitrary key-value pairs. Post-hoc validation with
    // the original schema from contracts.ts still enforces the record type.
    return z.object({}).passthrough() as unknown as T;
  }

  // Everything else (string, enum, boolean, literal, union, etc.): pass through
  return schema;
}
