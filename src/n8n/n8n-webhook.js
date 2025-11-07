import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import CypressAutonomousAgent from '../core/CypressAutonomousAgent.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Instancia del agente
const agent = new CypressAutonomousAgent();

// Endpoint principal para n8n
app.post('/webhook/cypress-agent', async (req, res) => {
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(chalk.blue(`\n🔄 [${requestId}] Solicitud recibida de n8n`));
    
    try {
        const { githubUrl, projectName, triggerType = 'manual' } = req.body;
        
        // Validar entrada
        if (!githubUrl) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere githubUrl',
                requestId
            });
        }

        console.log(chalk.cyan(`📦 [${requestId}] Procesando: ${githubUrl}`));
        
        // Procesar el repositorio
        const result = await agent.processRepository(githubUrl);
        
        const processingTime = Date.now() - startTime;
        
        // Preparar respuesta para n8n
        const n8nResponse = {
            success: result.success,
            requestId,
            processingTime: `${processingTime}ms`,
            timestamp: new Date().toISOString(),
            input: {
                githubUrl,
                projectName,
                triggerType
            },
            output: result.success ? {
                projectAnalysis: {
                    type: result.analysis.projectType,
                    framework: result.analysis.framework,
                    hasCypress: result.cypressCheck.hasCypressDependency
                },
                generatedSpecs: {
                    total: result.specSummary.totalSpecs,
                    types: result.specSummary.specTypes,
                    estimatedTime: result.specSummary.estimatedExecutionTime
                },
                outputPath: result.outputPath,
                files: await getGeneratedFiles(result.outputPath),
                summary: `Generados ${result.specSummary.totalSpecs} specs para ${result.analysis.projectType}`
            } : {
                error: result.error
            }
        };

        console.log(chalk.green(`✅ [${requestId}] Procesamiento completado en ${processingTime}ms`));
        
        res.json(n8nResponse);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(chalk.red(`❌ [${requestId}] Error: ${error.message}`));
        
        res.status(500).json({
            success: false,
            error: error.message,
            requestId,
            processingTime: `${processingTime}ms`
        });
    }
});

// Endpoint de estado
app.get('/webhook/status', (req, res) => {
    res.json({
        status: 'active',
        service: 'Cypress Autonomous Agent',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Endpoint para listar specs generados
app.get('/webhook/generated-specs', async (req, res) => {
    try {
        const specsPath = path.join(process.cwd(), 'generated-specs');
        const files = await getGeneratedFiles(specsPath);
        
        res.json({
            success: true,
            totalFiles: files.length,
            files: files
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Función auxiliar para obtener archivos generados
async function getGeneratedFiles(outputPath) {
    try {
        if (!await fs.pathExists(outputPath)) {
            return [];
        }
        
        const files = await fs.readdir(outputPath);
        const fileDetails = [];
        
        for (const file of files) {
            if (file.endsWith('.cy.js')) {
                const filePath = path.join(outputPath, file);
                const stats = await fs.stat(filePath);
                const content = await fs.readFile(filePath, 'utf8');
                
                fileDetails.push({
                    name: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.birthtime,
                    lines: content.split('\n').length
                });
            }
        }
        
        return fileDetails;
    } catch (error) {
        console.error('Error leyendo archivos:', error);
        return [];
    }
}

// Iniciar servidor
app.listen(PORT, () => {
    console.log(chalk.green.bold(`\n🚀 Servidor n8n-webhook iniciado en puerto ${PORT}`));
    console.log(chalk.blue(`📡 Endpoints disponibles:`));
    console.log(chalk.blue(`   POST http://localhost:${PORT}/webhook/cypress-agent`));
    console.log(chalk.blue(`   GET  http://localhost:${PORT}/webhook/status`));
    console.log(chalk.blue(`   GET  http://localhost:${PORT}/webhook/generated-specs`));
    console.log(chalk.green(`\n✅ Listo para recibir solicitudes de n8n!`));
});

export default app;