import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export default class TestSpecGenerator {
    constructor() {
        this.specTemplates = {
            basic: `describe('Template Básico', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('debería cargar la página principal', () => {
    cy.contains('Bienvenido').should('be.visible')
  })

  it('debería tener el título correcto', () => {
    cy.title().should('not.be.empty')
  })
})`,

            navigation: `describe('Navegación', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('debería navegar entre páginas', () => {
    cy.get('nav a').first().click()
    cy.url().should('include', '/nueva-pagina')
  })

  it('debería mantener el estado de navegación', () => {
    // Test de navegación compleja
  })
})`,

            forms: `describe('Formularios', () => {
  beforeEach(() => {
    cy.visit('/formulario')
  })

  it('debería enviar el formulario correctamente', () => {
    cy.get('#nombre').type('Usuario de Prueba')
    cy.get('#email').type('test@example.com')
    cy.get('form').submit()
    cy.contains('Éxito').should('be.visible')
  })

  it('debería mostrar errores de validación', () => {
    cy.get('form').submit()
    cy.contains('Campo requerido').should('be.visible')
  })
})`,

            api: `describe('API Calls', () => {
  it('debería hacer llamadas API exitosas', () => {
    cy.intercept('GET', '/api/data').as('getData')
    cy.visit('/')
    cy.wait('@getData').its('response.statusCode').should('eq', 200)
  })

  it('debería manejar errores de API', () => {
    cy.intercept('GET', '/api/data', { statusCode: 500 }).as('serverError')
    cy.visit('/')
    cy.wait('@serverError')
    cy.contains('Error del servidor').should('be.visible')
  })
})`
        };
    }

    generateTestSpecs(analysis, strategy) {
        console.log(chalk.blue('📝 Generando specs de prueba...'));
        
        const specs = [];
        const specCount = strategy.recommendedSpecs;
        
        for (let i = 0; i < specCount; i++) {
            const specType = this.selectSpecType(strategy, i);
            const specContent = this.generateSpecContent(specType, analysis, i);
            
            specs.push({
                name: `generated-spec-${i + 1}.cy.js`,
                type: specType,
                content: specContent,
                path: `cypress/e2e/generated-spec-${i + 1}.cy.js`
            });
        }
        
        console.log(chalk.green(`✅ ${specs.length} specs generados`));
        return specs;
    }

    selectSpecType(strategy, index) {
        const availableTypes = strategy.testPatterns;
        const typeIndex = index % availableTypes.length;
        return availableTypes[typeIndex];
    }

    generateSpecContent(specType, analysis, index) {
        const baseTemplate = this.getBaseTemplate(specType);
        
        // Personalizar el template basado en el tipo de proyecto
        const customizedTemplate = this.customizeTemplate(baseTemplate, analysis, specType, index);
        
        return customizedTemplate;
    }

    getBaseTemplate(specType) {
        const templateMap = {
            'component-testing': this.specTemplates.basic,
            'navigation-testing': this.specTemplates.navigation,
            'form-testing': this.specTemplates.forms,
            'api-testing': this.specTemplates.api,
            'user-interactions': this.specTemplates.basic,
            'state-changes': this.specTemplates.basic,
            'default': this.specTemplates.basic
        };
        
        return templateMap[specType] || templateMap.default;
    }

    customizeTemplate(template, analysis, specType, index) {
        let customized = template;
        
        // Personalizar basado en el framework
        if (analysis.framework === 'react') {
            customized = customized.replace('Bienvenido', 'React App');
        } else if (analysis.framework === 'vue') {
            customized = customized.replace('Bienvenido', 'Vue App');
        } else if (analysis.framework === 'angular') {
            customized = customized.replace('Bienvenido', 'Angular App');
        }
        
        // Añadir comentarios específicos
        const comment = `// Spec generado automáticamente por Cypress Autonomous Agent
// Tipo: ${specType}
// Framework: ${analysis.framework}
// Proyecto: ${analysis.projectType}
// Fecha: ${new Date().toISOString()}

`;
        
        return comment + customized;
    }

    async saveSpecsToDisk(specs, outputPath) {
        console.log(chalk.blue('💾 Guardando specs en disco...'));
        
        try {
            // Crear directorio si no existe
            await fs.ensureDir(outputPath);
            
            // Guardar cada spec
            for (const spec of specs) {
                const specPath = path.join(outputPath, spec.name);
                await fs.writeFile(specPath, spec.content);
                console.log(chalk.gray(`   📄 ${spec.name}`));
            }
            
            console.log(chalk.green(`✅ ${specs.length} specs guardados en: ${outputPath}`));
            return true;
            
        } catch (error) {
            console.error(chalk.red(`❌ Error guardando specs: ${error.message}`));
            return false;
        }
    }

    generateSpecSummary(specs, strategy) {
        const summary = {
            totalSpecs: specs.length,
            specTypes: {},
            estimatedExecutionTime: specs.length * 30, // 30 segundos por spec en promedio
            focusAreas: strategy.focusAreas
        };
        
        // Contar tipos de specs
        specs.forEach(spec => {
            summary.specTypes[spec.type] = (summary.specTypes[spec.type] || 0) + 1;
        });
        
        return summary;
    }
}