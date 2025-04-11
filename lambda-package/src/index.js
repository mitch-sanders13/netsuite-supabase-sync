const syncManager = require('./sync');
const config = require('./config');

/**
 * Runs the sync process and handles any uncaught errors
 * @returns {Promise<void>}
 */
async function runSyncProcess() {
  try {
    await syncManager.runSync();
    
    // If run with --once flag, exit after completion
    if (process.argv.includes('--once')) {
      console.log('Sync completed. Exiting...');
      process.exit(0);
    }
  } catch (error) {
    console.error('Fatal error in sync process:', error);
    process.exit(1);
  }
}

/**
 * Schedules the sync process to run at regular intervals
 */
function scheduleSync() {
  // Default interval is 6 hours (21600000 ms)
  const interval = process.env.SYNC_INTERVAL || 21600000;
  
  // Run immediately on startup
  console.log('Running initial sync...');
  runSyncProcess();

  // If not running with --once flag, schedule subsequent runs
  if (!process.argv.includes('--once')) {
    // Schedule subsequent runs
    setInterval(() => {
      console.log(`Running scheduled sync (every ${interval / 1000} seconds)...`);
      runSyncProcess();
    }, interval);

    console.log(`Scheduled sync to run every ${interval / 1000} seconds`);
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal. Shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
console.log('Starting NetSuite to Supabase Sync Application');
console.log('=============================================');
console.log('Configuration:');
console.log(`- Total mappings: ${config.mappings.length}`);
console.log('=============================================\n');

scheduleSync(); 