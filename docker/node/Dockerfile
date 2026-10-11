# Imaginea pentru containerul is-ia-node (frontend-ul React + Vite): Node.js 24 (LTS)
# Se construieste din folderul frontend (build.context in compose.yaml).
FROM node:24-alpine

WORKDIR /app

# Instalam exact dependintele din package-lock.json.
COPY package.json package-lock.json ./
RUN npm ci

EXPOSE 5173

# Volumul node_modules este sincronizat cu lockfile-ul la fiecare pornire.
CMD ["sh", "-c", "npm ci && npm run dev -- --host 0.0.0.0"]
