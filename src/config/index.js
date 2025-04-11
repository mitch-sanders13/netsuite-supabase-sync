// Load environment variables if not in Lambda environment
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  require('dotenv').config();
}

const fs = require('fs');
const path = require('path');

// Required environment variables
const requiredEnvVars = [
  'NS_ACCOUNT_ID',
  'NS_CONSUMER_KEY',
  'NS_CONSUMER_SECRET',
  'NS_TOKEN_ID',
  'NS_TOKEN_SECRET',
  'NS_SCRIPT_ID',
  'NS_DEPLOY_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

// Validate environment variables
function validateEnvVars() {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  // Log environment variables for debug (mask sensitive values)
  console.log('Environment variables loaded:');
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    const isSecret = varName.includes('SECRET') || varName.includes('KEY');
    console.log(`- ${varName}: ${isSecret ? value.substring(0, 4) + '...' : value}`);
  });
}

// Load and validate mappings
function loadMappings() {
  const mappingsPath = path.join(__dirname, '../mappings/searchToTable.json');
  
  try {
    const mappingsFile = fs.readFileSync(mappingsPath, 'utf8');
    const mappings = JSON.parse(mappingsFile);
    
    // Validate mappings structure
    if (!mappings.mappings || !Array.isArray(mappings.mappings)) {
      throw new Error('Invalid mappings file: missing or invalid mappings array');
    }
    
    // Validate each mapping
    mappings.mappings.forEach((mapping, index) => {
      const requiredFields = ['searchId', 'type', 'name', 'table', 'method'];
      const missingFields = requiredFields.filter(field => !mapping[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Invalid mapping at index ${index}: missing required fields ${missingFields.join(', ')}`);
      }
    });
    
    return mappings.mappings;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Mappings file not found at ${mappingsPath}`);
    }
    throw error;
  }
}

// Initialize configuration
function init() {
  // Validate environment variables
  validateEnvVars();
  
  // Load and validate mappings
  const mappings = loadMappings();
  
  console.log(`Loaded ${mappings.length} mappings from configuration`);
  
  return {
    // We don't create config objects anymore - just expose the mappings
    mappings: mappings,
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '21600000', 10) // Default to 6 hours
  };
}

module.exports = init(); 