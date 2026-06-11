export const environment = {
  production: true,
  /** Portal backend — issues the JWT HttpOnly cookie and exposes /api/me */
  portalUrl: 'http://localhost:8080',
  /** HR service — all /api/hr/* calls */
  hrApiUrl: 'http://localhost:8082',
};
