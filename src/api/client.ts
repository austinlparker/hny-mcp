import { z } from "zod";
import {
  QueryResult,
  AnalysisQuery,
  QueryCalculation,
} from "../types/query.js";
import { QueryToolSchema, ColumnAnalysisSchema } from "../types/schema.js";
import { HoneycombConfig } from "../types/config.js";
import { HoneycombError } from "../utils/errors.js";
import { Column } from "../types/column.js";
import { Dataset } from "../types/api.js";
import { SLO, SLODetailedResponse } from "../types/slo.js";
import { TriggerResponse } from "../types/trigger.js";
import { HoneycombEnvironment } from "../types/config.js";

export class HoneycombAPI {
  private readonly environments: Map<string, HoneycombEnvironment>;

  constructor(config: HoneycombConfig) {
    this.environments = new Map(
      config.environments.map((env) => [env.name, env]),
    );
  }

  getEnvironments(): string[] {
    return Array.from(this.environments.keys());
  }

  private async request<T>(
    environment: string,
    path: string,
    options: RequestInit & { params?: Record<string, any> } = {},
  ): Promise<T> {
    const env = this.environments.get(environment);
    if (!env) {
      throw new Error(`Unknown environment: ${environment}`);
    }

    const baseUrl = env.baseUrl || "https://api.honeycomb.io";
    const { params, ...requestOptions } = options;

    let url = `${baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      url += `?${searchParams.toString()}`;
    }

    const response = await fetch(url, {
      ...requestOptions,
      headers: {
        "X-Honeycomb-Team": env.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new HoneycombError(
        response.status,
        `Honeycomb API error: ${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // Dataset methods
  async getDataset(environment: string, datasetSlug: string): Promise<Dataset> {
    return this.request(environment, `/1/datasets/${datasetSlug}`);
  }

  async listDatasets(environment: string): Promise<Dataset[]> {
    return this.request(environment, "/1/datasets");
  }

  // Query methods
  async createQuery(
    environment: string,
    datasetSlug: string,
    query: AnalysisQuery,
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      environment,
      `/1/queries/${datasetSlug}`,
      {
        method: "POST",
        body: JSON.stringify(query),
      },
    );
  }

  async createQueryResult(
    environment: string,
    datasetSlug: string,
    queryId: string,
  ): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      environment,
      `/1/query_results/${datasetSlug}`,
      {
        method: "POST",
        body: JSON.stringify({ query_id: queryId }),
      },
    );
  }

  async getQueryResults(
    environment: string,
    datasetSlug: string,
    queryResultId: string,
  ): Promise<QueryResult> {
    return this.request<QueryResult>(
      environment,
      `/1/query_results/${datasetSlug}/${queryResultId}`,
    );
  }

  async queryAndWaitForResults(
    environment: string,
    datasetSlug: string,
    query: AnalysisQuery,
    maxAttempts = 10,
  ): Promise<QueryResult> {
    const queryResponse = await this.createQuery(
      environment,
      datasetSlug,
      query,
    );
    const queryId = queryResponse.id;

    const queryResult = await this.createQueryResult(
      environment,
      datasetSlug,
      queryId,
    );
    const queryResultId = queryResult.id;

    let attempts = 0;
    while (attempts < maxAttempts) {
      const results = await this.getQueryResults(
        environment,
        datasetSlug,
        queryResultId,
      );
      if (results.complete) {
        return results;
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Query timed out waiting for results");
  }

  // Column methods
  async getColumns(
    environment: string,
    datasetSlug: string,
  ): Promise<Column[]> {
    return this.request(environment, `/1/columns/${datasetSlug}`);
  }

  async getColumnByName(
    environment: string,
    datasetSlug: string,
    keyName: string,
  ): Promise<Column> {
    return this.request(
      environment,
      `/1/columns/${datasetSlug}?key_name=${encodeURIComponent(keyName)}`,
    );
  }

  async getVisibleColumns(
    environment: string,
    datasetSlug: string,
  ): Promise<Column[]> {
    const columns = await this.getColumns(environment, datasetSlug);
    return columns.filter((column) => !column.hidden);
  }

  async runAnalysisQuery(
    environment: string,
    datasetSlug: string,
    params: z.infer<typeof QueryToolSchema>,
  ) {
    const query: AnalysisQuery = {
      calculations: [
        {
          op: params.calculation,
          ...(params.column && { column: params.column }),
        },
      ],
      breakdowns: params.breakdowns || [],
      time_range: params.timeRange || 3600,
      ...(params.filter && { filters: [params.filter] }),
    };

    try {
      const results = await this.queryAndWaitForResults(
        environment,
        datasetSlug,
        query,
      );
      return {
        data: {
          results: results.data?.results || [],
          series: results.data?.series || [],
        },
        links: results.links,
      };
    } catch (error) {
      throw new Error(
        `Analysis query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async analyzeColumn(
    environment: string,
    datasetSlug: string,
    params: z.infer<typeof ColumnAnalysisSchema>,
  ) {
    const column = await this.getColumnByName(
      environment,
      datasetSlug,
      params.column,
    );

    const query: AnalysisQuery = {
      calculations: [{ op: "COUNT" }],
      breakdowns: [params.column],
      time_range: params.timeRange || 3600,
      orders: [
        {
          op: "COUNT",
          order: "descending",
        },
      ],
      limit: 10,
    };

    if (column.type === "integer" || column.type === "float") {
      const numericCalculations: QueryCalculation[] = [
        { op: "AVG", column: params.column },
        { op: "P95", column: params.column },
        { op: "MAX", column: params.column },
        { op: "MIN", column: params.column },
      ];
      query.calculations.push(...numericCalculations);
    }

    try {
      const results = await this.queryAndWaitForResults(
        environment,
        datasetSlug,
        query,
      );
      return {
        data: {
          results: results.data?.results || [],
          series: results.data?.series || [],
        },
        links: results.links,
      };
    } catch (error) {
      throw new Error(
        `Column analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getSLOs(environment: string, datasetSlug: string): Promise<SLO[]> {
    return this.request<SLO[]>(environment, `/1/slos/${datasetSlug}`);
  }

  async getSLO(
    environment: string,
    datasetSlug: string,
    sloId: string,
  ): Promise<SLODetailedResponse> {
    return this.request<SLODetailedResponse>(
      environment,
      `/1/slos/${datasetSlug}/${sloId}`,
      { params: { detailed: true } },
    );
  }

  async getTriggers(
    environment: string,
    datasetSlug: string,
  ): Promise<TriggerResponse[]> {
    return this.request<TriggerResponse[]>(
      environment,
      `/1/triggers/${datasetSlug}`,
    );
  }

  async getTrigger(
    environment: string,
    datasetSlug: string,
    triggerId: string,
  ): Promise<TriggerResponse> {
    return this.request<TriggerResponse>(
      environment,
      `/1/triggers/${datasetSlug}/${triggerId}`,
    );
  }
}