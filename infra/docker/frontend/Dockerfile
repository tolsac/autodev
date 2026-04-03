FROM node:22-alpine AS build

WORKDIR /app
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm install
COPY apps/frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY infra/docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
