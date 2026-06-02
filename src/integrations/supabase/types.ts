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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budget_lines: {
        Row: {
          actual_expenditure: number
          budget_id: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          planned_amount: number
        }
        Insert: {
          actual_expenditure?: number
          budget_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          planned_amount?: number
        }
        Update: {
          actual_expenditure?: number
          budget_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          planned_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          analytic_account: string | null
          budget_number: string
          created_at: string
          created_by: string | null
          currency: string
          date_from: string | null
          date_to: string | null
          id: string
          project_id: string | null
          responsible_id: string | null
          status: string | null
        }
        Insert: {
          analytic_account?: string | null
          budget_number: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          project_id?: string | null
          responsible_id?: string | null
          status?: string | null
        }
        Update: {
          analytic_account?: string | null
          budget_number?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          date_from?: string | null
          date_to?: string | null
          id?: string
          project_id?: string | null
          responsible_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      chat_channel_members: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_group: boolean
          name: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_group?: boolean
          name?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          id: string
          job_cost_sheet_id: string | null
          mime_type: string | null
          name: string
          project_id: string | null
          size_bytes: number | null
          storage_path: string
          supplier_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_cost_sheet_id?: string | null
          mime_type?: string | null
          name: string
          project_id?: string | null
          size_bytes?: number | null
          storage_path: string
          supplier_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_cost_sheet_id?: string | null
          mime_type?: string | null
          name?: string
          project_id?: string | null
          size_bytes?: number | null
          storage_path?: string
          supplier_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_job_cost_sheet_id_fkey"
            columns: ["job_cost_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_cost_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_lines: {
        Row: {
          actual_purchased_cost: number
          actual_purchased_qty: number | null
          actual_quantity: number
          actual_requisition_qty: number | null
          actual_vendor_bill_cost: number | null
          actual_vendor_bill_qty: number | null
          cost_per_unit: number | null
          cost_price_subtotal: number | null
          created_at: string
          description: string | null
          id: string
          invoice_subtotal: number | null
          job_cost_sheet_id: string
          job_type: string
          planned_qty: number | null
          product: string | null
          product_id: string | null
          quantity: number
          tab_type: string | null
          total_cost: number | null
          unit_price: number
          uom: string | null
        }
        Insert: {
          actual_purchased_cost?: number
          actual_purchased_qty?: number | null
          actual_quantity?: number
          actual_requisition_qty?: number | null
          actual_vendor_bill_cost?: number | null
          actual_vendor_bill_qty?: number | null
          cost_per_unit?: number | null
          cost_price_subtotal?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_subtotal?: number | null
          job_cost_sheet_id: string
          job_type: string
          planned_qty?: number | null
          product?: string | null
          product_id?: string | null
          quantity?: number
          tab_type?: string | null
          total_cost?: number | null
          unit_price?: number
          uom?: string | null
        }
        Update: {
          actual_purchased_cost?: number
          actual_purchased_qty?: number | null
          actual_quantity?: number
          actual_requisition_qty?: number | null
          actual_vendor_bill_cost?: number | null
          actual_vendor_bill_qty?: number | null
          cost_per_unit?: number | null
          cost_price_subtotal?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_subtotal?: number | null
          job_cost_sheet_id?: string
          job_type?: string
          planned_qty?: number | null
          product?: string | null
          product_id?: string | null
          quantity?: number
          tab_type?: string | null
          total_cost?: number | null
          unit_price?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_cost_lines_job_cost_sheet_id_fkey"
            columns: ["job_cost_sheet_id"]
            isOneToOne: false
            referencedRelation: "job_cost_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cost_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_sheets: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          name: string
          notes: string | null
          project_id: string | null
          receipt_path: string | null
          sheet_date: string | null
          state: string
          status: string
          total_planned_cost: number
          updated_at: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string | null
          receipt_path?: string | null
          sheet_date?: string | null
          state?: string
          status?: string
          total_planned_cost?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_id?: string | null
          receipt_path?: string | null
          sheet_date?: string | null
          state?: string
          status?: string
          total_planned_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cost_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          id: string
          ip_address: string | null
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          id: string
          name: string
          standard_price: number
          unit_of_measure: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          standard_price?: number
          unit_of_measure?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          standard_price?: number
          unit_of_measure?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget_spent: number
          budget_total: number
          created_at: string
          customer_name: string | null
          description: string | null
          expected_end_date: string | null
          id: string
          location: string | null
          name: string
          project_manager_id: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_spent?: number
          budget_total?: number
          created_at?: string
          customer_name?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          location?: string | null
          name: string
          project_manager_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_spent?: number
          budget_total?: number
          created_at?: string
          customer_name?: string | null
          description?: string | null
          expected_end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          project_manager_id?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      requisition_lines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          job_cost_center_id: string | null
          job_cost_line: string | null
          product: string | null
          quantity: number
          requisition_action: string | null
          requisition_id: string
          total: number | null
          unit_cost: number
          uom: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          job_cost_center_id?: string | null
          job_cost_line?: string | null
          product?: string | null
          quantity?: number
          requisition_action?: string | null
          requisition_id: string
          total?: number | null
          unit_cost?: number
          uom?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          job_cost_center_id?: string | null
          job_cost_line?: string | null
          product?: string | null
          quantity?: number
          requisition_action?: string | null
          requisition_id?: string
          total?: number | null
          unit_cost?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_lines_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          analytic_account: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          department: string | null
          employee_id: string | null
          id: string
          is_change_order: boolean | null
          project_id: string | null
          reason: string | null
          received_date: string | null
          requisition_date: string
          requisition_number: string
          requisition_type: string | null
          responsible_id: string | null
          status: string | null
          task_job_order: string | null
        }
        Insert: {
          analytic_account?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          employee_id?: string | null
          id?: string
          is_change_order?: boolean | null
          project_id?: string | null
          reason?: string | null
          received_date?: string | null
          requisition_date?: string
          requisition_number: string
          requisition_type?: string | null
          responsible_id?: string | null
          status?: string | null
          task_job_order?: string | null
        }
        Update: {
          analytic_account?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          department?: string | null
          employee_id?: string | null
          id?: string
          is_change_order?: boolean | null
          project_id?: string | null
          reason?: string | null
          received_date?: string | null
          requisition_date?: string
          requisition_number?: string
          requisition_type?: string | null
          responsible_id?: string | null
          status?: string | null
          task_job_order?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          job_title: string | null
          last_login_at: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_login_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel: string; _user: string }
        Returns: boolean
      }
      start_direct_message: { Args: { _other: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "site_manager" | "procurement_officer" | "accountant"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "site_manager", "procurement_officer", "accountant"],
    },
  },
} as const
