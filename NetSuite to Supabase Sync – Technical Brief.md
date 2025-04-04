**NetSuite to Supabase Sync – Technical Brief**

**Overview and Goal**

Every 6 hours, a cron-triggered Node.js script will **sync data from NetSuite Saved Searches to Supabase**. This one-off script will:

	•	**Call a NetSuite RESTlet** (custom REST API script in NetSuite) to retrieve Saved Search results (as JSON).

	•	**Upsert** those results into corresponding **Supabase tables** (using the Supabase JS client).

The mapping of Saved Searches to Supabase tables is defined in the provided CSV (e.g. Saved Search internal ID 2019 maps to table cash\_sales, etc.). The script will iterate through each mapping, fetch the data, and update the tables.

This brief covers:

	•	Setting up a NetSuite RESTlet to expose Saved Search results.

	•	Configuring NetSuite **Token-Based Authentication (TBA)** credentials.

	•	Writing the Node.js script to call the RESTlet (with OAuth1.0 headers) and handle responses.

	•	Upserting data into Supabase with its client library.

	•	Important tips and gotchas for NetSuite RESTlets and Saved Searches.

*(This guide assumes you are a mid-level Node.js engineer, comfortable with JavaScript/Node but new to NetSuite.)*

**1\. Creating a NetSuite RESTlet for Saved Searches**

**1.1 What is a RESTlet?**

A **RESTlet** is a custom script in NetSuite (written in SuiteScript, NetSuite’s JavaScript framework) that can be called via RESTful HTTP methods. It acts as a custom endpoint to perform tasks or retrieve data. In this case, we’ll create a RESTlet to run Saved Searches and return their results as JSON.

**1.2 Writing the SuiteScript (Restlet Script)**

NetSuite supports SuiteScript 2.x (similar to modern JS). We will write a SuiteScript 2.x Restlet that accepts a Saved Search ID and returns the results. Key points for the script:

	•	**Module Imports:** Use the N/search module to load and run saved searches.

	•	**Entry Points:** Define at least one entry point function (get, post, etc.). We’ll use GET for fetching data.

	•	**JSDoc Tags:** Include the @NScriptType Restlet tag in the script’s header comments to mark it as a Restlet script .

	•	**Returned Data:** Format the search results into a JavaScript object/array (which NetSuite will serialize to JSON).

**Example Restlet Script (SuiteScript 2.x):** *This script loads a saved search by ID and returns results as JSON.*

/\*\*  
 \*@NApiVersion 2.x  
 \*@NScriptType Restlet  
 \*/  
define(\['N/search'\], function(search) {  
    
  function get(requestParams) {  
    try {  
      var searchId \= requestParams.searchId;  
      if (\!searchId) {  
        throw new Error('Missing searchId parameter');  
      }  
      // Load the saved search by internal ID  
      var searchObj \= search.load({ id: searchId });  
        
      // Run the search and get first 1000 results  
      var results \= searchObj.run().getRange({ start: 0, end: 1000 });  
        
      // Format results into an array of objects  
      var data \= results.map(function(result) {  
        var row \= {};  
        result.columns.forEach(function(col) {  
          // Use column label if set, otherwise use field name  
          var key \= col.label || col.name;  
          row\[key\] \= result.getValue(col);  
        });  
        return row;  
      });  
        
      return data;  // NetSuite will serialize this to JSON  
    } catch (e) {  
      // Handle any errors (e.g., log in NetSuite or return a message)  
      return { error: e.message };  
    }  
  }  
    
  // Expose the GET function (and others if needed)  
  return { get: get };  
});

**Notes:** This script expects each Saved Search to have columns with unique labels or names that correspond to Supabase table fields. Ensure the Saved Search results include all necessary fields (e.g. internal IDs, amounts, etc.). Our search will return more than 1000 results, you need to retrieve data in pages (NetSuite’s search.runPaged() API).**3\. Node.js Script Implementation**

With the RESTlet and credentials ready, the Node.js script can be written. This script will:

	•	Read the mapping of Saved Search IDs to Supabase tables.

	•	For each Saved Search, call the RESTlet (with proper OAuth headers) and get JSON results.

	•	Upsert the results into the corresponding Supabase table.

	•	Run this on a schedule (via cron).

**3.1 Project Setup and Configuration**

Set up a Node.js project (if not already) and install needed packages:

	•	**HTTP client**: e.g. [axios](https://www.npmjs.com/package/axios) or Node’s built-in https/fetch to make HTTPS requests.

	•	**OAuth 1.0 helper**: Using a library like [oauth-1.0a](https://www.npmjs.com/package/oauth-1.0a) simplifies generating the auth header.

	•	**Supabase client**: @supabase/supabase-js for interacting with Supabase.

Run: npm install axios oauth-1.0a @supabase/supabase-js crypto.

**Configuration**: It’s best to store sensitive credentials in environment variables or a config file (not hard-coded). For example, in a .env file define NS\_CONSUMER\_KEY, NS\_CONSUMER\_SECRET, NS\_TOKEN\_ID, NS\_TOKEN\_SECRET, NS\_ACCOUNT\_ID, SUPABASE\_URL, SUPABASE\_SERVICE\_KEY, etc. Load them at runtime (using dotenv package or similar).

**3.2 OAuth1 Setup for NetSuite (Generating the Header)**

NetSuite’s TBA uses OAuth1.0. Each request must include an **Authorization header** with signatures and keys. We will use the credentials from section 2 to sign our requests.

**Using oauth-1.0a library (with HMAC-SHA256):**

const OAuth \= require('oauth-1.0a');  
const crypto \= require('crypto');  
const axios \= require('axios');

// NetSuite credentials and endpoint  
const accountId \= process.env.NS\_ACCOUNT\_ID;  // e.g. '123456' or '123456\_SB1'  
const baseUrl \= \`https://${accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl\`;

// OAuth setup  
const oauth \= OAuth({  
  consumer: { key: process.env.NS\_CONSUMER\_KEY, secret: process.env.NS\_CONSUMER\_SECRET },  
  signature\_method: 'HMAC-SHA256',  // NetSuite supports HMAC-SHA256 (and HMAC-SHA1)  
  hash\_function(baseString, key) {  
    return crypto.createHmac('sha256', key).update(baseString).digest('base64');  
  }  
});  
const token \= { key: process.env.NS\_TOKEN\_ID, secret: process.env.NS\_TOKEN\_SECRET };

When making a request, you’ll create an OAuth signature using the above. For example, to perform a GET request to our RESTlet for a given Saved Search ID:

async function fetchSavedSearchResults(searchId) {

  const allResults \= \[\];

  let page \= 0;

  let hasMore \= true;

  while (hasMore) {

    const url \= \`https://${config.netsuite.accountId}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${config.netsuite.scriptId}\&deploy=${config.netsuite.deployId}\&searchId=${searchId}\&page=${page}\`;

    const headers \= {

      ...getAuthHeader(url),

      'Content-Type': 'application/json',

    };

    try {

      const response \= await axios.get(url, { headers });

      const payload \= response.data;

      if (payload.error) {

        console.error('NetSuite Error:', payload.error);

        break;

      }

      allResults.push(...payload.data);

      hasMore \= payload.hasMore;

      page++;

    } catch (err) {

      console.error('Request failed:', err.message);

      break;

    }

  }

A proper Authorization header will look something like:

OAuth oauth\_consumer\_key="CONSUMER\_KEY", oauth\_token="TOKEN\_ID", oauth\_signature\_method="HMAC-SHA256", oauth\_timestamp="1609459200", oauth\_nonce="randomString", oauth\_version="1.0", oauth\_signature="BASE64\_SIGNATURE", realm="ACCOUNT\_ID"

The library handles constructing this. Just ensure you use a **fresh nonce and timestamp for each request** (oauth-1.0a does this via authorize() each call). NetSuite will reject requests if the OAuth header is invalid or replayed (you’d get an “INVALID\_LOGIN\_ATTEMPT” error in that case).

**Gotcha – Time Sync:** OAuth 1.0 uses timestamps; ensure your server clock is reasonably accurate. If the timestamp in the header is too far off from NetSuite’s time, auth may fail.

**Alternative:** Instead of writing the OAuth signing logic yourself, you could use the community module **nsrestlet** which simplifies connecting to NetSuite RESTlets . For learning purposes, doing it manually (or with oauth-1.0a) is fine, but nsrestlet.createLink(...) can handle OAuth and even NLAuth if needed.

**3.3 Calling the RESTlet and Handling Response**

Using the helper function above, your script can iterate over the Saved Search to table mappings. For each mapping:

	1\.	**Call** the RESTlet via fetchSavedSearchResults(searchId).

	2\.	Expect the response to be an array of result objects (or an object with an error field if something went wrong).

	3\.	Log or handle any errors (if the RESTlet returned { error: ... }, you should catch and inspect why – e.g., invalid search ID or permissions issue).

For example:

const mappings \= \[  
  { searchId: 2019, table: 'cash\_sales' },  
  { searchId: 2018, table: 'credit\_memos' },  
  // ... etc, as per the CSV mapping  
\];

async function runSync() {  
  for (const { searchId, table } of mappings) {  
    try {  
      const results \= await fetchSavedSearchResults(searchId);  
      if (results.error) {  
        console.error(\`Error from RESTlet for search ${searchId}:\`, results.error);  
        continue;  
      }  
      console.log(\`Fetched ${results.length} records from search ${searchId}.\`);  
      await upsertIntoSupabase(table, results);  
    } catch (err) {  
      console.error(\`Request failed for search ${searchId}:\`, err);  
    }  
  }  
}

// Run the sync  
runSync();

*(You might load the CSV and parse it to get mappings. For simplicity, you could also hardcode the mapping array or use a JSON config. Since the mapping likely won’t change often, either approach works. If using the CSV at runtime, use Node’s fs and a CSV parser to build the mappings array.)*

**3.4 Upserting Data into Supabase**

With the data for each table in hand, use the Supabase client to **upsert** (insert or update) into the appropriate table. Make sure you’ve [initialized the Supabase client](https://supabase.com/docs/guides/getting-started/tutorials/with-js) with your Supabase URL and a **service role API key** (the service key has full database permissions and is safe to use on the server side):

const { createClient } \= require('@supabase/supabase-js');  
const supabaseUrl \= process.env.SUPABASE\_URL;  
const supabaseServiceKey \= process.env.SUPABASE\_SERVICE\_KEY;  // use the secret service role key  
const supabase \= createClient(supabaseUrl, supabaseServiceKey);

Now define the upsert function. We assume each result object’s keys match the column names in the Supabase table. If not, you’ll need to map/rename fields accordingly. Also ensure that the Supabase table has a primary key or unique constraint (for example, an id column corresponding to NetSuite’s internal ID) so that upsert knows how to detect conflicts.

Example upsert usage (bulk upsert an array of objects):

async function upsertIntoSupabase(table, records) {  
  // Perform upsert (insert or update based on primary key conflict)  
  const { data, error } \= await supabase  
    .from(table)  
    .upsert(records, { onConflict: 'id' })   // assuming 'id' is primary key in table  
    .select();  // select() if you want the updated data returned

  if (error) {  
    console.error(\`Supabase upsert into ${table} failed:\`, error);  
  } else {  
    console.log(\`Upserted ${records.length} records into '${table}' table.\`);  
  }  
}

The Supabase client’s .upsert() will insert new rows and update existing rows that conflict on the specified key(s). For example, if the table’s primary key is id, each object in records should include the id. If a record with that id exists, it will be updated; if not, it will be inserted . Adjust the onConflict option based on your schema (it can be a composite key or unique column too).

**Gotcha – Data Types:** All data from the RESTlet is received as strings (NetSuite Saved Search returns values as strings by default). You may need to cast or convert types before upserting (e.g., convert numeric strings to JavaScript Numbers, or parse date strings). Supabase (PostgreSQL) will try to cast them into the column type, but explicit conversion in the script can be safer.

**Gotcha – Missing/Deleted Records:** This one-way sync doesn’t automatically delete rows in Supabase if they were removed in NetSuite (or no longer meet search criteria). If needed, you might handle deletions by comparing IDs, or by clearing a table before insert. A simpler approach is to have the Saved Search itself only return current active records and perhaps mark inactive ones; upsert will update existing ones. Just be mindful that over time Supabase may accumulate some records that NetSuite no longer has, unless you handle cleanup.

**3.5 Running the Script via Cron**

Since the Node.js app is a one-off script (not a persistent service), you will use cron to schedule it. On a Linux server, you might edit the crontab (e.g., crontab \-e) to add an entry. For a 6-hour interval, for example:

0 \*/6 \* \* \*   /usr/bin/node /path/to/netsuite\_sync.js \>\> /var/log/netsuite\_sync.log 2\>&1

This runs the script every 6 hours on the hour (adjust the schedule as needed). We redirect output to a log file for monitoring. Make sure the environment variables (NetSuite keys, Supabase keys, etc.) are available to the cron – you might source a profile or use a script that exports them, or include them in the crontab entry.

If deploying on a service or container, you can use its scheduler or equivalent (e.g., Heroku Scheduler, Kubernetes CronJob, etc.) with the same idea: run the Node script on a 6-hour schedule.

**4\. Tips and Gotchas**

**NetSuite API Constraints:** NetSuite RESTlets have governance limits (they consume “SuiteScript governance units” for operations) and a script may be set to time out if running too long. The simple search-and-return in the Restlet should be fine, but if any Saved Search is very large (thousands of records), consider implementing pagination in the RESTlet (using search.runPaged() as in the example script) to fetch in chunks. You could then have the Node script request multiple pages sequentially. Alternatively, limit the search criteria if possible or use SuiteAnalytics Connect/SuiteQL for large data.

**Authentication Errors:** If you get HTTP 401 or 403 errors when calling the RESTlet:

	•	Double check your OAuth header construction and credentials. The realm in the header should be your account ID .

	•	Ensure the token role has “Log in using Access Tokens” and not a Web Services Only role (Web Services Only roles cannot call RESTlets ).

	•	Make sure the script deployment is **Released** and not Restricted to an unexpected audience.

**Content Types:** Always set Content-Type: application/json on your request and return JSON from the RESTlet. NetSuite will parse incoming JSON request bodies to an object. In our case we send a GET with no body, but we set Content-Type just to be explicit. The RESTlet’s response (an array or object) will be JSON-encoded automatically when called externally .

**Securing Credentials:** Treat the Consumer and Token secrets like passwords. Do not commit them to code repositories. Use environment variables or a secrets manager. The same applies to the Supabase service key (which can bypass Row Level Security).

**Supabase Upsert Considerations:** Upsert is convenient, but ensure you use it correctly:

	•	Include the primary key in each record object (e.g., an id or other unique field from NetSuite).

	•	If your table uses a composite key (less likely here), use the onConflict option with comma-separated column names .

	•	If you have a large number of rows, you might batch them or stream them. The Supabase JS client will send the entire array in one request; watch out for very large payloads. If needed, chunk the results (e.g., upsert 500 at a time).

**Testing:** Before wiring up cron, test the script manually:

	•	Run the Node script once and verify it retrieves data and upserts to Supabase.

	•	You can test the RESTlet independently using a tool like Postman (configure OAuth1 there) or a simple Node snippet, to ensure the NetSuite side is working.

	•	It’s often helpful to log the output (maybe limit to a few records) during development to see the field names and data format coming from NetSuite, so you can adjust mapping to Supabase fields.

**Error Handling & Retries:** Consider what happens if one of the Saved Search calls fails (network glitch or NetSuite down). The script currently logs and continues. In a cron setup, the next run (6 hours later) will try again. This is probably fine for this use-case. If data is mission-critical, you might add retry logic with backoff for transient errors.

**Supabase Row Level Security (RLS):** If your Supabase tables have RLS enabled, using the service role key bypasses RLS. This is usually what you want for a backend sync. Just be aware that the service key has full rights on the database; keep it secure.

By following these steps, you will have a robust one-off Node.js script that regularly syncs NetSuite data to Supabase. The mid-level Node skills you have will be sufficient, and this guide demystifies the NetSuite-specific parts (Restlet and TBA). Good luck with your integration\!

**Sources**

	•	NetSuite Help – *Deploying a RESTlet* (script deployment steps and requirements)

	•	StackOverflow – *OAuth1 Header for NetSuite RESTlet* (example of constructing the OAuth header)

	•	Supabase JavaScript SDK – *Upsert Usage* (demonstration of upserting data using the client library)

	•	NSRestlet Library – *OAuth Connection Example* (community library showing how NetSuite RESTlet calls are configured)

