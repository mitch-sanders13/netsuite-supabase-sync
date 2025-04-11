const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class SupabaseClient {
  constructor() {
    // Access environment variables directly
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    // Validate credentials before creating the client
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }
    
    if (!supabaseKey) {
      throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');
    }
    
    // Validate URL format
    try {
      new URL(supabaseUrl);
    } catch (error) {
      throw new Error('SUPABASE_URL is not a valid URL');
    }
    
    this.client = createClient(
      supabaseUrl,
      supabaseKey
    );
  }

  /**
   * Checks if the table name is valid
   * @param {string} tableName - The table name to validate
   * @returns {boolean} - Whether the table name is valid
   * @private
   */
  _isValidTableName(tableName) {
    if (!tableName || typeof tableName !== 'string') {
      return false;
    }
    // Allow alphanumeric characters, underscores, and hyphens
    return /^[a-zA-Z0-9_-]+$/.test(tableName);
  }

  /**
   * Upserts data into a Supabase table
   * @param {string} table - The name of the table to upsert into
   * @param {Array} records - Array of records to upsert
   * @param {string} onConflict - The column to check for conflicts (default: 'id')
   * @returns {Promise<Object>} The response from Supabase
   */
  async upsert(table, records, onConflict = 'id') {
    // Validate table name
    if (!this._isValidTableName(table)) {
      throw new Error('Invalid table name format');
    }

    // Validate records
    if (!Array.isArray(records)) {
      throw new Error('Records must be an array');
    }

    if (records.length === 0) {
      console.warn(`No records to upsert for table: ${table}`);
      return { count: 0 };
    }

    // Validate onConflict
    if (onConflict) {
      // Allow alphanumeric characters, underscores, hyphens, and spaces for column names
      if (typeof onConflict !== 'string' || !/^[a-zA-Z0-9_\- ]+$/.test(onConflict)) {
        throw new Error('Invalid conflict column format');
      }
    }

    // Check if any records are missing the conflict key
    if (onConflict) {
      const missingConflictKey = records.some(record => record[onConflict] === undefined);
      if (missingConflictKey) {
        console.warn(`Some records are missing the conflict key: ${onConflict} in table: ${table}`);
      }
    }

    try {
      console.log(`Starting upsert to ${table} table with ${records.length} records using conflict column: '${onConflict}'`);
      
      // Verify all records have the conflict key
      const missingKeys = records.filter(record => record[onConflict] === undefined || record[onConflict] === null);
      if (missingKeys.length > 0) {
        console.warn(`WARNING: ${missingKeys.length} records missing conflict key '${onConflict}'`);
        // Don't log the full records - just count them
      }
      
      // Split records into chunks of 500 to avoid payload size limits
      const chunkSize = 500;
      const chunks = [];
      
      for (let i = 0; i < records.length; i += chunkSize) {
        chunks.push(records.slice(i, i + chunkSize));
      }

      console.log(`Splitting ${records.length} records into ${chunks.length} chunks of max ${chunkSize} records each`);

      const results = [];
      let chunkNumber = 1;
      
      for (const chunk of chunks) {
        console.log(`Processing chunk ${chunkNumber} of ${chunks.length} (${chunk.length} records)`);
        
        const { data, error } = await this.client
          .from(table)
          .upsert(chunk, { 
            onConflict,
            ignoreDuplicates: false // Update existing records
          })
          .select();

        if (error) {
          console.error(`Supabase upsert error in chunk ${chunkNumber}`);
          throw new Error(`Supabase upsert error: ${error.message}`);
        }

        console.log(`Successfully upserted chunk ${chunkNumber} with ${chunk.length} records`);
        results.push(...(data || []));
        chunkNumber++;
      }

      return {
        success: true,
        recordsProcessed: records.length,
        resultsReturned: results.length
      };
    } catch (error) {
      console.error(`Error during upsert to ${table}`);
      throw new Error(`Failed to upsert to table ${table}: ${error.message}`);
    }
  }

  /**
   * Validates that the client can connect to Supabase and the table exists
   * @param {Object} mapping - The mapping configuration
   * @returns {Promise<boolean>} - Whether the connection is valid
   */
  async validateConnection(mapping) {
    if (!mapping) {
      throw new Error('Invalid mapping configuration: mapping is undefined');
    }

    // Check for table property in various formats
    const table = mapping.supabaseTable || mapping.table;
    
    if (!table) {
      console.error('Mapping structure:', JSON.stringify(mapping, null, 2));
      throw new Error('Invalid mapping configuration: missing supabaseTable or table property');
    }

    // Validate table name format
    if (!this._isValidTableName(table)) {
      throw new Error(`Invalid table name format: ${table}`);
    }

    try {
      // Check if the table exists
      const { count, error } = await this.client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01') { // Table doesn't exist
          return false;
        }
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error(`Error validating connection to table: ${table}`);
      throw new Error(`Failed to validate Supabase connection: ${error.message}`);
    }
  }

  /**
   * Gets the current record count for a table
   * @param {string} table - The name of the table
   * @returns {Promise<number>} The number of records in the table
   */
  async getRecordCount(table) {
    if (!this._isValidTableName(table)) {
      throw new Error('Invalid table name format');
    }
    
    try {
      const { count, error } = await this.client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count;
    } catch (error) {
      console.error(`Error getting record count for ${table}`);
      throw new Error(`Failed to get record count: ${error.message}`);
    }
  }

  /**
   * Truncates a table (removes all records)
   * @param {string} table - The name of the table to truncate
   * @returns {Promise<boolean>} True if successful
   */
  async truncateTable(table) {
    if (!this._isValidTableName(table)) {
      throw new Error('Invalid table name format');
    }
    
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .neq('id', 0); // Delete all records

      if (error) throw error;
    } catch (error) {
      console.error(`Error truncating table ${table}`);
      throw new Error(`Failed to truncate table: ${error.message}`);
    }
  }
}

// Export a singleton instance
module.exports = new SupabaseClient(); 