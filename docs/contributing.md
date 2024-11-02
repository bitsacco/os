# Bitsacco OS - Contributing

We welcome your contributions to the Bitsacco OS project!

## Guidelines

1. Create an issue first and then assign it to yourself
2. We don't have forks so we use `username/feature` when creating a new branch
3. Create a PR, don't push to `main` branch
4. Ask for a review from `@okjodom`
5. Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) guidelines for your commits.

## Project setup

```bash
bun install
```

## Compile and run the project

### docker dev

- `bun start` to start all the services in a docker compose environment
- `bun stop` to shutdown all the services run via docker compose

## individual services

```bash
# general pattern to run an app
$ bun dev <app>

# for example, to run the swap microservice
$ bun dev swap

# to run the api gateway service
$ bun dev api
```

## Run tests

```bash
# unit tests
$ bun test

# target a specific test
$ bun test <test-name-or-file-path>

# watch for changes and re-run tests
$ bun test:watch
$ bun test:watch <test-name-or-file-path>

# e2e tests
$ bun test:e2e

# debug tests
$ bun test:debug

# test coverage
$ bun test:cov

```

## Working with GRPC

We use [gRPC](https://grpc.io/) to communicate between services.
For each service that defines an rpc interface, we have a `<service>.proto` file in the `/proto` folder.
If you make any changes to the proto file, you will need to regenerate the grpc code.

```bash
# generate grpc code
$ bun proto:gen
```
Resulting typescript files are generated in the `/libs/common/src/types/proto` folder.
You might need to manually update the index file in the types folder to include the new files.

## Working with Prisma

We use [Prisma](https://prisma.io/) as the ORM for our database.
Each service that uses prisma has a `prisma.schema` file in its corresponding `/src//prisma` folder.
At present, we manually need to gnerate and commit the prisma client whenever the schema is changed.
To do this, run the following command from within the service directory:

```bash
# generate prisma client
$ bun prisma:gen
```
