import path = require('path')

import { injectable, inject } from 'inversify'
import { IExecResult, IBuildAgent, TYPES } from '../../core/models'
import { DotnetTool, IDotnetTool } from '../../core/dotnet-tool'
import { GitVersionSettings, GitVersionOutput } from './models'
import { IVersionManager } from '../../core/versionManager'

export interface IGitVersionTool extends IDotnetTool {
    install(versionSpec: string, includePrerelease: boolean): Promise<void>
    run(options: GitVersionSettings): Promise<IExecResult>
    writeGitVersionToAgent(gitversion: GitVersionOutput): void
}

@injectable()
export class GitVersionTool extends DotnetTool implements IGitVersionTool {
    constructor(
        @inject(TYPES.IBuildAgent) buildAgent: IBuildAgent,
        @inject(TYPES.IVersionManager) versionManager: IVersionManager
    ) {
        super(buildAgent, versionManager)
    }

    public async install(
        versionSpec: string,
        includePrerelease: boolean
    ): Promise<void> {
        await this.toolInstall(
            'GitVersion.Tool',
            versionSpec,
            false,
            includePrerelease
        )
    }

    public run(options: GitVersionSettings): Promise<IExecResult> {
        const workDir = this.getRepoDir(options.targetPath)

        const args = this.getArguments(workDir, options)

        return this.execute('dotnet-gitversion', args)
    }

    private getRepoDir(targetPath: string): string {
        let workDir: string
        const srcDir = this.buildAgent.getSourceDir() || '.'
        if (!targetPath) {
            workDir = srcDir
        } else {
            if (this.buildAgent.directoryExists(targetPath)) {
                workDir = path.join(srcDir, targetPath)
            } else {
                throw new Error('Directory not found at ' + targetPath)
            }
        }
        return workDir.replace(/\\/g, '/')
    }

    private getArguments(
        workDir: string,
        options: GitVersionSettings
    ): string[] {
        const args = [workDir, '/output', 'json', '/output', 'buildserver']

        const {
            useConfigFile,
            configFilePath,
            updateAssemblyInfo,
            updateAssemblyInfoFilename,
            additionalArguments
        } = options

        if (useConfigFile) {
            if (
                this.buildAgent.isValidInputFile(
                    'configFilePath',
                    configFilePath
                )
            ) {
                args.push('/config', configFilePath)
            } else {
                throw new Error(
                    'GitVersion configuration file not found at ' +
                        configFilePath
                )
            }
        }
        if (updateAssemblyInfo) {
            args.push('/updateassemblyinfo')
            if (
                this.buildAgent.isValidInputFile(
                    'updateAssemblyInfoFilename',
                    updateAssemblyInfoFilename
                )
            ) {
                args.push(updateAssemblyInfoFilename)
            } else {
                throw new Error(
                    'AssemblyInfoFilename file not found at ' +
                        updateAssemblyInfoFilename
                )
            }
        }

        if (additionalArguments) {
            args.push(additionalArguments)
        }
        return args
    }

    public writeGitVersionToAgent(gitversion: GitVersionOutput): void {
        let properties = Object.keys(gitversion)
        let gitversionOutput = <any>gitversion

        properties.forEach(property => {
            const name = this.toCamelCase(property)
            const value = gitversionOutput[property]
            this.buildAgent.setOutput(name, value)
        })
    }

    private toCamelCase(input: string): string {
        return input.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (
            match,
            index
        ) {
            if (+match === 0) return '' // or if (/\s+/.test(match)) for white spaces
            return index == 0 ? match.toLowerCase() : match.toUpperCase()
        })
    }
}
