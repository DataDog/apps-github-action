import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'

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
    })
    const datadogAppKey: string = core.getInput('datadog-app-key', {
      required: true
    })
    const appName: string = core.getInput('app-name', { required: true })
    const appDisplayName: string = core.getInput('app-display-name', {
      required: true
    })
    const buildDir: string = core.getInput('build-dir') || 'dist'
    const buildCommand: string =
      core.getInput('build-command') || 'npm run build'
    const datadogSite: string =
      core.getInput('datadog-site') || 'app.datadoghq.com'

    core.info(`Building Vite app with command: ${buildCommand}`)

    // Step 1: Build the Vite app
    const buildArgs = buildCommand.split(' ')
    const buildCmd = buildArgs[0]
    const buildCmdArgs = buildArgs.slice(1)

    await exec.exec(buildCmd, buildCmdArgs)
    core.info('✓ Build completed successfully')

    // Step 2: Verify build directory exists
    if (!fs.existsSync(buildDir)) {
      throw new Error(`Build directory '${buildDir}' does not exist`)
    }
    core.info(`✓ Build directory '${buildDir}' exists`)

    // Step 3: Create a zip file of the build directory contents
    const zipFile = 'dist.zip'
    core.info(`Creating zip file: ${zipFile}`)

    // Zip contents without the directory wrapper
    await exec.exec('zip', ['-r', `../${zipFile}`, '.'], { cwd: buildDir })
    core.info(`✓ Zip file created: ${zipFile}`)

    // Step 4: Upload to Datadog
    const uploadUrl = `https://${datadogSite}/api/unstable/app-builder-code/apps/${appName}/upload`
    core.info(`Uploading to Datadog: ${uploadUrl}`)

    await exec.exec('curl', [
      '-X',
      'POST',
      uploadUrl,
      '-H',
      'Accept: application/json',
      '-H',
      `DD-API-KEY: ${datadogApiKey}`,
      '-H',
      `DD-APPLICATION-KEY: ${datadogAppKey}`,
      '-F',
      `bundle=@${zipFile}`,
      '-F',
      `name=${appDisplayName}`
    ])

    core.info('✓ Upload completed successfully')
    core.info(`App '${appDisplayName}' has been deployed to Datadog`)

    // Clean up zip file
    fs.unlinkSync(zipFile)
    core.debug('Cleaned up temporary zip file')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
