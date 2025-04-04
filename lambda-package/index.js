/**
 * AWS Lambda Handler for NetSuite to Supabase Sync
 * 
 * This file is the entry point for AWS Lambda.
 * It imports and re-exports the handler from the src/lambda.js file.
 */

// Import the handler from src/lambda.js
const { handler } = require('./src/lambda');

// Export the handler for AWS Lambda
exports.handler = handler; 