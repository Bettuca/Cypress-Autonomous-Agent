# Cypress Autonomous Agent

Autonomous testing agent with n8n integration for executing Cypress tests via webhooks.

## Features
- Webhook-triggered test execution
- Multiple test types (e2e, component, smoke, regression)
- n8n workflow automation
- REST API for Cypress execution

## Quick Start
```bash
# Start Cypress server
node cypress-server.cjs

# Start n8n  
n8n start
