# apps/solowallet

This app is a gRPC microservice for Bitsacco solo wallet.
The wallet full custodies ecash on behalf of individual members.
Members can withdraw at any time via lightning, or to fiat via integrated Bitsacco `swap` service.

## Dev

Run `bun dev solowallet` to launch the microservice in development mode.
Run `bun start` to launch this plus any other microservice and the REST api gateway in dev mode

## Docs

- See [solowallet.proto](https://github.com/bitsacco/os/blob/main/proto/solowallet.proto)
- With the microservice running, see supported gRPC methods with type reflection at http://localhost:4070

## Architecture

See [architecture.md](https://github.com/bitsacco/os/blob/main/docs/architecture.md)
