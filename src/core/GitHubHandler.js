import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import simpleGit from 'simple-git';
import chalk from 'chalk';

export default class GitHubHandler {
    constructor() {
        this.tempDir = path.join(process.cwd(), 'temp-repos');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async cloneAndAnalyze(githubUrl) {
        let tempPath = null;
        
        try {
            const repoName = this.extractRepoName(githubUrl);
            const repoPath = path.join(this.tempDir, repoName);
            
            // Limpiar directorio existente
            if (await fs.pathExists(repoPath)) {
                console.log(chalk.yellow(`🗑️  Limpiando directorio existente: ${repoName}`));
                await fs.remove(repoPath);
            }

            // 1. Clonar repositorio
            console.log(chalk.blue(`🔄 Clonando repositorio: ${githubUrl}`));
            const git = simpleGit();
            await git.clone(githubUrl, repoPath);
            console.log(chalk.green(`✅ Repositorio clonado: ${repoName}`));

            tempPath = repoPath;

            // 2. Instalar dependencias
            console.log(chalk.blue('📦 Instalando dependencias...'));
            const installResult = await this.installDependencies(repoPath);
            
            if (!installResult.success) {
                console.log(chalk.yellow('⚠️  Instalación de dependencias falló, continuando con análisis básico'));
            } else {
                console.log(chalk.green('✅ Dependencias instaladas correctamente'));
            }

            return {
                success: true,
                repoPath,
                repoName,
                dependenciesInstalled: installResult.success,
                installError: installResult.error,
                clonedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(chalk.red(`❌ Error: ${error.message}`));
            
            // Limpiar en caso de error
            if (tempPath) {
                await fs.remove(tempPath).catch(() => {});
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    async installDependencies(repoPath) {
        try {
            const packageJsonPath = path.join(repoPath, 'package.json');
            
            if (!await fs.pathExists(packageJsonPath)) {
                return { success: false, error: 'No package.json found' };
            }

            // Determinar gestor de paquetes (npm, yarn, pnpm)
            const packageManager = await this.detectPackageManager(repoPath);
            console.log(chalk.blue(`   Usando ${packageManager}...`));

            // Ejecutar instalación
            execSync(`${packageManager} install`, {
                cwd: repoPath,
                stdio: 'pipe',
                timeout: 120000 // 2 minutos timeout
            });

            return { success: true };

        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async detectPackageManager(repoPath) {
        // Verificar lock files para determinar el gestor
        if (await fs.pathExists(path.join(repoPath, 'yarn.lock'))) {
            return 'yarn';
        } else if (await fs.pathExists(path.join(repoPath, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        } else {
            return 'npm';
        }
    }

    extractRepoName(githubUrl) {
        const patterns = [
            /github\.com[/:]([^\/]+\/[^\/]+?)(?:\.git)?$/,
            /git@github\.com:([^\/]+\/[^\/]+?)(?:\.git)?$/
        ];
        
        for (const pattern of patterns) {
            const match = githubUrl.match(pattern);
            if (match) {
                return match[1].replace('/', '-') + '-' + Date.now();
            }
        }
        
        return 'unknown-repo-' + Date.now();
    }

    async getRepoInfo(repoPath) {
        try {
            const git = simpleGit(repoPath);
            const remotes = await git.getRemotes(true);
            const branches = await git.branchLocal();
            
            return {
                remotes: remotes.map(r => ({ name: r.name, url: r.refs.fetch })),
                currentBranch: branches.current,
                branches: branches.all
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // Método alternativo para solo análisis (sin instalación)
    async cloneForAnalysisOnly(githubUrl) {
        try {
            const repoName = this.extractRepoName(githubUrl);
            const repoPath = path.join(this.tempDir, repoName);
            
            // Limpiar directorio existente
            if (await fs.pathExists(repoPath)) {
                console.log(chalk.yellow(`🗑️  Limpiando directorio existente: ${repoName}`));
                await fs.remove(repoPath);
            }

            // Clonar SOLO para análisis (más rápido)
            console.log(chalk.blue(`🔄 Clonando para análisis rápido: ${githubUrl}`));
            
            const git = simpleGit();
            await git.clone(githubUrl, repoPath, ['--depth', '1']); // Solo último commit
            
            console.log(chalk.green(`✅ Repositorio listo para análisis: ${repoName}`));

            return {
                success: true,
                repoPath,
                repoName,
                dependenciesInstalled: false,
                clonedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error(chalk.red(`❌ Error clonando repositorio: ${error.message}`));
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Método para verificar si un proyecto tiene Cypress configurado
    async checkCypressSetup(repoPath) {
        try {
            const packageJsonPath = path.join(repoPath, 'package.json');
            const cypressConfigPaths = [
                'cypress.config.js',
                'cypress.config.ts',
                'cypress.json'
            ];

            const results = {
                hasPackageJson: false,
                hasCypressDependency: false,
                hasCypressConfig: false,
                cypressConfigPath: null,
                scripts: {}
            };

            // Verificar package.json
            if (await fs.pathExists(packageJsonPath)) {
                results.hasPackageJson = true;
                try {
                    const packageJson = await fs.readJson(packageJsonPath);
                    const allDeps = { 
                        ...packageJson.dependencies, 
                        ...packageJson.devDependencies 
                    };
                    
                    results.hasCypressDependency = !!allDeps.cypress;
                    results.scripts = packageJson.scripts || {};
                } catch (error) {
                    console.warn(chalk.yellow('⚠️  Error leyendo package.json'));
                }
            }

            // Verificar archivos de configuración de Cypress
            for (const configPath of cypressConfigPaths) {
                const fullPath = path.join(repoPath, configPath);
                if (await fs.pathExists(fullPath)) {
                    results.hasCypressConfig = true;
                    results.cypressConfigPath = configPath;
                    break;
                }
            }

            return results;

        } catch (error) {
            console.error(chalk.red(`❌ Error verificando Cypress: ${error.message}`));
            return {
                hasPackageJson: false,
                hasCypressDependency: false,
                hasCypressConfig: false,
                error: error.message
            };
        }
    }

    // Limpiar repositorios temporales antiguos
    async cleanupOldRepos(maxAgeHours = 24) {
        try {
            if (!await fs.pathExists(this.tempDir)) {
                return;
            }

            const items = await fs.readdir(this.tempDir);
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000;

            for (const item of items) {
                const itemPath = path.join(this.tempDir, item);
                const stat = await fs.stat(itemPath);
                
                if (now - stat.birthtime.getTime() > maxAge) {
                    await fs.remove(itemPath);
                    console.log(chalk.gray(`🧹 Limpiado temporal antiguo: ${item}`));
                }
            }
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Error limpiando temporales: ${error.message}`));
        }
    }
}