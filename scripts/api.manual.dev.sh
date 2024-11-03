
docker compose -f compose.yml -p os up -d postgres redis swap-clientd
bunx dotenv -e apps/api/.env.manual bun run dev api -- --trace-deprecation
