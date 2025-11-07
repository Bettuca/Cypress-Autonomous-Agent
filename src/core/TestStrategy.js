import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export default class TestStrategy {
    constructor() {
        this.strategies = {
            react: {
                name: 'React Testing Strategy',
                priority: ['component-testing', 'state-management', 'router-testing', 'form-testing'],
                selectors: ['data-testid', 'role', 'aria-label', 'className'],
                patterns: [
                    'component-rendering',
                    'user-interactions', 
                    'state-changes',
                    'api-calls'
                ]
            },
            vue: {
                name: 'Vue Testing Strategy',
                priority: ['component-testing', 'vuex-store', 'router-testing', 'form-validation'],
                selectors: ['data-test', 'v-test', 'aria-label', 'class'],
                patterns: [
                    'component-mounting',
                    'event-handling',
                    'computed-properties',
                    'vuex-actions'
                ]
            },
            angular: {
                name: 'Angular Testing Strategy',
                priority: ['component-testing', 'service-testing', 'router-testing', 'form-testing'],
                selectors: ['data-cy', 'data-test', 'aria-label'],
                patterns: [
                    'component-creation',
                    'dependency-injection',
                    'router-navigation',
                    'http-calls'
                ]
            },
            traditional: {
                name: 'Traditional Web App Strategy',
                priority: ['navigation-testing', 'form-testing', 'content-validation', 'user-flows'],
                selectors: ['id', 'class', 'name', 'data-*'],
                patterns: [
                    'page-navigation',
                    'form-submission',
                    'content-verification',
                    'user-journey'
                ]
            }
        };
    }

    generateStrategy(analysis) {
        console.log(chalk.blue('🎯 Generando estrategia de testing...'));
        
        const baseStrategy = this.strategies[analysis.framework] || this.strategies.traditional;
        
        const customStrategy = {
            ...baseStrategy,
            projectType: analysis.projectType,
            framework: analysis.framework,
            recommendedSpecs: this.calculateRecommendedSpecs(analysis),
            focusAreas: this.determineFocusAreas(analysis),
            testPatterns: this.selectTestPatterns(analysis, baseStrategy.patterns),
            selectorStrategy: baseStrategy.selectors
        };

        console.log(chalk.green(`✅ Estrategia generada: ${customStrategy.name}`));
        return customStrategy;
    }

    calculateRecommendedSpecs(analysis) {
        // Calcular cuántos specs generar basado en la complejidad del proyecto
        const baseCount = 3;
        const structureMultiplier = Math.min(analysis.projectStructure.length / 50, 3);
        const entryPointsBonus = analysis.entryPoints.length * 0.5;
        
        return Math.max(baseCount, Math.floor(baseCount + structureMultiplier + entryPointsBonus));
    }

    determineFocusAreas(analysis) {
        const focusAreas = [];
        
        // Basado en la estructura del proyecto
        if (analysis.projectStructure.some(item => item.path.includes('form'))) {
            focusAreas.push('form-testing');
        }
        
        if (analysis.projectStructure.some(item => item.path.includes('auth'))) {
            focusAreas.push('authentication');
        }
        
        if (analysis.entryPoints.length > 1) {
            focusAreas.push('navigation-testing');
        }
        
        if (analysis.projectStructure.some(item => item.path.includes('api'))) {
            focusAreas.push('api-testing');
        }
        
        // Si no se detectan áreas específicas, usar las básicas
        if (focusAreas.length === 0) {
            focusAreas.push('smoke-testing', 'critical-flows');
        }
        
        return focusAreas;
    }

    selectTestPatterns(analysis, basePatterns) {
        const patterns = [...basePatterns];
        
        // Añadir patrones específicos basados en el análisis
        if (analysis.dependencies.axios || analysis.dependencies.fetch) {
            patterns.push('api-testing');
        }
        
        if (analysis.entryPoints.length > 1) {
            patterns.push('multi-page-testing');
        }
        
        if (analysis.projectStructure.some(item => item.path.includes('form'))) {
            patterns.push('form-validation');
        }
        
        return patterns;
    }

    generateCypressConfig(analysis, strategy) {
        console.log(chalk.blue('⚙️  Generando configuración Cypress...'));
        
        const baseConfig = {
            e2e: {
                setupNodeEvents(on, config) {
                    // implement node event listeners here
                },
            },
        };

        // Configuraciones específicas por framework
        const frameworkConfigs = {
            react: {
                viewportWidth: 1200,
                viewportHeight: 800,
                defaultCommandTimeout: 10000
            },
            vue: {
                viewportWidth: 1200,
                viewportHeight: 800,
                defaultCommandTimeout: 10000
            },
            angular: {
                viewportWidth: 1200,
                viewportHeight: 800,
                defaultCommandTimeout: 15000
            },
            traditional: {
                viewportWidth: 1280,
                viewportHeight: 720,
                defaultCommandTimeout: 8000
            }
        };

        const frameworkConfig = frameworkConfigs[analysis.framework] || frameworkConfigs.traditional;
        
        const config = {
            ...baseConfig,
            ...frameworkConfig,
            reporter: 'mochawesome',
            reporterOptions: {
                reportDir: 'cypress/reports',
                overwrite: false,
                html: false,
                json: true,
            }
        };

        return config;
    }
}