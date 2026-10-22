// URL parameters can be repeated. Keep one value and validate values before RPC calls.
export function catalogParams(input: Record<string, string | string[] | undefined>) {
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(input))
    params[key] = Array.isArray(value) ? value[0] : value;
  const page = Number(params.page);
  params.page = String(Number.isFinite(page) ? Math.max(1, Math.min(10000, Math.floor(page))) : 1);
  if (!['newest', 'price-asc', 'price-desc', 'name'].includes(params.sort || ''))
    params.sort = 'newest';
  if (params.category && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.category))
    params.category = '00000000-0000-0000-0000-000000000000';
  return params;
}
