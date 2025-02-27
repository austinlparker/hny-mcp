# Honeycomb MCP Server
[![smithery badge](https://smithery.ai/badge/@honeycombio/honeycomb-mcp)](https://smithery.ai/server/@honeycombio/honeycomb-mcp)

A [Model Context Protocol](https://modelcontextprotocol.io) server for interacting with Honeycomb observability data. This server enables LLMs like Claude to directly analyze and query your Honeycomb datasets across multiple environments.

## Features

- Query Honeycomb datasets across multiple environments
- Analyze columns and data patterns
- Run analytics queries with support for:
  - Multiple calculation types (COUNT, AVG, P95, etc.)
  - Breakdowns and filters
  - Time-based analysis
- Monitor SLOs and their status
- View and analyze Triggers
- Access dataset metadata and schema information

## Installation

### Installing via Smithery

To install Honeycomb MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@honeycombio/honeycomb-mcp):

```bash
npx -y @smithery/cli install @honeycombio/honeycomb-mcp --client claude
```

### Manual Installation
```bash
pnpm install
pnpm run build
```

## Configuration

Create a configuration file at `.mcp-honeycomb.json` in one of these locations:
- Current directory
- Home directory (`~/.mcp-honeycomb.json`)
- Custom location specified by `MCP_HONEYCOMB_CONFIG` environment variable

Example configuration:
```json
{
  "environments": [
    {
      "name": "production",
      "apiKey": "your_prod_api_key"
    },
    {
      "name": "staging",
      "apiKey": "your_staging_api_key"
    }
  ]
}
```

## Usage

### With Claude or other MCP Clients

The server exposes both resources and tools for interacting with Honeycomb data.

#### Resources

Access Honeycomb datasets using URIs in the format:
`honeycomb://{environment}/{dataset}`

For example:
- `honeycomb://production/api-requests`
- `honeycomb://staging/backend-services`

The resource response includes:
- Dataset name
- Column information (name, type, description)
- Schema details

#### Tools

- `list_datasets`: List all datasets in an environment
  ```json
  { "environment": "production" }
  ```

- `get_columns`: Get column information for a dataset
  ```json
  {
    "environment": "production",
    "dataset": "api-requests"
  }
  ```

- `run_query`: Run analytics queries with rich options
  ```json
  {
    "environment": "production",
    "dataset": "api-requests",
    "calculations": [
      { "op": "COUNT" },
      { "op": "P95", "column": "duration_ms" }
    ],
    "breakdowns": ["service.name"],
    "time_range": 3600
  }
  ```

- `analyze_column`: Get statistical analysis of a column
  ```json
  {
    "environment": "production",
    "dataset": "api-requests",
    "column": "duration_ms"
  }
  ```

- `list_slos`: List all SLOs for a dataset
  ```json
  {
    "environment": "production",
    "dataset": "api-requests"
  }
  ```

- `get_slo`: Get detailed SLO information
  ```json
  {
    "environment": "production",
    "dataset": "api-requests",
    "sloId": "abc123"
  }
  ```

- `list_triggers`: List all triggers for a dataset
  ```json
  {
    "environment": "production",
    "dataset": "api-requests"
  }
  ```

- `get_trigger`: Get detailed trigger information
  ```json
  {
    "environment": "production",
    "dataset": "api-requests",
    "triggerId": "xyz789"
  }
  ```

### Example Queries

Ask Claude things like:

- "What datasets are available in the production environment?"
- "Show me the P95 latency for the API service over the last hour"
- "What's the error rate broken down by service name?"
- "Are there any SLOs close to breaching their budget?"
- "Show me all active triggers in the staging environment"
- "What columns are available in the production API dataset?"

## Development

```bash
pnpm install
pnpm run build
```

## Requirements

- Node.js 16+
- Honeycomb API keys with appropriate permissions:
  - Query access for analytics
  - Read access for SLOs and Triggers
  - Environment-level access for dataset operations

## License

MIT
