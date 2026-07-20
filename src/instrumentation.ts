// Runs once at server startup (Next.js instrumentation hook).
// Registers the OS-level trust store PLUS any corporate/antivirus TLS
// inspection certificates in certs/*.pem (e.g. Norton "Web/Mail Shield")
// as Node's default CAs — so every outbound HTTPS call (Supabase, Anthropic)
// verifies correctly on machines where antivirus intercepts TLS.
// Certificate validation remains fully enabled.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      // Cast: these APIs exist in Node 22.15+/24 but @types/node@20 lacks them
      const tls = (await import('node:tls')) as unknown as {
        getCACertificates(type?: 'default' | 'system' | 'bundled' | 'extra'): string[];
        setDefaultCACertificates(certs: string[]): void;
      };
      const fs = await import('node:fs');
      const path = await import('node:path');

      const certs: string[] = [...tls.getCACertificates('default')];

      // Windows/macOS system store (includes antivirus roots the OS trusts)
      try {
        certs.push(...tls.getCACertificates('system'));
      } catch {
        // not available on this platform — continue
      }

      // Project-local extra certs
      const dir = path.join(process.cwd(), 'certs');
      if (fs.existsSync(dir)) {
        for (const f of fs.readdirSync(dir)) {
          if (f.endsWith('.pem') || f.endsWith('.crt')) {
            certs.push(fs.readFileSync(path.join(dir, f), 'utf8'));
          }
        }
      }

      tls.setDefaultCACertificates(certs);
      console.log(`[tls] trust store extended (${certs.length} CAs)`);
    } catch (err) {
      console.warn('[tls] could not extend trust store:', err);
    }
  }
}
