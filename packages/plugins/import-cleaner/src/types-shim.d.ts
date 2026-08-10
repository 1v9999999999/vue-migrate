// Type shim for indirectly-referenced @babel/* modules
declare module '@babel/traverse' {
  const traverse: any
  export default traverse
}
