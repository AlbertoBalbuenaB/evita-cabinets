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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_chat_sessions: {
        Row: {
          created_at: string | null
          id: string
          messages: Json
          session_key: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json
          session_key?: string
          title?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json
          session_key?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      area_cabinets: {
        Row: {
          accessories: Json
          accessories_cost: number
          area_id: string
          back_panel_height_inches: number | null
          back_panel_material_cost: number | null
          back_panel_material_id: string | null
          back_panel_sf: number | null
          back_panel_width_inches: number | null
          box_edgeband_cost: number | null
          box_edgeband_id: string | null
          box_interior_finish_cost: number | null
          box_interior_finish_id: string | null
          box_material_cost: number | null
          box_material_id: string | null
          created_at: string | null
          cut_piece_overrides: Json | null
          display_order: number | null
          door_profile_cost: number
          door_profile_id: string | null
          doors_edgeband_cost: number | null
          doors_edgeband_id: string | null
          doors_interior_finish_cost: number | null
          doors_interior_finish_id: string | null
          doors_material_cost: number | null
          doors_material_id: string | null
          drawer_box_edgeband_cost: number | null
          drawer_box_edgeband_id: string | null
          drawer_box_material_cost: number | null
          drawer_box_material_id: string | null
          extra_shelves: number | null
          hardware: Json | null
          hardware_cost: number | null
          id: string
          is_rta: boolean
          labor_cost: number | null
          original_back_panel_material_price: number | null
          original_box_edgeband_price: number | null
          original_box_interior_finish_price: number | null
          original_box_material_price: number | null
          original_doors_edgeband_price: number | null
          original_doors_interior_finish_price: number | null
          original_doors_material_price: number | null
          product_sku: string | null
          quantity: number
          shelf_edgeband_cost: number | null
          shelf_edgeband_id: string | null
          shelf_material_cost: number | null
          shelf_material_id: string | null
          source_drawing_element_id: string | null
          subtotal: number | null
          use_back_panel_material: boolean | null
          use_drawer_box_material: boolean | null
          use_shelf_material: boolean | null
        }
        Insert: {
          accessories?: Json
          accessories_cost?: number
          area_id: string
          back_panel_height_inches?: number | null
          back_panel_material_cost?: number | null
          back_panel_material_id?: string | null
          back_panel_sf?: number | null
          back_panel_width_inches?: number | null
          box_edgeband_cost?: number | null
          box_edgeband_id?: string | null
          box_interior_finish_cost?: number | null
          box_interior_finish_id?: string | null
          box_material_cost?: number | null
          box_material_id?: string | null
          created_at?: string | null
          cut_piece_overrides?: Json | null
          display_order?: number | null
          door_profile_cost?: number
          door_profile_id?: string | null
          doors_edgeband_cost?: number | null
          doors_edgeband_id?: string | null
          doors_interior_finish_cost?: number | null
          doors_interior_finish_id?: string | null
          doors_material_cost?: number | null
          doors_material_id?: string | null
          drawer_box_edgeband_cost?: number | null
          drawer_box_edgeband_id?: string | null
          drawer_box_material_cost?: number | null
          drawer_box_material_id?: string | null
          extra_shelves?: number | null
          hardware?: Json | null
          hardware_cost?: number | null
          id?: string
          is_rta?: boolean
          labor_cost?: number | null
          original_back_panel_material_price?: number | null
          original_box_edgeband_price?: number | null
          original_box_interior_finish_price?: number | null
          original_box_material_price?: number | null
          original_doors_edgeband_price?: number | null
          original_doors_interior_finish_price?: number | null
          original_doors_material_price?: number | null
          product_sku?: string | null
          quantity?: number
          shelf_edgeband_cost?: number | null
          shelf_edgeband_id?: string | null
          shelf_material_cost?: number | null
          shelf_material_id?: string | null
          source_drawing_element_id?: string | null
          subtotal?: number | null
          use_back_panel_material?: boolean | null
          use_drawer_box_material?: boolean | null
          use_shelf_material?: boolean | null
        }
        Update: {
          accessories?: Json
          accessories_cost?: number
          area_id?: string
          back_panel_height_inches?: number | null
          back_panel_material_cost?: number | null
          back_panel_material_id?: string | null
          back_panel_sf?: number | null
          back_panel_width_inches?: number | null
          box_edgeband_cost?: number | null
          box_edgeband_id?: string | null
          box_interior_finish_cost?: number | null
          box_interior_finish_id?: string | null
          box_material_cost?: number | null
          box_material_id?: string | null
          created_at?: string | null
          cut_piece_overrides?: Json | null
          display_order?: number | null
          door_profile_cost?: number
          door_profile_id?: string | null
          doors_edgeband_cost?: number | null
          doors_edgeband_id?: string | null
          doors_interior_finish_cost?: number | null
          doors_interior_finish_id?: string | null
          doors_material_cost?: number | null
          doors_material_id?: string | null
          drawer_box_edgeband_cost?: number | null
          drawer_box_edgeband_id?: string | null
          drawer_box_material_cost?: number | null
          drawer_box_material_id?: string | null
          extra_shelves?: number | null
          hardware?: Json | null
          hardware_cost?: number | null
          id?: string
          is_rta?: boolean
          labor_cost?: number | null
          original_back_panel_material_price?: number | null
          original_box_edgeband_price?: number | null
          original_box_interior_finish_price?: number | null
          original_box_material_price?: number | null
          original_doors_edgeband_price?: number | null
          original_doors_interior_finish_price?: number | null
          original_doors_material_price?: number | null
          product_sku?: string | null
          quantity?: number
          shelf_edgeband_cost?: number | null
          shelf_edgeband_id?: string | null
          shelf_material_cost?: number | null
          shelf_material_id?: string | null
          source_drawing_element_id?: string | null
          subtotal?: number | null
          use_back_panel_material?: boolean | null
          use_drawer_box_material?: boolean | null
          use_shelf_material?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "area_cabinets_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_back_panel_material_id_fkey"
            columns: ["back_panel_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_box_edgeband_id_fkey"
            columns: ["box_edgeband_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_box_interior_finish_id_fkey"
            columns: ["box_interior_finish_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_box_material_id_fkey"
            columns: ["box_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_doors_edgeband_id_fkey"
            columns: ["doors_edgeband_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_doors_interior_finish_id_fkey"
            columns: ["doors_interior_finish_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_doors_material_id_fkey"
            columns: ["doors_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_drawer_box_edgeband_id_fkey"
            columns: ["drawer_box_edgeband_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_drawer_box_material_id_fkey"
            columns: ["drawer_box_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_product_sku_fkey"
            columns: ["product_sku"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["sku"]
          },
          {
            foreignKeyName: "area_cabinets_shelf_edgeband_id_fkey"
            columns: ["shelf_edgeband_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_cabinets_shelf_material_id_fkey"
            columns: ["shelf_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
        ]
      }
      area_closet_items: {
        Row: {
          area_id: string
          boxes_count: number
          closet_catalog_id: string
          created_at: string | null
          hardware: Json | null
          hardware_cost: number
          id: string
          notes: string | null
          quantity: number
          subtotal_mxn: number
          unit_price_mxn: number
          unit_price_usd: number
          updated_at: string | null
          with_backs: boolean
        }
        Insert: {
          area_id: string
          boxes_count?: number
          closet_catalog_id: string
          created_at?: string | null
          hardware?: Json | null
          hardware_cost?: number
          id?: string
          notes?: string | null
          quantity?: number
          subtotal_mxn?: number
          unit_price_mxn?: number
          unit_price_usd?: number
          updated_at?: string | null
          with_backs?: boolean
        }
        Update: {
          area_id?: string
          boxes_count?: number
          closet_catalog_id?: string
          created_at?: string | null
          hardware?: Json | null
          hardware_cost?: number
          id?: string
          notes?: string | null
          quantity?: number
          subtotal_mxn?: number
          unit_price_mxn?: number
          unit_price_usd?: number
          updated_at?: string | null
          with_backs?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "area_closet_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_closet_items_closet_catalog_id_fkey"
            columns: ["closet_catalog_id"]
            isOneToOne: false
            referencedRelation: "closet_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      area_countertops: {
        Row: {
          area_id: string
          created_at: string | null
          id: string
          item_name: string
          notes: string | null
          price_list_item_id: string
          quantity: number
          source_drawing_element_id: string | null
          subtotal: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          area_id: string
          created_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          price_list_item_id: string
          quantity?: number
          source_drawing_element_id?: string | null
          subtotal?: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          price_list_item_id?: string
          quantity?: number
          source_drawing_element_id?: string | null
          subtotal?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_countertops_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_countertops_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
        ]
      }
      area_items: {
        Row: {
          area_id: string
          created_at: string | null
          id: string
          item_name: string
          notes: string | null
          price_list_item_id: string
          quantity: number
          source_drawing_element_id: string | null
          subtotal: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          area_id: string
          created_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          price_list_item_id: string
          quantity?: number
          source_drawing_element_id?: string | null
          subtotal?: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          price_list_item_id?: string
          quantity?: number
          source_drawing_element_id?: string | null
          subtotal?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_items_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
        ]
      }
      area_prefab_items: {
        Row: {
          area_id: string
          cost_mxn: number
          cost_usd: number
          created_at: string | null
          finish: string
          fx_rate: number
          id: string
          notes: string | null
          prefab_catalog_id: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          area_id: string
          cost_mxn: number
          cost_usd: number
          created_at?: string | null
          finish: string
          fx_rate?: number
          id?: string
          notes?: string | null
          prefab_catalog_id: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          cost_mxn?: number
          cost_usd?: number
          created_at?: string | null
          finish?: string
          fx_rate?: number
          id?: string
          notes?: string | null
          prefab_catalog_id?: string
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_prefab_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_prefab_items_prefab_catalog_id_fkey"
            columns: ["prefab_catalog_id"]
            isOneToOne: false
            referencedRelation: "prefab_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "area_prefab_items_prefab_catalog_id_fkey"
            columns: ["prefab_catalog_id"]
            isOneToOne: false
            referencedRelation: "prefab_catalog_with_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      area_sections: {
        Row: {
          area_id: string
          created_at: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          area_id: string
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          area_id?: string
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "area_sections_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_templates: {
        Row: {
          accessories: Json
          back_panel_height_inches: number | null
          back_panel_material_id: string | null
          back_panel_material_name: string | null
          back_panel_width_inches: number | null
          box_edgeband_id: string | null
          box_edgeband_name: string | null
          box_interior_finish_id: string | null
          box_interior_finish_name: string | null
          box_material_id: string | null
          box_material_name: string | null
          category: string
          created_at: string | null
          description: string | null
          door_profile_id: string | null
          door_profile_name: string | null
          doors_edgeband_id: string | null
          doors_edgeband_name: string | null
          doors_interior_finish_id: string | null
          doors_interior_finish_name: string | null
          doors_material_id: string | null
          doors_material_name: string | null
          hardware: Json | null
          id: string
          is_rta: boolean | null
          last_used_at: string | null
          name: string
          original_back_panel_material_price: number | null
          original_box_edgeband_price: number | null
          original_box_interior_finish_price: number | null
          original_box_material_price: number | null
          original_doors_edgeband_price: number | null
          original_doors_interior_finish_price: number | null
          original_doors_material_price: number | null
          product_description: string | null
          product_sku: string | null
          updated_at: string | null
          usage_count: number | null
          use_back_panel_material: boolean | null
          use_box_interior_finish: boolean | null
          use_doors_interior_finish: boolean | null
        }
        Insert: {
          accessories?: Json
          back_panel_height_inches?: number | null
          back_panel_material_id?: string | null
          back_panel_material_name?: string | null
          back_panel_width_inches?: number | null
          box_edgeband_id?: string | null
          box_edgeband_name?: string | null
          box_interior_finish_id?: string | null
          box_interior_finish_name?: string | null
          box_material_id?: string | null
          box_material_name?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          door_profile_id?: string | null
          door_profile_name?: string | null
          doors_edgeband_id?: string | null
          doors_edgeband_name?: string | null
          doors_interior_finish_id?: string | null
          doors_interior_finish_name?: string | null
          doors_material_id?: string | null
          doors_material_name?: string | null
          hardware?: Json | null
          id?: string
          is_rta?: boolean | null
          last_used_at?: string | null
          name: string
          original_back_panel_material_price?: number | null
          original_box_edgeband_price?: number | null
          original_box_interior_finish_price?: number | null
          original_box_material_price?: number | null
          original_doors_edgeband_price?: number | null
          original_doors_interior_finish_price?: number | null
          original_doors_material_price?: number | null
          product_description?: string | null
          product_sku?: string | null
          updated_at?: string | null
          usage_count?: number | null
          use_back_panel_material?: boolean | null
          use_box_interior_finish?: boolean | null
          use_doors_interior_finish?: boolean | null
        }
        Update: {
          accessories?: Json
          back_panel_height_inches?: number | null
          back_panel_material_id?: string | null
          back_panel_material_name?: string | null
          back_panel_width_inches?: number | null
          box_edgeband_id?: string | null
          box_edgeband_name?: string | null
          box_interior_finish_id?: string | null
          box_interior_finish_name?: string | null
          box_material_id?: string | null
          box_material_name?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          door_profile_id?: string | null
          door_profile_name?: string | null
          doors_edgeband_id?: string | null
          doors_edgeband_name?: string | null
          doors_interior_finish_id?: string | null
          doors_interior_finish_name?: string | null
          doors_material_id?: string | null
          doors_material_name?: string | null
          hardware?: Json | null
          id?: string
          is_rta?: boolean | null
          last_used_at?: string | null
          name?: string
          original_back_panel_material_price?: number | null
          original_box_edgeband_price?: number | null
          original_box_interior_finish_price?: number | null
          original_box_material_price?: number | null
          original_doors_edgeband_price?: number | null
          original_doors_interior_finish_price?: number | null
          original_doors_material_price?: number | null
          product_description?: string | null
          product_sku?: string | null
          updated_at?: string | null
          usage_count?: number | null
          use_back_panel_material?: boolean | null
          use_box_interior_finish?: boolean | null
          use_doors_interior_finish?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_templates_back_panel_material_id_fkey"
            columns: ["back_panel_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_box_edgeband_id_fkey"
            columns: ["box_edgeband_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_box_interior_finish_id_fkey"
            columns: ["box_interior_finish_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_box_material_id_fkey"
            columns: ["box_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_doors_edgeband_id_fkey"
            columns: ["doors_edgeband_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_doors_interior_finish_id_fkey"
            columns: ["doors_interior_finish_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_doors_material_id_fkey"
            columns: ["doors_material_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabinet_templates_product_sku_fkey"
            columns: ["product_sku"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["sku"]
          },
        ]
      }
      closet_catalog: {
        Row: {
          boxes_count: number
          cabinet_code: string
          created_at: string | null
          depth_in: number
          description: string
          dimensions_locked: boolean
          evita_line: string
          has_backs_option: boolean
          height_in: number
          id: string
          is_active: boolean
          price_with_backs_usd: number | null
          price_without_backs_usd: number | null
          updated_at: string | null
          width_in: number
        }
        Insert: {
          boxes_count?: number
          cabinet_code: string
          created_at?: string | null
          depth_in: number
          description: string
          dimensions_locked?: boolean
          evita_line: string
          has_backs_option?: boolean
          height_in: number
          id?: string
          is_active?: boolean
          price_with_backs_usd?: number | null
          price_without_backs_usd?: number | null
          updated_at?: string | null
          width_in: number
        }
        Update: {
          boxes_count?: number
          cabinet_code?: string
          created_at?: string | null
          depth_in?: number
          description?: string
          dimensions_locked?: boolean
          evita_line?: string
          has_backs_option?: boolean
          height_in?: number
          id?: string
          is_active?: boolean
          price_with_backs_usd?: number | null
          price_without_backs_usd?: number | null
          updated_at?: string | null
          width_in?: number
        }
        Relationships: []
      }
      custom_types: {
        Row: {
          created_at: string | null
          id: string
          type_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          type_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          type_name?: string
        }
        Relationships: []
      }
      custom_units: {
        Row: {
          created_at: string | null
          id: string
          unit_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          unit_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          unit_name?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      drawing_areas: {
        Row: {
          created_at: string
          drawing_id: string
          id: string
          name: string
          prefix: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          drawing_id: string
          id?: string
          name: string
          prefix: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          drawing_id?: string
          id?: string
          name?: string
          prefix?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "drawing_areas_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_elements: {
        Row: {
          area_id: string | null
          created_at: string
          depth_mm: number | null
          drawing_id: string
          element_type: string
          elevation_id: string | null
          height_mm: number | null
          id: string
          product_id: string | null
          props: Json
          rotation_deg: number
          tag: string | null
          updated_at: string
          view_type: string
          width_mm: number | null
          x_mm: number
          y_mm: number
          z_index: number
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          depth_mm?: number | null
          drawing_id: string
          element_type: string
          elevation_id?: string | null
          height_mm?: number | null
          id?: string
          product_id?: string | null
          props?: Json
          rotation_deg?: number
          tag?: string | null
          updated_at?: string
          view_type: string
          width_mm?: number | null
          x_mm: number
          y_mm: number
          z_index?: number
        }
        Update: {
          area_id?: string | null
          created_at?: string
          depth_mm?: number | null
          drawing_id?: string
          element_type?: string
          elevation_id?: string | null
          height_mm?: number | null
          id?: string
          product_id?: string | null
          props?: Json
          rotation_deg?: number
          tag?: string | null
          updated_at?: string
          view_type?: string
          width_mm?: number | null
          x_mm?: number
          y_mm?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "drawing_elements_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "drawing_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_elements_drawing_id_fkey"
            columns: ["drawing_id"]
            isOneToOne: false
            referencedRelation: "drawings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_elements_elevation_id_fkey"
            columns: ["elevation_id"]
            isOneToOne: false
            referencedRelation: "drawing_elevations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawing_elements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_elevations: {
        Row: {
          area_id: string
          created_at: string
          id: string
          letter: string
          sort_order: number
          wall_angle_deg: number | null
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          letter: string
          sort_order?: number
          wall_angle_deg?: number | null
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          letter?: string
          sort_order?: number
          wall_angle_deg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drawing_elevations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "drawing_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      drawings: {
        Row: {
          created_at: string
          created_by: string | null
          export_language: string | null
          id: string
          lock_tags: boolean
          name: string
          paper_size: string | null
          project_id: string
          scale: string | null
          show_position_tags: boolean
          specs: Json
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          export_language?: string | null
          id?: string
          lock_tags?: boolean
          name: string
          paper_size?: string | null
          project_id: string
          scale?: string | null
          show_position_tags?: boolean
          specs?: Json
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          export_language?: string | null
          id?: string
          lock_tags?: boolean
          name?: string
          paper_size?: string | null
          project_id?: string
          scale?: string | null
          show_position_tags?: boolean
          specs?: Json
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drawings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by_member_id: string | null
          id: string
          movement_type: string
          notes: string | null
          price_list_item_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          running_average_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by_member_id?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          price_list_item_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          running_average_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by_member_id?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          price_list_item_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          running_average_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff_json: Json | null
          entry_id: string | null
          id: string
          proposal_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff_json?: Json | null
          entry_id?: string | null
          id?: string
          proposal_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff_json?: Json | null
          entry_id?: string | null
          id?: string
          proposal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_audit_log_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "kb_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_audit_log_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "kb_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          section_num: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          section_num?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          section_num?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_comments: {
        Row: {
          author_id: string
          body_tiptap: Json
          created_at: string
          entry_id: string | null
          id: string
          parent_id: string | null
          proposal_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body_tiptap: Json
          created_at?: string
          entry_id?: string | null
          id?: string
          parent_id?: string | null
          proposal_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_tiptap?: Json
          created_at?: string
          entry_id?: string | null
          id?: string
          parent_id?: string | null
          proposal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "kb_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "kb_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_comments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "kb_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entries: {
        Row: {
          body_md: string
          category_id: string
          created_at: string
          created_by: string | null
          current_version: number
          enrichment_notes: string | null
          entry_type: string
          id: string
          last_edited_by: string | null
          needs_enrichment: boolean
          price_item_refs: string[]
          product_refs: string[]
          search_tsv: unknown
          slug: string
          status: string
          structured_data: Json
          supplier_ids: string[]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body_md?: string
          category_id: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          enrichment_notes?: string | null
          entry_type: string
          id?: string
          last_edited_by?: string | null
          needs_enrichment?: boolean
          price_item_refs?: string[]
          product_refs?: string[]
          search_tsv?: unknown
          slug: string
          status?: string
          structured_data?: Json
          supplier_ids?: string[]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body_md?: string
          category_id?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          enrichment_notes?: string | null
          entry_type?: string
          id?: string
          last_edited_by?: string | null
          needs_enrichment?: boolean
          price_item_refs?: string[]
          product_refs?: string[]
          search_tsv?: unknown
          slug?: string
          status?: string
          structured_data?: Json
          supplier_ids?: string[]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entries_last_edited_by_fkey"
            columns: ["last_edited_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entry_versions: {
        Row: {
          body_md: string
          category_id: string
          created_at: string
          edit_summary: string | null
          edited_by: string | null
          entry_id: string
          entry_type: string
          id: string
          price_item_refs: string[]
          product_refs: string[]
          slug: string
          structured_data: Json
          supplier_ids: string[]
          tags: string[]
          title: string
          version_num: number
        }
        Insert: {
          body_md: string
          category_id: string
          created_at?: string
          edit_summary?: string | null
          edited_by?: string | null
          entry_id: string
          entry_type: string
          id?: string
          price_item_refs: string[]
          product_refs: string[]
          slug: string
          structured_data: Json
          supplier_ids: string[]
          tags: string[]
          title: string
          version_num: number
        }
        Update: {
          body_md?: string
          category_id?: string
          created_at?: string
          edit_summary?: string | null
          edited_by?: string | null
          entry_id?: string
          entry_type?: string
          id?: string
          price_item_refs?: string[]
          product_refs?: string[]
          slug?: string
          structured_data?: Json
          supplier_ids?: string[]
          tags?: string[]
          title?: string
          version_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "kb_entry_versions_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_entry_versions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "kb_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_proposals: {
        Row: {
          author_id: string
          base_version: number | null
          created_at: string
          description_md: string | null
          id: string
          kind: string
          merged_at: string | null
          merged_version: number | null
          proposed_body_md: string | null
          proposed_category_id: string | null
          proposed_entry_type: string | null
          proposed_price_item_refs: string[] | null
          proposed_product_refs: string[] | null
          proposed_slug: string | null
          proposed_structured_data: Json | null
          proposed_supplier_ids: string[] | null
          proposed_tags: string[] | null
          proposed_title: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          state: string
          summary: string
          target_entry_id: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          base_version?: number | null
          created_at?: string
          description_md?: string | null
          id?: string
          kind: string
          merged_at?: string | null
          merged_version?: number | null
          proposed_body_md?: string | null
          proposed_category_id?: string | null
          proposed_entry_type?: string | null
          proposed_price_item_refs?: string[] | null
          proposed_product_refs?: string[] | null
          proposed_slug?: string | null
          proposed_structured_data?: Json | null
          proposed_supplier_ids?: string[] | null
          proposed_tags?: string[] | null
          proposed_title?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          state?: string
          summary: string
          target_entry_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          base_version?: number | null
          created_at?: string
          description_md?: string | null
          id?: string
          kind?: string
          merged_at?: string | null
          merged_version?: number | null
          proposed_body_md?: string | null
          proposed_category_id?: string | null
          proposed_entry_type?: string | null
          proposed_price_item_refs?: string[] | null
          proposed_product_refs?: string[] | null
          proposed_slug?: string | null
          proposed_structured_data?: Json | null
          proposed_supplier_ids?: string[] | null
          proposed_tags?: string[] | null
          proposed_title?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          state?: string
          summary?: string
          target_entry_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_proposals_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_proposals_proposed_category_id_fkey"
            columns: ["proposed_category_id"]
            isOneToOne: false
            referencedRelation: "kb_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_proposals_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_proposals_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "kb_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_suppliers: {
        Row: {
          categories: string[]
          contact: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes_md: string
          ops_supplier_id: string | null
          search_tsv: unknown
          slug: string
          updated_at: string
        }
        Insert: {
          categories?: string[]
          contact?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes_md?: string
          ops_supplier_id?: string | null
          search_tsv?: unknown
          slug: string
          updated_at?: string
        }
        Update: {
          categories?: string[]
          contact?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes_md?: string
          ops_supplier_id?: string | null
          search_tsv?: unknown
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_suppliers_ops_supplier_id_fkey"
            columns: ["ops_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          project_id: string | null
          project_name: string | null
          recipient_id: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          project_id?: string | null
          project_name?: string | null
          recipient_id: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          project_id?: string | null
          project_name?: string | null
          recipient_id?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      prefab_brand: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prefab_catalog: {
        Row: {
          brand_id: string
          cabinet_code: string
          category: string
          created_at: string | null
          depth_in: number | null
          description: string | null
          dims_auto_parsed: boolean
          dims_locked: boolean
          height_in: number | null
          id: string
          is_active: boolean
          item_type: Database["public"]["Enums"]["prefab_item_type"]
          notes: string | null
          updated_at: string | null
          width_in: number | null
        }
        Insert: {
          brand_id: string
          cabinet_code: string
          category: string
          created_at?: string | null
          depth_in?: number | null
          description?: string | null
          dims_auto_parsed?: boolean
          dims_locked?: boolean
          height_in?: number | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["prefab_item_type"]
          notes?: string | null
          updated_at?: string | null
          width_in?: number | null
        }
        Update: {
          brand_id?: string
          cabinet_code?: string
          category?: string
          created_at?: string | null
          depth_in?: number | null
          description?: string | null
          dims_auto_parsed?: boolean
          dims_locked?: boolean
          height_in?: number | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["prefab_item_type"]
          notes?: string | null
          updated_at?: string | null
          width_in?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prefab_catalog_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "prefab_brand"
            referencedColumns: ["id"]
          },
        ]
      }
      prefab_catalog_price: {
        Row: {
          cost_usd: number
          created_at: string | null
          effective_date: string
          finish: string
          id: string
          is_current: boolean
          prefab_catalog_id: string
        }
        Insert: {
          cost_usd: number
          created_at?: string | null
          effective_date?: string
          finish: string
          id?: string
          is_current?: boolean
          prefab_catalog_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string | null
          effective_date?: string
          finish?: string
          id?: string
          is_current?: boolean
          prefab_catalog_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prefab_catalog_price_prefab_catalog_id_fkey"
            columns: ["prefab_catalog_id"]
            isOneToOne: false
            referencedRelation: "prefab_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prefab_catalog_price_prefab_catalog_id_fkey"
            columns: ["prefab_catalog_id"]
            isOneToOne: false
            referencedRelation: "prefab_catalog_with_prices"
            referencedColumns: ["id"]
          },
        ]
      }
      price_change_log: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          item_description: string
          new_price: number
          old_price: number
          price_difference: number | null
          price_list_item_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          item_description: string
          new_price: number
          old_price: number
          price_difference?: number | null
          price_list_item_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          item_description?: string
          new_price?: number
          old_price?: number
          price_difference?: number | null
          price_list_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_change_log_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list: {
        Row: {
          average_cost: number | null
          base_price: number | null
          concept_description: string
          created_at: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          last_purchase_cost: number | null
          material: string | null
          min_stock_level: number
          notes: string | null
          price: number
          price_last_updated_at: string
          price_with_tax: number | null
          product_url: string | null
          sf_per_sheet: number | null
          sku_code: string | null
          stock_location: string | null
          stock_quantity: number
          tax_rate: number | null
          technical_depth_mm: number | null
          technical_finish: string | null
          technical_height_mm: number | null
          technical_material: string | null
          technical_thickness_mm: number | null
          technical_width_mm: number | null
          type: string
          unit: string
          updated_at: string | null
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          average_cost?: number | null
          base_price?: number | null
          concept_description: string
          created_at?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_purchase_cost?: number | null
          material?: string | null
          min_stock_level?: number
          notes?: string | null
          price?: number
          price_last_updated_at?: string
          price_with_tax?: number | null
          product_url?: string | null
          sf_per_sheet?: number | null
          sku_code?: string | null
          stock_location?: string | null
          stock_quantity?: number
          tax_rate?: number | null
          technical_depth_mm?: number | null
          technical_finish?: string | null
          technical_height_mm?: number | null
          technical_material?: string | null
          technical_thickness_mm?: number | null
          technical_width_mm?: number | null
          type: string
          unit: string
          updated_at?: string | null
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          average_cost?: number | null
          base_price?: number | null
          concept_description?: string
          created_at?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_purchase_cost?: number | null
          material?: string | null
          min_stock_level?: number
          notes?: string | null
          price?: number
          price_last_updated_at?: string
          price_with_tax?: number | null
          product_url?: string | null
          sf_per_sheet?: number | null
          sku_code?: string | null
          stock_location?: string | null
          stock_quantity?: number
          tax_rate?: number | null
          technical_depth_mm?: number | null
          technical_finish?: string | null
          technical_height_mm?: number | null
          technical_material?: string | null
          technical_thickness_mm?: number | null
          technical_width_mm?: number | null
          type?: string
          unit?: string
          updated_at?: string | null
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: []
      }
      price_list_suppliers: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          notes: string | null
          price_list_item_id: string
          supplier_id: string
          supplier_price: number | null
          supplier_sku: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          price_list_item_id: string
          supplier_id: string
          supplier_price?: number | null
          supplier_sku?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          price_list_item_id?: string
          supplier_id?: string
          supplier_price?: number | null
          supplier_sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_suppliers_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products_catalog: {
        Row: {
          box_edgeband: number | null
          box_edgeband_color: number | null
          box_sf: number
          boxes_per_unit: number
          collection_name: string | null
          created_at: string | null
          custom_labor_cost: number | null
          cut_pieces: Json | null
          default_is_rta: boolean
          depth_in: number | null
          description: string
          doors_fronts_edgeband: number | null
          doors_fronts_sf: number
          draft_default_hinge: string | null
          draft_detail_svg: string | null
          draft_elevation_svg: string | null
          draft_enabled: boolean
          draft_family: string | null
          draft_plan_svg: string | null
          draft_series: string | null
          draft_subfamily: string | null
          has_drawers: boolean | null
          height_in: number | null
          id: string
          is_active: boolean | null
          original_box_sf: number | null
          original_doors_fronts_sf: number | null
          sku: string
          status: string | null
          total_edgeband: number
          updated_at: string | null
          waste_applied: boolean | null
          width_in: number | null
        }
        Insert: {
          box_edgeband?: number | null
          box_edgeband_color?: number | null
          box_sf?: number
          boxes_per_unit?: number
          collection_name?: string | null
          created_at?: string | null
          custom_labor_cost?: number | null
          cut_pieces?: Json | null
          default_is_rta?: boolean
          depth_in?: number | null
          description: string
          doors_fronts_edgeband?: number | null
          doors_fronts_sf?: number
          draft_default_hinge?: string | null
          draft_detail_svg?: string | null
          draft_elevation_svg?: string | null
          draft_enabled?: boolean
          draft_family?: string | null
          draft_plan_svg?: string | null
          draft_series?: string | null
          draft_subfamily?: string | null
          has_drawers?: boolean | null
          height_in?: number | null
          id?: string
          is_active?: boolean | null
          original_box_sf?: number | null
          original_doors_fronts_sf?: number | null
          sku: string
          status?: string | null
          total_edgeband?: number
          updated_at?: string | null
          waste_applied?: boolean | null
          width_in?: number | null
        }
        Update: {
          box_edgeband?: number | null
          box_edgeband_color?: number | null
          box_sf?: number
          boxes_per_unit?: number
          collection_name?: string | null
          created_at?: string | null
          custom_labor_cost?: number | null
          cut_pieces?: Json | null
          default_is_rta?: boolean
          depth_in?: number | null
          description?: string
          doors_fronts_edgeband?: number | null
          doors_fronts_sf?: number
          draft_default_hinge?: string | null
          draft_detail_svg?: string | null
          draft_elevation_svg?: string | null
          draft_enabled?: boolean
          draft_family?: string | null
          draft_plan_svg?: string | null
          draft_series?: string | null
          draft_subfamily?: string | null
          has_drawers?: boolean | null
          height_in?: number | null
          id?: string
          is_active?: boolean | null
          original_box_sf?: number | null
          original_doors_fronts_sf?: number | null
          sku?: string
          status?: string | null
          total_edgeband?: number
          updated_at?: string | null
          waste_applied?: boolean | null
          width_in?: number | null
        }
        Relationships: []
      }
      project_activities: {
        Row: {
          created_at: string | null
          display_order: number
          end_date: string
          id: string
          name: string
          project_id: string | null
          start_date: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          end_date: string
          id?: string
          name: string
          project_id?: string | null
          start_date: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          end_date?: string
          id?: string
          name?: string
          project_id?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_activities_project_id_fkey_new"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_areas: {
        Row: {
          applies_tariff: boolean
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          project_id: string
          quantity: number
          subtotal: number | null
          updated_at: string | null
        }
        Insert: {
          applies_tariff?: boolean
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          project_id: string
          quantity?: number
          subtotal?: number | null
          updated_at?: string | null
        }
        Update: {
          applies_tariff?: boolean
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          project_id?: string
          quantity?: number
          subtotal?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_areas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string | null
          display_order: number
          file_name: string | null
          id: string
          label: string
          project_id: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          file_name?: string | null
          id?: string
          label: string
          project_id?: string | null
          url?: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          file_name?: string | null
          id?: string
          label?: string
          project_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey_new"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_log_replies: {
        Row: {
          author_id: string | null
          author_name: string | null
          comment: string
          created_at: string | null
          id: string
          log_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          comment: string
          created_at?: string | null
          id?: string
          log_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_log_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_log_replies_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "project_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_logs: {
        Row: {
          author_id: string | null
          author_name: string | null
          comment: string
          created_at: string | null
          id: string
          log_type: string
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          comment: string
          created_at?: string | null
          id?: string
          log_type?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          log_type?: string
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_logs_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_logs_project_id_fkey_new"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_price_staleness: {
        Row: {
          affected_material_count: number | null
          has_stale_prices: boolean | null
          id: string
          last_checked_at: string | null
          project_id: string
        }
        Insert: {
          affected_material_count?: number | null
          has_stale_prices?: boolean | null
          id?: string
          last_checked_at?: string | null
          project_id: string
        }
        Update: {
          affected_material_count?: number | null
          has_stale_prices?: boolean | null
          id?: string
          last_checked_at?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_price_staleness_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_purchase_items: {
        Row: {
          assigned_to_member_id: string | null
          concept: string
          created_at: string
          deadline: string | null
          display_order: number | null
          id: string
          inventory_committed: boolean
          notes: string | null
          price: number | null
          price_list_item_id: string | null
          priority: string | null
          project_id: string
          quantity: number
          status: string | null
          subtotal: number | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_member_id?: string | null
          concept: string
          created_at?: string
          deadline?: string | null
          display_order?: number | null
          id?: string
          inventory_committed?: boolean
          notes?: string | null
          price?: number | null
          price_list_item_id?: string | null
          priority?: string | null
          project_id: string
          quantity?: number
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_member_id?: string | null
          concept?: string
          created_at?: string
          deadline?: string | null
          display_order?: number | null
          id?: string
          inventory_committed?: boolean
          notes?: string | null
          price?: number | null
          price_list_item_id?: string | null
          priority?: string | null
          project_id?: string
          quantity?: number
          status?: string | null
          subtotal?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_purchase_items_assigned_to_member_id_fkey"
            columns: ["assigned_to_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchase_items_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchase_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_purchase_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          bucket: string | null
          created_at: string | null
          description: string | null
          details: string | null
          display_order: number
          due_date: string | null
          id: string
          owner_member_id: string | null
          parent_task_id: string | null
          priority: string
          project_id: string | null
          recurrence: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          bucket?: string | null
          created_at?: string | null
          description?: string | null
          details?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          owner_member_id?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          bucket?: string | null
          created_at?: string | null
          description?: string | null
          details?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          owner_member_id?: string | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_owner_member_id_fkey"
            columns: ["owner_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey_new"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_version_details: {
        Row: {
          area_id: string | null
          area_name: string
          cabinets_affected_count: number
          change_type: string
          created_at: string | null
          difference: number
          difference_percentage: number
          id: string
          material_changes: Json | null
          new_subtotal: number
          previous_subtotal: number
          price_changes: Json | null
          version_id: string
        }
        Insert: {
          area_id?: string | null
          area_name: string
          cabinets_affected_count?: number
          change_type: string
          created_at?: string | null
          difference?: number
          difference_percentage?: number
          id?: string
          material_changes?: Json | null
          new_subtotal?: number
          previous_subtotal?: number
          price_changes?: Json | null
          version_id: string
        }
        Update: {
          area_id?: string | null
          area_name?: string
          cabinets_affected_count?: number
          change_type?: string
          created_at?: string | null
          difference?: number
          difference_percentage?: number
          id?: string
          material_changes?: Json | null
          new_subtotal?: number
          previous_subtotal?: number
          price_changes?: Json | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_version_details_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "project_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_version_details_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "project_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          affected_areas: string[] | null
          change_summary: Json | null
          created_at: string | null
          id: string
          notes: string | null
          project_id: string
          snapshot_data: Json
          total_amount: number
          version_name: string
          version_number: number
          version_type: string
        }
        Insert: {
          affected_areas?: string[] | null
          change_summary?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          snapshot_data?: Json
          total_amount?: number
          version_name: string
          version_number: number
          version_type: string
        }
        Update: {
          affected_areas?: string[] | null
          change_summary?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          snapshot_data?: Json
          total_amount?: number
          version_name?: string
          version_number?: number
          version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          created_at: string | null
          created_by_member_id: string | null
          customer: string | null
          id: string
          inventory_auto_committed: boolean
          last_modified_at: string | null
          last_modified_by_member_id: string | null
          name: string
          project_brief: string | null
          project_details: string | null
          project_type: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          customer?: string | null
          id?: string
          inventory_auto_committed?: boolean
          last_modified_at?: string | null
          last_modified_by_member_id?: string | null
          name: string
          project_brief?: string | null
          project_details?: string | null
          project_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by_member_id?: string | null
          customer?: string | null
          id?: string
          inventory_auto_committed?: boolean
          last_modified_at?: string | null
          last_modified_by_member_id?: string | null
          name?: string
          project_brief?: string | null
          project_details?: string | null
          project_type?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_member_id_fkey"
            columns: ["created_by_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_last_modified_by_member_id_fkey"
            columns: ["last_modified_by_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_item_comment_replies: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          comment_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body: string
          comment_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          comment_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_item_comment_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_item_comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "purchase_item_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_item_comments: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          id: string
          purchase_item_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body: string
          created_at?: string
          id?: string
          purchase_item_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          purchase_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_item_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_item_comments_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "project_purchase_items"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_optimizer_runs: {
        Row: {
          board_count: number
          cost_per_m2: number
          created_at: string
          edgeband_cost: number
          id: string
          is_active: boolean
          is_stale: boolean
          material_cost: number
          name: string
          notes: string | null
          quotation_id: string
          result: Json
          snapshot: Json
          total_cost: number
          total_piece_m2: number
          updated_at: string
          waste_pct: number
        }
        Insert: {
          board_count?: number
          cost_per_m2?: number
          created_at?: string
          edgeband_cost?: number
          id?: string
          is_active?: boolean
          is_stale?: boolean
          material_cost?: number
          name?: string
          notes?: string | null
          quotation_id: string
          result: Json
          snapshot: Json
          total_cost?: number
          total_piece_m2?: number
          updated_at?: string
          waste_pct?: number
        }
        Update: {
          board_count?: number
          cost_per_m2?: number
          created_at?: string
          edgeband_cost?: number
          id?: string
          is_active?: boolean
          is_stale?: boolean
          material_cost?: number
          name?: string
          notes?: string | null
          quotation_id?: string
          result?: Json
          snapshot?: Json
          total_cost?: number
          total_piece_m2?: number
          updated_at?: string
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_optimizer_runs_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          active_optimizer_run_id: string | null
          address: string | null
          created_at: string | null
          customer: string | null
          disclaimer_price_validity: string | null
          disclaimer_tariff_info: string | null
          id: string
          install_delivery: number | null
          install_delivery_per_box: number | null
          install_delivery_per_box_usd: number | null
          install_delivery_usd: number | null
          name: string
          optimizer_is_stale: boolean
          optimizer_total_amount: number | null
          other_expenses: number | null
          other_expenses_label: string | null
          pdf_address: string | null
          pdf_customer: string | null
          pdf_project_brief: string | null
          pdf_project_name: string | null
          pricing_method: string
          profit_multiplier: number | null
          project_brief: string | null
          project_details: string | null
          project_id: string
          project_type: string
          quote_date: string
          referral_currency_rate: number | null
          risk_factor_applies_optimizer: boolean | null
          risk_factor_applies_sqft: boolean | null
          risk_factor_percentage: number | null
          status: string | null
          tariff_multiplier: number | null
          tax_percentage: number | null
          total_amount: number | null
          updated_at: string | null
          version_label: string | null
          version_number: number | null
        }
        Insert: {
          active_optimizer_run_id?: string | null
          address?: string | null
          created_at?: string | null
          customer?: string | null
          disclaimer_price_validity?: string | null
          disclaimer_tariff_info?: string | null
          id?: string
          install_delivery?: number | null
          install_delivery_per_box?: number | null
          install_delivery_per_box_usd?: number | null
          install_delivery_usd?: number | null
          name: string
          optimizer_is_stale?: boolean
          optimizer_total_amount?: number | null
          other_expenses?: number | null
          other_expenses_label?: string | null
          pdf_address?: string | null
          pdf_customer?: string | null
          pdf_project_brief?: string | null
          pdf_project_name?: string | null
          pricing_method?: string
          profit_multiplier?: number | null
          project_brief?: string | null
          project_details?: string | null
          project_id: string
          project_type?: string
          quote_date?: string
          referral_currency_rate?: number | null
          risk_factor_applies_optimizer?: boolean | null
          risk_factor_applies_sqft?: boolean | null
          risk_factor_percentage?: number | null
          status?: string | null
          tariff_multiplier?: number | null
          tax_percentage?: number | null
          total_amount?: number | null
          updated_at?: string | null
          version_label?: string | null
          version_number?: number | null
        }
        Update: {
          active_optimizer_run_id?: string | null
          address?: string | null
          created_at?: string | null
          customer?: string | null
          disclaimer_price_validity?: string | null
          disclaimer_tariff_info?: string | null
          id?: string
          install_delivery?: number | null
          install_delivery_per_box?: number | null
          install_delivery_per_box_usd?: number | null
          install_delivery_usd?: number | null
          name?: string
          optimizer_is_stale?: boolean
          optimizer_total_amount?: number | null
          other_expenses?: number | null
          other_expenses_label?: string | null
          pdf_address?: string | null
          pdf_customer?: string | null
          pdf_project_brief?: string | null
          pdf_project_name?: string | null
          pricing_method?: string
          profit_multiplier?: number | null
          project_brief?: string | null
          project_details?: string | null
          project_id?: string
          project_type?: string
          quote_date?: string
          referral_currency_rate?: number | null
          risk_factor_applies_optimizer?: boolean | null
          risk_factor_applies_sqft?: boolean | null
          risk_factor_percentage?: number | null
          status?: string | null
          tariff_multiplier?: number | null
          tax_percentage?: number | null
          total_amount?: number | null
          updated_at?: string | null
          version_label?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_active_optimizer_run_fk"
            columns: ["active_optimizer_run_id"]
            isOneToOne: false
            referencedRelation: "quotation_optimizer_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          category: string
          created_at: string | null
          data_type: string
          description: string
          exchange_rate_usd_to_mxn: number
          id: string
          key: string
          logo_url: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          data_type?: string
          description: string
          exchange_rate_usd_to_mxn?: number
          id?: string
          key: string
          logo_url?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          data_type?: string
          description?: string
          exchange_rate_usd_to_mxn?: number
          id?: string
          key?: string
          logo_url?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      supplier_logs: {
        Row: {
          author_id: string | null
          author_name: string | null
          comment: string
          created_at: string | null
          id: string
          log_type: string
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          comment: string
          created_at?: string | null
          id?: string
          log_type?: string
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          comment?: string
          created_at?: string | null
          id?: string
          log_type?: string
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_logs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          categories: string[] | null
          contact_name: string | null
          created_at: string
          delivery_terms: string | null
          email: string | null
          id: string
          is_active: boolean
          last_evaluation_date: string | null
          lead_time_days: number | null
          logo_url: string | null
          min_purchase_amount: number | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          punctuality: string | null
          quality_score: number | null
          special_discounts: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          categories?: string[] | null
          contact_name?: string | null
          created_at?: string
          delivery_terms?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_evaluation_date?: string | null
          lead_time_days?: number | null
          logo_url?: string | null
          min_purchase_amount?: number | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          punctuality?: string | null
          quality_score?: number | null
          special_discounts?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          categories?: string[] | null
          contact_name?: string | null
          created_at?: string
          delivery_terms?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_evaluation_date?: string | null
          lead_time_days?: number | null
          logo_url?: string | null
          min_purchase_amount?: number | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          punctuality?: string | null
          quality_score?: number | null
          special_discounts?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      task_assignees: {
        Row: {
          member_id: string
          task_id: string
        }
        Insert: {
          member_id: string
          task_id: string
        }
        Update: {
          member_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comment_replies: {
        Row: {
          author_id: string | null
          body: string
          comment_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          comment_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          comment_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comment_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string | null
          id: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string | null
          id?: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_deliverables: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          label: string
          task_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          label: string
          task_id: string
          url?: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          label?: string
          task_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_deliverables_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tag_assignments: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "task_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tag_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          label: string
          project_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          label: string
          project_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          label?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      taxes_by_type: {
        Row: {
          created_at: string | null
          id: string
          material_type: string
          tax_percentage: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_type: string
          tax_percentage?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_type?: string
          tax_percentage?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          department_id: string | null
          display_order: number
          email: string | null
          id: string
          is_active: boolean
          job_title: string | null
          name: string
          role: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          department_id?: string | null
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          name: string
          role?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          department_id?: string | null
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      template_usage_log: {
        Row: {
          area_id: string
          cabinet_id: string | null
          id: string
          project_id: string
          quantity_used: number | null
          template_id: string
          used_at: string | null
        }
        Insert: {
          area_id: string
          cabinet_id?: string | null
          id?: string
          project_id: string
          quantity_used?: number | null
          template_id: string
          used_at?: string | null
        }
        Update: {
          area_id?: string
          cabinet_id?: string | null
          id?: string
          project_id?: string
          quantity_used?: number | null
          template_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_usage_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_usage_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cabinet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      prefab_catalog_with_prices: {
        Row: {
          brand_id: string | null
          cabinet_code: string | null
          category: string | null
          created_at: string | null
          depth_in: number | null
          description: string | null
          dims_auto_parsed: boolean | null
          dims_locked: boolean | null
          height_in: number | null
          id: string | null
          is_active: boolean | null
          item_type: Database["public"]["Enums"]["prefab_item_type"] | null
          notes: string | null
          prices: Json | null
          updated_at: string | null
          width_in: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prefab_catalog_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "prefab_brand"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_hardware_cost: {
        Args: { p_cabinet_quantity: number; p_hardware_array: Json }
        Returns: number
      }
      check_product_usage: {
        Args: { product_sku_param: string }
        Returns: {
          project_names: string[]
          usage_count: number
        }[]
      }
      check_project_price_staleness: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      commit_project_inventory: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      count_cabinets_with_hardware: {
        Args: {
          p_area_ids: string[]
          p_hardware_id: string
          p_table_name: string
        }
        Returns: number
      }
      create_project_snapshot: { Args: { p_project_id: string }; Returns: Json }
      current_member_id: { Args: never; Returns: string }
      evita_hardware_bulk_update:
        | {
            Args: {
              p_area_filter?: string
              p_hardware_id: string
              p_price: number
              p_project_id: string
              p_qty_rule?: string
              p_remove_id?: string
              p_remove_price?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_area_filter?: string
              p_hardware_id: string
              p_price: number
              p_project_id: string
              p_qty_rule?: string
              p_remove_id?: string
              p_remove_price?: number
            }
            Returns: Json
          }
      get_hardware_category: {
        Args: { p_hardware_id: string }
        Returns: string
      }
      get_most_used_templates: {
        Args: { limit_count?: number }
        Returns: {
          category: string
          id: string
          last_used_at: string
          name: string
          usage_count: number
        }[]
      }
      get_next_version_number: {
        Args: { p_project_id: string }
        Returns: number
      }
      get_template_usage_by_category: {
        Args: never
        Returns: {
          category: string
          total_templates: number
          total_uses: number
        }[]
      }
      get_template_usage_timeline: {
        Args: { days_back?: number }
        Returns: {
          usage_count: number
          usage_date: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      kb_merge_proposal: {
        Args: { p_note?: string; p_proposal_id: string }
        Returns: string
      }
      refresh_project_price_staleness: {
        Args: { p_project_id: string }
        Returns: undefined
      }
      remove_hardware_from_cabinet: {
        Args: { p_hardware_array: Json; p_hardware_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_hardware_in_cabinet: {
        Args: {
          p_hardware_array: Json
          p_new_hardware_id: string
          p_old_hardware_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      prefab_item_type: "cabinet" | "accessory" | "linear" | "panel"
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
      prefab_item_type: ["cabinet", "accessory", "linear", "panel"],
    },
  },
} as const
