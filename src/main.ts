/*
 * Copyright 2026-Present Datadog, Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';

/** The npm package name of the Datadog Apps CLI. */
const CLI_PACKAGE_NAME = '@datadog/apps-cli';

/**
 * Path to the `datadog-apps` binary when the project has the CLI installed,
 * or undefined. Searches `node_modules/.bin` upward from the app directory,
 * the same way npx itself resolves binaries.
 *
 * Checking the binary rather than package.json matters: a custom install
 * command can skip the section that lists the CLI (for example,
 * `npm ci --omit=dev`), and bare `npx datadog-apps` would then fetch the
 * unrelated registry package `datadog-apps` instead of failing.
 *
 * @param appDirectory Root directory of the app
 * @returns Absolute path to the installed binary, or undefined.
 */
function findLocalCliBin(appDirectory: string): string | undefined {
  for (
    let directory = path.resolve(appDirectory);
    ;
    directory = path.dirname(directory)
  ) {
    const bin = path.join(directory, 'node_modules', '.bin', 'datadog-apps');
    if (fs.existsSync(bin)) {
      return bin;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
  }
}

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const datadogApiKey: string = core.getInput('datadog-api-key', {
      required: true
    });
    const datadogAppKey: string = core.getInput('datadog-app-key', {
      required: true
    });

    core.setSecret(datadogApiKey);
    core.setSecret(datadogAppKey);

    const appDirectory: string = path.resolve(
      core.getInput('app-directory') || '.'
    );
    const installCommand: string = core.getInput('install-command') || 'npm ci';
    const datadogSite: string = core.getInput('datadog-site');
    const cliVersion: string = core.getInput('cli-version') || 'latest';
    // Verify app directory exists
    if (!fs.existsSync(appDirectory)) {
      throw new Error(`App directory '${appDirectory}' does not exist`);
    }
    core.info(`✓ App directory found: ${appDirectory}`);

    // Step 1: Install dependencies (if install command is provided)
    if (installCommand) {
      core.info(`Installing dependencies with command: ${installCommand}`);
      const installArgs = installCommand.split(' ');
      const installCmd = installArgs[0];
      const installCmdArgs = installArgs.slice(1);

      await exec.exec(installCmd, installCmdArgs, { cwd: appDirectory });
      core.info('✓ Dependencies installed successfully');
    }

    // Step 2: Build, upload, and publish the app with the CLI, which owns the
    // whole deployment now that the build plugins no longer upload. When the
    // project has @datadog/apps-cli installed, npx runs that version;
    // otherwise it fetches the version from the cli-version input into the
    // runner user's npx cache — no global install, so no write access to
    // npm's global prefix and no mutation of shared runner state. Every
    // option is passed as a CLI flag; only the API and app keys go through
    // the environment, which is where the CLI reads them from.
    const gitSha = process.env.GITHUB_SHA || '';
    const deployArgs = ['--yes'];
    if (findLocalCliBin(appDirectory)) {
      core.info(
        `✓ Project ${CLI_PACKAGE_NAME} found; running that version with npx`
      );
    } else {
      deployArgs.push('--package', `${CLI_PACKAGE_NAME}@${cliVersion}`);
      core.info(`Running ${CLI_PACKAGE_NAME}@${cliVersion} with npx`);
    }
    deployArgs.push('datadog-apps', 'deploy');
    if (datadogSite) {
      deployArgs.push('--site', datadogSite);
    }
    if (gitSha) {
      deployArgs.push('--version-name', gitSha);
    }

    core.info(`Deploying Datadog App (version name: ${gitSha})`);
    await exec.exec('npx', deployArgs, {
      cwd: appDirectory,
      env: {
        ...process.env,
        DATADOG_API_KEY: datadogApiKey,
        DATADOG_APP_KEY: datadogAppKey
      }
    });
    core.info('✓ Build, upload, and publish completed successfully');
    core.info(`✓ Your app has been deployed to Datadog! 🎉`);
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
