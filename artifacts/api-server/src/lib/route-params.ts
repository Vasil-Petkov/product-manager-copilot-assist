/**
 * Named, non-wildcard route IDs must be single strings. Express 5 also types
 * wildcard parameters as arrays; never silently coerce an array into an ID.
 */
export function parseRouteInteger(value: string | string[] | undefined): number {
  return typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
}
