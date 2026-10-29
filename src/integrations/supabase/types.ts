export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_id: string
          assigned_task: string | null
          attempts: number
          completed_at: string | null
          experiment_run_id: string
          id: string
          output_json: Json | null
          owner_id: string
          parent_agent_id: string | null
          role: string
          started_at: string | null
          status: string
          task_run_id: string
        }
        Insert: {
          agent_id: string
          assigned_task?: string | null
          attempts?: number
          completed_at?: string | null
          experiment_run_id: string
          id?: string
          output_json?: Json | null
          owner_id?: string
          parent_agent_id?: string | null
          role: string
          started_at?: string | null
          status: string
          task_run_id: string
        }
        Update: {
          agent_id?: string
          assigned_task?: string | null
          attempts?: number
          completed_at?: string | null
          experiment_run_id?: string
          id?: string
          output_json?: Json | null
          owner_id?: string
          parent_agent_id?: string | null
          role?: string
          started_at?: string | null
          status?: string
          task_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_experiment_run_id_fkey"
            columns: ["experiment_run_id"]
            isOneToOne: false
            referencedRelation: "experiment_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_task_run_id_fkey"
            columns: ["task_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      benchmark_tasks: {
        Row: {
          complexity: string
          conflicting: boolean
          created_at: string
          dataset_id: string
          description: string
          forbidden_claims: string[]
          id: string
          owner_id: string
          reference_facts: string[]
          required_fields: string[]
          rubric: string | null
          task_key: string
        }
        Insert: {
          complexity?: string
          conflicting?: boolean
          created_at?: string
          dataset_id: string
          description: string
          forbidden_claims?: string[]
          id?: string
          owner_id?: string
          reference_facts?: string[]
          required_fields?: string[]
          rubric?: string | null
          task_key: string
        }
        Update: {
          complexity?: string
          conflicting?: boolean
          created_at?: string
          dataset_id?: string
          description?: string
          forbidden_claims?: string[]
          id?: string
          owner_id?: string
          reference_facts?: string[]
          required_fields?: string[]
          rubric?: string | null
          task_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "benchmark_tasks_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          owner_id: string
          project_id: string
          schema_json: Json
          source_type: string
          template: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          owner_id?: string
          project_id: string
          schema_json?: Json
          source_type?: string
          template?: string
          version?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          owner_id?: string
          project_id?: string
          schema_json?: Json
          source_type?: string
          template?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          details_json: Json
          evaluator_type: string
          evaluator_version: string
          experiment_run_id: string
          id: string
          metric_name: string
          metric_value: number | null
          owner_id: string
          task_run_id: string | null
        }
        Insert: {
          created_at?: string
          details_json?: Json
          evaluator_type: string
          evaluator_version: string
          experiment_run_id: string
          id?: string
          metric_name: string
          metric_value?: number | null
          owner_id?: string
          task_run_id?: string | null
        }
        Update: {
          created_at?: string
          details_json?: Json
          evaluator_type?: string
          evaluator_version?: string
          experiment_run_id?: string
          id?: string
          metric_name?: string
          metric_value?: number | null
          owner_id?: string
          task_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_experiment_run_id_fkey"
            columns: ["experiment_run_id"]
            isOneToOne: false
            referencedRelation: "experiment_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_task_run_id_fkey"
            columns: ["task_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_artifacts: {
        Row: {
          artifact_type: string
          created_at: string
          experiment_run_id: string
          id: string
          metadata_json: Json
          owner_id: string
          storage_path: string | null
        }
        Insert: {
          artifact_type: string
          created_at?: string
          experiment_run_id: string
          id?: string
          metadata_json?: Json
          owner_id?: string
          storage_path?: string | null
        }
        Update: {
          artifact_type?: string
          created_at?: string
          experiment_run_id?: string
          id?: string
          metadata_json?: Json
          owner_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiment_artifacts_experiment_run_id_fkey"
            columns: ["experiment_run_id"]
            isOneToOne: false
            referencedRelation: "experiment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_definitions: {
        Row: {
          category: string
          configuration_json: Json
          created_at: string
          dataset_id: string | null
          dataset_version: string | null
          description: string | null
          hypothesis: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          project_id: string
          tags: string[]
        }
        Insert: {
          category: string
          configuration_json: Json
          created_at?: string
          dataset_id?: string | null
          dataset_version?: string | null
          description?: string | null
          hypothesis?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string
          project_id: string
          tags?: string[]
        }
        Update: {
          category?: string
          configuration_json?: Json
          created_at?: string
          dataset_id?: string | null
          dataset_version?: string | null
          description?: string | null
          hypothesis?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          project_id?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "experiment_definitions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_runs: {
        Row: {
          completed_at: string | null
          configuration_snapshot: Json
          created_at: string
          error_summary: string | null
          experiment_definition_id: string
          id: string
          model_identifier: string
          owner_id: string
          provider: string
          started_at: string | null
          status: string
          summary_json: Json | null
          sweep_label: string | null
          trace_id: string | null
          trial_index: number
        }
        Insert: {
          completed_at?: string | null
          configuration_snapshot: Json
          created_at?: string
          error_summary?: string | null
          experiment_definition_id: string
          id?: string
          model_identifier: string
          owner_id?: string
          provider: string
          started_at?: string | null
          status?: string
          summary_json?: Json | null
          sweep_label?: string | null
          trace_id?: string | null
          trial_index?: number
        }
        Update: {
          completed_at?: string | null
          configuration_snapshot?: Json
          created_at?: string
          error_summary?: string | null
          experiment_definition_id?: string
          id?: string
          model_identifier?: string
          owner_id?: string
          provider?: string
          started_at?: string | null
          status?: string
          summary_json?: Json | null
          sweep_label?: string | null
          trace_id?: string | null
          trial_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "experiment_runs_experiment_definition_id_fkey"
            columns: ["experiment_definition_id"]
            isOneToOne: false
            referencedRelation: "experiment_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      task_runs: {
        Row: {
          completed_at: string | null
          evaluation_status: string
          experiment_run_id: string
          final_output: Json | null
          id: string
          metrics_json: Json | null
          owner_id: string
          started_at: string | null
          status: string
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          evaluation_status?: string
          experiment_run_id: string
          final_output?: Json | null
          id?: string
          metrics_json?: Json | null
          owner_id?: string
          started_at?: string | null
          status: string
          task_id: string
        }
        Update: {
          completed_at?: string | null
          evaluation_status?: string
          experiment_run_id?: string
          final_output?: Json | null
          id?: string
          metrics_json?: Json | null
          owner_id?: string
          started_at?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_runs_experiment_run_id_fkey"
            columns: ["experiment_run_id"]
            isOneToOne: false
            referencedRelation: "experiment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      trace_spans: {
        Row: {
          agent_run_id: string | null
          attributes_json: Json
          duration_ms: number
          end_time: string
          events_json: Json
          experiment_run_id: string
          id: string
          operation_name: string
          owner_id: string
          parent_span_id: string | null
          span_id: string
          start_time: string
          status: string
          task_run_id: string | null
          trace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          attributes_json?: Json
          duration_ms: number
          end_time: string
          events_json?: Json
          experiment_run_id: string
          id?: string
          operation_name: string
          owner_id?: string
          parent_span_id?: string | null
          span_id: string
          start_time: string
          status: string
          task_run_id?: string | null
          trace_id: string
        }
        Update: {
          agent_run_id?: string | null
          attributes_json?: Json
          duration_ms?: number
          end_time?: string
          events_json?: Json
          experiment_run_id?: string
          id?: string
          operation_name?: string
          owner_id?: string
          parent_span_id?: string | null
          span_id?: string
          start_time?: string
          status?: string
          task_run_id?: string | null
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trace_spans_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_spans_experiment_run_id_fkey"
            columns: ["experiment_run_id"]
            isOneToOne: false
            referencedRelation: "experiment_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trace_spans_task_run_id_fkey"
            columns: ["task_run_id"]
            isOneToOne: false
            referencedRelation: "task_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
