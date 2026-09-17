export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Role = 'USER' | 'CLIENT_ADMIN' | 'SUPER_ADMIN';
export type ConsultantStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type ConsultantCategory =
  | 'ASTROLOGER'
  | 'PSYCHOLOGIST'
  | 'TAROT'
  | 'NUMEROLOGIST'
  | 'PALMIST'
  | 'VASTU'
  | 'REIKI'
  | 'LIFE_COACH'
  | 'MOTIVATIONAL_SPEAKER'
  | 'SPIRITUAL_GUIDE'
  | 'YOGA_INSTRUCTOR';

export type Faith =
  | 'HINDU'
  | 'ISLAM'
  | 'CHRISTIAN'
  | 'BUDDHIST'
  | 'JEWISH'
  | 'SIKH'
  | 'OTHER';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MISSED'
  | 'DISPUTED';

export type CallStatus = 'INITIATED' | 'CONNECTED' | 'ENDED' | 'RECORDING_READY';
export type TransactionType = 'TOPUP' | 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'FEE' | 'COMMISSION';

export interface Database {
  public: {
    Tables: {
      User: {
        Row: {
          id: string
          email: string
          username: string
          name: string | null
          avatar: string | null
          role: Role
          sparks: number
          isVerified: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          email: string
          username: string
          name?: string | null
          avatar?: string | null
          role?: Role
          sparks?: number
          isVerified?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          name?: string | null
          avatar?: string | null
          role?: Role
          sparks?: number
          isVerified?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      UserPreferences: {
        Row: {
          id: string
          userId: string
          interests: string[]
          goals: string[]
          favoriteConsultants: string[]
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          interests?: string[]
          goals?: string[]
          favoriteConsultants?: string[]
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          interests?: string[]
          goals?: string[]
          favoriteConsultants?: string[]
          createdAt?: string
          updatedAt?: string
        }
      }
      UserActivity: {
        Row: {
          id: string
          userId: string
          consultantId: string
          type: string
          createdAt: string
        }
        Insert: {
          id?: string
          userId: string
          consultantId: string
          type: string
          createdAt?: string
        }
        Update: {
          id?: string
          userId?: string
          consultantId?: string
          type?: string
          createdAt?: string
        }
      }
      Wallet: {
        Row: {
          id: string
          userId: string
          balance: number
          escrow: number
          pendingIn: number
          pendingOut: number
          blocked: number
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          balance?: number
          escrow?: number
          pendingIn?: number
          pendingOut?: number
          blocked?: number
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          balance?: number
          escrow?: number
          pendingIn?: number
          pendingOut?: number
          blocked?: number
          createdAt?: string
          updatedAt?: string
        }
      }
      Transaction: {
        Row: {
          id: string
          walletId: string
          type: TransactionType
          amount: number
          balance: number
          description: string
          referenceId: string | null
          metadata: Json | null
          createdAt: string
        }
        Insert: {
          id?: string
          walletId: string
          type: TransactionType
          amount: number
          balance: number
          description: string
          referenceId?: string | null
          metadata?: Json | null
          createdAt?: string
        }
        Update: {
          id?: string
          walletId?: string
          type?: TransactionType
          amount?: number
          balance?: number
          description?: string
          referenceId?: string | null
          metadata?: Json | null
          createdAt?: string
        }
      }
      Consultant: {
        Row: {
          id: string
          userId: string
          category: ConsultantCategory
          specialties: string[]
          languages: string[]
          bio: string | null
          perMinuteRate: number
          isVerified: boolean
          isActive: boolean
          faith: Faith
          rating: number
          totalConsultations: number
          earnings: number
          availability: Json
          status: ConsultantStatus
          verificationDocs: Json | null
          rejectionReason: string | null
          approvedBy: string | null
          approvedAt: string | null
          subdomain: string | null
          subdomainActive: boolean
          whiteLabelEnabled: boolean
          theme: Json | null
          chatRate: number | null
          audioRate: number | null
          videoRate: number | null
          physicalRate: number | null
          bufferMinutes: number
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          category: ConsultantCategory
          specialties?: string[]
          languages?: string[]
          bio?: string | null
          perMinuteRate?: number
          isVerified?: boolean
          isActive?: boolean
          faith?: Faith
          rating?: number
          totalConsultations?: number
          earnings?: number
          availability?: Json
          status?: ConsultantStatus
          verificationDocs?: Json | null
          rejectionReason?: string | null
          approvedBy?: string | null
          approvedAt?: string | null
          subdomain?: string | null
          subdomainActive?: boolean
          whiteLabelEnabled?: boolean
          theme?: Json | null
          chatRate?: number | null
          audioRate?: number | null
          videoRate?: number | null
          physicalRate?: number | null
          bufferMinutes?: number
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          category?: ConsultantCategory
          specialties?: string[]
          languages?: string[]
          bio?: string | null
          perMinuteRate?: number
          isVerified?: boolean
          isActive?: boolean
          faith?: Faith
          rating?: number
          totalConsultations?: number
          earnings?: number
          availability?: Json
          status?: ConsultantStatus
          verificationDocs?: Json | null
          rejectionReason?: string | null
          approvedBy?: string | null
          approvedAt?: string | null
          subdomain?: string | null
          subdomainActive?: boolean
          whiteLabelEnabled?: boolean
          theme?: Json | null
          chatRate?: number | null
          audioRate?: number | null
          videoRate?: number | null
          physicalRate?: number | null
          bufferMinutes?: number
          createdAt?: string
          updatedAt?: string
        }
      }
      Booking: {
        Row: {
          id: string
          userId: string | null
          consultantId: string
          scheduledAt: string
          durationMinutes: number
          status: BookingStatus
          meetingLink: string | null
          externalEmail: string | null
          paymentId: string | null
          amount: number
          platformFee: number
          consultantEarning: number
          rating: number | null
          review: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId?: string | null
          consultantId: string
          scheduledAt: string
          durationMinutes?: number
          status?: BookingStatus
          meetingLink?: string | null
          externalEmail?: string | null
          paymentId?: string | null
          amount: number
          platformFee: number
          consultantEarning: number
          rating?: number | null
          review?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string | null
          consultantId?: string
          scheduledAt?: string
          durationMinutes?: number
          status?: BookingStatus
          meetingLink?: string | null
          externalEmail?: string | null
          paymentId?: string | null
          amount?: number
          platformFee?: number
          consultantEarning?: number
          rating?: number | null
          review?: string | null
          createdAt?: string
          updatedAt?: string
        }
      }
      CallSession: {
        Row: {
          id: string
          bookingId: string | null
          userId: string
          consultantId: string
          isAI: boolean
          aiConsultantId: string | null
          startTime: string
          endTime: string | null
          durationSeconds: number
          amount: number
          status: CallStatus
          recordingUrl: string | null
          recordingReady: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          bookingId?: string | null
          userId: string
          consultantId: string
          isAI?: boolean
          aiConsultantId?: string | null
          startTime?: string
          endTime?: string | null
          durationSeconds?: number
          amount?: number
          status?: CallStatus
          recordingUrl?: string | null
          recordingReady?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          bookingId?: string | null
          userId?: string
          consultantId?: string
          isAI?: boolean
          aiConsultantId?: string | null
          startTime?: string
          endTime?: string | null
          durationSeconds?: number
          amount?: number
          status?: CallStatus
          recordingUrl?: string | null
          recordingReady?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      Post: {
        Row: {
          id: string
          content: string
          mediaUrls: string[]
          authorId: string
          cheerCount: number
          commentCount: number
          shareCount: number
          isPinned: boolean
          isFlagged: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          content: string
          mediaUrls?: string[]
          authorId: string
          cheerCount?: number
          commentCount?: number
          shareCount?: number
          isPinned?: boolean
          isFlagged?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          content?: string
          mediaUrls?: string[]
          authorId?: string
          cheerCount?: number
          commentCount?: number
          shareCount?: number
          isPinned?: boolean
          isFlagged?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      Comment: {
        Row: {
          id: string
          content: string
          authorId: string
          postId: string
          parentId: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          content: string
          authorId: string
          postId: string
          parentId?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          content?: string
          authorId?: string
          postId?: string
          parentId?: string | null
          createdAt?: string
          updatedAt?: string
        }
      }
      Cheer: {
        Row: {
          id: string
          userId: string
          postId: string
          createdAt: string
        }
        Insert: {
          id?: string
          userId: string
          postId: string
          createdAt?: string
        }
        Update: {
          id?: string
          userId?: string
          postId?: string
          createdAt?: string
        }
      }
      Notification: {
        Row: {
          id: string
          userId: string
          type: string
          message: string
          redirectUrl: string | null
          read: boolean
          actorId: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          type: string
          message: string
          redirectUrl?: string | null
          read?: boolean
          actorId: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          type?: string
          message?: string
          redirectUrl?: string | null
          read?: boolean
          actorId?: string
          createdAt?: string
          updatedAt?: string
        }
      }
      AIConsultant: {
        Row: {
          id: string
          name: string
          username: string
          avatar: string
          category: string
          isPaid: boolean
          perMinuteRate: number
          rating: number
          experience: number
          totalConsultations: number
          sparks: number
          bio: string
          specialties: string[]
          languages: string[]
          model: string
          responseTime: number
          accuracy: number
          isActive: boolean
          gender: string | null
          persona: string | null
          voiceStyle: string | null
          isFeatured: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          username: string
          avatar: string
          category: string
          isPaid?: boolean
          perMinuteRate?: number
          rating?: number
          experience?: number
          totalConsultations?: number
          sparks?: number
          bio: string
          specialties?: string[]
          languages?: string[]
          model: string
          responseTime?: number
          accuracy?: number
          isActive?: boolean
          gender?: string | null
          persona?: string | null
          voiceStyle?: string | null
          isFeatured?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          username?: string
          avatar?: string
          category?: string
          isPaid?: boolean
          perMinuteRate?: number
          rating?: number
          experience?: number
          totalConsultations?: number
          sparks?: number
          bio?: string
          specialties?: string[]
          languages?: string[]
          model?: string
          responseTime?: number
          accuracy?: number
          isActive?: boolean
          gender?: string | null
          persona?: string | null
          voiceStyle?: string | null
          isFeatured?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      Conversation: {
        Row: {
          id: string
          userAId: string
          userBId: string
          lastMessageAt: string
          lastMessageText: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userAId: string
          userBId: string
          lastMessageAt?: string
          lastMessageText?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userAId?: string
          userBId?: string
          lastMessageAt?: string
          lastMessageText?: string | null
          createdAt?: string
          updatedAt?: string
        }
      }
      ChatMessage: {
        Row: {
          id: string
          conversationId: string
          senderId: string
          content: string
          readAt: string | null
          createdAt: string
        }
        Insert: {
          id?: string
          conversationId: string
          senderId: string
          content: string
          readAt?: string | null
          createdAt?: string
        }
        Update: {
          id?: string
          conversationId?: string
          senderId?: string
          content?: string
          readAt?: string | null
          createdAt?: string
        }
      }
    }
    Functions: {
      process_wallet_deduction: {
        Args: {
          p_user_id: string
          p_amount: number
          p_description: string
          p_reference_id?: string | null
          p_transaction_type?: TransactionType
          p_metadata?: Json | null
        }
        Returns: Json
      }
      process_wallet_topup: {
        Args: {
          p_user_id: string
          p_amount: number
          p_description: string
          p_reference_id?: string | null
          p_metadata?: Json | null
        }
        Returns: Json
      }
      process_escrow_release: {
        Args: {
          p_booking_id: string
          p_consultant_id: string
          p_consultant_earning: number
          p_platform_fee: number
        }
        Returns: Json
      }
    }
  }
}
