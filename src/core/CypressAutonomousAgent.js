import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import GitHubHandler from './GitHubHandler.js';
import ProjectAnalyzer from './ProjectAnalyzer.js';
import TestStrategy from './TestStrategy.js';
import TestSpecGenerator from '../generators/TestSpecGenerator.js';

class CypressAutonomousAgent {
    constructor() {
        this.githubHandler = new GitHubHandler();
        this.projectAnalyzer = new ProjectAnalyzer();
        this.testStrategy = new TestStrategy();
        this.testGenerator = new TestSpecGenerator();
        this.tempDir = path.join(process.cwd(), 'temp-repos');
        this.outputDir = path.join(process.cwd(), 'generated-specs');
        
        // Asegurar que el directorio de salida existe
        this.ensureOutputDir();
    }

    async ensureOutputDir() {
        await fs.ensureDir(this.outputDir);
    }

    async processRepository(githubUrl) {
        let tempPath = null;
        
        try {
            console.log(chalk.cyan(`\n🔍 Procesando repositorio: ${githubUrl}`));
            
            // 1. Clonar repositorio REAL con instalación de dependencias
            const cloneResult = await this.githubHandler.cloneAndAnalyze(githubUrl);
            if (!cloneResult.success) {
                throw new Error(`Error clonando: ${cloneResult.error}`);
            }
            
            tempPath = cloneResult.repoPath;

            // 2. Análisis REAL del proyecto con dependencias instaladas
            const analysis = await this.projectAnalyzer.deepAnalysis(cloneResult.repoPath);
            
            // 3. Verificar configuración Cypress
            const cypressCheck = await this.githubHandler.checkCypressSetup(cloneResult.repoPath);
            
            // 4. Generar estrategia de testing
            const strategy = await this.testStrategy.generateStrategy(analysis);
            
            // 5. Generar specs de prueba
            const generatedSpecs = await this.testGenerator.generateTestSpecs(analysis, strategy);
            
            // 6. Guardar specs en disco
            const specsSaved = await this.testGenerator.saveSpecsToDisk(generatedSpecs, this.outputDir);
            
            // 7. Generar resumen
            const specSummary = this.testGenerator.generateSpecSummary(generatedSpecs, strategy);
            
            return {
                success: true,
                repository: githubUrl,
                analysis: analysis,
                cypressCheck: cypressCheck,
                strategy: strategy,
                generatedSpecs: generatedSpecs,
                specSummary: specSummary,
                specsSaved: specsSaved,
                outputPath: this.outputDir,
                tempPath: tempPath,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(chalk.red(`❌ Error procesando repositorio: ${error.message}`));
            
            // Limpiar en caso de error
            if (tempPath) {
                await this.cleanup(tempPath);
            }
            
            return {
                success: false,
                error: error.message,
                repository: githubUrl
            };
        }
    }

    async cleanup(tempPath) {
        try {
            if (tempPath && tempPath.startsWith(this.tempDir)) {
                await fs.remove(tempPath);
                console.log(chalk.gray(`🧹 Limpiado: ${path.basename(tempPath)}`));
            }
        } catch (error) {
            console.warn(chalk.yellow(`⚠️  Error limpiando: ${error.message}`));
        }
    }

    // Método para obtener el estado del agente
    getStatus() {
        return {
            status: 'active',
            outputDir: this.outputDir,
            tempDir: this.tempDir,
            timestamp: new Date().toISOString()
        };
    }
}

export default CypressAutonomousAgent;