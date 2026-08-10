// Type shim for indirectly-referenced @babel/* modules
// (core's codegen.ts uses @babel/generator; when this plugin imports @vue-migrate/core,
//  tsc walks the chain and needs the declaration available in this project too.)

declare module '@babel/generator' {
  const generate: any
  export default generate
}
