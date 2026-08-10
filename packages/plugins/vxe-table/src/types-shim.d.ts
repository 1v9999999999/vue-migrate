// Type shim for @babel/generator + @babel/traverse which don't ship .d.ts in v7.29.x
declare module '@babel/generator'
declare module '@babel/traverse' {
  const traverse: any
  export default traverse
}
