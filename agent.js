import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import GitHubHandler from './src/core/GitHubHandler.js';
import ProjectAnalyzer from './src/core/ProjectAnalyzer.js';
import TestStrategy from './src/core/TestStrategy.js';
import TestSpecGenerator from './src/generators/TestSpecGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CypressAutonomousAgent {
    constructor() {
        this.githubHandler = new GitHubHandler();
        this.projectAnalyzer = new ProjectAnalyzer();
        this.testStrategy = new TestStrategy();
        this.testGenerator = new TestSpecGenerator();
        this.tempDir = path.join(process.cwd(), 'temp-repos');
        this.outputDir = path.join(process.cwd(), 'generated-specs');
        
        console.log(chalk.green.bold('🤖 Agente Cypress Autónomo - VERSIÓN COMPLETA'));
        console.log(chalk.blue(`📁 Directorio temporal: ${this.tempDir}`));
        console.log(chalk.blue(`📁 Salida de specs: ${this.outputDir}`));
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
            
            // 8. Mostrar resultados detallados
            this.displayAnalysisResults(analysis, cloneResult.repoName, cypressCheck, strategy, specSummary);
            
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

    displayAnalysisResults(analysis, repoName, cypressCheck, strategy, specSummary) {
        console.log(chalk.green.bold('\n📊 ANÁLISIS COMPLETO DEL PROYECTO:'));
        console.log(chalk.blue('┌─────────────────────────────────────────────'));
        console.log(chalk.blue('│ 📦 INFORMACIÓN DEL PROYECTO'));
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(`│ Nombre: ${repoName}`);
        console.log(`│ Tipo: ${chalk.yellow(analysis.projectType)}`);
        console.log(`│ Framework: ${chalk.yellow(analysis.framework)}`);
        console.log(`│ Package.json: ${analysis.hasPackageJson ? '✅ Sí' : '❌ No'}`);
        console.log(`│ Dependencias: ${analysis.dependenciesInstalled ? '✅ Instaladas' : '❌ No instaladas'}`);
        console.log(`│ Cypress: ${analysis.cypressInstalled ? '✅ Detectado' : '❌ No detectado'}`);
        
        if (analysis.packageJson && analysis.packageJson.name) {
            console.log(`│   - Nombre: ${analysis.packageJson.name}`);
            console.log(`│   - Versión: ${analysis.packageJson.version || 'N/A'}`);
        }

        // Información de Cypress
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(chalk.blue('│ 🧪 CONFIGURACIÓN CYPRESS'));
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(`│ Dependencia: ${cypressCheck.hasCypressDependency ? '✅ Sí' : '❌ No'}`);
        console.log(`│ Archivo config: ${cypressCheck.hasCypressConfig ? '✅ ' + cypressCheck.cypressConfigPath : '❌ No'}`);
        
        // Estrategia de Testing
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(chalk.blue('│ 🎯 ESTRATEGIA DE TESTING'));
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(`│ Estrategia: ${strategy.name}`);
        console.log(`│ Especs recomendados: ${strategy.recommendedSpecs}`);
        console.log(`│ Áreas de enfoque: ${strategy.focusAreas.join(', ')}`);
        console.log(`│ Patrones: ${strategy.testPatterns.slice(0, 3).join(', ')}...`);
        
        // Resumen de Specs Generados
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(chalk.blue('│ 📝 SPECS GENERADOS'));
        console.log(chalk.blue('├─────────────────────────────────────────────'));
        console.log(`│ Total generados: ${specSummary.totalSpecs}`);
        console.log(`│ Tiempo estimado: ${specSummary.estimatedExecutionTime} segundos`);
        Object.entries(specSummary.specTypes).forEach(([type, count]) => {
            console.log(`│   ${type}: ${count} specs`);
        });

        // Scripts ejecutables
        if (analysis.executableScripts && Object.keys(analysis.executableScripts).length > 0) {
            console.log(chalk.blue('├─────────────────────────────────────────────'));
            console.log(chalk.blue('│ 🚀 SCRIPTS EJECUTABLES'));
            console.log(chalk.blue('├─────────────────────────────────────────────'));
            Object.entries(analysis.executableScripts)
                .filter(([script, info]) => info.canExecute)
                .slice(0, 4)
                .forEach(([script, info]) => {
                    const emoji = this.getScriptEmoji(info.type);
                    console.log(`│ ${emoji} ${script}: ${chalk.gray(info.command)}`);
                });
        }

        console.log(chalk.blue('└─────────────────────────────────────────────'));
        
        // Resumen final
        console.log(chalk.green.bold('\n🎯 RESUMEN EJECUTIVO:'));
        console.log(`   📊 Proyecto: ${analysis.projectType}`);
        console.log(`   🏗️  Framework: ${analysis.framework}`);
        console.log(`   🧪 Cypress: ${cypressCheck.hasCypressDependency ? '✅ Configurado' : '❌ Por configurar'}`);
        console.log(`   📝 Specs generados: ${specSummary.totalSpecs}`);
        console.log(`   🎯 Estrategia: ${strategy.name}`);
        console.log(`   💾 Guardado en: ${this.outputDir}`);
    }

    getScriptEmoji(scriptType) {
        const emojis = {
            'test': '🧪',
            'build': '🏗️',
            'start': '🚀', 
            'dev': '💻',
            'cypress': '⏱️',
            'lint': '📝',
            'other': '⚡'
        };
        return emojis[scriptType] || '⚡';
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

    // Método para uso con n8n - devuelve datos estructurados
    async processForN8N(githubUrl, options = {}) {
        const result = await this.processRepository(githubUrl);
        
        // Formatear respuesta para n8n
        if (result.success) {
            return {
                success: true,
                data: {
                    project: {
                        name: result.analysis.packageJson?.name || 'Unknown',
                        type: result.analysis.projectType,
                        framework: result.analysis.framework,
                        hasCypress: result.cypressCheck.hasCypressDependency
                    },
                    specs: {
                        total: result.specSummary.totalSpecs,
                        types: result.specSummary.specTypes,
                        estimatedTime: result.specSummary.estimatedExecutionTime,
                        outputPath: result.outputPath
                    },
                    strategy: result.strategy.name,
                    generatedFiles: result.generatedSpecs.map(spec => ({
                        name: spec.name,
                        type: spec.type,
                        path: spec.path
                    }))
                },
                summary: `Generados ${result.specSummary.totalSpecs} specs Cypress para ${result.analysis.projectType}`,
                timestamp: result.timestamp
            };
        } else {
            return {
                success: false,
                error: result.error,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Función para modo standalone (pruebas directas)
async function testStandaloneMode() {
    const agent = new CypressAutonomousAgent();
    
    // Crear directorio de salida
    await fs.ensureDir(agent.outputDir);
    
    // Repositorio de prueba
    const testRepo = 'https://github.com/cypress-io/cypress-example-kitchensink';
    
    console.log(chalk.yellow.bold('\n🧪 MODO STANDALONE - PRUEBA DIRECTA'));
    console.log(chalk.yellow('📍 Repositorio: Cypress Example Kitchensink\n'));
    
    console.log(chalk.yellow(`🔬 Analizando y generando pruebas: ${testRepo}`));
    
    const result = await agent.processRepository(testRepo);
    
    if (result.success) {
        console.log(chalk.green.bold(`\n✅ GENERACIÓN DE PRUEBAS EXITOSA!`));
        console.log(chalk.blue(`📁 Los specs generados están en: ${result.outputPath}`));
        
        // Mostrar archivos generados
        try {
            const files = await fs.readdir(result.outputPath);
            console.log(chalk.blue('📄 Archivos generados:'));
            files.forEach(file => {
                console.log(chalk.gray(`   - ${file}`));
            });
        } catch (error) {
            console.log(chalk.yellow('⚠️  No se pudieron listar los archivos generados'));
        }
        
        // Limpiar después del análisis
        await agent.cleanup(result.tempPath);
    } else {
        console.log(chalk.red.bold(`\n❌ ERROR: ${result.error}`));
    }
    
    console.log(chalk.green.bold('\n🎯 PRUEBA COMPLETADA - AGENTE FUNCIONANDO!'));
}

// Función para modo n8n (servidor webhook)
async function startN8NMode() {
    console.log(chalk.green.bold('\n🚀 INICIANDO MODO n8n INTEGRATION...'));
    
    try {
        // Importación dinámica para evitar conflictos
        const { default: n8nWebhook } = await import('./src/n8n/n8n-webhook.js');
        console.log(chalk.green('✅ Servidor n8n-webhook cargado correctamente'));
    } catch (error) {
        console.log(chalk.yellow('📝 Para usar el modo n8n, ejecuta: npm run n8n'));
        console.log(chalk.yellow('📝 O instala las dependencias: npm install express cors'));
    }
}

// Determinar modo de ejecución
async function main() {
    const args = process.argv.slice(2);
    const mode = args[0] || 'standalone';
    
    if (mode === 'n8n') {
        await startN8NMode();
    } else if (mode === 'standalone') {
        await testStandaloneMode();
    } else if (mode === 'help') {
        console.log(chalk.blue.bold(`
🤖 CYPRESS AUTONOMOUS AGENT - MODOS DE USO:

1. 🧪 Modo Standalone (default):
   node agent.js standalone
   node agent.js

2. 🔌 Modo n8n Integration:
   node agent.js n8n
   npm run n8n

3. 🚀 Modo Webhook (servidor):
   npm run n8n

4. 📋 Ayuda:
   node agent.js help

📍 Ejemplos de uso:
   - Probar con repositorio específico: Modifica testRepo en el código
   - Integrar con n8n: Usa el endpoint /webhook/cypress-agent
   - Ver specs generados: Revisa la carpeta generated-specs/
        `));
    } else {
        console.log(chalk.yellow(`⚠️  Modo desconocido: ${mode}`));
        console.log(chalk.yellow('💡 Usa: node agent.js help para ver opciones disponibles'));
    }
}

// Limpieza de temporales antiguos al iniciar
async function cleanupOldRepos() {
    const handler = new GitHubHandler();
    await handler.cleanupOldRepos(1);
}

// Ejecutar aplicación
cleanupOldRepos()
    .then(() => main())
    .catch(error => {
        console.error('Error durante la ejecución:', error);
    });

export default CypressAutonomousAgent;