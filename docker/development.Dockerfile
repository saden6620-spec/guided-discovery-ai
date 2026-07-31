FROM node:24.18.0-bookworm-slim AS node_runtime

FROM python:3.13.14-slim-bookworm

COPY --from=node_runtime /usr/local/ /usr/local/

ARG PNPM_VERSION=11.4.0

RUN corepack enable pnpm \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && node --version \
    && pnpm --version \
    && python --version

WORKDIR /workspace

CMD ["sleep", "infinity"]
