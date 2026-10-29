import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['better-sqlite3'],
  outputFileTracingExcludes: { '/*': ['./.local/**/*','./assets/source/**/*','./test-results/**/*','./docs/screenshots/**/*'] },
};
export default withNextIntl(config);
