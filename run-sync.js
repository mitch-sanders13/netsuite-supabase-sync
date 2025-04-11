const syncManager = require('./src/sync');

async function main() {
  try {
    console.log("Starting NetSuite → Supabase sync...");
    const syncStats = await syncManager.runSync();
    console.log("Sync completed:", syncStats);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

main(); 