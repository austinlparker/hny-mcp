import { z } from "zod";
import { Column } from "./column.js";
import { AnalysisQuery, QueryResult } from "./query.js";

export interface Resource {
  uri: string;
  name: string;
  description: string;
}

export interface Dataset {
  name: string;
  slug: string;
  description?: string;
  settings?: {
    delete_protected?: boolean;
  };
  expand_json_depth?: number;
  regular_columns_count?: number;
  last_written_at?: string | null;
  created_at: string;
}

export interface DatasetWithColumns extends Dataset {
  columns: {
    name: string;
    type: string;
    description?: string;
  }[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: {
    name: string;
    description: string;
    required: boolean;
  }[];
}

export interface MessageContent {
  type: "text";
  text: string;
}

export interface ToolResponse {
  content: MessageContent[];
}

export interface PromptResponse {
  messages: {
    role: "user";
    content: MessageContent;
  }[];
}