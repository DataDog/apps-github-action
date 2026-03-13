# Contributing

## Submitting Issues

GitHub issues are welcome, feel free to submit error reports and feature
requests!

- Ensure the bug was not already reported by searching on GitHub under
  [Issues](https://github.com/DataDog/apps-github-action/issues).
- If you're unable to find an open issue addressing the problem,
  [open a new one](https://github.com/DataDog/apps-github-action/issues/new/choose).
- Make sure to add enough details to explain your use case.

If you require further assistance, you can also contact
[our support](https://docs.datadoghq.com/help/).

## Development

```bash
# Run the tests
npm run test

# Build project
npm bundle

# Run linter, prettier, tests, and build package
npm run all
```

## Submitting pull requests

Have you fixed a bug or written a new feature and want to share it? Many thanks!

Before opening the pull request, make sure you have run `npm run all` to lint
and build the package.

In order to ease/speed up our review, here are some items you can check/improve
when submitting your pull request:

- **Write meaningful commit messages** Messages should be concise but
  explanatory. The commit message should describe the reason for the change, to
  later understand quickly the thing you've been working on for a day.

- **Keep it small and focused.** Pull requests should contain only one fix, or
  one feature improvement. Bundling several fixes or features in the same PR
  will make it harder to review, and eventually take more time to release.

- **Write tests for the code you wrote.** Each module should be tested. Our CI
  is not public, so it may be difficult to understand why your pull request
  status is failing. Make sure that all tests pass locally, and we'll try to
  sort it out in our CI.
