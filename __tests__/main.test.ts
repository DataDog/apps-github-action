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

const mockExistsSync = jest.fn<typeof import('fs').existsSync>();

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('fs', () => ({
  existsSync: mockExistsSync
}));
jest.unstable_mockModule('@actions/core', () => core);
jest.unstable_mockModule('@actions/exec', () => execModule);

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
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

  it('runs the install command before the build command', async () => {
    await run();

    expect(execModule.exec).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = execModule.exec.mock.calls;
    expect(firstCall[0]).toBe('npm');
    expect(firstCall[1]).toEqual(['ci']);
    expect(secondCall[0]).toBe('npm');
    expect(secondCall[1]).toEqual(['run', 'build']);
  });

  it('passes Datadog credentials and metadata to the build command', async () => {
    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'npm',
      ['run', 'build'],
      expect.objectContaining({
        env: expect.objectContaining({
          DATADOG_API_KEY: 'test-api-key',
          DATADOG_APP_KEY: 'test-app-key',
          DATADOG_APPS_VERSION_NAME: 'abc123sha',
          DATADOG_APPS_UPLOAD_ASSETS: '1'
        })
      })
    );
  });

  it('uses GITHUB_SHA as the app version name', async () => {
    process.env.GITHUB_SHA = 'deadbeef';

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'npm',
      ['run', 'build'],
      expect.objectContaining({
        env: expect.objectContaining({ DATADOG_APPS_VERSION_NAME: 'deadbeef' })
      })
    );
  });

  it('defaults version name to empty string when GITHUB_SHA is unset', async () => {
    delete process.env.GITHUB_SHA;

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'npm',
      ['run', 'build'],
      expect.objectContaining({
        env: expect.objectContaining({ DATADOG_APPS_VERSION_NAME: '' })
      })
    );
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

  it('uses a custom build command', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key';
      if (name === 'datadog-app-key') return 'test-app-key';
      if (name === 'build-command') return 'pnpm build --mode production';
      return '';
    });

    await run();

    expect(execModule.exec).toHaveBeenCalledWith(
      'pnpm',
      ['build', '--mode', 'production'],
      expect.any(Object)
    );
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
      expect.any(String),
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

  it('fails when the build command exits with an error', async () => {
    execModule.exec
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('build script failed'));

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('build script failed');
  });

  it('does not call setFailed on a successful run', async () => {
    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
