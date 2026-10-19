// Importaciones de Vite que electron-vite no declara para el proceso principal.
declare module '*.sql?raw' {
  const sql: string
  export default sql
}
