# apps/auth

This app is a gRPC microservice for Bitsacco authentication.
This service can be configured to support
 - [x] jwt authentication
 - [x] local auth via phone number and pin
 - [ ] local auth via nostr npub and pin

## Dev

Run `bun dev auth` to launch the microservice in development mode.
Run `bun start` to launch this plus any other microservice and the REST api gateway in dev mode 

## Docs

- See [auth.proto](https://github.com/bitsacco/os/blob/main/proto/auth.proto)
- With the microservice running, see supported gRPC methods with type reflection at http://localhost:4070

## Architecture

See [architecture.md](https://github.com/bitsacco/os/blob/main/docs/architecture.md)
