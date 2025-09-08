// Local TypeScript shims for Deno and std libs used by Supabase Edge Functions.
// These are only to satisfy local editors / TypeScript tooling. Supabase runtime provides the real implementations.

declare module 'std/server' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Minimal Deno global shim for env access used in functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
