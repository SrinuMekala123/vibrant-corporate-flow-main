import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  ticket_id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback';
  title: string;
  message: string;
  phase: number;
  action_url?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export const notificationService = {
  // Create an in-app notification and trigger an email
  async notifyUser(
    userId: string,
    ticketId: string,
    type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback',
    title: string,
    message: string,
    phase: number,
    actionUrl?: string,
    excludeUserId?: string
  ) {
    try {
      if (excludeUserId && userId === excludeUserId) {
        if (import.meta.env.DEV) {
          console.log("🚫 Skipping self-notification for user:", userId);
        }
        return null;
      }
      const targetActionUrl = actionUrl || `/complaints/${ticketId}`;
      
      // 1. Insert in-app notification into DB
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        ticket_id: ticketId,
        type,
        title,
        message,
        phase,
        action_url: targetActionUrl,
        is_read: false
      });

      if (error) {
        console.error('Error inserting notification:', error);
      }

      // 2. Fetch target user's email to send email notification
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user email for notification:', profileError);
        return null;
      }

      if (profile?.email) {
        // Send email via the Edge Function
        try {
          await supabase.functions.invoke("send-notification", {
            body: {
              email: profile.email,
              subject: title,
              message,
              ticketId
            }
          });
        } catch (fnErr: any) {
          console.warn('send-notification edge function may not exist:', fnErr?.message || fnErr);
        }
      }

      return null;
    } catch (err) {
      console.error('Failed to notify user:', err);
    }
  },

  // Notify all admin users
  async notifyAdmins(
    ticketId: string,
    type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback',
    title: string,
    message: string,
    phase: number,
    actionUrl?: string,
    excludeUserId?: string
  ) {
    try {
      const adminIds = await this.getAdminUserIds();
      if (adminIds.length > 0) {
        await Promise.all(
          adminIds.map(adminId =>
            this.notifyUser(adminId, ticketId, type, title, message, phase, actionUrl, excludeUserId)
          )
        );
      }
    } catch (err) {
      console.error('Failed to notify admins:', err);
    }
  },

  // Get all Admin user IDs
  async getAdminUserIds(): Promise<string[]> {
    try {
      const { data: admins, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (error) {
        console.error('Error fetching admin IDs:', error);
        return [];
      }
      return admins?.map((a: any) => a.id) || [];
    } catch (err) {
      console.error('Failed to get admin IDs:', err);
      return [];
    }
  },

  // Insert notification for a single user or multiple users (array), with deduplication
  async insertNotification(
    userIds: string | string[],
    ticketId: string,
    type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback',
    title: string,
    message: string,
    phase: number,
    actionUrl?: string,
    excludeUserId?: string
  ) {
    try {
      const ids = Array.isArray(userIds) ? userIds : [userIds];
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      
      const targetActionUrl = actionUrl || `/complaints/${ticketId}`;
      
      await Promise.all(
        uniqueIds.map(id =>
          this.notifyUser(id, ticketId, type, title, message, phase, targetActionUrl, excludeUserId)
        )
      );
    } catch (err) {
      console.error('Failed to insert notification:', err);
    }
  },

  // Fetch last 20 notifications for a user
  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data || [];
  },

  // Mark a specific notification as read
  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('Error marking notification as read:', error);
    }
    return data;
  },

  // Mark all notifications for a user as read
  async markAllAsRead(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
    }
    return data;
  }
};
