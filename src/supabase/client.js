const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class SupabaseClient {
  constructor() {
    this.client = createClient(
      config.supabase.url,
      config.supabase.serviceKey
    );
  }

  /**
   * Upserts data into a Supabase table
   * @param {string} table - The name of the table to upsert into
   * @param {Array} records - Array of records to upsert
   * @param {string} onConflict - The column to check for conflicts (default: 'id')
   * @returns {Promise<Object>} The response from Supabase
   */
  async upsert(table, records, onConflict = 'id') {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('No records provided for upsert');
    }

    try {
      console.log(`Starting upsert to ${table} table with ${records.length} records using conflict column: '${onConflict}'`);
      
      // Verify all records have the conflict key
      const missingKeys = records.filter(record => record[onConflict] === undefined || record[onConflict] === null);
      if (missingKeys.length > 0) {
        console.warn(`WARNING: ${missingKeys.length} records missing conflict key '${onConflict}'`);
        if (missingKeys.length < 5) {
          console.warn(`Missing records: ${JSON.stringify(missingKeys)}`);
        }
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
          // Provide detailed error information
          console.error(`Supabase upsert error in chunk ${chunkNumber}:`, error);
          
          // Try to identify the problematic record
          if (error.details?.includes('duplicate key value')) {
            const match = error.details.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
            if (match) {
              const [_, column, value] = match;
              console.error(`Duplicate key issue with column "${column}" and value "${value}"`);
            }
          }
          
          throw new Error(`Supabase upsert error: ${error.message} (details: ${error.details || 'none'})`);
        }

        console.log(`Successfully upserted chunk ${chunkNumber} with ${chunk.length} records`);
        results.push(...(data || []));
        chunkNumber++;
      }

      return {
        success: true,
        recordsProcessed: records.length,
        resultsReturned: results.length,
        results
      };
    } catch (error) {
      console.error(`Detailed error during upsert to ${table}:`, error);
      throw new Error(`Failed to upsert to table ${table}: ${error.message}`);
    }
  }

  /**
   * Validates the Supabase connection by making a test query
   * @returns {Promise<boolean>} True if connection is valid
   */
  async validateConnection() {
    try {
      // Try to fetch a single row from the first table in our mappings
      const { data, error } = await this.client
        .from(config.mappings[0].table)
        .select('*')
        .limit(1);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Invalid Supabase credentials');
      }
      throw error;
    }
  }

  /**
   * Gets the current record count for a table
   * @param {string} table - The name of the table
   * @returns {Promise<number>} The number of records in the table
   */
  async getRecordCount(table) {
    try {
      const { count, error } = await this.client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return count;
    } catch (error) {
      throw new Error(`Failed to get record count for table ${table}: ${error.message}`);
    }
  }

  /**
   * Truncates a table (removes all records)
   * @param {string} table - The name of the table to truncate
   * @returns {Promise<boolean>} True if successful
   */
  async truncateTable(table) {
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .neq('id', 0); // Delete all records (using a condition that's always true)

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to truncate table ${table}: ${error.message}`);
    }
  }
}

// Export a singleton instance
module.exports = new SupabaseClient(); 