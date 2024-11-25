
# docker compose -f compose.yml -p os up -d postgres redis
bunx dotenv -e apps/sms/.env.manual bun run dev sms -- --trace-deprecation
f