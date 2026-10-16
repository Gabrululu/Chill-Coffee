FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config libssl-dev libdbus-1-3 ca-certificates curl git jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global --force pnpm@12.3.4

# Official release assets and their published SHA-256 digests (v28.1.0).
ARG TARGETARCH
RUN set -eu; \
    architecture="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "$architecture" in \
      amd64) target=x86_64-unknown-linux-gnu; checksum=c1680deee94301d33ada7a17f98411e642a4248c727afbd2e43050d345746462 ;; \
      arm64) target=aarch64-unknown-linux-gnu; checksum=b1e6ab53b0dd673400110fbd665a525cd0a969449943a2990a782f20cc7abe98 ;; \
      *) echo "Arquitectura no compatible: $architecture" >&2; exit 1 ;; \
    esac; \
    curl --fail --show-error --location --retry 3 "https://github.com/stellar/stellar-cli/releases/download/v28.1.0/stellar-cli-28.1.0-${target}.tar.gz" -o /tmp/stellar-cli.tar.gz; \
    echo "$checksum  /tmp/stellar-cli.tar.gz" | sha256sum --check -; \
    tar -xzf /tmp/stellar-cli.tar.gz -C /usr/local/bin stellar; \
    chmod 0755 /usr/local/bin/stellar; \
    rm /tmp/stellar-cli.tar.gz; \
    stellar --version

USER node
ENV CARGO_HOME=/home/node/.cargo \
    RUSTUP_HOME=/home/node/.rustup
ENV PATH=/home/node/.cargo/bin:${PATH}
RUN curl --proto '=https' --tlsv1.2 --fail --show-error --location https://sh.rustup.rs -o /tmp/install-rust.sh \
    && sh /tmp/install-rust.sh -y --no-modify-path --profile minimal --default-toolchain 1.91.1 --component rustfmt,clippy,rust-analyzer --target wasm32v1-none \
    && rm /tmp/install-rust.sh \
    && rustc --version \
    && pnpm --version

# Login shells reset PATH on Debian; keep Rust available in Codespaces terminals.
USER root
RUN printf '%s\n' 'export CARGO_HOME=/home/node/.cargo' 'export RUSTUP_HOME=/home/node/.rustup' 'export PATH="$CARGO_HOME/bin:$PATH"' > /etc/profile.d/stellar-rust.sh
USER node
