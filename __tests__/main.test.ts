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
    // By default nothing exists inside node_modules, so the local CLI
    // binary is absent and tests exercise the pinned-package npx path;
    // tests for the installed-CLI path override this.
    mockExistsSync.mockImplementation(
      (p: fs.PathLike) => !String(p).includes('node_modules')
    );
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

  it('runs the install command, then deploys through npx', async () => {
    await run();

    expect(execModule.exec).toHaveBeenCalledTimes(2);
    const [installCall, deployCall] = execModule.exec.mock.calls;
    expect(installCall[0]).toBe('npm');
    expect(installCall[1]).toEqual(['ci']);
    expect(deployCall[0]).toBe('npx');
    expect(deployCall[1]).toEqual([
      '--yes',
      '--package',
      '@datadog/apps-cli@latest',
      'datadog-apps',
      'deploy',
      '--version-name',
      'abc123sha'
    ]);
  });

  it('passes only the Datadog credentials through the environment', async () => {
    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'npx',
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          DATADOG_API_KEY: 'test-api-key',
          DATADOG_APP_KEY: 'test-app-key'
        })
      })
    );
    const deployEnv = execModule.exec.mock.calls[1][2]?.env ?? {};
    expect(deployEnv).not.toHaveProperty('DATADOG_APPS_VERSION_NAME');
  });

  it('passes GITHUB_SHA as --version-name to the deploy command', async () => {
    process.env.GITHUB_SHA = 'deadbeef';

    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[1]).toContain('--version-name');
    expect(deployCall[1]).toContain('deadbeef');
  });

  it('omits --version-name when GITHUB_SHA is unset', async () => {
    delete process.env.GITHUB_SHA;

    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[1]).toEqual([
      '--yes',
      '--package',
      '@datadog/apps-cli@latest',
      'datadog-apps',
      'deploy'
    ]);
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

  it('runs a pinned CLI version when cli-version is set', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'cli-version') return '0.0.1';
      return '';
    });

    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[1]).toContain('--package');
    expect(deployCall[1]).toContain('@datadog/apps-cli@0.0.1');
  });

  it('runs the installed project CLI via npx without --package', async () => {
    mockExistsSync.mockImplementation(() => true);

    await run();

    expect(execModule.exec).toHaveBeenCalledTimes(2);
    const [installCall, deployCall] = execModule.exec.mock.calls;
    expect(installCall[0]).toBe('npm');
    expect(installCall[1]).toEqual(['ci']);
    expect(deployCall[0]).toBe('npx');
    expect(deployCall[1]).toEqual([
      '--yes',
      'datadog-apps',
      'deploy',
      '--version-name',
      'abc123sha'
    ]);
  });

  it('uses a CLI installed above the app directory (monorepo)', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'app-directory') return '/repo/packages/app';
      return '';
    });
    mockExistsSync.mockImplementation(
      (p: fs.PathLike) =>
        p === '/repo/packages/app' ||
        p === '/repo/node_modules/.bin/datadog-apps'
    );

    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[0]).toBe('npx');
    expect(deployCall[1]).toEqual([
      '--yes',
      'datadog-apps',
      'deploy',
      '--version-name',
      'abc123sha'
    ]);
    expect(deployCall[2]).toEqual(
      expect.objectContaining({ cwd: '/repo/packages/app' })
    );
  });

  it('ignores the cli-version input when the project CLI is installed', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'cli-version') return '0.0.1';
      return '';
    });
    mockExistsSync.mockImplementation(() => true);

    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[1]).not.toContain('--package');
    expect(deployCall[1]).not.toContain('@datadog/apps-cli@0.0.1');
  });

  it('passes the datadog-site input as --site to the deploy command', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'datadog-site') return 'datadoghq.eu';
      return '';
    });

    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[1]).toContain('--site');
    expect(deployCall[1]).toContain('datadoghq.eu');
  });

  it('omits --site when the datadog-site input is not set', async () => {
    await run();

    const deployCall = execModule.exec.mock.calls[1];
    expect(deployCall[1]).not.toContain('--site');
  });

  it('runs the deploy command in the specified app directory', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'app-directory') return '/path/to/app';
      return '';
    });

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'npx',
      expect.any(Array),
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

  it('fails when the deploy command exits with an error', async () => {
    execModule.exec
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
