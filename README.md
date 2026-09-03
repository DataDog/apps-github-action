# Deploy Datadog High Code App Action

Build and deploy Datadog Apps using GitHub Actions.

## Setup

To get started:

1. Add your Datadog API and Application Keys as secrets to your GitHub
   repository.
   - For more information, see
     [API and Application Keys](https://docs.datadoghq.com/account_management/api-app-keys/).
2. In your GitHub workflow, use `DataDog/apps-github-action`.

## Sample Workflows

### Deploy on each commit to main (single-app repository, app at root)

```yaml
name: Continuous Deployment
on:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  deploy-app:
    name: Deploy Datadog App
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        id: checkout
        uses: actions/checkout@v6

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@v6

      - name: Deploy
        id: deploy
        uses: DataDog/apps-github-action
        with:
          datadog-api-key: ${{ secrets.DATADOG_API_KEY }}
          datadog-app-key: ${{ secrets.DATADOG_APP_KEY }}
```

### Deploy on each commit to main (monorepo, app in a subdirectory)

```yaml
name: Continuous Deployment
on:
  push:
    branches:
      - main
    paths:
      - path/to/your/app/**

permissions:
  contents: read

jobs:
  deploy-app:
    name: Deploy Datadog App
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        id: checkout
        uses: actions/checkout@v6

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@v6

      - name: Deploy
        id: deploy
        uses: DataDog/apps-github-action
        with:
          datadog-api-key: ${{ secrets.DATADOG_API_KEY }}
          datadog-app-key: ${{ secrets.DATADOG_APP_KEY }}
          app-directory: path/to/your/app
```

## How It Works

The action installs your app's dependencies, then builds, uploads, and publishes
the app with the
[Datadog Apps CLI](https://www.npmjs.com/package/@datadog/apps-cli) by running
`datadog-apps deploy` in your app's directory. When the CLI is already installed
in your app's `node_modules` (for example, as a dependency installed by your
install command), that version runs through `npx`. Otherwise, the CLI is
installed globally, with the version from the `cli-version` input. The CLI
builds the app by running the project's `build` script with the project's own
package manager, then uploads and publishes the built app to Datadog. Every
option the action supplies — the site and the version name (the commit SHA,
`GITHUB_SHA`) — is passed to the CLI as a command-line flag. Only the API and
app keys are passed through the environment, which is where the CLI reads them
from.

## Inputs

| Input             | Description                                                                                                                                                                                                                                 | Required | Default  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| `datadog-api-key` | Your Datadog API key. This key is [created in your Datadog organization](https://docs.datadoghq.com/account_management/api-app-keys/) and should be stored as a [secret](https://github.com/en/actions/reference/encrypted-secrets)         | Yes      |          |
| `datadog-app-key` | Your Datadog application key. This key is [created in your Datadog organization](https://docs.datadoghq.com/account_management/api-app-keys/) and should be stored as a [secret](https://github.com/en/actions/reference/encrypted-secrets) | Yes      |          |
| `app-directory`   | The path to your Datadog App's root directory                                                                                                                                                                                               | No       | `.`      |
| `install-command` | Command to install dependencies before deploying                                                                                                                                                                                            | No       | `npm ci` |
| `datadog-site`    | Datadog site to deploy to (for example, `datadoghq.eu`). When not set, the CLI resolves the site from the `DD_SITE` or `DATADOG_SITE` environment variable, or the `datadogSite` field of the app's `datadog-app.config.json`               | No       |          |
| `cli-version`     | Version of `@datadog/apps-cli` to install. Ignored when the CLI is already installed in the app's `node_modules` — that version runs instead, through `npx`                                                                                 | No       | `latest` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)
