# apps/swap

This app is a gRPC microservice for onramping / offramping between <currency>/BTC

## Supported Currency Pairs

- KES/BTC
  - onramp from mpesa via STK push
  - offramp to mpesa via send money

## Dev

Run `bun dev swap` to launch the microservices in development mode.
Run `bun start` to launch this plus any other microservice and the REST api gateway in dev mode

## Docs

- See [swap.proto](https://github.com/bitsacco/os/blob/main/proto/swap.proto)
- With the microservice running, see supported gRPC methods with type reflection at http://localhost:4040

## Architecture

See [architecture.md](https://github.com/bitsacco/os/blob/main/docs/architecture.md)
