const syncManager = require('./sync');

/**
 * Lambda entry point for NetSuite to Supabase sync
 * @param {Object} event - AWS Lambda event object
 * @returns {Object} Lambda response
 */
exports.handler = async (event) => {
  try {
    console.log("Starting NetSuite → Supabase sync...");
    
    // Call the main sync logic
    const syncStats = await syncManager.runSync();
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Sync complete", 
        stats: syncStats
      }),
    };
  } catch (error) {
    console.error("Sync failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 