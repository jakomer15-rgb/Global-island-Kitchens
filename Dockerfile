# Optional: run the site on a server or container host that has Chrome (needed for quotation PDFs
# without a separate browser service). NOT built or tested in the development environment (no Docker
# there): build it once and run `npm run launch:check` inside it before relying on it.
FROM node:24-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
# The build needs the production variables that the pages read at build time (docs/DEPLOYMENT.md).
RUN npm run build

FROM base AS run
ENV NODE_ENV=production PORT=3000
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["npm", "start"]