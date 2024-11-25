
docker compose -f compose.yml -p os up -d postgres redis
bunx dotenv -e apps/shares/.env.manual bun run dev shares -- --trace-deprecation
