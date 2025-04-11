const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');

class NetSuiteClient {
  constructor() {
    // Access environment variables directly
    this.accountId = process.env.NS_ACCOUNT_ID;
    this.consumerKey = process.env.NS_CONSUMER_KEY;
    this.consumerSecret = process.env.NS_CONSUMER_SECRET;
    this.tokenId = process.env.NS_TOKEN_ID;
    this.tokenSecret = process.env.NS_TOKEN_SECRET;
    this.scriptId = process.env.NS_SCRIPT_ID;
    this.deployId = process.env.NS_DEPLOY_ID;
    
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
    // Validate inputs
    if (!url) {
      throw new Error('URL is required for authentication');
    }
    
    if (!this.oauth || !this.token) {
      throw new Error('OAuth is not properly initialized');
    }
    
    // Sanitize method
    method = (method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    const requestData = {
      url,
      method,
      data: {} // Empty object for GET requests
    };

    // Generate OAuth parameters
    const oauth = this.oauth.authorize(requestData, this.token);
    
    // Validate that all required OAuth parameters exist
    const requiredParams = [
      'oauth_consumer_key', 'oauth_token', 'oauth_signature_method',
      'oauth_timestamp', 'oauth_nonce', 'oauth_version', 'oauth_signature'
    ];
    
    const missingParams = requiredParams.filter(param => !oauth[param]);
    if (missingParams.length > 0) {
      throw new Error(`Missing required OAuth parameters: ${missingParams.join(', ')}`);
    }
    
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
    // Ensure proper encoding of all values
    let authHeaderString = 'OAuth ' + Object.keys(headerParams)
      .map(key => {
        // Extra safety: ensure no null/undefined values
        const value = headerParams[key] !== undefined && headerParams[key] !== null
          ? headerParams[key].toString()
          : '';
        return `${key}="${encodeURIComponent(value)}"`;
      })
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
    // Check if response exists
    if (!response) {
      throw new Error('Empty response received from NetSuite');
    }
    
    // If response is a string, try to parse it as JSON
    let parsedResponse = response;
    if (typeof response === 'string') {
      try {
        // Limit the size of the response we try to parse to prevent DoS
        if (response.length > 50000000) { // 50MB limit
          throw new Error('Response size exceeds limit');
        }
        
        parsedResponse = JSON.parse(response);
      } catch (error) {
        console.error('Failed to parse NetSuite response as JSON');
        throw new Error('Invalid JSON response from NetSuite');
      }
    }

    // Validate response format
    if (typeof parsedResponse !== 'object') {
      throw new Error('Invalid response format: not an object');
    }
    
    if (!parsedResponse.data) {
      throw new Error('Invalid response format: missing data property');
    }
    
    if (!Array.isArray(parsedResponse.data)) {
      throw new Error('Invalid response format: data is not an array');
    }

    // Safely access properties with defaults
    return {
      data: parsedResponse.data || [],
      pageIndex: typeof parsedResponse.pageIndex === 'number' ? parsedResponse.pageIndex : 0,
      totalPages: typeof parsedResponse.totalPages === 'number' ? parsedResponse.totalPages : 1,
      hasMore: Boolean(parsedResponse.hasMore)
    };
  }

  /**
   * Fetches data from a NetSuite Saved Search
   * @param {string} searchId - The internal ID of the Saved Search
   * @param {number} page - The page number to fetch (0-based)
   * @returns {Promise<Object>} The response data from NetSuite
   */
  async fetchSavedSearch(searchId, page = 0) {
    // Input validation
    if (!searchId || typeof searchId !== 'string') {
      throw new Error('Invalid searchId parameter');
    }
    
    if (page === undefined || page === null || isNaN(parseInt(page))) {
      throw new Error('Invalid page parameter');
    }
    
    // Convert to number and ensure it's non-negative
    page = Math.max(0, parseInt(page));
    
    // Construct the URL with query parameters
    const url = `${this.baseUrl}?script=${encodeURIComponent(this.scriptId)}&deploy=${encodeURIComponent(this.deployId)}&searchId=${encodeURIComponent(searchId)}&page=${encodeURIComponent(page)}`;
    
    try {
      const headers = this.getAuthHeaders(url);
      
      console.log('Making request to NetSuite:');
      console.log(`URL: ${this.baseUrl}?script=${this.scriptId}&deploy=${this.deployId}&searchId=${searchId}&page=${page}`);
      // Don't log full authorization headers
      console.log('Auth headers prepared successfully');
      
      // Add timeout to handle network issues
      const response = await axios.get(url, { 
        headers,
        timeout: 120000 // 120 seconds timeout
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
      // Sanitize error information before logging
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        console.error(`NetSuite API Error Response (${statusCode})`);
        
        if (statusCode === 401 || statusCode === 403) {
          throw new Error('Authentication failed. Please check NetSuite credentials.');
        } else if (statusCode === 404) {
          throw new Error('NetSuite resource not found. Please check searchId and deployment parameters.');
        } else if (statusCode >= 500) {
          throw new Error('NetSuite server error. Please try again later.');
        } else {
          throw new Error(`NetSuite API Error: ${statusCode}`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from NetSuite API');
        throw new Error('Connection to NetSuite failed. Please check your network and try again.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Request setup error');
        throw new Error('Failed to set up request to NetSuite API');
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
      // Input validation
      if (!searchId || typeof searchId !== 'string') {
        throw new Error('Invalid searchId parameter');
      }
      
      if (pageIndex === undefined || pageIndex === null || isNaN(parseInt(pageIndex))) {
        throw new Error('Invalid pageIndex parameter');
      }
      
      // Convert 1-based pageIndex to 0-based page for internal use
      const page = Math.max(0, parseInt(pageIndex) - 1);
      console.log(`Fetching page ${pageIndex} (internal page ${page}) of Saved Search ${searchId}...`);
      
      const rawResponse = await this.fetchSavedSearch(searchId, page);
      const parsedResponse = this.parseNetSuiteResponse(rawResponse);
      
      console.log(`Retrieved ${parsedResponse.data.length} records (page ${parsedResponse.pageIndex + 1} of ${parsedResponse.totalPages})`);
      
      return {
        data: parsedResponse.data || [],
        hasMore: parsedResponse.hasMore || false
      };
    } catch (error) {
      console.error(`Error fetching page ${pageIndex} from saved search ${searchId}`);
      // Provide more specific error message without exposing sensitive details
      if (error.message.includes('Invalid')) {
        throw error; // Pass through validation errors
      } else if (error.message.includes('Authentication failed')) {
        throw error; // Pass through authentication errors
      } else if (error.message.includes('NetSuite resource not found')) {
        throw error; // Pass through 404 errors
      } else {
        throw new Error(`Failed to fetch data from NetSuite saved search ${searchId}`);
      }
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
      console.log(`Account ID: ${this.accountId ? '✓ Set' : '✗ Missing'}`);
      console.log(`Script ID: ${this.scriptId ? '✓ Set' : '✗ Missing'}`);
      console.log(`Deploy ID: ${this.deployId ? '✓ Set' : '✗ Missing'}`);
      console.log(`Base URL: ${this.baseUrl ? '✓ Set' : '✗ Missing'}`);
      
      // Verify we have all required credentials before proceeding
      if (!this.accountId || !this.scriptId || !this.deployId || !this.consumerKey || !this.consumerSecret || !this.tokenId || !this.tokenSecret) {
        throw new Error('Missing required NetSuite credentials');
      }
      
      // Try to fetch the first page of any saved search
      if (!config.mappings || !config.mappings.length) {
        throw new Error('No mappings found for validation');
      }
      
      const searchId = config.mappings[0].searchId;
      console.log(`Testing with Saved Search ID: ${searchId}`);
      
      await this.fetchSavedSearch(searchId, 0);
      console.log('NetSuite validation successful!');
      return true;
    } catch (error) {
      console.error('NetSuite validation error occurred');
      
      // Sanitize error messages to avoid exposing sensitive information
      if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
        throw new Error('Authentication failed. Please check NetSuite credentials.');
      } else if (error.response && error.response.status) {
        throw new Error(`NetSuite API returned status code: ${error.response.status}`);
      } else if (error.message && error.message.includes('Missing required NetSuite credentials')) {
        throw error; // Pass through our own validation error
      } else {
        throw new Error('Failed to validate NetSuite connection');
      }
    }
  }
}

// Export a singleton instance
module.exports = new NetSuiteClient(); 