/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Slug do venue padrão desta implantação (nunca hardcode o id — docs/PRODUCT.md). */
  readonly VITE_DEFAULT_VENUE_SLUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
