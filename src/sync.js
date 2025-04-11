const netsuiteClient = require('./netsuite/client');
const supabaseClient = require('./supabase/client');
const config = require('./config');

// Tables that require page-by-page processing due to large data volumes
const PAGINATED_TABLES = new Set([
  'invoices-detailed',
  'item-fulfillments-detailed',
  'sales-data-detailed'
]);

function requiresPagination(table) {
  return PAGINATED_TABLES.has(table);
}

class SyncManager {
  constructor() {
    this.syncStats = {
      startTime: null,
      endTime: null,
      totalMappings: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      errors: []
    };
  }

  /**
   * Logs a message with timestamp
   * @param {string} message - The message to log
   */
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  /**
   * Logs an error and adds it to sync stats
   * @param {string} message - The error message
   * @param {Error} error - The error object
   */
  logError(message, error) {
    this.log(`ERROR: ${message}`);
    this.syncStats.errors.push({
      message,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Validates connections to both NetSuite and Supabase
   * @returns {Promise<boolean>} True if both connections are valid
   */
  async validateConnections() {
    try {
      this.log('Validating NetSuite connection...');
      await netsuiteClient.validateCredentials();
      
      this.log('Validating Supabase connection...');
      await supabaseClient.validateConnection();
      
      return true;
    } catch (error) {
      this.logError('Connection validation failed', error);
      return false;
    }
  }

  /**
   * Process records to ensure they have correct data types for the specific table
   * @param {string} table - The table name to process for
   * @param {Array} rawRecords - Raw records from NetSuite
   * @returns {Array} Processed records with correct data types
   */
  processRecordsForTable(table, rawRecords) {
    if (!rawRecords || rawRecords.length === 0) return [];
    
    this.log(`Processing ${rawRecords.length} records for ${table}...`);

    // Log a sample record for debugging
    if (rawRecords.length > 0) {
      this.log(`Sample raw record structure for ${table}: ${JSON.stringify(rawRecords[0], null, 2)}`);
    }
    
    // Helper functions for formatting
    const parseNumber = (value) => {
      if (!value) return null;
      // Remove commas and parse as float
      return parseFloat(String(value).replace(/,/g, '')) || null;
    };
    
    const parseId = (value) => {
      if (!value) return null;
      // Parse as integer
      return parseInt(String(value), 10) || null;
    };
    
    // Table-specific processing logic
    switch (table) {
      case 'cash_sales':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "Created From": record['Created From'] || '',
            "Name": record.Name || '',
            "Amount": parseNumber(record.Amount),
            "Status": record.Status || '',
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "Sales Order Internal ID": parseId(record['Sales Order Internal ID']),
            "Partner Internal ID": parseId(record['Partner Internal ID']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'credit_memos':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "Created From": record['Created From'] || '',
            "Name": record.Name || '',
            "Amount": parseNumber(record.Amount),
            "Status": record.Status || '',
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "Sales Order Internal ID": record['Sales Order Internal ID'] || '', // String in Supabase
            "Partner Internal ID": parseId(record['Partner Internal ID']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'customers':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']) || index + 1,
            "Number": parseId(record['Number']),
            "Company Name": record['Company Name'] || '',
            "Terms": record['Terms'] || '',
            "Partner": record['Partner'] || '',
            "Wholesale Customer Segment": record['Wholesale Customer Segment'] || '',
            "Price Level": record['Price Level'] || '',
            "Account Rating": record['Account Rating'] || '',
            "Email": record['Email'] || '',
            "Phone": record['Phone'] || '',
            "Default Billing Address": record['Default Billing Address'] || '',
            "Default Shipping Address": record['Default Shipping Address'] || '',
            "Sales Rep Name": record['Sales Rep Name'] || '',
            "Sales Rep Email": record['Sales Rep Email'] || '',
            "TW | Email of Primary Contact": record['TW | Email of Primary Contact'] || '',
            "TW | Email of Billing Contact": record['TW | Email of Billing Contact'] || '',
            "TW | Email of Billing Contact 2": record['TW | Email of Billing Contact 2'] || '',
            "Primary Currency": record['Primary Currency'] || '',
            "Hold Orders for CC Info": record['Hold Orders for CC Info'] || '',
            "AR Red Flag": record['AR Red Flag'] || '',
            "Partner Internal ID": parseId(record['Partner Internal ID']),
            "timestamp": new Date().toISOString()
          };
        });
      
      case 'invoices':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "Created From": record['Created From'] || '',
            "Name": record.Name || '',
            "Amount": parseNumber(record.Amount),
            "Status": record.Status || '',
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "Sales Order Internal ID": parseId(record['Sales Order Internal ID']),
            "Payment Link": record['Payment Link'] || '',
            "Partner Internal ID": parseId(record['Partner Internal ID']),
            "timestamp": new Date().toISOString(),
            "Due Date":  record['Due Date'] || '',
          };
        });
        
      case 'invoices-detailed':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "Name": record.Name || '',
            "Status": record.Status || '',
            "Item Name": record['Item Name'] || '',
            "Design": record['Design'] || '',
            "Class": record['Class'] || '',
            "UPC Code": record['UPC Code'] || '',
            "Quantity": parseId(record['Quantity']),
            "Amount": parseNumber(record.Amount),
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "Sales Order #": record['Sales Order #'] || record['Created From'] || '',
            "Sales Order Internal ID": parseId(record['Sales Order Internal ID']),
            "pkey": parseId(record['pkey']),
            "SKU": record['SKU'] || '',
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'item-fulfillments':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "Created From": record['Created From'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "Name": record.Name || '',
            "Amount": parseNumber(record.Amount),
            "Status": record.Status || '',
            "Tracking Numbers": record['Tracking Numbers'] || '',
            "Sales Order Internal ID": parseId(record['Sales Order Internal ID']),
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'item-fulfillments-detailed':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "Name": record.Name || '',
            "Status": record.Status || '',
            "Item Name": record['Item Name'] || '',
            "Design": record['Design'] || '',
            "Class": record['Class'] || '',
            "UPC Code": record['UPC Code'] || '',
            "Quantity": parseId(record['Quantity']),
            "pkey": parseId(record['pkey']),
            "SKU": record['SKU'] || '',
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'partners':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']) || index + 1,
            "Name": record.Name || '',
            "Email": record.Email || '',
            "Phone": record.Phone || '',
            "Office Phone": record['Office Phone'] || '',
            "Fax": record.Fax || '',
            "Code": record.Code || '',
            "Alt. Email": record['Alt. Email'] || '',
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'sales-orders':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "Customer Name": record['Customer Name'] || record.Name || '',
            "Amount": parseNumber(record.Amount),
            "Status": record.Status || '',
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "Ship Date": record['Ship Date'] || null,
            "Ship Date End": record['Ship Date End'] || null,
            "Partner Internal ID": parseId(record['Partner Internal ID']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'sales-data-detailed':
        return rawRecords.map((record, index) => {
          return {
            "Internal ID": parseId(record['Internal ID']),
            "Date": record.Date || null,
            "Document Number": record['Document Number'] || '',
            "PO/Check Number": record['PO/Check Number'] || '',
            "NuOrder Order #": record['NuOrder Order #'] || '',
            "Customer Name": record['Customer Name'] || record.Name || '',
            "Status": record.Status || '',
            "Item Name": record['Item Name'] || '',
            "Design": record['Design'] || '',
            "Class": record['Class'] || '',
            "UPC Code": record['UPC Code'] || '',
            "Quantity": parseId(record['Quantity']),
            "Amount": parseNumber(record.Amount),
            "Line ID": parseId(record['Line ID']),
            "Customer Internal ID": parseId(record['Customer Internal ID']),
            "pkey": parseId(record['pkey']),
            "SKU": record['SKU'] || '',
            "timestamp": new Date().toISOString()
          };
        });
      
      case 'forecast':
        return rawRecords.map((record, index) => {
          return {
            "Month": record['Month'] || null,
            "Sales Rep": record['Sales Rep'] || '',
            "Forecasted Amount": parseNumber(record['Forecasted Amount']),
            "Partner ID": parseId(record['Partner ID']),
            "pkey": parseId(record['pkey']) || index + 1
          };
        });
      
      default:
        // Generic processing for tables without specific mapping
        this.log(`No specific processing for ${table}, using generic processing`);
        return rawRecords.map((record, index) => {
          const processedRecord = {};
          
          // Process each field, trying to convert to appropriate types
          Object.keys(record).forEach(key => {
            const value = record[key];
            
            // Handle data types based on field names
            if (key === 'Internal ID' || key.includes('Internal ID') || key.includes(' ID')) {
              processedRecord[key] = parseId(value);
            } else if (key === 'Amount' || key.includes('Amount') || key.includes('Price') || key.includes('Total')) {
              processedRecord[key] = parseNumber(value);
            } else if (key === 'Date' || key.includes('Date')) {
              processedRecord[key] = value || null;
            } else {
              processedRecord[key] = value || '';
            }
          });
          
          // Ensure Internal ID exists
          if (!processedRecord['Internal ID']) {
            processedRecord['Internal ID'] = index + 1;
          }
          
          // Add timestamp
          processedRecord.timestamp = new Date().toISOString();
          
          return processedRecord;
        });
    }
  }

  /**
   * Syncs a single mapping from NetSuite to Supabase using pagination
   * @param {Object} mapping - The mapping configuration
   * @returns {Promise<boolean>} True if sync was successful
   */
  async syncMappingWithPagination(mapping) {
    const { searchId, table, name } = mapping;
    let pageIndex = 1;
    let hasMorePages = true;
    let totalRecordsProcessed = 0;

    try {
      // Get current record count before sync
      const beforeCount = await supabaseClient.getRecordCount(table);
      this.log(`Current record count in ${table}: ${beforeCount}`);

      while (hasMorePages) {
        this.log(`Fetching page ${pageIndex} for ${name}...`);
        const { data: pageData, hasMore } = await netsuiteClient.fetchSavedSearchPage(searchId, pageIndex);
        
        if (pageData && pageData.length > 0) {
          const processedRecords = this.processRecordsForTable(table, pageData);
          this.log(`Processing page ${pageIndex} with ${processedRecords.length} records for ${table}`);
          
          const conflictKey = "pkey";
          const result = await supabaseClient.upsert(table, processedRecords, conflictKey);
          
          totalRecordsProcessed += processedRecords.length;
          this.log(`Successfully synced page ${pageIndex} to Supabase (${processedRecords.length} records)`);
        } else {
          this.log(`No records found in page ${pageIndex} for ${name}`);
        }

        hasMorePages = hasMore;
        pageIndex++;
      }

      // Get final record count
      const afterCount = await supabaseClient.getRecordCount(table);
      this.log(`Completed paginated sync for ${name}:`);
      this.log(`- Total records processed: ${totalRecordsProcessed}`);
      this.log(`- Records in table before: ${beforeCount}`);
      this.log(`- Records in table after: ${afterCount}`);

      return true;
    } catch (error) {
      this.logError(`Failed to sync ${name} to ${table} during pagination`, error);
      return false;
    }
  }

  /**
   * Syncs a single mapping from NetSuite to Supabase
   * @param {Object} mapping - The mapping configuration
   * @returns {Promise<boolean>} True if sync was successful
   */
  async syncMapping(mapping) {
    const { searchId, table, name, type } = mapping;
    
    try {
      this.log(`Starting sync for ${name} (${type}) to table ${table}`);
      
      // Use paginated sync for large tables
      if (requiresPagination(table)) {
        return await this.syncMappingWithPagination(mapping);
      }

      // Get current record count before sync
      const beforeCount = await supabaseClient.getRecordCount(table);
      this.log(`Current record count in ${table}: ${beforeCount}`);

      // Fetch data from NetSuite
      this.log(`Fetching data from NetSuite Saved Search ${searchId}...`);
      const rawRecords = await netsuiteClient.fetchAllSavedSearchPages(searchId);
      this.log(`Retrieved ${rawRecords.length} records from NetSuite`);

      if (rawRecords.length === 0) {
        this.log(`No records found for ${name}, skipping upsert`);
        return true;
      }

      // Log raw record field names to help debugging
      if (rawRecords.length > 0) {
        this.log(`Field names in raw records: ${Object.keys(rawRecords[0]).join(', ')}`);
      }

      // Process records for this table
      const processedRecords = this.processRecordsForTable(table, rawRecords);
      this.log(`Processed ${processedRecords.length} records for ${table}`);

      // Log sample of processed records for verification
      if (processedRecords.length > 0) {
        this.log(`Sample processed record: ${JSON.stringify(processedRecords[0], null, 2)}`);
        
        // Determine which conflict key to use
        let conflictKey = "Internal ID"; // Default
        
        // Use pkey as conflict key for these specific tables
        if (table === 'sales-data-detailed' || table === 'invoices-detailed' || table === 'item-fulfillments-detailed') {
          conflictKey = "pkey";
          
          // Verify that pkey is present and properly formatted
          const samplePkey = processedRecords[0][conflictKey];
          this.log(`Sample ${conflictKey}: ${samplePkey} (type: ${typeof samplePkey})`);
          
          if (samplePkey === null || samplePkey === undefined) {
            this.log(`WARNING: ${conflictKey} is missing in processed records for ${table}`);
          }
        } else {
          // Verify that Internal ID is present and properly formatted
          const sampleId = processedRecords[0]['Internal ID'];
          this.log(`Sample Internal ID: ${sampleId} (type: ${typeof sampleId})`);
          
          if (sampleId === null || sampleId === undefined) {
            this.log(`WARNING: Internal ID is missing in processed records for ${table}`);
          }
        }

        // Upsert data to Supabase using the appropriate conflict key
        this.log(`Upserting ${processedRecords.length} records to ${table} using "${conflictKey}" as conflict key...`);
        const result = await supabaseClient.upsert(table, processedRecords, conflictKey);
        
        // Get new record count
        const afterCount = await supabaseClient.getRecordCount(table);
        
        this.log(`Sync completed for ${name}:`);
        this.log(`- Records processed: ${result.recordsProcessed}`);
        this.log(`- Records in table before: ${beforeCount}`);
        this.log(`- Records in table after: ${afterCount}`);
      } else {
        this.log(`No processed records for ${table}, skipping upsert`);
      }
      
      return true;
    } catch (error) {
      this.logError(`Failed to sync ${name} to ${table}`, error);
      return false;
    }
  }

  /**
   * Runs the complete sync process for all mappings
   * @returns {Promise<Object>} Sync statistics
   */
  async runSync() {
    this.syncStats.startTime = new Date().toISOString();
    this.syncStats.totalMappings = config.mappings.length;
    
    this.log('Starting NetSuite to Supabase sync process');
    this.log(`Total mappings to process: ${this.syncStats.totalMappings}`);

    // Validate connections first
    if (!await this.validateConnections()) {
      this.log('Connection validation failed. Aborting sync.');
      return this.syncStats;
    }

    // Process each mapping
    for (const mapping of config.mappings) {
      const success = await this.syncMapping(mapping);
      if (success) {
        this.syncStats.successfulSyncs++;
      } else {
        this.syncStats.failedSyncs++;
      }
    }

    this.syncStats.endTime = new Date().toISOString();
    
    // Log final statistics
    this.log('\nSync Process Completed:');
    this.log(`Total mappings: ${this.syncStats.totalMappings}`);
    this.log(`Successful syncs: ${this.syncStats.successfulSyncs}`);
    this.log(`Failed syncs: ${this.syncStats.failedSyncs}`);
    
    if (this.syncStats.errors.length > 0) {
      this.log('\nErrors encountered:');
      this.syncStats.errors.forEach(error => {
        this.log(`- ${error.message}: ${error.error}`);
      });
    }

    return this.syncStats;
  }
}

// Export both the class and a singleton instance
module.exports = new SyncManager();
module.exports.SyncManager = SyncManager; 