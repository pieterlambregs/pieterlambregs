FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY auth.sh /docker-entrypoint.d/40-packshot-auth.sh
RUN chmod +x /docker-entrypoint.d/40-packshot-auth.sh
