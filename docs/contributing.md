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

## Building a new service

To create a new service or app, you can use [nestjs cli]() helpers to modify the workspace as desired.
Open a shell at the root and run the following command, assuming you have all the dependencies already installed

```bash
$ bunx nest
```

