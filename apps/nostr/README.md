# apps/nostr

This app is a gRPC microservice for simple nostr operations with Bitsacco

## Dev

Run `bun dev nostr` to launch the microservice in development mode.
Run `bun start` to launch this plus any other microservice and the REST api gateway in dev mode

## Docs

- See [nostr.proto](https://github.com/bitsacco/os/blob/main/proto/nostr.proto)
- With the microservice running, see supported gRPC methods with type reflection at http://localhost:4050

## Architecture

See [architecture.md](https://github.com/bitsacco/os/blob/main/docs/architecture.md)
