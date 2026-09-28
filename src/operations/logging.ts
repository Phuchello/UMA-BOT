// HTTP/Discord errors may include tokens, request bodies or signed evidence URLs.
export function errorCategory(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  if (/^DiscordAPIError(?:\[\d+\])?$/.test(error.name)) return 'DiscordAPIError';
  return ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'AbortError', 'HTTPError']
    .includes(error.name) ? error.name : 'Error';
}
