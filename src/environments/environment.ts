export const environment = {
  production: false,
  /** Portal backend — issues the JWT HttpOnly cookie and exposes /api/me */
  portalUrl: 'http://localhost:8080',
  /** HR service — all /api/hr/* calls */
  hrApiUrl: 'http://localhost:8888',
  /** Shell (portal frontend) — unauthenticated users are sent here */
  shellUrl: 'http://localhost:4200',
  /** Generic API base — dev HR service */
  apiUrl: 'http://localhost:8891',
};
