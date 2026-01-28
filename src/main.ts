import * as core from '@actions/core'
import * as exec from '@actions/exec'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const datadogApiKey: string = core.getInput('datadog-api-key', {
      required: true
    })
    const datadogAppKey: string = core.getInput('datadog-app-key', {
      required: true
    })

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug('Running npx apps install...')

    // Set environment variables for the command
    const env: { [key: string]: string } = {
      ...process.env,
      DD_API_KEY: datadogApiKey,
      DD_APP_KEY: datadogAppKey
    }

    // Run npx apps install with Datadog credentials in environment
    await exec.exec('npx', ['apps', 'install'], {
      env,
      silent: false
    })

    await exec.exec('ls', ['-la'], {
      silent: false
    })

    core.info('Datadog apps installation completed successfully')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
