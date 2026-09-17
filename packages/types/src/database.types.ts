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
      _legacy_audit_events: {
        Row: {
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entry_hash: string | null
          event_action: string
          event_category: string
          event_outcome: string
          id: string
          ip_address: unknown
          metadata: Json | null
          prev_hash: string | null
          request_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entry_hash?: string | null
          event_action: string
          event_category: string
          event_outcome: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          prev_hash?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entry_hash?: string | null
          event_action?: string
          event_category?: string
          event_outcome?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          prev_hash?: string | null
          request_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      _legacy_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      _legacy_consultant_applications: {
        Row: {
          avatar_url: string | null
          bio: string
          cover_url: string | null
          created_at: string | null
          expertise: string
          full_name: string
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio: string
          cover_url?: string | null
          created_at?: string | null
          expertise: string
          full_name: string
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          cover_url?: string | null
          created_at?: string | null
          expertise?: string
          full_name?: string
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      _legacy_consultant_bookings: {
        Row: {
          consultant_name: string
          created_at: string | null
          date: string
          id: string
          specialty: string | null
          status: string | null
          time: string
        }
        Insert: {
          consultant_name: string
          created_at?: string | null
          date: string
          id?: string
          specialty?: string | null
          status?: string | null
          time: string
        }
        Update: {
          consultant_name?: string
          created_at?: string | null
          date?: string
          id?: string
          specialty?: string | null
          status?: string | null
          time?: string
        }
        Relationships: []
      }
      _legacy_consultations: {
        Row: {
          client_id: string
          consultant_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          rate_per_minute: number
          service_type: string | null
          started_at: string | null
          status: string | null
          total_cost: number | null
        }
        Insert: {
          client_id: string
          consultant_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          rate_per_minute: number
          service_type?: string | null
          started_at?: string | null
          status?: string | null
          total_cost?: number | null
        }
        Update: {
          client_id?: string
          consultant_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          rate_per_minute?: number
          service_type?: string | null
          started_at?: string | null
          status?: string | null
          total_cost?: number | null
        }
        Relationships: []
      }
      _legacy_messages: {
        Row: {
          consultation_id: string
          content: string
          created_at: string | null
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          consultation_id: string
          content: string
          created_at?: string | null
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          consultation_id?: string
          content?: string
          created_at?: string | null
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: []
      }
      _legacy_notifications: {
        Row: {
          actorId: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          read: boolean | null
          redirectUrl: string | null
          target_user_id: string
          title: string
          type: string | null
          updatedAt: string | null
          userId: string | null
        }
        Insert: {
          actorId?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read?: boolean | null
          redirectUrl?: string | null
          target_user_id: string
          title: string
          type?: string | null
          updatedAt?: string | null
          userId?: string | null
        }
        Update: {
          actorId?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read?: boolean | null
          redirectUrl?: string | null
          target_user_id?: string
          title?: string
          type?: string | null
          updatedAt?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      _legacy_session_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          sender_id: string | null
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          sender_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "_legacy_session_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_session_requests: {
        Row: {
          consultant_id: string | null
          created_at: string | null
          id: string
          seeker_id: string | null
          status: string | null
        }
        Insert: {
          consultant_id?: string | null
          created_at?: string | null
          id?: string
          seeker_id?: string | null
          status?: string | null
        }
        Update: {
          consultant_id?: string | null
          created_at?: string | null
          id?: string
          seeker_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_requests_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_requests_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          status: string | null
          transaction_type: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          transaction_type?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          transaction_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      AdminAuditLog: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string | null
          email: string | null
          id: string
          ip: string | null
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          record_id: string
          success: boolean | null
          table_name: string
          targetId: string | null
          targetType: string | null
          userAgent: string | null
          userId: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          success?: boolean | null
          table_name: string
          targetId?: string | null
          targetType?: string | null
          userAgent?: string | null
          userId?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          success?: boolean | null
          table_name?: string
          targetId?: string | null
          targetType?: string | null
          userAgent?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      AdminInvite: {
        Row: {
          acceptedAt: string | null
          createdAt: string
          email: string
          expiresAt: string
          id: string
          invitedBy: string
          revokedAt: string | null
          role: string
          tokenHash: string
        }
        Insert: {
          acceptedAt?: string | null
          createdAt?: string
          email: string
          expiresAt: string
          id?: string
          invitedBy: string
          revokedAt?: string | null
          role?: string
          tokenHash: string
        }
        Update: {
          acceptedAt?: string | null
          createdAt?: string
          email?: string
          expiresAt?: string
          id?: string
          invitedBy?: string
          revokedAt?: string | null
          role?: string
          tokenHash?: string
        }
        Relationships: []
      }
      AdminLoginAttempt: {
        Row: {
          createdAt: string
          email: string
          id: string
          ip: string | null
          reason: string | null
          success: boolean
        }
        Insert: {
          createdAt?: string
          email: string
          id?: string
          ip?: string | null
          reason?: string | null
          success: boolean
        }
        Update: {
          createdAt?: string
          email?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
        }
        Relationships: []
      }
      ai_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string
          specialty: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name: string
          specialty: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          specialty?: string
        }
        Relationships: []
      }
      ai_services: {
        Row: {
          created_at: string | null
          description: string
          href: string
          icon_name: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          href: string
          icon_name: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          href?: string
          icon_name?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      AIConsultant: {
        Row: {
          accuracy: number
          avatar: string
          bio: string
          category: string
          createdAt: string
          experience: number
          gender: string | null
          id: string
          isActive: boolean
          isFeatured: boolean
          isPaid: boolean
          languages: string[]
          model: string
          name: string
          perMinuteRate: number
          persona: string | null
          rating: number
          responseTime: number
          sparks: number
          specialties: string[]
          totalConsultations: number
          updatedAt: string
          username: string
          voiceStyle: string | null
        }
        Insert: {
          accuracy?: number
          avatar: string
          bio: string
          category: string
          createdAt?: string
          experience?: number
          gender?: string | null
          id?: string
          isActive?: boolean
          isFeatured?: boolean
          isPaid?: boolean
          languages?: string[]
          model?: string
          name: string
          perMinuteRate?: number
          persona?: string | null
          rating?: number
          responseTime?: number
          sparks?: number
          specialties?: string[]
          totalConsultations?: number
          updatedAt?: string
          username: string
          voiceStyle?: string | null
        }
        Update: {
          accuracy?: number
          avatar?: string
          bio?: string
          category?: string
          createdAt?: string
          experience?: number
          gender?: string | null
          id?: string
          isActive?: boolean
          isFeatured?: boolean
          isPaid?: boolean
          languages?: string[]
          model?: string
          name?: string
          perMinuteRate?: number
          persona?: string | null
          rating?: number
          responseTime?: number
          sparks?: number
          specialties?: string[]
          totalConsultations?: number
          updatedAt?: string
          username?: string
          voiceStyle?: string | null
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          created_at: string
          email: string
          id: number
          ip: string | null
          reason: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: number
          ip?: string | null
          reason?: string | null
          success: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: number
          ip?: string | null
          reason?: string | null
          success?: boolean
        }
        Relationships: []
      }
      Booking: {
        Row: {
          amount: number
          consultantEarning: number
          consultantId: string | null
          createdAt: string | null
          durationMinutes: number
          externalEmail: string | null
          id: string
          meetingLink: string | null
          paymentId: string | null
          platformFee: number
          rating: number | null
          review: string | null
          scheduledAt: string
          status: string
          updatedAt: string | null
          userId: string | null
        }
        Insert: {
          amount?: number
          consultantEarning?: number
          consultantId?: string | null
          createdAt?: string | null
          durationMinutes?: number
          externalEmail?: string | null
          id?: string
          meetingLink?: string | null
          paymentId?: string | null
          platformFee?: number
          rating?: number | null
          review?: string | null
          scheduledAt: string
          status?: string
          updatedAt?: string | null
          userId?: string | null
        }
        Update: {
          amount?: number
          consultantEarning?: number
          consultantId?: string | null
          createdAt?: string | null
          durationMinutes?: number
          externalEmail?: string | null
          id?: string
          meetingLink?: string | null
          paymentId?: string | null
          platformFee?: number
          rating?: number | null
          review?: string | null
          scheduledAt?: string
          status?: string
          updatedAt?: string | null
          userId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Booking_consultantId_fkey"
            columns: ["consultantId"]
            isOneToOne: false
            referencedRelation: "Consultant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Booking_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Booking_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      CallSession: {
        Row: {
          aiConsultantId: string | null
          amount: number
          bookingId: string | null
          consultantId: string | null
          createdAt: string
          durationSeconds: number
          endTime: string | null
          id: string
          isAI: boolean
          recordingReady: boolean
          recordingUrl: string | null
          startTime: string
          status: string
          updatedAt: string
          userId: string
        }
        Insert: {
          aiConsultantId?: string | null
          amount?: number
          bookingId?: string | null
          consultantId?: string | null
          createdAt?: string
          durationSeconds?: number
          endTime?: string | null
          id?: string
          isAI?: boolean
          recordingReady?: boolean
          recordingUrl?: string | null
          startTime?: string
          status?: string
          updatedAt?: string
          userId: string
        }
        Update: {
          aiConsultantId?: string | null
          amount?: number
          bookingId?: string | null
          consultantId?: string | null
          createdAt?: string
          durationSeconds?: number
          endTime?: string | null
          id?: string
          isAI?: boolean
          recordingReady?: boolean
          recordingUrl?: string | null
          startTime?: string
          status?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "CallSession_bookingId_fkey"
            columns: ["bookingId"]
            isOneToOne: true
            referencedRelation: "Booking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CallSession_consultantId_fkey"
            columns: ["consultantId"]
            isOneToOne: false
            referencedRelation: "Consultant"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CallSession_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CallSession_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Cheer: {
        Row: {
          createdAt: string
          id: string
          postId: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id?: string
          postId: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          postId?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Cheer_postId_fkey"
            columns: ["postId"]
            isOneToOne: false
            referencedRelation: "Post"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Cheer_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Cheer_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Comment: {
        Row: {
          authorId: string
          content: string
          createdAt: string
          id: string
          parentId: string | null
          postId: string
          updatedAt: string
        }
        Insert: {
          authorId: string
          content: string
          createdAt?: string
          id?: string
          parentId?: string | null
          postId: string
          updatedAt?: string
        }
        Update: {
          authorId?: string
          content?: string
          createdAt?: string
          id?: string
          parentId?: string | null
          postId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "Comment_authorId_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Comment_authorId_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Comment_parentId_fkey"
            columns: ["parentId"]
            isOneToOne: false
            referencedRelation: "Comment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Comment_postId_fkey"
            columns: ["postId"]
            isOneToOne: false
            referencedRelation: "Post"
            referencedColumns: ["id"]
          },
        ]
      }
      Consultant: {
        Row: {
          approvedAt: string | null
          approvedBy: string | null
          audioRate: number | null
          availability: Json | null
          bio: string | null
          bufferMinutes: number | null
          category: string
          chatRate: number | null
          createdAt: string | null
          earnings: number | null
          faith: string | null
          id: string
          isActive: boolean | null
          isVerified: boolean | null
          languages: string[] | null
          perMinuteRate: number
          physicalRate: number | null
          rating: number | null
          rejectionReason: string | null
          sparkScore: number | null
          specialties: string[] | null
          status: string | null
          subdomain: string | null
          subdomainActive: boolean | null
          theme: Json | null
          totalConsultations: number | null
          updatedAt: string | null
          userId: string
          verificationDocs: Json | null
          videoRate: number | null
          whiteLabelEnabled: boolean | null
        }
        Insert: {
          approvedAt?: string | null
          approvedBy?: string | null
          audioRate?: number | null
          availability?: Json | null
          bio?: string | null
          bufferMinutes?: number | null
          category?: string
          chatRate?: number | null
          createdAt?: string | null
          earnings?: number | null
          faith?: string | null
          id?: string
          isActive?: boolean | null
          isVerified?: boolean | null
          languages?: string[] | null
          perMinuteRate?: number
          physicalRate?: number | null
          rating?: number | null
          rejectionReason?: string | null
          sparkScore?: number | null
          specialties?: string[] | null
          status?: string | null
          subdomain?: string | null
          subdomainActive?: boolean | null
          theme?: Json | null
          totalConsultations?: number | null
          updatedAt?: string | null
          userId: string
          verificationDocs?: Json | null
          videoRate?: number | null
          whiteLabelEnabled?: boolean | null
        }
        Update: {
          approvedAt?: string | null
          approvedBy?: string | null
          audioRate?: number | null
          availability?: Json | null
          bio?: string | null
          bufferMinutes?: number | null
          category?: string
          chatRate?: number | null
          createdAt?: string | null
          earnings?: number | null
          faith?: string | null
          id?: string
          isActive?: boolean | null
          isVerified?: boolean | null
          languages?: string[] | null
          perMinuteRate?: number
          physicalRate?: number | null
          rating?: number | null
          rejectionReason?: string | null
          sparkScore?: number | null
          specialties?: string[] | null
          status?: string | null
          subdomain?: string | null
          subdomainActive?: boolean | null
          theme?: Json | null
          totalConsultations?: number | null
          updatedAt?: string | null
          userId?: string
          verificationDocs?: Json | null
          videoRate?: number | null
          whiteLabelEnabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "Consultant_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Consultant_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Conversation: {
        Row: {
          createdAt: string | null
          id: string
          isGroup: boolean | null
          lastMessageAt: string | null
          lastMessageText: string | null
          metadata: Json | null
        }
        Insert: {
          createdAt?: string | null
          id?: string
          isGroup?: boolean | null
          lastMessageAt?: string | null
          lastMessageText?: string | null
          metadata?: Json | null
        }
        Update: {
          createdAt?: string | null
          id?: string
          isGroup?: boolean | null
          lastMessageAt?: string | null
          lastMessageText?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      ConversationParticipant: {
        Row: {
          conversationId: string
          joinedAt: string | null
          lastReadAt: string | null
          role: string | null
          userId: string
        }
        Insert: {
          conversationId: string
          joinedAt?: string | null
          lastReadAt?: string | null
          role?: string | null
          userId: string
        }
        Update: {
          conversationId?: string
          joinedAt?: string | null
          lastReadAt?: string | null
          role?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ConversationParticipant_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "Conversation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConversationParticipant_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConversationParticipant_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      DebugLog: {
        Row: {
          channel: string
          createdAt: string
          data: Json | null
          durationMs: number | null
          event: string
          id: string
          level: string
          message: string | null
          requestId: string | null
          route: string | null
          userId: string | null
        }
        Insert: {
          channel: string
          createdAt?: string
          data?: Json | null
          durationMs?: number | null
          event: string
          id?: string
          level: string
          message?: string | null
          requestId?: string | null
          route?: string | null
          userId?: string | null
        }
        Update: {
          channel?: string
          createdAt?: string
          data?: Json | null
          durationMs?: number | null
          event?: string
          id?: string
          level?: string
          message?: string | null
          requestId?: string | null
          route?: string | null
          userId?: string | null
        }
        Relationships: []
      }
      Message: {
        Row: {
          content: string
          conversationId: string | null
          createdAt: string | null
          deletedAt: string | null
          editedAt: string | null
          id: string
          metadata: Json | null
          senderId: string | null
          type: string | null
        }
        Insert: {
          content: string
          conversationId?: string | null
          createdAt?: string | null
          deletedAt?: string | null
          editedAt?: string | null
          id?: string
          metadata?: Json | null
          senderId?: string | null
          type?: string | null
        }
        Update: {
          content?: string
          conversationId?: string | null
          createdAt?: string | null
          deletedAt?: string | null
          editedAt?: string | null
          id?: string
          metadata?: Json | null
          senderId?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Message_conversationId_fkey"
            columns: ["conversationId"]
            isOneToOne: false
            referencedRelation: "Conversation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Message_senderId_fkey"
            columns: ["senderId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Message_senderId_fkey"
            columns: ["senderId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          actorId: string | null
          createdAt: string
          id: string
          message: string
          read: boolean
          redirectUrl: string | null
          type: string
          updatedAt: string
          userId: string
        }
        Insert: {
          actorId?: string | null
          createdAt?: string
          id?: string
          message: string
          read?: boolean
          redirectUrl?: string | null
          type?: string
          updatedAt?: string
          userId: string
        }
        Update: {
          actorId?: string | null
          createdAt?: string
          id?: string
          message?: string
          read?: boolean
          redirectUrl?: string | null
          type?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Notification_actorId_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_actorId_fkey"
            columns: ["actorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Post: {
        Row: {
          authorId: string | null
          cheerCount: number | null
          commentCount: number | null
          content: string
          created_at: string | null
          id: string
          isFlagged: boolean | null
          isPinned: boolean | null
          mediaUrls: string[] | null
          shareCount: number | null
          updatedAt: string | null
        }
        Insert: {
          authorId?: string | null
          cheerCount?: number | null
          commentCount?: number | null
          content: string
          created_at?: string | null
          id?: string
          isFlagged?: boolean | null
          isPinned?: boolean | null
          mediaUrls?: string[] | null
          shareCount?: number | null
          updatedAt?: string | null
        }
        Update: {
          authorId?: string | null
          cheerCount?: number | null
          commentCount?: number | null
          content?: string
          created_at?: string | null
          id?: string
          isFlagged?: boolean | null
          isPinned?: boolean | null
          mediaUrls?: string[] | null
          shareCount?: number | null
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_posts_consultant_id_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_posts_consultant_id_fkey"
            columns: ["authorId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      sparks: {
        Row: {
          consultant_id: string
          last_spark_at: string | null
          total_sparks: number | null
        }
        Insert: {
          consultant_id: string
          last_spark_at?: string | null
          total_sparks?: number | null
        }
        Update: {
          consultant_id?: string
          last_spark_at?: string | null
          total_sparks?: number | null
        }
        Relationships: []
      }
      Transaction: {
        Row: {
          amount: number
          balance: number
          createdAt: string | null
          description: string
          id: string
          metadata: Json | null
          referenceId: string | null
          type: string
          walletId: string
        }
        Insert: {
          amount: number
          balance: number
          createdAt?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          referenceId?: string | null
          type?: string
          walletId: string
        }
        Update: {
          amount?: number
          balance?: number
          createdAt?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          referenceId?: string | null
          type?: string
          walletId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Transaction_walletId_fkey"
            columns: ["walletId"]
            isOneToOne: false
            referencedRelation: "Wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string | null
          createdAt: string | null
          date_of_birth: string | null
          email: string
          full_name: string | null
          gender: string | null
          id: string
          is_ai: boolean | null
          is_online: boolean | null
          isVerified: boolean | null
          name: string | null
          onboarding_completed: boolean | null
          role: Database["public"]["Enums"]["AppRole"] | null
          sparks: number | null
          sparkScore: number | null
          system_prompt: string | null
          updated_at: string | null
          updatedAt: string | null
          username: string | null
          wallet_balance: number | null
          zodiac_sign: string | null
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          createdAt?: string | null
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          gender?: string | null
          id: string
          is_ai?: boolean | null
          is_online?: boolean | null
          isVerified?: boolean | null
          name?: string | null
          onboarding_completed?: boolean | null
          role?: Database["public"]["Enums"]["AppRole"] | null
          sparks?: number | null
          sparkScore?: number | null
          system_prompt?: string | null
          updated_at?: string | null
          updatedAt?: string | null
          username?: string | null
          wallet_balance?: number | null
          zodiac_sign?: string | null
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          createdAt?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          is_ai?: boolean | null
          is_online?: boolean | null
          isVerified?: boolean | null
          name?: string | null
          onboarding_completed?: boolean | null
          role?: Database["public"]["Enums"]["AppRole"] | null
          sparks?: number | null
          sparkScore?: number | null
          system_prompt?: string | null
          updated_at?: string | null
          updatedAt?: string | null
          username?: string | null
          wallet_balance?: number | null
          zodiac_sign?: string | null
        }
        Relationships: []
      }
      UserActivity: {
        Row: {
          consultantId: string | null
          createdAt: string
          id: string
          type: string
          userId: string
        }
        Insert: {
          consultantId?: string | null
          createdAt?: string
          id?: string
          type: string
          userId: string
        }
        Update: {
          consultantId?: string | null
          createdAt?: string
          id?: string
          type?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserActivity_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserActivity_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      UserPreferences: {
        Row: {
          createdAt: string
          favoriteConsultants: string[]
          goals: string[]
          id: string
          interests: string[]
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          favoriteConsultants?: string[]
          goals?: string[]
          id?: string
          interests?: string[]
          updatedAt?: string
          userId: string
        }
        Update: {
          createdAt?: string
          favoriteConsultants?: string[]
          goals?: string[]
          id?: string
          interests?: string[]
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "UserPreferences_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "UserPreferences_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Wallet: {
        Row: {
          balance: number
          blocked: number
          createdAt: string
          escrow: number
          id: string
          pendingIn: number
          pendingOut: number
          updatedAt: string
          userId: string
        }
        Insert: {
          balance?: number
          blocked?: number
          createdAt?: string
          escrow?: number
          id?: string
          pendingIn?: number
          pendingOut?: number
          updatedAt?: string
          userId: string
        }
        Update: {
          balance?: number
          blocked?: number
          createdAt?: string
          escrow?: number
          id?: string
          pendingIn?: number
          pendingOut?: number
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "Wallet_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Wallet_userId_fkey"
            columns: ["userId"]
            isOneToOne: true
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          created_at: string | null
          gateway: string | null
          id: string
          reference_id: string | null
          status: string | null
          transaction_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          gateway?: string | null
          id?: string
          reference_id?: string | null
          status?: string | null
          transaction_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          gateway?: string | null
          id?: string
          reference_id?: string | null
          status?: string | null
          transaction_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string | null
          is_ai: boolean | null
          is_online: boolean | null
          onboarding_completed: boolean | null
          role: string | null
          sparks: number | null
          system_prompt: string | null
          updated_at: string | null
          wallet_balance: number | null
          zodiac_sign: string | null
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string | null
          is_ai?: boolean | null
          is_online?: boolean | null
          onboarding_completed?: boolean | null
          role?: never
          sparks?: number | null
          system_prompt?: string | null
          updated_at?: string | null
          wallet_balance?: number | null
          zodiac_sign?: string | null
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string | null
          is_ai?: boolean | null
          is_online?: boolean | null
          onboarding_completed?: boolean | null
          role?: never
          sparks?: number | null
          system_prompt?: string | null
          updated_at?: string | null
          wallet_balance?: number | null
          zodiac_sign?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_column_if_not_exists: {
        Args: {
          p_column_def: string
          p_column_name: string
          p_schema_name: string
          p_table_name: string
        }
        Returns: undefined
      }
      add_constraint_if_not_exists: {
        Args: {
          p_constraint_def: string
          p_constraint_name: string
          p_schema_name: string
          p_table_name: string
        }
        Returns: undefined
      }
      approve_consultant: {
        Args: { target_application_id: string; target_user_id: string }
        Returns: undefined
      }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_is_consultant: { Args: never; Returns: boolean }
      auth_user_role: { Args: never; Returns: string }
      cleanup_admin_logs: { Args: never; Returns: undefined }
      current_user_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      deduct_wallet_balance: {
        Args: { amount: number; user_id: string }
        Returns: number
      }
      delete_user_cascade: { Args: { p_user_id: string }; Returns: Json }
      get_or_create_conversation: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: string
      }
      is_locked_out: { Args: { p_email: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      pulse_deduct_inr: {
        Args: { p_client_id: string; p_consultation_id: string }
        Returns: Json
      }
      recharge_wallet: { Args: { recharge_amount: number }; Returns: number }
    }
    Enums: {
      AppRole:
        | "USER"
        | "CLIENT_ADMIN"
        | "SUPPORT"
        | "ADMIN"
        | "SUPER_ADMIN"
        | "VIEWER"
        | "AI"
      BookingStatus:
        | "PENDING"
        | "CONFIRMED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "MISSED"
        | "DISPUTED"
      CallStatus: "INITIATED" | "CONNECTED" | "ENDED" | "RECORDING_READY"
      ConsultantCategory:
        | "ASTROLOGER"
        | "PSYCHOLOGIST"
        | "TAROT"
        | "NUMEROLOGIST"
        | "PALMIST"
        | "VASTU"
        | "REIKI"
        | "LIFE_COACH"
        | "HEALER"
        | "MOTIVATIONAL_SPEAKER"
        | "SPIRITUAL_GUIDE"
        | "YOGA_INSTRUCTOR"
      ConsultantStatus: "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED"
      Faith:
        | "HINDU"
        | "ISLAM"
        | "CHRISTIAN"
        | "BUDDHIST"
        | "JEWISH"
        | "SIKH"
        | "OTHER"
      Role:
        | "USER"
        | "HEALER"
        | "ADMIN"
        | "SUPER_ADMIN"
        | "CLIENT_ADMIN"
        | "SUPPORT"
        | "VIEWER"
      TransactionType:
        | "TOPUP"
        | "PAYMENT"
        | "REFUND"
        | "PAYOUT"
        | "FEE"
        | "COMMISSION"
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
    Enums: {
      AppRole: [
        "USER",
        "CLIENT_ADMIN",
        "SUPPORT",
        "ADMIN",
        "SUPER_ADMIN",
        "VIEWER",
        "AI",
      ],
      BookingStatus: [
        "PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "MISSED",
        "DISPUTED",
      ],
      CallStatus: ["INITIATED", "CONNECTED", "ENDED", "RECORDING_READY"],
      ConsultantCategory: [
        "ASTROLOGER",
        "PSYCHOLOGIST",
        "TAROT",
        "NUMEROLOGIST",
        "PALMIST",
        "VASTU",
        "REIKI",
        "LIFE_COACH",
        "HEALER",
        "MOTIVATIONAL_SPEAKER",
        "SPIRITUAL_GUIDE",
        "YOGA_INSTRUCTOR",
      ],
      ConsultantStatus: ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"],
      Faith: [
        "HINDU",
        "ISLAM",
        "CHRISTIAN",
        "BUDDHIST",
        "JEWISH",
        "SIKH",
        "OTHER",
      ],
      Role: [
        "USER",
        "HEALER",
        "ADMIN",
        "SUPER_ADMIN",
        "CLIENT_ADMIN",
        "SUPPORT",
        "VIEWER",
      ],
      TransactionType: [
        "TOPUP",
        "PAYMENT",
        "REFUND",
        "PAYOUT",
        "FEE",
        "COMMISSION",
      ],
    },
  },
} as const
