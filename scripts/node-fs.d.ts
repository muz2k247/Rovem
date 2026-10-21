// The two Node file functions `scripts/maps.ts` uses, declared here so the project needs no @types/node (tsconfig lists only vite/client).
declare module 'node:fs' {
  export function mkdirSync(path: URL | string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: URL | string, data: string): void;
}
