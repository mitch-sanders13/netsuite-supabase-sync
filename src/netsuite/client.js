const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');

class NetSuiteClient {
  constructor() {
    this.accountId = config.netsuite.accountId;
    this.consumerKey = config.netsuite.consumerKey;
    this.consumerSecret = config.netsuite.consumerSecret;
    this.tokenId = config.netsuite.tokenId;
    this.tokenSecret = config.netsuite.tokenSecret;
    this.scriptId = config.netsuite.scriptId;
    this.deployId = config.netsuite.deployId;
    
    // Ensure baseUrl is formatted correctly for NetSuite RESTlets
    this.baseUrl = `https://${this.accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl`;
    
    this.oauth = OAuth({
      consumer: {
        key: this.consumerKey,
        secret: this.consumerSecret
      },
      signature_method: 'HMAC-SHA256',
      hash_function(baseString, key) {
        return crypto
          .createHmac('sha256', key)
          .update(baseString)
          .digest('base64');
      }
    });

    this.token = {
      key: this.tokenId,
      secret: this.tokenSecret
    };
  }

  /**
   * Generates OAuth headers for a request
   * @param {string} url - The full URL of the request
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @returns {Object} Headers object with OAuth and Content-Type
   */
  getAuthHeaders(url, method = 'GET') {
    const requestData = {
      url,
      method,
      data: {} // Empty object for GET requests
    };

    // Generate OAuth parameters
    const oauth = this.oauth.authorize(requestData, this.token);
    
    // Add the realm parameter
    const headerParams = {
      oauth_consumer_key: oauth.oauth_consumer_key,
      oauth_token: oauth.oauth_token,
      oauth_signature_method: oauth.oauth_signature_method,
      oauth_timestamp: oauth.oauth_timestamp,
      oauth_nonce: oauth.oauth_nonce,
      oauth_version: oauth.oauth_version,
      oauth_signature: oauth.oauth_signature,
      realm: this.accountId
    };
    
    // Format as key="value" pairs separated by commas
    let authHeaderString = 'OAuth ' + Object.keys(headerParams)
      .map(key => `${key}="${encodeURIComponent(headerParams[key])}"`)
      .join(', ');
    
    return {
      'Authorization': authHeaderString,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Parses the response from the NetSuite RESTlet
   * @param {Object} response - The response from the API call
   * @returns {Object} Parsed response with data, pageIndex, totalPages, and hasMore
   */
  parseNetSuiteResponse(response) {
    // If response is a string, try to parse it as JSON
    let parsedResponse = response;
    if (typeof response === 'string') {
      try {
        parsedResponse = JSON.parse(response);
      } catch (error) {
        throw new Error(`Failed to parse NetSuite response: ${error.message}`);
      }
    }

    // Validate response format
    if (!parsedResponse || !parsedResponse.data || !Array.isArray(parsedResponse.data)) {
      throw new Error(`Invalid response format from NetSuite API: missing data array`);
    }

    return {
      data: parsedResponse.data,
      pageIndex: parsedResponse.pageIndex || 0,
      totalPages: parsedResponse.totalPages || 1,
      hasMore: parsedResponse.hasMore || false
    };
  }

  /**
   * Fetches data from a NetSuite Saved Search
   * @param {string} searchId - The internal ID of the Saved Search
   * @param {number} page - The page number to fetch (0-based)
   * @returns {Promise<Object>} The response data from NetSuite
   */
  async fetchSavedSearch(searchId, page = 0) {
    // Construct the URL with query parameters
    const url = `${this.baseUrl}?script=${this.scriptId}&deploy=${this.deployId}&searchId=${searchId}&page=${page}`;
    
    try {
      const headers = this.getAuthHeaders(url);
      
      console.log('Making request to NetSuite:');
      console.log(`URL: ${url}`);
      console.log(`Authorization Header: ${headers.Authorization}`);
      
      // Add timeout to handle network issues
      const response = await axios.get(url, { 
        headers,
        timeout: 120000 // 120 seconds timeout (increased from 30 seconds)
      });
      
      console.log(`Response status: ${response.status}`);
      
      // Handle different response formats
      if (!response.data) {
        throw new Error('Empty response from NetSuite');
      }
      
      if (response.data.error) {
        throw new Error(`NetSuite API Error: ${response.data.error}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error details:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const responseData = JSON.stringify(error.response.data);
        console.error(`NetSuite API Error Response (${statusCode}): ${responseData}`);
        
        throw new Error(`NetSuite API Error: ${statusCode} - ${error.response.data.message || error.response.statusText || 'Unknown error'}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        throw new Error(`No response received from NetSuite API: ${error.message}`);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Request setup error:', error.message);
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  /**
   * Fetches a single page of results from a saved search
   * @param {string} searchId - The internal ID of the saved search
   * @param {number} pageIndex - The 1-based page index to fetch
   * @returns {Promise<{data: Array, hasMore: boolean}>} The page data and whether there are more pages
   */
  async fetchSavedSearchPage(searchId, pageIndex) {
    try {
      // Convert 1-based pageIndex to 0-based page for internal use
      const page = pageIndex - 1;
      console.log(`Fetching page ${pageIndex} (internal page ${page}) of Saved Search ${searchId}...`);
      
      const rawResponse = await this.fetchSavedSearch(searchId, page);
      const parsedResponse = this.parseNetSuiteResponse(rawResponse);
      
      console.log(`Retrieved ${parsedResponse.data.length} records (page ${parsedResponse.pageIndex + 1} of ${parsedResponse.totalPages})`);
      
      return {
        data: parsedResponse.data,
        hasMore: parsedResponse.hasMore
      };
    } catch (error) {
      console.error(`Error fetching page ${pageIndex} from saved search ${searchId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches all pages of data from a NetSuite Saved Search
   * @param {string} searchId - The internal ID of the Saved Search
   * @returns {Promise<Array>} All results from the Saved Search
   */
  async fetchAllSavedSearchPages(searchId) {
    const allResults = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${page} of Saved Search ${searchId}...`);
      const rawResponse = await this.fetchSavedSearch(searchId, page);
      
      // Parse and validate the response
      try {
        console.log('Response received, parsing...');
        const parsedResponse = this.parseNetSuiteResponse(rawResponse);
        
        console.log(`Retrieved ${parsedResponse.data.length} records (page ${parsedResponse.pageIndex + 1} of ${parsedResponse.totalPages})`);
        
        allResults.push(...parsedResponse.data);
        hasMore = parsedResponse.hasMore;
        page++;

        // Add a small delay between requests to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        
        // Try to log the raw response for debugging
        const responseStr = typeof rawResponse === 'string' 
          ? rawResponse 
          : JSON.stringify(rawResponse);
          
        console.log('Raw response:', responseStr.substring(0, 500) + '...');
        throw error;
      }
    }

    console.log(`Total records retrieved from Saved Search ${searchId}: ${allResults.length}`);
    return allResults;
  }

  /**
   * Validates the NetSuite credentials by making a test request
   * @returns {Promise<boolean>} True if credentials are valid
   */
  async validateCredentials() {
    try {
      console.log('Validating NetSuite credentials...');
      console.log(`Account ID: ${this.accountId}`);
      console.log(`Script ID: ${this.scriptId}`);
      console.log(`Deploy ID: ${this.deployId}`);
      console.log(`Base URL: ${this.baseUrl}`);
      
      // Try to fetch the first page of any saved search
      const searchId = config.mappings[0].searchId;
      console.log(`Testing with Saved Search ID: ${searchId}`);
      
      await this.fetchSavedSearch(searchId, 0);
      console.log('NetSuite validation successful!');
      return true;
    } catch (error) {
      console.error('NetSuite validation error:', error);
      if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
        throw new Error(`Invalid NetSuite credentials: ${error.message}`);
      }
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new NetSuiteClient(); 