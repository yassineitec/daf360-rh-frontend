FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY .npmrc .npmrc
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx ng build --configuration production
 
FROM nginx:alpine
COPY --from=build /app/dist/daf360-rh-frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80