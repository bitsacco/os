# apps/chama

This app is a gRPC microservice for Bitsacco chama wallet.
The wallet full custodies ecash on behalf of groups of members.
Members save and transact together in what is commonly known as a Chama savings group

## Dev

Run `bun dev chama` to launch the microservice in development mode.
Run `bun start` to launch this plus any other microservice and the REST api gateway in dev mode

## Docs

- See [chama.proto](https://github.com/bitsacco/os/blob/main/proto/chama.proto)
- With the microservice running, see supported gRPC methods with type reflection at http://localhost:4070

## Architecture

See [architecture.md](https://github.com/bitsacco/os/blob/main/docs/architecture.md)
