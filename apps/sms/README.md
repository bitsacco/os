# apps/sms

This app is a gRPC microservice for simple sms operations with Bitsacco.
This is a passthrough sms sender using africastalking APIs.

## Dev

Run `bun dev sms` to launch the microservice in development mode.
Run `bun start` to launch this plus any other microservice and the REST api gateway in dev mode

## Docs

- See [sms.proto](https://github.com/bitsacco/os/blob/main/proto/sms.proto)
- With the microservice running, see supported gRPC methods with type reflection at http://localhost:4060

## Architecture

See [architecture.md](https://github.com/bitsacco/os/blob/main/docs/architecture.md)
