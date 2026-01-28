/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'
import * as execModule from '../__fixtures__/exec.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/exec', () => execModule)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    // Set the action's inputs as return values from core.getInput().
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key'
      if (name === 'datadog-app-key') return 'test-app-key'
      return ''
    })

    // Mock exec.exec to resolve successfully
    execModule.exec.exec.mockResolvedValue(0)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('Runs npx apps install with correct environment variables', async () => {
    await run()

    // Verify that npx apps install was called
    expect(execModule.exec.exec).toHaveBeenCalledWith(
      'npx',
      ['apps', 'install'],
      expect.objectContaining({
        env: expect.objectContaining({
          DD_API_KEY: 'test-api-key',
          DD_APP_KEY: 'test-app-key'
        }),
        silent: false
      })
    )

    // Verify success message was logged
    expect(core.info).toHaveBeenCalledWith(
      'Datadog apps installation completed successfully'
    )
  })

  it('Sets environment variables correctly', async () => {
    await run()

    const execCall = execModule.exec.exec.mock.calls.find(
      (call) => call[0] === 'npx' && call[1][0] === 'apps'
    )

    expect(execCall).toBeDefined()
    expect(execCall?.[2]?.env).toMatchObject({
      DD_API_KEY: 'test-api-key',
      DD_APP_KEY: 'test-app-key'
    })
  })

  it('Handles errors correctly', async () => {
    const error = new Error('npx command failed')
    execModule.exec.exec.mockRejectedValueOnce(error)

    await run()

    // Verify that the action was marked as failed.
    expect(core.setFailed).toHaveBeenCalledWith('npx command failed')
  })

  it('Requires both API key and App key', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'datadog-api-key') return 'test-api-key'
      // Missing app key
      return ''
    })

    await run()

    // The action should still attempt to run, but may fail
    // This tests that getInput is called with required: true
    expect(core.getInput).toHaveBeenCalledWith('datadog-api-key', {
      required: true
    })
    expect(core.getInput).toHaveBeenCalledWith('datadog-app-key', {
      required: true
    })
  })
})
