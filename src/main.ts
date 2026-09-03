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
 * Whether the project already depends on @datadog/apps-cli, so the action can
 * run that pinned version instead of installing one globally.
 *
 * @param appDirectory Root directory of the app
 * @returns True when the app's package.json lists the CLI as a dependency.
 */
function hasCliDependency(appDirectory: string): boolean {
  const packageJsonPath = path.join(appDirectory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8')
    ) as Record<string, Record<string, string> | undefined>;
    return Boolean(
      packageJson.dependencies?.[CLI_PACKAGE_NAME] ||
      packageJson.devDependencies?.[CLI_PACKAGE_NAME] ||
      packageJson.optionalDependencies?.[CLI_PACKAGE_NAME]
    );
  } catch {
    // A malformed package.json fails the install command with a clearer
    // error; treat it as no CLI dependency and fall back to a global install.
    return false;
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
    // project already depends on @datadog/apps-cli, run that pinned version
    // through npx; otherwise install the CLI globally with the cli-version
    // input. Every option is passed as a CLI flag; only the API and app keys
    // go through the environment, which is where the CLI reads them from.
    const gitSha = process.env.GITHUB_SHA || '';
    const deployArgs = ['deploy'];
    if (datadogSite) {
      deployArgs.push('--site', datadogSite);
    }
    if (gitSha) {
      deployArgs.push('--version-name', gitSha);
    }

    let deployCommand = 'datadog-apps';
    if (hasCliDependency(appDirectory)) {
      deployCommand = 'npx';
      deployArgs.unshift('datadog-apps');
      core.info(
        `✓ ${CLI_PACKAGE_NAME} found in the project dependencies; running that version with npx`
      );
    } else {
      core.info(`Installing ${CLI_PACKAGE_NAME}@${cliVersion}`);
      await exec.exec('npm', [
        'install',
        '--global',
        `${CLI_PACKAGE_NAME}@${cliVersion}`
      ]);
      core.info(`✓ ${CLI_PACKAGE_NAME} installed successfully`);
    }

    core.info(`Deploying Datadog App (version name: ${gitSha})`);
    await exec.exec(deployCommand, deployArgs, {
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
