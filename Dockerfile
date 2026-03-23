FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_API_WORKFLOW_URL=http://test.guanzhao12.com:3009
ARG VITE_API_DATA_SUPPORT_URL=http://test.guanzhao12.com:3000

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_WORKFLOW_URL=${VITE_API_WORKFLOW_URL}
ENV VITE_API_DATA_SUPPORT_URL=${VITE_API_DATA_SUPPORT_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
