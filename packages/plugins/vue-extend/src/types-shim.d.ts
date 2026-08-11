/* @vue-migrate/plugin-vue-extend — local type shim for @babel/traverse (no .d.ts in ESM) */
declare module '@babel/traverse' {
  const traverse: any
  export default traverse
}
