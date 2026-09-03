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

/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals';
import * as core from '../__fixtures__/core.js';
import * as execModule from '../__fixtures__/exec.js';
import type * as fs from 'fs';

const mockExistsSync = jest.fn<typeof fs.existsSync>();

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('fs', () => ({
  existsSync: mockExistsSync
}));
jest.unstable_mockModule('@actions/core', () => core);
jest.unstable_mockModule('@actions/exec', () => execModule);

// The module being tested should be imported dynamically. This ensures
// that the mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js');

describe('run()', () => {
  beforeEach(() => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      return '';
    });
    mockExistsSync.mockReturnValue(true);
    execModule.exec.mockResolvedValue(0);
    process.env.GITHUB_SHA = 'abc123sha';
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.GITHUB_SHA;
  });

  it('requires datadog-api-key and datadog-app-key as inputs', async () => {
    await run();

    expect(core.getInput).toHaveBeenCalledWith('datadog-api-key', {
      required: true
    });
    expect(core.getInput).toHaveBeenCalledWith('datadog-app-key', {
      required: true
    });
  });

  it('masks the Datadog API and app keys as secrets', async () => {
    await run();

    expect(core.setSecret).toHaveBeenCalledWith('test-api-key');
    expect(core.setSecret).toHaveBeenCalledWith('test-app-key');
  });

  it('runs the install command, installs the CLI, then deploys', async () => {
    await run();

    expect(execModule.exec).toHaveBeenCalledTimes(3);
    const [installCall, cliInstallCall, deployCall] =
      execModule.exec.mock.calls;
    expect(installCall[0]).toBe('npm');
    expect(installCall[1]).toEqual(['ci']);
    expect(cliInstallCall[0]).toBe('npm');
    expect(cliInstallCall[1]).toEqual([
      'install',
      '--global',
      '@datadog/apps-cli@latest'
    ]);
    expect(deployCall[0]).toBe('datadog-apps');
    expect(deployCall[1]).toEqual(['deploy', '--version-name', 'abc123sha']);
  });

  it('passes only the Datadog credentials through the environment', async () => {
    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'datadog-apps',
      ['deploy', '--version-name', 'abc123sha'],
      expect.objectContaining({
        env: expect.objectContaining({
          DATADOG_API_KEY: 'test-api-key',
          DATADOG_APP_KEY: 'test-app-key'
        })
      })
    );
    const deployEnv = execModule.exec.mock.calls[2][2]?.env ?? {};
    expect(deployEnv).not.toHaveProperty('DATADOG_APPS_VERSION_NAME');
  });

  it('passes GITHUB_SHA as --version-name to the deploy command', async () => {
    process.env.GITHUB_SHA = 'deadbeef';

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'datadog-apps',
      ['deploy', '--version-name', 'deadbeef'],
      expect.any(Object)
    );
  });

  it('omits --version-name when GITHUB_SHA is unset', async () => {
    delete process.env.GITHUB_SHA;

    await run();

    const deployCall = execModule.exec.mock.calls[2];
    expect(deployCall[1]).toEqual(['deploy']);
  });

  it('uses a custom install command', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'install-command') return 'yarn install --frozen-lockfile';
      return '';
    });

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'yarn',
      ['install', '--frozen-lockfile'],
      expect.any(Object)
    );
  });

  it('installs a pinned CLI version when cli-version is set', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'cli-version') return '0.0.1';
      return '';
    });

    await run();

    expect(execModule.exec).toHaveBeenCalledWith('npm', [
      'install',
      '--global',
      '@datadog/apps-cli@0.0.1'
    ]);
  });

  it('passes the datadog-site input as --site to the deploy command', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'datadog-site') return 'datadoghq.eu';
      return '';
    });

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'datadog-apps',
      ['deploy', '--site', 'datadoghq.eu', '--version-name', 'abc123sha'],
      expect.any(Object)
    );
  });

  it('omits --site when the datadog-site input is not set', async () => {
    await run();

    const deployCall = execModule.exec.mock.calls[2];
    expect(deployCall[1]).toEqual(['deploy', '--version-name', 'abc123sha']);
  });

  it('runs commands in the specified app directory', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'app-directory') return '/path/to/app';
      return '';
    });

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'datadog-apps',
      ['deploy', '--version-name', 'abc123sha'],
      expect.objectContaining({ cwd: '/path/to/app' })
    );
  });

  it('fails when the app directory does not exist', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'app-directory') return '/nonexistent/dir';
      return '';
    });
    mockExistsSync.mockReturnValue(false);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      "App directory '/nonexistent/dir' does not exist"
    );
    expect(execModule.exec).not.toHaveBeenCalled();
  });

  it('fails when the install command exits with an error', async () => {
    execModule.exec.mockRejectedValueOnce(new Error('npm ci failed'));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('npm ci failed');
  });

  it('fails when the CLI installation exits with an error', async () => {
    execModule.exec
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('npm install failed'));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('npm install failed');
  });

  it('fails when the deploy command exits with an error', async () => {
    execModule.exec
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('deploy failed'));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('deploy failed');
  });

  it('does not call setFailed on a successful run', async () => {
    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
