/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_KARAOKE_ROOM_SLUG?: string;
  /** 'true' liga as comandas no banco real (exige as migrations aplicadas). Padrão: demonstração. */
  readonly VITE_COMANDAS_LIVE?: string;
  readonly VITE_YOUTUBE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
