export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      products_catalog: {
        Row: {
          id: string;
          sku: string;
          description: string;
          box_sf: number;
          box_edgeband: number | null;
          box_edgeband_color: number | null;
          doors_fronts_sf: number;
          doors_fronts_edgeband: number | null;
          total_edgeband: number;
          has_drawers: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          description: string;
          box_sf: number;
          box_edgeband?: number | null;
          box_edgeband_color?: number | null;
          doors_fronts_sf: number;
          doors_fronts_edgeband?: number | null;
          total_edgeband: number;
          has_drawers?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          description?: string;
          box_sf?: number;
          box_edgeband?: number | null;
          box_edgeband_color?: number | null;
          doors_fronts_sf?: number;
          doors_fronts_edgeband?: number | null;
          total_edgeband?: number;
          has_drawers?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      price_list: {
        Row: {
          id: string;
          sku_code: string | null;
          concept_description: string;
          type: string;
          material: string | null;
          dimensions: string | null;
          unit: string;
          price: number;
          sf_per_sheet: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku_code?: string | null;
          concept_description: string;
          type: string;
          material?: string | null;
          dimensions?: string | null;
          unit: string;
          price: number;
          sf_per_sheet?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku_code?: string | null;
          concept_description?: string;
          type?: string;
          material?: string | null;
          dimensions?: string | null;
          unit?: string;
          price?: number;
          sf_per_sheet?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          name: string;
          customer: string | null;
          address: string | null;
          quote_date: string;
          total_amount: number;
          status: string;
          project_type: string;
          other_expenses: number;
          tariff_multiplier: number;
          profit_multiplier: number;
          tax_percentage: number;
          install_delivery: number;
          project_details: string | null;
          project_brief: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          customer?: string | null;
          address?: string | null;
          quote_date?: string;
          total_amount?: number;
          status?: string;
          project_type?: string;
          other_expenses?: number;
          tariff_multiplier?: number;
          profit_multiplier?: number;
          tax_percentage?: number;
          install_delivery?: number;
          project_details?: string | null;
          project_brief?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          customer?: string | null;
          address?: string | null;
          quote_date?: string;
          total_amount?: number;
          status?: string;
          project_type?: string;
          other_expenses?: number;
          tariff_multiplier?: number;
          profit_multiplier?: number;
          tax_percentage?: number;
          install_delivery?: number;
          project_details?: string | null;
          project_brief?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      project_areas: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          display_order: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          display_order?: number;
          subtotal?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          display_order?: number;
          subtotal?: number;
          created_at?: string;
        };
      };
      area_cabinets: {
        Row: {
          id: string;
          area_id: string;
          product_sku: string | null;
          quantity: number;
          box_material_id: string | null;
          box_edgeband_id: string | null;
          box_interior_finish_id: string | null;
          doors_material_id: string | null;
          doors_edgeband_id: string | null;
          doors_interior_finish_id: string | null;
          hardware: Json;
          box_material_cost: number;
          box_edgeband_cost: number;
          box_interior_finish_cost: number;
          doors_material_cost: number;
          doors_edgeband_cost: number;
          doors_interior_finish_cost: number;
          hardware_cost: number;
          labor_cost: number;
          subtotal: number;
          created_at: string;
          is_rta: boolean;
        };
        Insert: {
          id?: string;
          area_id: string;
          product_sku?: string | null;
          quantity?: number;
          box_material_id?: string | null;
          box_edgeband_id?: string | null;
          box_interior_finish_id?: string | null;
          doors_material_id?: string | null;
          doors_edgeband_id?: string | null;
          doors_interior_finish_id?: string | null;
          hardware?: Json;
          box_material_cost?: number;
          box_edgeband_cost?: number;
          box_interior_finish_cost?: number;
          doors_material_cost?: number;
          doors_edgeband_cost?: number;
          doors_interior_finish_cost?: number;
          hardware_cost?: number;
          labor_cost?: number;
          subtotal?: number;
          created_at?: string;
          is_rta?: boolean;
        };
        Update: {
          id?: string;
          area_id?: string;
          product_sku?: string | null;
          quantity?: number;
          box_material_id?: string | null;
          box_edgeband_id?: string | null;
          box_interior_finish_id?: string | null;
          doors_material_id?: string | null;
          doors_edgeband_id?: string | null;
          doors_interior_finish_id?: string | null;
          hardware?: Json;
          box_material_cost?: number;
          box_edgeband_cost?: number;
          box_interior_finish_cost?: number;
          doors_material_cost?: number;
          doors_edgeband_cost?: number;
          doors_interior_finish_cost?: number;
          hardware_cost?: number;
          labor_cost?: number;
          subtotal?: number;
          created_at?: string;
          is_rta?: boolean;
        };
      };
    };
  };
}
