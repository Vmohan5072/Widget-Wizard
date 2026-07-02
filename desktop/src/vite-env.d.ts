/// <reference types="vite/client" />

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.png?inline" {
  const dataUri: string;
  export default dataUri;
}
