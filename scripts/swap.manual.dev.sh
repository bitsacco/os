
docker compose -f compose.yml -p os up -d api postgres redis swap-clientd
bunx dotenv -e apps/swap/.env.manual bun run dev swap -- --trace-deprecation
