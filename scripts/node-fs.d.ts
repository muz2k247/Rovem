// The few Node file functions `scripts/maps.ts` and the style-sheet test use, declared here so the project needs no @types/node (tsconfig lists only vite/client).
declare module 'node:fs' {
  export function mkdirSync(path: URL | string, options?: { recursive?: boolean }): void;
  export function writeFileSync(path: URL | string, data: string): void;
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
}
