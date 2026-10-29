# Third-party notices

Dependencies retain their licenses in node_modules and are pinned in package-lock.json. Keep applicable licenses when distributing source or bundles.

| Dependency                                               | License                  | Source                                                                                                              |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Next.js / React / Tailwind                               | MIT                      | https://github.com/vercel/next.js / https://github.com/facebook/react / https://github.com/tailwindlabs/tailwindcss |
| shadcn/ui                                                | MIT                      | https://github.com/shadcn-ui/ui/blob/main/LICENSE.md                                                                |
| Motion                                                   | MIT                      | https://github.com/motiondivision/motion/blob/main/LICENSE.md                                                       |
| Zustand                                                  | MIT                      | https://github.com/pmndrs/zustand/blob/main/LICENSE                                                                 |
| next-intl                                                | MIT                      | https://github.com/amannn/next-intl/blob/main/LICENSE                                                               |
| Playwright                                               | Apache-2.0               | https://github.com/microsoft/playwright/blob/main/LICENSE                                                           |
| TypeScript                                               | Apache-2.0               | https://github.com/microsoft/TypeScript                                                                             |
| Lucide                                                   | ISC                      | https://github.com/lucide-icons/lucide                                                                              |
| Radix UI, clsx, class-variance-authority, tailwind-merge | MIT / Apache-2.0 for cva | See installed package LICENSE files                                                                                 |
| Manrope / Inter                                          | SIL OFL 1.1              | @fontsource-variable/manrope/LICENSE; @fontsource-variable/inter/LICENSE                                            |

## shadcn/ui Button

Generated using shadcn 4.23.0; modified imports and project CSS on 2026-10-28.

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Images

All four images were generated with the built-in imagegen tool for this demo. They depict fictional products and interiors, not actual inventory or completed work. Prompts and file provenance are recorded in ASSETS.md. No external store photographs or customer testimonials are used.

## Server workspace dependencies (2026-10-28)

- Better Auth 1.7.14 — MIT, https://github.com/better-auth/better-auth; official Next.js integration and database migration documentation checked.
- better-sqlite3 13.0.3 — MIT, https://github.com/WiseLibs/better-sqlite3; Node >=22, native runtime verified on Node 24.22.1. Bundled SQLite has its own public-domain notice.
- Zod 4.6.7 — MIT, https://github.com/colinhacks/zod.
- tsx 4.23.15 — MIT, https://github.com/privatenumber/tsx.
- @types/better-sqlite3 9.6.0 — MIT, DefinitelyTyped.

Installed package license files remain in node_modules and the lockfile records exact resolved versions. No complete storefront or admin template was imported. Twelve seed models reuse the four explicitly fictional image resources; these are not photographs of twelve actual products.

## Cloud demonstration dependencies (2026-10-28)

- pg 8.23.1 — MIT, [node-postgres](https://github.com/brianc/node-postgres). Direct Better Auth PostgreSQL adapter, compatible with Neon TCP/TLS connections.
- @types/pg 8.23.1 — MIT, DefinitelyTyped.
- @vercel/functions 3.6.1 — Apache-2.0, [Vercel Functions](https://github.com/vercel/vercel/tree/main/packages/functions). Pinned to this stable compatible release because the examined 3.10.4 dependency tree introduced a vulnerable transitive Zod version; no forced peer overrides are used.
- PostgreSQL 18 test server — [PostgreSQL License](https://www.postgresql.org/about/licence/). Installed system binaries were used; PostgreSQL binaries and databases are not included in the source distribution.
- GitHub Actions checkout 7.0.1 and setup-node 7.1.0 — MIT, their official repositories. Used only in the prepared CI workflow.

No @vercel/postgres package, Shopify SDK or Neon-specific driver was added. Managed service terms and fees are separate from the open-source package licenses.
