const FACEIT_API = "https://open.faceit.com/data/v4";

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Json = { [key: string]: JsonValue };

export class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function parseTeamGuid(...inputs: unknown[]): string {
  for (const input of inputs) {
    const match = typeof input === "string" ? GUID_RE.exec(input) : null;
    if (match) return match[0].toLowerCase();
  }
  return "";
}

export async function faceitGet(path: string, apiKey: string): Promise<Json> {
  const response = await fetch(`${FACEIT_API}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (response.ok) return (await response.json()) as Json;

  const raw = await response.text().catch(() => "");
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  console.error("FACEIT request failed", { path, status: response.status, data });
  const dataObject = data && typeof data === "object" ? data as Record<string, JsonValue> : null;
  const errors = dataObject?.errors;
  const firstError = Array.isArray(errors) && errors[0] && typeof errors[0] === "object" ? errors[0] as Record<string, JsonValue> : null;
  const detail = (typeof firstError?.message === "string" ? firstError.message : "") || (typeof dataObject?.message === "string" ? dataObject.message : "");
  if (response.status === 401 || response.status === 403) {
    throw new RequestError("FACEIT не принял ключ API. Проверьте ключ в настройках.", 502);
  }
  if (response.status === 404) {
    throw new RequestError(`FACEIT не нашёл данные по запросу ${path.split("?")[0]}. Проверьте ID команды и матчей.`, 502);
  }
  throw new RequestError(`FACEIT вернул ошибку (${response.status})${detail ? `: ${detail}` : ""}.`, 502);
}
