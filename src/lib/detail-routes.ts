// Detail pages whose resource can be missing or someone else's (area 50 #15, area 10 #18, SH-07 #14).
// Their own notFound() runs inside the /app loading boundary, after a 200 has streamed; the proxy uses
// this to decide before the stream (src/lib/supabase/detail-gate.ts). Pure, tested.

export type DetailKind = "requirement" | "opportunity" | "network";
export interface DetailRoute {
  kind: DetailKind;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

const ROUTES: readonly (readonly [RegExp, DetailKind])[] = [
  // the requirement and its sub-pages; `new` is a sibling route, not an id
  [
    /^\/app\/organization\/requirements\/(?!new\/?$)([^/]+)(?:\/(?:matches|applications|edit))?\/?$/,
    "requirement",
  ],
  [/^\/app\/professional\/opportunities\/([^/]+)\/?$/, "opportunity"],
  [/^\/app\/organization\/network\/([^/]+)\/?$/, "network"],
];

function decoded(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment; // a malformed escape is not a uuid either: the gate answers 404
  }
}

/** The detail page a path opens, or null (lists, forms and every other page). */
export function detailRouteOf(pathname: string): DetailRoute | null {
  for (const [pattern, kind] of ROUTES) {
    const id = pattern.exec(pathname)?.[1];
    if (id !== undefined) return { kind, id: decoded(id) };
  }
  return null;
}
