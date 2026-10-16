#!/usr/bin/env bash
set -Eeuo pipefail
cafe_workspace_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$cafe_workspace_dir"
printf '\n☕ Preparando Stellar Chill Café — solo Testnet\n'
node --version
pnpm --version
rustc --version
stellar --version
# Copy templates only on first setup. Never replace a participant's settings.
if [[ ! -e .env ]]; then cp .env.example .env; fi
if [[ ! -e frontend/.env.local ]]; then cp .env.example frontend/.env.local; fi
pnpm install --frozen-lockfile
# Warm the WASM build so contract editing starts with dependencies available.
pnpm contract:build
printf '\n✓ Entorno preparado. Lee SPEC.md. La página se abrirá en el puerto 3000.\n'
printf 'No se han creado wallets ni enviado transacciones.\n'
