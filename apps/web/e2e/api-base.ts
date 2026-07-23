/** Cổng API mặc định — thống nhất với .env.example và CI. */
export const DEFAULT_API_PORT = 3000;

export function getE2eApiBase() {
  const port = process.env.API_PORT ?? String(DEFAULT_API_PORT);
  return `http://localhost:${port}/api`;
}
