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

type Nested = string | number | boolean | null | undefined | Nested[] | { [k: string]: Nested };

/** PHP urlencode(): like encodeURIComponent but also encodes !'()*~ and uses + for spaces. */
export function phpUrlEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, "+");
}

/** PHP http_build_query() for nested arrays/objects. */
export function httpBuildQuery(obj: Record<string, Nested>, prefix?: string): string {
  const parts: string[] = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      const entries = Array.isArray(value)
        ? Object.fromEntries(value.map((v, i) => [String(i), v]))
        : value;
      const inner = httpBuildQuery(entries as Record<string, Nested>, fullKey);
      if (inner) parts.push(inner);
    } else {
      const str = typeof value === "boolean" ? (value ? "1" : "0") : String(value);
      parts.push(`${phpUrlEncode(fullKey)}=${phpUrlEncode(str)}`);
    }
  }
  return parts.join("&");
}

/** PHP parse_str() for form bodies like a=1&items[0][id]=x. */
export function parseFormBody(body: string): Record<string, Nested> {
  const out: Record<string, Nested> = {};
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const m = rawKey.match(/^([^[]+)((?:\[[^\]]*\])*)$/);
    if (!m) {
      out[rawKey] = value;
      continue;
    }
    const path = [m[1], ...Array.from(m[2].matchAll(/\[([^\]]*)\]/g), (x) => x[1])];
    let node = out as Record<string, Nested>;
    for (let i = 0; i < path.length; i++) {
      let seg = path[i];
      const last = i === path.length - 1;
      if (seg === "") seg = String(Object.keys(node).length);
      if (last) node[seg] = value;
      else {
        if (typeof node[seg] !== "object" || node[seg] === null) node[seg] = {};
        node = node[seg] as Record<string, Nested>;
      }
    }
  }
  return out;
}

/** Slotegrator signature string: params + auth headers, top-level keys sorted (ksort), http_build_query. */
export function buildSignString(values: Record<string, Nested>) {
  const sorted: Record<string, Nested> = {};
  for (const k of Object.keys(values).sort()) sorted[k] = values[k];
  return httpBuildQuery(sorted);
}

export async function hmacSha1Hex(key: string, message: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Turns a Slotegrator rollback list (array or {0:{},1:{}}) into a plain array. */
export function toList(value: unknown): Record<string, string>[] {
  if (!value || typeof value !== "object") return [];
  return (Array.isArray(value) ? value : Object.values(value)) as Record<string, string>[];
}
