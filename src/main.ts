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
    const buildCommand: string =
      core.getInput('build-command') || 'npm run build';
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

    // Step 2: Build the Vite app (with upload)
    const deploy: boolean = core.getInput('deploy').toLowerCase() !== 'false';
    const gitSha = deploy ? process.env.GITHUB_SHA || '' : '';
    core.info(`Building Vite app with command: ${buildCommand}`);
    if (deploy) {
      core.info(`Git commit SHA: ${gitSha}`);
    }

    const buildArgs = buildCommand.split(' ');
    const buildCmd = buildArgs[0];
    const buildCmdArgs = buildArgs.slice(1);

    await exec.exec(buildCmd, buildCmdArgs, {
      cwd: appDirectory,
      env: {
        ...process.env,
        DATADOG_API_KEY: datadogApiKey,
        DATADOG_APP_KEY: datadogAppKey,
        DATADOG_APPS_VERSION_NAME: gitSha,
        DATADOG_APPS_UPLOAD_ASSETS: '1'
      }
    });
    core.info('✓ Build and upload completed successfully');
    if (deploy) {
      core.info(`✓ Your app has been deployed to Datadog! 🎉`);
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message);
  }
}
