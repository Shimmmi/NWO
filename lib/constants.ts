export const BASE_PATH = "/nwo";

export function apiPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
