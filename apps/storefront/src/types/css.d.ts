// Next.js handles CSS imports at build time (SWC/webpack); TypeScript on its
// own has no built-in declaration for them, so plain `tsc --noEmit` needs
// this ambient module to accept side-effect imports like
// `import "../styles/globals.css"`.
declare module "*.css"
