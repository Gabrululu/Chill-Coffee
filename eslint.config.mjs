import { FlatCompat } from '@eslint/eslintrc';
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { settings: { next: { rootDir: 'frontend/' } } },
  { ignores: ['**/.next/**', '**/.next-production/**', '**/.next-dev/**', '**/.open-next/**', '**/.wrangler/**', '**/next-env.d.ts', 'frontend/lib/stellar/generated/**'] },
];
export default config;
