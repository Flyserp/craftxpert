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
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      advertisement_clicks: {
        Row: {
          ad_id: string
          created_at: string
          event_type: string
          id: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          event_type?: string
          id?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          event_type?: string
          id?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advertisement_clicks_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisements: {
        Row: {
          clicks: number
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          impressions: number
          is_active: boolean
          link_url: string | null
          placement: string
          sort_order: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          clicks?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          link_url?: string | null
          placement?: string
          sort_order?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          clicks?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          is_active?: boolean
          link_url?: string | null
          placement?: string
          sort_order?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          placement: string
          position: number
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          placement?: string
          position?: number
          starts_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          placement?: string
          position?: number
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reschedule_requests: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          message: string | null
          original_date: string
          original_start_time: string
          previous_booking_status: string
          proposed_date: string
          proposed_end_time: string
          proposed_start_time: string
          proposer_id: string
          proposer_role: string
          recipient_id: string
          responded_at: string | null
          response_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          message?: string | null
          original_date: string
          original_start_time: string
          previous_booking_status: string
          proposed_date: string
          proposed_end_time: string
          proposed_start_time: string
          proposer_id: string
          proposer_role: string
          recipient_id: string
          responded_at?: string | null
          response_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          message?: string | null
          original_date?: string
          original_start_time?: string
          previous_booking_status?: string
          proposed_date?: string
          proposed_end_time?: string
          proposed_start_time?: string
          proposer_id?: string
          proposer_role?: string
          recipient_id?: string
          responded_at?: string | null
          response_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reschedule_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_staff_id: string | null
          booking_date: string
          coupon_code: string | null
          created_at: string
          customer_id: string
          discount_amount: number | null
          end_time: string
          id: string
          notes: string | null
          payment_intent_id: string | null
          payment_method: string | null
          payment_status: string
          service_id: string
          start_time: string
          status: string
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total_price: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          assigned_staff_id?: string | null
          booking_date: string
          coupon_code?: string | null
          created_at?: string
          customer_id: string
          discount_amount?: number | null
          end_time: string
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: string
          service_id: string
          start_time: string
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_price?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          assigned_staff_id?: string | null
          booking_date?: string
          coupon_code?: string | null
          created_at?: string
          customer_id?: string
          discount_amount?: number | null
          end_time?: string
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_method?: string | null
          payment_status?: string
          service_id?: string
          start_time?: string
          status?: string
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_price?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "vendor_services"
            referencedColumns: ["id"]
          },
        ]
      }
      category_commissions: {
        Row: {
          category_id: string
          commission_type: string
          commission_value: number
          created_at: string
          deposit_percentage: number | null
          id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          deposit_percentage?: number | null
          id?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          commission_type?: string
          commission_value?: number
          created_at?: string
          deposit_percentage?: number | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_commissions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          province_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          province_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          province_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_province_id_fkey"
            columns: ["province_id"]
            isOneToOne: false
            referencedRelation: "provinces"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          admin_reply: string | null
          created_at: string
          email: string
          id: string
          ip_address: string | null
          message: string
          name: string
          replied_at: string | null
          replied_by: string | null
          status: string
          subject: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          message: string
          name: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          message?: string
          name?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          last_message_at: string
          participant_1: string
          participant_2: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          participant_1: string
          participant_2: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          participant_1?: string
          participant_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_model: string | null
          disabled_at: string | null
          failure_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_seen_at: string
          locale: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_model?: string | null
          disabled_at?: string | null
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_seen_at?: string
          locale?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_model?: string | null
          disabled_at?: string | null
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_seen_at?: string
          locale?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_notes: string | null
          booking_id: string | null
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          priority: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          booking_id?: string | null
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          priority?: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          type?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          booking_id?: string | null
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          priority?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          subject: string
          updated_at: string
          updated_by: string | null
          variables: string[]
        }
        Insert: {
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          subject: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
        }
        Update: {
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
          variables?: string[]
        }
        Relationships: []
      }
      employer_profiles: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          last_renewed_at: string | null
          logo_url: string | null
          updated_at: string
          user_id: string
          verification_expires_at: string | null
          verification_status: string
          verified_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          last_renewed_at?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
          verification_expires_at?: string | null
          verification_status?: string
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          last_renewed_at?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id?: string
          verification_expires_at?: string | null
          verification_status?: string
          verified_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: []
      }
      homepage_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          customer_id: string
          id: string
          invoice_number: string
          issued_at: string | null
          paid_at: string | null
          pdf_url: string | null
          status: string
          tax_amount: number
          total_amount: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          invoice_number: string
          issued_at?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          invoice_number?: string
          issued_at?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          status?: string
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_credit_purchases: {
        Row: {
          amount: number
          bundle_label: string
          created_at: string
          credits: number
          id: string
          payment_method: string
          vendor_id: string
        }
        Insert: {
          amount: number
          bundle_label: string
          created_at?: string
          credits: number
          id?: string
          payment_method?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          bundle_label?: string
          created_at?: string
          credits?: number
          id?: string
          payment_method?: string
          vendor_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_hidden: boolean
          is_read: boolean
          moderation_note: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          moderation_note?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_hidden?: boolean
          is_read?: boolean
          moderation_note?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_assignments: {
        Row: {
          assigned_to: string
          claimed_at: string
          created_at: string
          entity_id: string
          expires_at: string
          expiry_notified_at: string | null
          id: string
          kind: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          claimed_at?: string
          created_at?: string
          entity_id: string
          expires_at?: string
          expiry_notified_at?: string | null
          id?: string
          kind: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          claimed_at?: string
          created_at?: string
          entity_id?: string
          expires_at?: string
          expiry_notified_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_notification_routes: {
        Row: {
          created_at: string
          id: string
          kind: string | null
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string | null
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string | null
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      moderation_response_templates: {
        Row: {
          action: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          action: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_delivery_logs: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error: string | null
          event_type: string | null
          id: string
          metadata: Json
          provider_response: Json | null
          recipient_user_id: string | null
          status: string
          title: string | null
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json
          provider_response?: Json | null
          recipient_user_id?: string | null
          status: string
          title?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          event_type?: string | null
          id?: string
          metadata?: Json
          provider_response?: Json | null
          recipient_user_id?: string | null
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          event_type: string
          id: string
          in_app_enabled: boolean
          push_enabled: boolean
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          event_type: string
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          event_type?: string
          id?: string
          in_app_enabled?: boolean
          push_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          payment_method: string
          payment_type: string
          paypal_order_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_id: string
          vendor_id: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_method?: string
          payment_type?: string
          paypal_order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id: string
          vendor_id: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          payment_method?: string
          payment_type?: string
          paypal_order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          is_secret: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          is_secret?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          is_secret?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          business_name: string | null
          category_id: string | null
          certificates: Json | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          experience_years: number | null
          featured_rank: number | null
          featured_until: string | null
          id: string
          is_featured: boolean
          latitude: number | null
          longitude: number | null
          moderation_note: string | null
          phone: string | null
          profile_completed: boolean
          restricted_until: string | null
          restriction_reason: string | null
          show_availability_public: boolean
          skills: string[] | null
          status: string
          updated_at: string
          user_id: string
          vacation_mode: boolean
          vacation_until: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          category_id?: string | null
          certificates?: Json | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          experience_years?: number | null
          featured_rank?: number | null
          featured_until?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          moderation_note?: string | null
          phone?: string | null
          profile_completed?: boolean
          restricted_until?: string | null
          restriction_reason?: string | null
          show_availability_public?: boolean
          skills?: string[] | null
          status?: string
          updated_at?: string
          user_id: string
          vacation_mode?: boolean
          vacation_until?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_name?: string | null
          category_id?: string | null
          certificates?: Json | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          experience_years?: number | null
          featured_rank?: number | null
          featured_until?: string | null
          id?: string
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          moderation_note?: string | null
          phone?: string | null
          profile_completed?: boolean
          restricted_until?: string | null
          restriction_reason?: string | null
          show_availability_public?: boolean
          skills?: string[] | null
          status?: string
          updated_at?: string
          user_id?: string
          vacation_mode?: boolean
          vacation_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_coupons: {
        Row: {
          applicable_to: string
          code: string
          created_at: string
          current_uses: number
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
          vendor_id: string | null
        }
        Insert: {
          applicable_to?: string
          code: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vendor_id?: string | null
        }
        Update: {
          applicable_to?: string
          code?: string
          created_at?: string
          current_uses?: number
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      provider_push_settings: {
        Row: {
          booking_updates: boolean
          created_at: string
          marketing: boolean
          new_messages: boolean
          overrides_defaults: boolean
          payment_updates: boolean
          provider_id: string
          push_enabled: boolean
          review_alerts: boolean
          updated_at: string
        }
        Insert: {
          booking_updates?: boolean
          created_at?: string
          marketing?: boolean
          new_messages?: boolean
          overrides_defaults?: boolean
          payment_updates?: boolean
          provider_id: string
          push_enabled?: boolean
          review_alerts?: boolean
          updated_at?: string
        }
        Update: {
          booking_updates?: boolean
          created_at?: string
          marketing?: boolean
          new_messages?: boolean
          overrides_defaults?: boolean
          payment_updates?: boolean
          provider_id?: string
          push_enabled?: boolean
          review_alerts?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      provider_settings: {
        Row: {
          created_at: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_staff: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          provider_id: string
          role: Database["public"]["Enums"]["staff_invite_role"]
          staff_user_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id: string
          role?: Database["public"]["Enums"]["staff_invite_role"]
          staff_user_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          provider_id?: string
          role?: Database["public"]["Enums"]["staff_invite_role"]
          staff_user_id?: string
          title?: string | null
        }
        Relationships: []
      }
      provider_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          id: string
          last_renewed_at: string | null
          plan_id: string
          provider_id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          id?: string
          last_renewed_at?: string | null
          plan_id: string
          provider_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          id?: string
          last_renewed_at?: string | null
          plan_id?: string
          provider_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      provinces: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provinces_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_matches: {
        Row: {
          address: string | null
          budget_max: number | null
          budget_min: number | null
          category_id: string | null
          category_name: string | null
          created_at: string
          id: string
          result_count: number
          task_id: string | null
          top_vendor_name: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          budget_max?: number | null
          budget_min?: number | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          result_count?: number
          task_id?: string | null
          top_vendor_name?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          budget_max?: number | null
          budget_min?: number | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          result_count?: number
          task_id?: string | null
          top_vendor_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          booking_id: string
          created_at?: string
          customer_id: string
          id?: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          booking_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          after_photos: string[] | null
          before_photos: string[] | null
          booking_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          is_hidden: boolean
          moderation_note: string | null
          rating: number
          vendor_id: string
          vendor_reply: string | null
          vendor_reply_at: string | null
        }
        Insert: {
          after_photos?: string[] | null
          before_photos?: string[] | null
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_hidden?: boolean
          moderation_note?: string | null
          rating: number
          vendor_id: string
          vendor_reply?: string | null
          vendor_reply_at?: string | null
        }
        Update: {
          after_photos?: string[] | null
          before_photos?: string[] | null
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_hidden?: boolean
          moderation_note?: string | null
          rating?: number
          vendor_id?: string
          vendor_reply?: string | null
          vendor_reply_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      search_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          query_normalized: string | null
          result_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          query_normalized?: string | null
          result_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          query_normalized?: string | null
          result_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      service_subcategories: {
        Row: {
          category_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorship_orders: {
        Row: {
          amount: number
          created_at: string
          days: number
          ends_at: string
          id: string
          service_id: string
          starts_at: string
          status: string
          vendor_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          days: number
          ends_at: string
          id?: string
          service_id: string
          starts_at?: string
          status?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          days?: number
          ends_at?: string
          id?: string
          service_id?: string
          starts_at?: string
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorship_orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "vendor_services"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          provider_id: string
          role: Database["public"]["Enums"]["staff_invite_role"]
          status: string
          title: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          provider_id: string
          role?: Database["public"]["Enums"]["staff_invite_role"]
          status?: string
          title?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          provider_id?: string
          role?: Database["public"]["Enums"]["staff_invite_role"]
          status?: string
          title?: string | null
          token?: string
        }
        Relationships: []
      }
      subcategory_overrides: {
        Row: {
          is_hidden: boolean
          sort_order: number | null
          subcategory_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          is_hidden?: boolean
          sort_order?: number | null
          subcategory_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          is_hidden?: boolean
          sort_order?: number | null
          subcategory_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategory_overrides_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: true
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          features: Json
          id: string
          interval: Database["public"]["Enums"]["subscription_interval"]
          is_active: boolean
          name: string
          price: number
          sort_order: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          interval: Database["public"]["Enums"]["subscription_interval"]
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          interval?: Database["public"]["Enums"]["subscription_interval"]
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      task_drafts: {
        Row: {
          created_at: string
          id: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          employer_id: string
          id: string
          metadata: Json
          payment_method: string
          reference: string | null
          status: string
          task_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          employer_id: string
          id?: string
          metadata?: Json
          payment_method?: string
          reference?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          employer_id?: string
          id?: string
          metadata?: Json
          payment_method?: string
          reference?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_payments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_proposals: {
        Row: {
          attachments: Json
          booking_id: string | null
          created_at: string
          customer_id: string
          direction: string
          estimated_duration: string | null
          eta_date: string | null
          id: string
          message: string | null
          quoted_price: number | null
          responded_at: string | null
          service_id: string | null
          status: string
          task_id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          attachments?: Json
          booking_id?: string | null
          created_at?: string
          customer_id: string
          direction: string
          estimated_duration?: string | null
          eta_date?: string | null
          id?: string
          message?: string | null
          quoted_price?: number | null
          responded_at?: string | null
          service_id?: string | null
          status?: string
          task_id: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          attachments?: Json
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          direction?: string
          estimated_duration?: string | null
          eta_date?: string | null
          id?: string
          message?: string | null
          quoted_price?: number | null
          responded_at?: string | null
          service_id?: string | null
          status?: string
          task_id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_proposals_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "vendor_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          address: string
          budget_max: number | null
          budget_min: number | null
          category_id: string | null
          created_at: string
          customer_id: string
          description: string
          experience_level: string | null
          featured: boolean
          id: string
          moderation_note: string | null
          payment_status: string
          photos: string[] | null
          posting_fee: number
          preferred_date: string | null
          preferred_time: string | null
          skills: string[]
          status: string
          subcategory_id: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          address: string
          budget_max?: number | null
          budget_min?: number | null
          category_id?: string | null
          created_at?: string
          customer_id: string
          description: string
          experience_level?: string | null
          featured?: boolean
          id?: string
          moderation_note?: string | null
          payment_status?: string
          photos?: string[] | null
          posting_fee?: number
          preferred_date?: string | null
          preferred_time?: string | null
          skills?: string[]
          status?: string
          subcategory_id?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          address?: string
          budget_max?: number | null
          budget_min?: number | null
          category_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          experience_level?: string | null
          featured?: boolean
          id?: string
          moderation_note?: string | null
          payment_status?: string
          photos?: string[] | null
          posting_fee?: number
          preferred_date?: string | null
          preferred_time?: string | null
          skills?: string[]
          status?: string
          subcategory_id?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_push_defaults: {
        Row: {
          booking_updates: boolean
          id: boolean
          marketing: boolean
          new_messages: boolean
          payment_updates: boolean
          push_enabled: boolean
          review_alerts: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          booking_updates?: boolean
          id?: boolean
          marketing?: boolean
          new_messages?: boolean
          payment_updates?: boolean
          push_enabled?: boolean
          review_alerts?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          booking_updates?: boolean
          id?: boolean
          marketing?: boolean
          new_messages?: boolean
          payment_updates?: boolean
          push_enabled?: boolean
          review_alerts?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          start_time: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean
          start_time: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_blocked_dates: {
        Row: {
          blocked_date: string
          created_at: string
          id: string
          reason: string | null
          vendor_id: string
        }
        Insert: {
          blocked_date: string
          created_at?: string
          id?: string
          reason?: string | null
          vendor_id: string
        }
        Update: {
          blocked_date?: string
          created_at?: string
          id?: string
          reason?: string | null
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_lead_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_portfolio: {
        Row: {
          caption: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string
          media_type: string
          sort_order: number
          title: string | null
          vendor_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          media_type?: string
          sort_order?: number
          title?: string | null
          vendor_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          media_type?: string
          sort_order?: number
          title?: string | null
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_services: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          faqs: Json
          featured_started_at: string | null
          featured_until: string | null
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
          is_sponsored: boolean
          price_max: number | null
          price_min: number | null
          price_type: string
          sponsored_started_at: string | null
          sponsored_until: string | null
          subcategory_id: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          faqs?: Json
          featured_started_at?: string | null
          featured_until?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
          is_sponsored?: boolean
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          sponsored_started_at?: string | null
          sponsored_until?: string | null
          subcategory_id?: string | null
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          faqs?: Json
          featured_started_at?: string | null
          featured_until?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          is_featured?: boolean
          is_sponsored?: boolean
          price_max?: number | null
          price_min?: number | null
          price_type?: string
          sponsored_started_at?: string | null
          sponsored_until?: string | null
          subcategory_id?: string | null
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_services_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "service_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_verifications: {
        Row: {
          admin_notes: string | null
          business_name: string | null
          business_registration_url: string | null
          created_at: string
          document_status: Json
          expires_at: string | null
          government_id_url: string | null
          id: string
          info_request_items: Json
          info_request_note: string | null
          insurance_url: string | null
          last_renewed_at: string | null
          legal_name: string | null
          police_clearance_url: string | null
          professional_license_url: string | null
          proof_of_address_url: string | null
          rejection_note: string | null
          rejection_reasons: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_at: string | null
          tax_certificate_url: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          admin_notes?: string | null
          business_name?: string | null
          business_registration_url?: string | null
          created_at?: string
          document_status?: Json
          expires_at?: string | null
          government_id_url?: string | null
          id?: string
          info_request_items?: Json
          info_request_note?: string | null
          insurance_url?: string | null
          last_renewed_at?: string | null
          legal_name?: string | null
          police_clearance_url?: string | null
          professional_license_url?: string | null
          proof_of_address_url?: string | null
          rejection_note?: string | null
          rejection_reasons?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          tax_certificate_url?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          admin_notes?: string | null
          business_name?: string | null
          business_registration_url?: string | null
          created_at?: string
          document_status?: Json
          expires_at?: string | null
          government_id_url?: string | null
          id?: string
          info_request_items?: Json
          info_request_note?: string | null
          insurance_url?: string | null
          last_renewed_at?: string | null
          legal_name?: string | null
          police_clearance_url?: string | null
          professional_license_url?: string | null
          proof_of_address_url?: string | null
          rejection_note?: string | null
          rejection_reasons?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_at?: string | null
          tax_certificate_url?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      verification_reminder_log: {
        Row: {
          created_at: string
          email_error: string | null
          email_status: string
          expires_at: string | null
          id: string
          in_app_error: string | null
          in_app_status: string
          kind: string
          metadata: Json
          notification_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_user_id: string | null
          target_id: string
          updated_at: string
          window_days: number
          window_key: string
          window_label: string | null
        }
        Insert: {
          created_at?: string
          email_error?: string | null
          email_status?: string
          expires_at?: string | null
          id?: string
          in_app_error?: string | null
          in_app_status?: string
          kind: string
          metadata?: Json
          notification_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_user_id?: string | null
          target_id: string
          updated_at?: string
          window_days: number
          window_key: string
          window_label?: string | null
        }
        Update: {
          created_at?: string
          email_error?: string | null
          email_status?: string
          expires_at?: string | null
          id?: string
          in_app_error?: string | null
          in_app_status?: string
          kind?: string
          metadata?: Json
          notification_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_user_id?: string | null
          target_id?: string
          updated_at?: string
          window_days?: number
          window_key?: string
          window_label?: string | null
        }
        Relationships: []
      }
      verification_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          event: string
          from_status: Database["public"]["Enums"]["verification_status"] | null
          id: string
          note: string | null
          reasons: string[] | null
          to_status: Database["public"]["Enums"]["verification_status"]
          vendor_id: string
          verification_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event: string
          from_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id?: string
          note?: string | null
          reasons?: string[] | null
          to_status: Database["public"]["Enums"]["verification_status"]
          vendor_id: string
          verification_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          event?: string
          from_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          id?: string
          note?: string | null
          reasons?: string[] | null
          to_status?: Database["public"]["Enums"]["verification_status"]
          vendor_id?: string
          verification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_status_history_verification_id_fkey"
            columns: ["verification_id"]
            isOneToOne: false
            referencedRelation: "vendor_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_details: Json | null
          payment_method: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_details?: Json | null
          payment_method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_details?: Json | null
          payment_method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_staff_invitation: { Args: { _token: string }; Returns: Json }
      admin_hard_delete_review: {
        Args: { _reason: string; _review_id: string }
        Returns: Json
      }
      admin_promote_service: {
        Args: {
          _days?: number
          _kind: string
          _notes?: string
          _service_id: string
        }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          faqs: Json
          featured_started_at: string | null
          featured_until: string | null
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
          is_sponsored: boolean
          price_max: number | null
          price_min: number | null
          price_type: string
          sponsored_started_at: string | null
          sponsored_until: string | null
          subcategory_id: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_services"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_remove_service_promotion: {
        Args: { _kind: string; _notes?: string; _service_id: string }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          faqs: Json
          featured_started_at: string | null
          featured_until: string | null
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
          is_sponsored: boolean
          price_max: number | null
          price_min: number | null
          price_type: string
          sponsored_started_at: string | null
          sponsored_until: string | null
          subcategory_id: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_services"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_to_task: {
        Args: {
          p_attachments?: Json
          p_customer_id: string
          p_estimated_duration: string
          p_eta_date: string
          p_message: string
          p_quoted_price: number
          p_service_id: string
          p_task_id: string
        }
        Returns: string
      }
      approve_refund: {
        Args: { _admin_notes?: string; _refund_id: string }
        Returns: Json
      }
      assign_moderation_case: {
        Args: {
          _assignee: string
          _entity_id: string
          _kind: string
          _note?: string
          _ttl_minutes?: number
        }
        Returns: {
          assigned_to: string
          claimed_at: string
          created_at: string
          entity_id: string
          expires_at: string
          expiry_notified_at: string | null
          id: string
          kind: string
          notes: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "moderation_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_moderation_action: {
        Args: { _action: string; _items: Json; _note?: string }
        Returns: Json
      }
      bulk_moderation_claim_action: {
        Args: {
          _action: string
          _items: Json
          _note?: string
          _ttl_minutes?: number
        }
        Returns: Json
      }
      bump_brand_version: { Args: never; Returns: string }
      cancel_job: {
        Args: { _reason?: string; _task_id: string }
        Returns: Json
      }
      claim_moderation_case: {
        Args: { _entity_id: string; _kind: string; _ttl_minutes?: number }
        Returns: {
          assigned_to: string
          claimed_at: string
          created_at: string
          entity_id: string
          expires_at: string
          expiry_notified_at: string | null
          id: string
          kind: string
          notes: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "moderation_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_moderation_case: {
        Args: { _entity_id: string; _kind: string; _notes?: string }
        Returns: undefined
      }
      enforce_provider_restriction: {
        Args: { _vendor_id: string }
        Returns: undefined
      }
      escalate_overdue_moderation_cases: { Args: never; Returns: Json }
      expire_featured_services: { Args: never; Returns: undefined }
      expire_overdue_tasks: { Args: never; Returns: number }
      expire_sponsored_services: { Args: never; Returns: undefined }
      expire_stale_verifications: { Args: never; Returns: Json }
      get_setting_int: {
        Args: { _default: number; _key: string }
        Returns: number
      }
      get_staff_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          provider_id: string
          provider_name: string
          role: Database["public"]["Enums"]["staff_invite_role"]
          status: string
          title: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_open_report: {
        Args: { _id: string; _type: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invalidate_device_token: {
        Args: { _reason: string; _token: string }
        Returns: undefined
      }
      invitee_email_matches: { Args: { _invite_id: string }; Returns: boolean }
      is_admin_or_moderator: { Args: { _user_id: string }; Returns: boolean }
      log_login_event: {
        Args: { _provider?: string; _user_agent?: string }
        Returns: undefined
      }
      mark_withdrawal_paid: {
        Args: { _admin_notes?: string; _withdrawal_id: string }
        Returns: Json
      }
      moderation_route_recipients: {
        Args: { _kind: string; _tenant?: string }
        Returns: string[]
      }
      nearby_providers: {
        Args: { center_lat: number; center_lng: number; radius_km?: number }
        Returns: {
          distance_km: number
          user_id: string
        }[]
      }
      notify_admins: {
        Args: {
          _message: string
          _metadata?: Json
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_expired_moderation_claims: { Args: never; Returns: number }
      popular_searches: {
        Args: { _limit?: number; _since_days?: number }
        Returns: {
          hits: number
          query: string
        }[]
      }
      prune_stale_device_tokens: {
        Args: { _older_than_days?: number }
        Returns: number
      }
      purge_expired_hidden_reviews: { Args: never; Returns: Json }
      record_ad_event: {
        Args: { _ad_id: string; _event_type?: string }
        Returns: undefined
      }
      record_device_token_failure: {
        Args: { _reason: string; _token: string }
        Returns: undefined
      }
      register_device_token: {
        Args: {
          _app_version?: string
          _device_model?: string
          _locale?: string
          _platform: string
          _token: string
        }
        Returns: string
      }
      release_moderation_case: {
        Args: { _entity_id: string; _kind: string }
        Returns: undefined
      }
      renew_task: {
        Args: { _new_deadline: string; _task_id: string }
        Returns: undefined
      }
      search_suggestions: {
        Args: { _limit?: number; _prefix: string }
        Returns: {
          hits: number
          query: string
        }[]
      }
      set_initial_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      sponsor_vendor_service: {
        Args: { _days?: number; _service_id: string }
        Returns: {
          category_id: string
          created_at: string
          description: string | null
          faqs: Json
          featured_started_at: string | null
          featured_until: string | null
          id: string
          images: string[]
          is_active: boolean
          is_featured: boolean
          is_sponsored: boolean
          price_max: number | null
          price_min: number | null
          price_type: string
          sponsored_started_at: string | null
          sponsored_until: string | null
          subcategory_id: string | null
          title: string
          updated_at: string
          vendor_id: string
        }
        SetofOptions: {
          from: "*"
          to: "vendor_services"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      sweep_provider_restrictions: { Args: never; Returns: Json }
      takeover_moderation_case:
        | {
            Args: { _entity_id: string; _kind: string; _ttl_minutes?: number }
            Returns: {
              assigned_to: string
              claimed_at: string
              created_at: string
              entity_id: string
              expires_at: string
              expiry_notified_at: string | null
              id: string
              kind: string
              notes: string | null
              status: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "moderation_assignments"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _entity_id: string
              _kind: string
              _reason?: string
              _ttl_minutes?: number
            }
            Returns: {
              assigned_to: string
              claimed_at: string
              created_at: string
              entity_id: string
              expires_at: string
              expiry_notified_at: string | null
              id: string
              kind: string
              notes: string | null
              status: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "moderation_assignments"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      test_admin_audit_log_invitee_policy: {
        Args: never
        Returns: {
          assertion: string
          detail: string
          passed: boolean
        }[]
      }
    }
    Enums: {
      app_role: "customer" | "provider" | "admin" | "employer" | "moderator"
      staff_invite_role: "staff" | "manager" | "provider_admin"
      subscription_interval: "monthly" | "quarterly" | "yearly"
      subscription_status: "active" | "expired" | "cancelled" | "pending"
      subscription_tier: "individual" | "small_business"
      verification_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "info_requested"
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
      app_role: ["customer", "provider", "admin", "employer", "moderator"],
      staff_invite_role: ["staff", "manager", "provider_admin"],
      subscription_interval: ["monthly", "quarterly", "yearly"],
      subscription_status: ["active", "expired", "cancelled", "pending"],
      subscription_tier: ["individual", "small_business"],
      verification_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "info_requested",
      ],
    },
  },
} as const
