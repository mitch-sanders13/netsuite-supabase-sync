const syncManager = require('./sync');
const config = require('./config');
const netsuiteClient = require('./netsuite/client');
const supabaseClient = require('./supabase/client');

async function testCashSalesSync() {
  console.log('=== Testing Cash Sales Sync ===');
  
  try {
    // Find the cash_sales mapping
    const cashSalesMapping = config.mappings.find(mapping => mapping.table === 'cash_sales');
    
    if (!cashSalesMapping) {
      console.error('Error: Could not find cash_sales mapping in configuration');
      process.exit(1);
    }
    
    console.log(`Found cash_sales mapping: Search ID ${cashSalesMapping.searchId}`);
    
    // Validate connections first
    console.log('Validating connections...');
    await netsuiteClient.validateCredentials();
    await supabaseClient.validateConnection();
    
    // Check current record count
    const beforeCount = await supabaseClient.getRecordCount('cash_sales');
    console.log(`Current record count in cash_sales: ${beforeCount}`);
    
    // Fetch data from NetSuite
    console.log(`Fetching data from NetSuite Saved Search ${cashSalesMapping.searchId}...`);
    const rawRecords = await netsuiteClient.fetchAllSavedSearchPages(cashSalesMapping.searchId);
    console.log(`Retrieved ${rawRecords.length} records from NetSuite`);
    
    if (rawRecords.length === 0) {
      console.log('No records found, skipping upsert');
      process.exit(0);
    }
    
    // Log all fields from the first record to see what we're working with
    console.log('Fields in first record:');
    Object.keys(rawRecords[0]).forEach(key => {
      console.log(`- ${key}: ${rawRecords[0][key]}`);
    });
    
    // Process records to ensure they have correct data types
    const records = rawRecords.map((record, index) => {
      // Use Document Number as the Internal ID since it appears to be unique
      // Remove the "CS" prefix if present
      const documentNumber = record['Document Number'] || '';
      const internalId = documentNumber.replace(/^CS/, '');
      
      return {
        "Internal ID": internalId ? parseInt(internalId, 10) || index + 1 : index + 1,
        "Date": record.Date || null,
        "Document Number": record['Document Number'] || '',
        "PO/Check Number": record['PO/Check Number'] || '',
        "NuOrder Order #": record['NuOrder Order #'] || '',
        "Created From": record['Created From'] || '',
        "Name": record.Name || '',
        "Amount": record.Amount ? parseFloat(record.Amount.replace(/,/g, '')) : 0,
        "Status": record.Status || '',
        "Customer Internal ID": record['Customer Internal ID'] ? parseInt(record['Customer Internal ID'], 10) || null : null,
        "Sales Order Internal ID": record['Sales Order Internal ID'] ? parseInt(record['Sales Order Internal ID'], 10) || null : null,
        "Partner Internal ID": record['Partner Internal ID'] ? parseInt(record['Partner Internal ID'], 10) || null : null
      };
    });
    
    // Sample of the first processed record
    console.log('Sample processed record:', JSON.stringify(records[0], null, 2));
    
    // Upsert data to Supabase using Internal ID as conflict key
    console.log(`Upserting ${records.length} records to cash_sales using "Internal ID" as conflict key...`);
    const result = await supabaseClient.upsert('cash_sales', records, 'Internal ID');
    
    // Get new record count
    const afterCount = await supabaseClient.getRecordCount('cash_sales');
    
    console.log('Sync completed for cash_sales:');
    console.log(`- Records processed: ${result.recordsProcessed}`);
    console.log(`- Records in table before: ${beforeCount}`);
    console.log(`- Records in table after: ${afterCount}`);
    
    console.log('=== Test completed successfully ===');
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

// Run the test
testCashSalesSync(); 