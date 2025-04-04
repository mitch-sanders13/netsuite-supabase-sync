netsuite-supabase-sync/  
├── src/  
│   ├── config/  
│   │   └── index.js            \# Loads and exports environment config  
│   ├── netsuite/  
│   │   ├── client.js           \# Handles OAuth and NetSuite RESTlet calls  
│   │   └── fetchSavedSearch.js\# Encapsulates logic to call RESTlet for a given searchId  
│   ├── supabase/  
│   │   ├── client.js           \# Creates and exports the Supabase client  
│   │   └── upsert.js           \# Function to upsert data into Supabase  
│   ├── mappings/  
│   │   └── searchToTable.json  \# Saved Search ID to Supabase table mapping  
│   ├── sync.js                 \# Core logic: loads mapping, fetches, and upserts  
│   └── index.js                \# Entrypoint for the cron job  
├── .env                        \# Holds secrets (not committed)  
├── .gitignore  
├── package.json  
└── README.md  
