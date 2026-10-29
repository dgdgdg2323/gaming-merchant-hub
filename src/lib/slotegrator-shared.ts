export type SlotegratorGame = {
  uuid: string;
  name: string;
  image?: string | null;
  type?: string;
  provider?: string;
  technology?: string;
  has_lobby?: number;
  is_mobile?: number;
};

/** Slotegrator signature string: all params + auth headers, sorted by key, form-encoded (PHP http_build_query style). */
export function buildSignString(values: Record<string, string>) {
  const sorted = Object.keys(values)
    .sort()
    .map((k) => [k, values[k]] as [string, string]);
  return new URLSearchParams(sorted).toString();
}
