/**
 * Entorno de produccion. Angular reemplaza `environment.ts` por este archivo
 * durante `ng build` (configuracion `production`, ver angular.json).
 *
 * `api` debe apuntar al dominio publico del backend en Railway, incluyendo el
 * prefijo global `/api` que define main.ts. Ejemplo:
 *   https://proyecto-integrador-production.up.railway.app/api
 */
export const environment = {
  produccion: true,
  api: 'https://proyecto-integrador-production-90fb.up.railway.app/api',
};
