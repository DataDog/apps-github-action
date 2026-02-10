import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'

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
    const appDirectory: string = path.resolve(
      core.getInput('app-directory') || '.'
    )
    const buildDir: string = core.getInput('build-dir') || 'dist'
    const installCommand: string = core.getInput('install-command') || 'npm ci'
    const buildCommand: string =
      core.getInput('build-command') || 'npm run build'
    const datadogSite: string =
      core.getInput('datadog-site') || 'app.datadoghq.com'

    // Verify app directory exists
    if (!fs.existsSync(appDirectory)) {
      throw new Error(`App directory '${appDirectory}' does not exist`)
    }
    core.info(`App directory found: ${appDirectory}`)

    // Step 1: Install dependencies (if install command is provided)
    if (installCommand) {
      core.info(`Installing dependencies with command: ${installCommand}`)
      const installArgs = installCommand.split(' ')
      const installCmd = installArgs[0]
      const installCmdArgs = installArgs.slice(1)

      await exec.exec(installCmd, installCmdArgs, { cwd: appDirectory })
      core.info('✓ Dependencies installed successfully')
    }

    // Step 2: Build the Vite app
    core.info(`Building Vite app with command: ${buildCommand}`)
    const buildArgs = buildCommand.split(' ')
    const buildCmd = buildArgs[0]
    const buildCmdArgs = buildArgs.slice(1)

    await exec.exec(buildCmd, buildCmdArgs, { cwd: appDirectory })
    core.info('✓ Build completed successfully')

    // Step 3: Verify build directory exists
    const fullBuildPath = path.join(appDirectory, buildDir)
    if (!fs.existsSync(fullBuildPath)) {
      throw new Error(`Build directory '${fullBuildPath}' does not exist`)
    }
    core.info(`✓ Build directory '${fullBuildPath}' exists`)

    // Step 4: Create a zip file of the build directory contents
    const zipFile = 'dist.zip'
    core.info(`Creating zip file: ${zipFile}`)

    // Zip contents without the directory wrapper
    await exec.exec('zip', ['-r', `../${zipFile}`, '.'], { cwd: fullBuildPath })
    core.info(`✓ Zip file created: ${zipFile}`)

    // Step 5: Upload to Datadog
    const uploadUrl = `https://${datadogSite}/api/unstable/app-builder-code/apps/${appName}/upload`
    core.info(`Uploading to Datadog: ${uploadUrl}`)

    await exec.exec(
      'curl',
      [
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
      ],
      { cwd: appDirectory }
    )

    core.info('') // Empty line for formatting
    core.info('✓ Upload completed successfully')
    core.info(`App '${appDisplayName}' has been deployed to Datadog! 🎉`)

    // Clean up zip file
    const zipFilePath = path.join(appDirectory, zipFile)
    fs.unlinkSync(zipFilePath)
    core.debug('Cleaned up temporary zip file')
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
