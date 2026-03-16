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

### Deploy a preview on pull requests

Only use this workflow on trusted, private repositories, as it could enable
external contributors to obtain your Datadog keys from GitHub Actions by opening
a PR with malicious code.

```yaml
name: Preview Deployment
on:
  pull_request:
    types:
      - opened
      - synchronize

permissions:
  contents: read

jobs:
  deploy-preview:
    name: Deploy Datadog App Preview
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        id: checkout
        uses: actions/checkout@v6

      - name: Setup Node.js
        id: setup-node
        uses: actions/setup-node@v6

      - name: Deploy Preview
        id: preview
        uses: DataDog/apps-github-action
        with:
          datadog-api-key: ${{ secrets.DATADOG_API_KEY }}
          datadog-app-key: ${{ secrets.DATADOG_APP_KEY }}
          publish: false
```

## Inputs

| Input             | Description                                                                                                                                                                                                                                      | Required | Default         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------- |
| `datadog-api-key` | Your Datadog API key. This key is [created in your Datadog organization](https://docs.datadoghq.com/account_management/api-app-keys/) and should be stored as a [secret](https://docs.github.com/en/actions/reference/encrypted-secrets)         | Yes      |                 |
| `datadog-app-key` | Your Datadog application key. This key is [created in your Datadog organization](https://docs.datadoghq.com/account_management/api-app-keys/) and should be stored as a [secret](https://docs.github.com/en/actions/reference/encrypted-secrets) | Yes      |                 |
| `app-directory`   | The path to your Datadog App's root directory                                                                                                                                                                                                    | No       | `.`             |
| `install-command` | Command to install dependencies before building                                                                                                                                                                                                  | No       | `npm ci`        |
| `build-command`   | Command to build the Vite app                                                                                                                                                                                                                    | No       | `npm run build` |
| `publish`         | Whether to deploy and publish the app. When `false`, the app will be deployed but not published                                                                                                                                                  | No       | `true`          |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)
