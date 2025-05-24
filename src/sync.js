const netsuiteClient = require('./netsuite/client');
const supabaseClient = require('./supabase/client');
const config = require('./config');

// Tables that require page-by-page processing due to large data volumes
const PAGINATED_TABLES = new Set([
  'invoices_detailed',
  'item_fulfillments_detailed',
  'sales_orders_detailed'
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
      
      // Ensure we have at least one mapping to validate against
      if (!config.mappings || config.mappings.length === 0) {
        throw new Error('No mappings found for validation');
      }
      
      // Use the first mapping for validation
      const firstMapping = config.mappings[0];
      this.log(`Using first mapping table "${firstMapping.table}" for Supabase connection validation`);
      
      await supabaseClient.validateConnection(firstMapping);
      
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
            "cash_sale_internal_id": parseId(record['cash_sale_internal_id']) || index + 1,
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "po_number": record['po_number'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "created_from": record['created_from'] || '',
            "name": record['name'] || '',
            "amount": parseNumber(record['amount']),
            "status": record['status'] || '',
            "customer_internal_id": parseId(record['customer_internal_id']),
            "sales_order_internal_id": parseId(record['sales_order_internal_id']),
            "partner_internal_id": parseId(record['partner_internal_id']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'credit_memos':
        return rawRecords.map((record, index) => {
          return {
            "credit_memo_internal_id": parseId(record['credit_memo_internal_id']) || index + 1,
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "po_number": record['po_number'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "created_from": record['created_from'] || '',
            "name": record['name'] || '',
            "amount": parseNumber(record['amount']),
            "status": record['status'] || '',
            "customer_internal_id": parseId(record['customer_internal_id']),
            "sales_order_internal_id": record['sales_order_internal_id'] || '', // String in Supabase
            "partner_internal_id": parseId(record['partner_internal_id']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'customers':
        return rawRecords.map((record, index) => {
          return {
            "customer_internal_id": parseId(record['customer_internal_id']) || index + 1,
            "number": parseId(record['number']),
            "company_name": record['company_name'] || '',
            "terms": record['terms'] || '',
            "partner": record['partner'] || '',
            "wholesale_customer_segment": record['wholesale_customer_segment'] || '',
            "price_level": record['price_level'] || '',
            "account_rating": record['account_rating'] || '',
            "email": record['email'] || '',
            "phone": record['phone'] || '',
            "default_billing_address": record['default_billing_address'] || '',
            "default_shipping_address": record['default_shipping_address'] || '',
            "tw_email_of_primary_contact": record['tw_email_of_primary_contact'] || '',
            "tw_email_of_billing_contact": record['tw_email_of_billing_contact'] || '',
            "tw_email_of_billing_contact_2": record['tw_email_of_billing_contact_2'] || '',
            "primary_currency": record['primary_currency'] || '',
            "hold_orders_for_cc_info": record['hold_orders_for_cc_info'] || '',
            "ar_red_flag": record['ar_red_flag'] || '',
            "partner_internal_id": parseId(record['partner_internal_id']),
            "timestamp": new Date().toISOString()
          };
        });
      
      case 'invoices':
        return rawRecords.map((record, index) => {
          return {
            "invoice_internal_id": parseId(record['invoice_internal_id']) || index + 1,
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "po_number": record['po_number'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "created_from": record['created_from'] || '',
            "name": record['name'] || '',
            "amount": parseNumber(record['amount']),
            "status": record['status'] || '',
            "customer_internal_id": parseId(record['customer_internal_id']),
            "sales_order_internal_id": parseId(record['sales_order_internal_id']),
            "payment_link": record['payment_link'] || '',
            "partner_internal_id": parseId(record['partner_internal_id']),
            "timestamp": new Date().toISOString(),
            "due_date": record['due_date'] || null
          };
        });
        
      case 'invoices_detailed':
        return rawRecords.map((record, index) => {
          return {
            "invoice_internal_id": parseId(record['invoice_internal_id']),
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "po_number": record['po_number'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "name": record['name'] || '',
            "status": record['status'] || '',
            "item_name": record['item_name'] || '',
            "design": record['design'] || '',
            "class": record['class'] || '',
            "upc_code": record['upc_code'] || '',
            "quantity": parseId(record['quantity']),
            "amount": parseNumber(record['amount']),
            "customer_internal_id": parseId(record['customer_internal_id']),
            "sales_order_number": record['sales_order_number'] || record['created_from'] || '',
            "sales_order_internal_id": parseId(record['sales_order_internal_id']),
            "pkey": parseId(record['pkey']) || `${parseId(record['invoice_internal_id']) || index + 1}_${parseId(record['line_id']) || index + 1}`,
            "sku": record['sku'] || '',
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'item_fulfillments':
        return rawRecords.map((record, index) => {
          return {
            "item_fulfillment_internal_id": parseId(record['item_fulfillment_internal_id']) || index + 1,
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "created_from": record['created_from'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "po_check_number": record['po_check_number'] || '',
            "name": record['name'] || '',
            "amount": parseNumber(record['amount']),
            "status": record['status'] || '',
            "tracking_numbers": record['tracking_numbers'] || '',
            "sales_order_internal_id": parseId(record['sales_order_internal_id']),
            "customer_internal_id": parseId(record['customer_internal_id']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'item_fulfillments_detailed':
        return rawRecords.map((record, index) => {
          return {
            "item_fulfillment_internal_id": parseId(record['item_fulfillment_internal_id']),
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "name": record['name'] || '',
            "status": record['status'] || '',
            "item_name": record['item_name'] || '',
            "design": record['design'] || '',
            "class": record['class'] || '',
            "upc_code": record['upc_code'] || '',
            "quantity": parseId(record['quantity']),
            "pkey": parseId(record['pkey']) || `${parseId(record['item_fulfillment_internal_id']) || index + 1}_${parseId(record['line_id']) || index + 1}`,
            "sku": record['sku'] || '',
            "customer_internal_id": parseId(record['customer_internal_id']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'partners':
        return rawRecords.map((record, index) => {
          return {
            "partner_internal_id": parseId(record['partner_internal_id']) || index + 1,
            "name": record['name'] || '',
            "email": record['email'] || '',
            "phone": record['phone'] || '',
            "office_phone": record['office_phone'] || '',
            "fax": record['fax'] || '',
            "code": record['code'] || '',
            "alt_email": record['alt_email'] || '',
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'sales_orders':
        return rawRecords.map((record, index) => {
          return {
            "sales_order_internal_id": parseId(record['sales_order_internal_id']) || index + 1,
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "po_number": record['po_number'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "customer_name": record['customer_name'] || record['name'] || '',
            "amount": parseNumber(record['amount']),
            "status": record['status'] || '',
            "customer_internal_id": parseId(record['customer_internal_id']),
            "ship_date": record['ship_date'] || null,
            "ship_date_end": record['ship_date_end'] || null,
            "partner_internal_id": parseId(record['partner_internal_id']),
            "timestamp": new Date().toISOString()
          };
        });
        
      case 'sales_orders_detailed':
        return rawRecords.map((record, index) => {
          return {
            "sales_order_internal_id": parseId(record['sales_order_internal_id']),
            "date": record['date'] || null,
            "document_number": record['document_number'] || '',
            "po_number": record['po_number'] || '',
            "nuorder_order_number": record['nuorder_order_number'] || '',
            "customer_name": record['customer_name'] || record['name'] || '',
            "status": record['status'] || '',
            "item_name": record['item_name'] || '',
            "design": record['design'] || '',
            "class": record['class'] || '',
            "upc_code": record['upc_code'] || '',
            "quantity": parseId(record['quantity']),
            "amount": parseNumber(record['amount']),
            "line_id": parseId(record['line_id']),
            "customer_internal_id": parseId(record['customer_internal_id']),
            "pkey": parseId(record['pkey']) || `${parseId(record['sales_order_internal_id']) || index + 1}_${parseId(record['line_id']) || index + 1}`,
            "sku": record['sku'] || '',
            "timestamp": new Date().toISOString()
          };
        });
      
      case 'forecast':
        return rawRecords.map((record, index) => {
          return {
            "month": record['month'] || null,
            "partner": record['sales_rep'] || record['partner'] || '',
            "forecasted_amount": parseNumber(record['forecasted_amount']),
            "partner_internal_id": parseId(record['partner_internal_id'] || record['partner_id']),
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
            if (key.includes('internal_id') || key.includes('_id') || key === 'id') {
              processedRecord[key] = parseId(value);
            } else if (key.includes('amount') || key.includes('price') || key.includes('total')) {
              processedRecord[key] = parseNumber(value);
            } else if (key.includes('date')) {
              processedRecord[key] = value || null;
            } else {
              processedRecord[key] = value || '';
            }
          });
          
          // Ensure an ID exists for primary key
          if (!processedRecord['id'] && !Object.keys(processedRecord).some(key => key.includes('internal_id'))) {
            processedRecord['id'] = index + 1;
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
          
          // Determine which conflict key to use (same logic as syncMapping)
          let conflictKey = this.getTableIdColumn(table);
          
          // Use pkey as conflict key for these specific tables
          if (table === 'sales_orders_detailed' || table === 'invoices_detailed' || table === 'item_fulfillments_detailed') {
            conflictKey = "pkey";
            
            // Verify that pkey is present and properly formatted
            if (processedRecords.length > 0) {
              const samplePkey = processedRecords[0][conflictKey];
              this.log(`Sample ${conflictKey}: ${samplePkey} (type: ${typeof samplePkey})`);
              
              if (samplePkey === null || samplePkey === undefined) {
                this.log(`WARNING: ${conflictKey} is missing in processed records for ${table}`);
              }
            }
          } else {
            // Verify that the table ID is present and properly formatted
            if (processedRecords.length > 0) {
              const sampleId = processedRecords[0][conflictKey];
              this.log(`Sample ${conflictKey}: ${sampleId} (type: ${typeof sampleId})`);
              
              if (sampleId === null || sampleId === undefined) {
                this.log(`WARNING: ${conflictKey} is missing in processed records for ${table}`);
              }
            }
          }
          
          this.log(`Upserting page ${pageIndex} with ${processedRecords.length} records to ${table} using "${conflictKey}" as conflict key...`);
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
        let conflictKey = this.getTableIdColumn(table);
        
        // Use pkey as conflict key for these specific tables
        if (table === 'sales_orders_detailed' || table === 'invoices_detailed' || table === 'item_fulfillments_detailed') {
          conflictKey = "pkey";
          
          // Verify that pkey is present and properly formatted
          const samplePkey = processedRecords[0][conflictKey];
          this.log(`Sample ${conflictKey}: ${samplePkey} (type: ${typeof samplePkey})`);
          
          if (samplePkey === null || samplePkey === undefined) {
            this.log(`WARNING: ${conflictKey} is missing in processed records for ${table}`);
          }
        } else {
          // Verify that the table ID is present and properly formatted
          const sampleId = processedRecords[0][conflictKey];
          this.log(`Sample ${conflictKey}: ${sampleId} (type: ${typeof sampleId})`);
          
          if (sampleId === null || sampleId === undefined) {
            this.log(`WARNING: ${conflictKey} is missing in processed records for ${table}`);
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

  /**
   * Gets the primary ID column name for a specific table
   * @param {string} table - The table name
   * @returns {string} The ID column name for the table
   */
  getTableIdColumn(table) {
    const tableIdMap = {
      'cash_sales': 'cash_sale_internal_id',
      'credit_memos': 'credit_memo_internal_id', 
      'customers': 'customer_internal_id',
      'invoices': 'invoice_internal_id',
      'invoices_detailed': 'invoice_internal_id',
      'item_fulfillments': 'item_fulfillment_internal_id',
      'item_fulfillments_detailed': 'item_fulfillment_internal_id',
      'partners': 'partner_internal_id',
      'sales_orders': 'sales_order_internal_id',
      'sales_orders_detailed': 'sales_order_internal_id',
      'forecast': 'pkey' // Forecast uses pkey as primary key
    };
    
    return tableIdMap[table] || 'id'; // Default fallback
  }
}

// Export both the class and a singleton instance
module.exports = new SyncManager();
module.exports.SyncManager = SyncManager; 