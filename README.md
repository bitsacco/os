# Bitsacco Open Source

[Bitsacco Open Source](https://github.com/bitsacco/opensource) is home to services and components powering the [Bitsacco](https://bitsacco.com) platform.

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

| Read more contribution docs at [contributing.md](https://github.com/bitsacco/opensource/blob/main/docs/contributing.md)

## Resources

Check out a few resources that may come in handy when working services and components in this project:

- Read the architecture documentation at [architecture.md](https://github.com/bitsacco/opensource/blob/main/docs/architecture.md).
- For questions and support, please visit our [Discord channel](https://discord.gg/r2ZW377ADS).

## Support

Bitsacco Open Source is MIT-licensed. We grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://bitsacco.com/opensource).

## Stay in touch

- Maintainer - [Jodom](https://twitter.com/okjodom)
- Website - [https://bitsacco.com](https://bitsacco.com/)
- Twitter - [@bitsacco](https://twitter.com/bitsacco)

## License

Bitsacco Open Source is [MIT licensed](https://github.com/bitsacco/opensource/blob/main/LICENSE).
