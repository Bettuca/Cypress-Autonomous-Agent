import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export default class ProjectAnalyzer {
    constructor() {
        this.frameworkIndicators = {
            react: ['react', 'react-dom', 'next', 'gatsby'],
            vue: ['vue', 'nuxt', 'vuex', 'vue-router'],
            angular: ['@angular/core', '@angular/common', 'rxjs'],
            nextjs: ['next', 'react'],
            nuxtjs: ['nuxt', 'vue'],
            svelte: ['svelte', 'svelte-kit'],
            traditional: ['jquery', 'bootstrap', 'popper.js']
        };
    }

    async deepAnalysis(repoPath) {
        console.log(chalk.blue('🔍 Analizando estructura del proyecto...'));
        
        const analysis = {
            projectType: 'unknown',
            framework: 'none',
            hasPackageJson: false,
            dependencies: {},
            devDependencies: {},
            dependenciesInstalled: false,
            cypressInstalled: false,
            projectStructure: [],
            entryPoints: [],
            testFiles: [],
            buildTools: [],
            executableScripts: {},
            analysisDate: new Date().toISOString()
        };

        try {
            // Análisis de package.json
            await this.analyzePackageJson(repoPath, analysis);
            
            // Análisis de dependencias instaladas
            await this.analyzeInstalledDependencies(repoPath, analysis);
            
            // Análisis de estructura de archivos
            await this.analyzeProjectStructure(repoPath, analysis);
            
            // Detectar framework y tipo
            this.detectFrameworkAndType(analysis);
            
            // Buscar puntos de entrada
            await this.findEntryPoints(repoPath, analysis);
            
            // Buscar archivos de prueba existentes
            await this.findExistingTests(repoPath, analysis);

            // Analizar herramientas de build
            await this.analyzeBuildTools(repoPath, analysis);

            console.log(chalk.green(`✅ Análisis completado: ${analysis.projectType}`));
            
            return analysis;

        } catch (error) {
            console.error(chalk.red(`❌ Error en análisis: ${error.message}`));
            return analysis;
        }
    }

    async analyzePackageJson(repoPath, analysis) {
        const packageJsonPath = path.join(repoPath, 'package.json');
        
        if (await fs.pathExists(packageJsonPath)) {
            try {
                const packageJson = await fs.readJson(packageJsonPath);
                analysis.hasPackageJson = true;
                analysis.dependencies = packageJson.dependencies || {};
                analysis.devDependencies = packageJson.devDependencies || {};
                analysis.scripts = packageJson.scripts || {};
                analysis.packageJson = {
                    name: packageJson.name,
                    version: packageJson.version,
                    description: packageJson.description,
                    main: packageJson.main,
                    author: packageJson.author
                };
                
            } catch (error) {
                console.warn(chalk.yellow('⚠️  No se pudo leer package.json'));
            }
        }
    }

    async analyzeInstalledDependencies(repoPath, analysis) {
        try {
            const nodeModulesPath = path.join(repoPath, 'node_modules');
            
            if (!await fs.pathExists(nodeModulesPath)) {
                analysis.dependenciesInstalled = false;
                return;
            }

            analysis.dependenciesInstalled = true;
            
            // Verificar Cypress instalado
            const cypressPath = path.join(nodeModulesPath, 'cypress');
            analysis.cypressInstalled = await fs.pathExists(cypressPath);
            
            // Analizar scripts de package.json con dependencias reales
            if (analysis.scripts) {
                analysis.executableScripts = this.analyzeExecutableScripts(analysis.scripts);
            }

            // Detectar testing frameworks instalados
            analysis.testingFrameworks = this.detectTestingFrameworks(analysis.dependencies, analysis.devDependencies);

        } catch (error) {
            analysis.dependenciesInstalled = false;
            console.warn(chalk.yellow('⚠️  Error analizando dependencias instaladas'));
        }
    }

    analyzeExecutableScripts(scripts) {
        const executable = {};
        
        for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
            executable[scriptName] = {
                command: scriptCommand,
                canExecute: this.canExecuteScript(scriptCommand),
                type: this.getScriptType(scriptName, scriptCommand)
            };
        }
        
        return executable;
    }

    canExecuteScript(command) {
        const executablePatterns = [
            'start', 'dev', 'serve', 'build', 'test', 'cypress', 'lint', 
            'typecheck', 'storybook', 'compile', 'deploy'
        ];
        
        return executablePatterns.some(pattern => 
            command.toLowerCase().includes(pattern)
        );
    }

    getScriptType(scriptName, command) {
        if (scriptName.includes('test') || command.includes('test')) return 'test';
        if (scriptName.includes('build') || command.includes('build')) return 'build';
        if (scriptName.includes('start') || command.includes('start')) return 'start';
        if (scriptName.includes('dev') || command.includes('dev')) return 'dev';
        if (scriptName.includes('cypress') || command.includes('cypress')) return 'cypress';
        if (scriptName.includes('lint')) return 'lint';
        return 'other';
    }

    detectTestingFrameworks(dependencies, devDependencies) {
        const allDeps = { ...dependencies, ...devDependencies };
        const frameworks = [];

        const testingLibs = {
            'cypress': 'Cypress',
            'jest': 'Jest', 
            'mocha': 'Mocha',
            'jasmine': 'Jasmine',
            'vitest': 'Vitest',
            '@testing-library/react': 'Testing Library React',
            '@testing-library/vue': 'Testing Library Vue',
            '@testing-library/angular': 'Testing Library Angular',
            'enzyme': 'Enzyme',
            'puppeteer': 'Puppeteer',
            'playwright': 'Playwright'
        };

        for (const [lib, name] of Object.entries(testingLibs)) {
            if (allDeps[lib]) {
                frameworks.push(name);
            }
        }

        return frameworks;
    }

    async analyzeProjectStructure(repoPath, analysis, currentPath = '', depth = 0) {
        if (depth > 3) return;
        
        try {
            const fullPath = path.join(repoPath, currentPath);
            const items = await fs.readdir(fullPath);
            
            for (const item of items) {
                if (item.startsWith('.') || item === 'node_modules' || item === '.git') continue;
                
                const itemPath = path.join(currentPath, item);
                const fullItemPath = path.join(repoPath, itemPath);
                
                try {
                    const stat = await fs.stat(fullItemPath);
                    
                    if (stat.isDirectory()) {
                        analysis.projectStructure.push({
                            type: 'directory',
                            path: itemPath,
                            depth,
                            important: this.isImportantDirectory(item)
                        });
                        
                        if (depth < 2 || this.isImportantDirectory(item)) {
                            await this.analyzeProjectStructure(repoPath, analysis, itemPath, depth + 1);
                        }
                    } else if (stat.isFile() && depth <= 2) {
                        analysis.projectStructure.push({
                            type: 'file',
                            path: itemPath,
                            extension: path.extname(item),
                            size: stat.size,
                            important: this.isImportantFile(item)
                        });
                    }
                } catch (error) {
                    // Ignorar errores de permisos
                }
            }
        } catch (error) {
            // Ignorar errores de directorio
        }
    }

    isImportantDirectory(dirName) {
        const importantDirs = ['src', 'app', 'components', 'pages', 'public', 'tests', 'cypress', 'e2e', 'spec', 'features'];
        return importantDirs.includes(dirName);
    }

    isImportantFile(fileName) {
        const importantFiles = ['package.json', 'README.md', 'index.html', 'app.js', 'main.js', 'index.js', 'App.jsx', 'App.tsx'];
        const importantExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte'];
        
        return importantFiles.includes(fileName) || 
               importantExtensions.some(ext => fileName.endsWith(ext));
    }

    detectFrameworkAndType(analysis) {
        const { dependencies, devDependencies } = analysis;
        const allDeps = { ...dependencies, ...devDependencies };

        // Detectar framework principal
        for (const [framework, indicators] of Object.entries(this.frameworkIndicators)) {
            if (indicators.some(indicator => allDeps[indicator])) {
                analysis.framework = framework;
                break;
            }
        }

        if (analysis.framework === 'none') {
            analysis.framework = 'traditional';
        }

        // Determinar tipo de proyecto
        analysis.projectType = this.determineProjectType(analysis, allDeps);
    }

    determineProjectType(analysis, allDeps) {
        const structure = analysis.projectStructure.map(item => item.path);
        
        switch (analysis.framework) {
            case 'react':
                if (allDeps.next) return 'Next.js Application';
                if (allDeps.gatsby) return 'Gatsby Application';
                if (structure.some(s => s.includes('pages/') || s.includes('app/'))) return 'React SPA';
                return 'React Application';
                
            case 'vue':
                if (allDeps.nuxt) return 'Nuxt.js Application';
                if (structure.some(s => s.includes('pages/') || s.includes('views/'))) return 'Vue SPA';
                return 'Vue Application';
                
            case 'angular':
                return 'Angular Application';
                
            case 'nextjs':
                return 'Next.js SSR Application';
                
            case 'nuxtjs':
                return 'Nuxt.js SSR Application';
                
            case 'svelte':
                if (allDeps['svelte-kit']) return 'SvelteKit Application';
                return 'Svelte Application';
                
            default:
                if (structure.some(s => s.includes('index.html'))) return 'Traditional Web Application';
                if (structure.some(s => s.includes('.php'))) return 'PHP Application';
                return 'Unknown Project Type';
        }
    }

    async findEntryPoints(repoPath, analysis) {
        const possibleEntries = [
            'index.html', 'src/index.js', 'src/main.js', 'src/index.ts',
            'public/index.html', 'app/index.html', 'src/App.js', 'src/App.tsx',
            'index.php', 'app.php', 'main.js', 'app.js', 'App.jsx', 'App.tsx',
            'src/main.ts', 'src/main.tsx'
        ];
        
        for (const entry of possibleEntries) {
            if (await fs.pathExists(path.join(repoPath, entry))) {
                analysis.entryPoints.push({
                    path: entry,
                    exists: true
                });
            }
        }
    }

    async findExistingTests(repoPath, analysis) {
        const testPatterns = [
            '**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts',
            'cypress/e2e/**/*.js', 'cypress/e2e/**/*.ts',
            'tests/**/*.js', 'test/**/*.js', 'e2e/**/*.js',
            '**/__tests__/**/*.js', '**/__tests__/**/*.ts'
        ];
        
        // Buscar archivos de prueba
        for (const pattern of testPatterns) {
            try {
                const files = await this.globFind(repoPath, pattern);
                files.forEach(file => {
                    analysis.testFiles.push({
                        path: file,
                        type: this.getTestType(file),
                        framework: this.getTestFramework(file)
                    });
                });
            } catch (error) {
                // Pattern no encontrado, continuar
            }
        }
    }

    async globFind(repoPath, pattern) {
        const results = [];
        
        async function search(dir, patternParts) {
            try {
                const items = await fs.readdir(dir);
                for (const item of items) {
                    if (item === 'node_modules' || item === '.git') continue;
                    
                    const fullPath = path.join(dir, item);
                    const stat = await fs.stat(fullPath);
                    
                    if (stat.isDirectory()) {
                        await search(fullPath, patternParts);
                    } else if (stat.isFile()) {
                        const relativePath = path.relative(repoPath, fullPath);
                        
                        // Patrón simple de matching
                        if (pattern.includes('**')) {
                            const basePattern = pattern.replace('**/', '');
                            if (relativePath.includes(basePattern.replace('*', ''))) {
                                results.push(relativePath);
                            }
                        } else if (item.includes(pattern.replace('*', ''))) {
                            results.push(relativePath);
                        }
                    }
                }
            } catch (error) {
                // Ignorar errores
            }
        }
        
        await search(repoPath, pattern);
        return results;
    }

    getTestType(filePath) {
        if (filePath.includes('cypress')) return 'e2e';
        if (filePath.includes('.test.') || filePath.includes('.spec.')) return 'unit';
        if (filePath.includes('e2e')) return 'e2e';
        if (filePath.includes('__tests__')) return 'unit';
        return 'unknown';
    }

    getTestFramework(filePath) {
        if (filePath.includes('cypress')) return 'Cypress';
        if (filePath.includes('jest')) return 'Jest';
        if (filePath.includes('mocha')) return 'Mocha';
        if (filePath.includes('vitest')) return 'Vitest';
        return 'Unknown';
    }

    async analyzeBuildTools(repoPath, analysis) {
        const buildConfigs = {
            'webpack.config.js': 'Webpack',
            'vite.config.js': 'Vite', 
            'vite.config.ts': 'Vite',
            'rollup.config.js': 'Rollup',
            'parcel.config.js': 'Parcel',
            'angular.json': 'Angular CLI',
            'vue.config.js': 'Vue CLI',
            'next.config.js': 'Next.js',
            'nuxt.config.js': 'Nuxt.js',
            'svelte.config.js': 'Svelte'
        };

        analysis.buildTools = [];

        for (const [configFile, toolName] of Object.entries(buildConfigs)) {
            if (await fs.pathExists(path.join(repoPath, configFile))) {
                analysis.buildTools.push({
                    name: toolName,
                    configFile: configFile
                });
            }
        }

        // También verificar en package.json scripts
        if (analysis.scripts) {
            const buildScripts = Object.entries(analysis.scripts)
                .filter(([name, cmd]) => 
                    name.includes('build') || 
                    cmd.includes('webpack') || 
                    cmd.includes('vite') || 
                    cmd.includes('rollup')
                )
                .map(([name, cmd]) => ({ name, command: cmd }));

            if (buildScripts.length > 0) {
                analysis.buildScripts = buildScripts;
            }
        }
    }

    // Método para análisis rápido (sin dependencias instaladas)
    async quickAnalysis(repoPath) {
        const analysis = {
            projectType: 'unknown',
            framework: 'none',
            hasPackageJson: false,
            dependencies: {},
            devDependencies: {},
            dependenciesInstalled: false,
            projectStructure: [],
            entryPoints: [],
            analysisDate: new Date().toISOString()
        };

        try {
            await this.analyzePackageJson(repoPath, analysis);
            await this.analyzeProjectStructure(repoPath, analysis, '', 2); // Profundidad limitada
            this.detectFrameworkAndType(analysis);
            await this.findEntryPoints(repoPath, analysis);

            return analysis;
        } catch (error) {
            console.error(chalk.red(`❌ Error en análisis rápido: ${error.message}`));
            return analysis;
        }
    }
}