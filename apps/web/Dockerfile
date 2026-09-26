FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
RUN pnpm --filter @dhaka-tesla-pool/web build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/public apps/web/public

RUN pnpm install --frozen-lockfile --prod

EXPOSE 3000

CMD ["pnpm", "--filter", "@dhaka-tesla-pool/web", "start"]
