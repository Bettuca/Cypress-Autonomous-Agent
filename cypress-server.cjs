const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const port = 3000;

app.use(express.json());

// Endpoint mejorado para múltiples tipos de tests
app.post('/run-cypress', async (req, res) => {
  console.log('📦 Recibiendo solicitud para ejecutar Cypress...');
  
  try {
    const { url, testType, spec, browser, headless } = req.body;
    
    console.log('🔧 Parámetros recibidos:', { url, testType, spec, browser, headless });
    
    // Configurar comando base
    let command = 'npx cypress run';
    
    // Agregar opciones según los parámetros
    if (headless !== false) command += ' --headless';
    if (browser) command += ` --browser ${browser}`;
    if (spec) command += ` --spec "${spec}"`;
    if (url) command += ` --env targetUrl=${url}`;
    
    // Configuraciones específicas por tipo de test
    switch(testType) {
      case 'e2e':
        command += ' --e2e';
        break;
      case 'component':
        command += ' --component';
        break;
      case 'smoke':
        command += ' --env grep="smoke"';
        break;
      case 'regression':
        command += ' --env grep="regression"';
        break;
      default:
        // Test básico por defecto
        command += ' --e2e';
    }
    
    console.log('🚀 Ejecutando comando:', command);
    
    const { stdout, stderr } = await execAsync(command);
    
    console.log('✅ Cypress ejecutado exitosamente');
    
    res.json({
      success: true,
      message: `Cypress ${testType} tests completed successfully`,
      testType: testType,
      url: url,
      command: command,
      output: stdout,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.log('❌ Error ejecutando Cypress:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Cypress tests failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para listar tipos de tests disponibles
app.get('/test-types', (req, res) => {
  res.json({
    availableTestTypes: [
      { type: 'e2e', description: 'End-to-End Tests' },
      { type: 'component', description: 'Component Tests' },
      { type: 'smoke', description: 'Smoke Tests' },
      { type: 'regression', description: 'Regression Tests' },
      { type: 'basic', description: 'Basic Tests' }
    ],
    availableBrowsers: ['chrome', 'firefox', 'edge', 'electron'],
    timestamp: new Date().toISOString()
  });
});

// Health check mejorado
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Enhanced Cypress Server',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🚀 Enhanced Cypress Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📋 Available tests: http://localhost:${port}/test-types`);
});