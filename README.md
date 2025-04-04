# NetSuite to Supabase Sync

A Node.js application that synchronizes data from NetSuite Saved Searches to Supabase tables on a scheduled basis.

## Features

- Fetches data from NetSuite Saved Searches via RESTlet
- Upserts data into corresponding Supabase tables
- Runs on a configurable schedule (default: every 6 hours)
- Handles pagination and large datasets
- Secure credential management

## Prerequisites

- Node.js (latest version)
- NetSuite account with RESTlet access
- Supabase account with appropriate permissions
- NetSuite Token-Based Authentication (TBA) credentials

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
4. Configure your Saved Search to Supabase table mappings in `src/mappings/searchToTable.json`

## Configuration

### Environment Variables

See `.env.example` for all required environment variables.

### Saved Search Mappings

Edit `src/mappings/searchToTable.json` to map NetSuite Saved Search IDs to Supabase table names.

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

## Project Structure

```
netsuite-supabase-sync/
├── src/
│   ├── config/          # Configuration management
│   ├── netsuite/        # NetSuite API integration
│   ├── supabase/        # Supabase client and operations
│   ├── mappings/        # Saved Search to table mappings
│   ├── sync.js          # Core sync logic
│   └── index.js         # Application entry point
├── .env                 # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

## Error Handling

The application includes comprehensive error handling for:
- NetSuite API failures
- Supabase connection issues
- Data transformation errors
- Authentication problems

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

ISC 