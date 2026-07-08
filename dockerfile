FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
COPY .npmrc .npmrc
RUN npm ci --legacy-peer-deps
COPY . .
# native-federation ng build writes dist then hangs; timeout kills the idle
# process. We then verify the FULL browser output — index.html + styles.css +
# remoteEntry.json — so a truncated build (killed before styles.css was written)
# FAILS loudly here instead of silently shipping a CSS-less app that serves the
# default nginx page for /styles.css. -s = file exists AND is non-empty.
RUN timeout 1200 npm run build || true; \
    test -s dist/daf360-rh-frontend/browser/index.html && \
    test -s dist/daf360-rh-frontend/browser/styles.css && \
    test -f dist/daf360-rh-frontend/browser/remoteEntry.json
 
FROM nginx:alpine
COPY --from=build /app/dist/daf360-rh-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80