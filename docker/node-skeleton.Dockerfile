FROM node:24.18.0-bookworm-slim

ARG PNPM_VERSION=11.4.0

RUN corepack enable pnpm \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate

WORKDIR /workspace

COPY . .

RUN pnpm install --frozen-lockfile \
    && pnpm build

CMD ["sleep", "infinity"]

