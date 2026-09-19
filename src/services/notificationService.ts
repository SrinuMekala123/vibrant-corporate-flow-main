import { supabase } from '../lib/supabase';
import { formatComplaintTicketId } from './complaintService';
import { formatInstallationTicketId } from './installationService';

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
        } catch (edgeErr) {
          if (import.meta.env.DEV) {
            console.warn("send-notification edge function skipped:", edgeErr);
          }
        }
      }

      return null;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('Failed to notify user:', err);
      }
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

  // Fetch notifications for a user (combining database records and operational system alerts)
  async getNotifications(userId?: string): Promise<Notification[]> {
    let directNotifs: Notification[] = [];
    if (userId) {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          directNotifs = data;
        }
      } catch (err) {
        console.warn("Direct notifications fetch warning:", err);
      }
    }

    // Operational System Alerts
    const operationalNotifs: Notification[] = [];
    const readIds: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem("btl_read_notification_ids") || "[]");
      } catch {
        return [];
      }
    })();

    try {
      // 1. Unassigned or newly registered complaints
      const { data: complaints } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (complaints) {
        complaints.forEach((c: any) => {
          const formattedId = formatComplaintTicketId(c);

          // Operational Alert: New or unassigned complaint
          if (c.status === "registered" || !c.assigned_technician || c.assigned_technician === "Unassigned") {
            const notifId = `notif-comp-new-${c.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: c.id,
              type: "warning",
              title: `Unassigned Complaint: ${formattedId}`,
              message: `${c.title || "Service Ticket"} for ${c.customer_name || "Client"} awaits technician dispatch.`,
              phase: 1,
              action_url: `/complaints/${c.id}`,
              is_read: readIds.includes(notifId),
              created_at: c.created_at
            });
          }

          // Operational Alert: Chargeable service with pending payment
          if (
            (c.chargeable_service === "Yes" || (c.service_charge && Number(c.service_charge) > 0)) &&
            c.payment_status === "Pending"
          ) {
            const notifId = `notif-comp-pay-${c.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: c.id,
              type: "info",
              title: `Payment Pending: ${formattedId}`,
              message: `Chargeable repair of ₹${c.service_charge || 0} pending invoice settlement.`,
              phase: 4,
              action_url: `/service-reports?tab=payment`,
              is_read: readIds.includes(notifId),
              created_at: c.created_at
            });
          }

          // Operational Alert: High priority or critical in-progress ticket
          if (
            (c.priority === "high" || c.priority === "critical") &&
            c.status !== "completed" &&
            c.status !== "resolved"
          ) {
            const notifId = `notif-comp-urgent-${c.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: c.id,
              type: "error",
              title: `Critical Ticket: ${formattedId}`,
              message: `High-priority issue (${c.title}) requires urgent supervisor attention.`,
              phase: 2,
              action_url: `/complaints/${c.id}`,
              is_read: readIds.includes(notifId),
              created_at: c.created_at
            });
          }
        });
      }
    } catch (e) {
      console.warn("Could not fetch operational alerts for notifications:", e);
    }

    try {
      // 2. Active installations
      const { data: installations } = await supabase
        .from("installations")
        .select("id, status, scheduled_date, non_btl_customer_name, customer:customers(full_name), created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (installations) {
        installations.forEach((i: any) => {
          const formattedId = formatInstallationTicketId(i);
          const cust = (i.customer as any)?.full_name || i.non_btl_customer_name || "Client";
          if (i.status === "Assigned" || i.status === "Scheduled") {
            const notifId = `notif-inst-${i.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: i.id,
              type: "assignment",
              title: `Installation Active: ${formattedId}`,
              message: `Field deployment for ${cust} currently ${i.status.toLowerCase()}.`,
              phase: 2,
              action_url: `/installations`,
              is_read: readIds.includes(notifId),
              created_at: i.created_at
            });
          }
        });
      }
    } catch (e) {
      console.warn("Could not fetch installation notifications:", e);
    }

    // Merge and deduplicate by ID
    const all = [...directNotifs, ...operationalNotifs];
    const unique = Array.from(new Map(all.map((item) => [item.id, item])).values());

    // Sort descending by created_at
    return unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25);
  },

  // Mark a specific notification as read
  async markAsRead(notificationId: string) {
    try {
      const readIds: string[] = JSON.parse(localStorage.getItem("btl_read_notification_ids") || "[]");
      if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
        localStorage.setItem("btl_read_notification_ids", JSON.stringify(readIds));
      }
    } catch (e) {
      console.warn("LocalStorage mark as read error:", e);
    }

    // If it's a UUID from notifications table, update Supabase
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId)) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);
      } catch (err) {
        console.warn("Supabase mark as read error:", err);
      }
    }
  },

  // Mark all notifications for a user as read
  async markAllAsRead(userId?: string, notificationIds?: string[]) {
    try {
      const readIds: string[] = JSON.parse(localStorage.getItem("btl_read_notification_ids") || "[]");
      if (notificationIds && notificationIds.length > 0) {
        notificationIds.forEach((id) => {
          if (!readIds.includes(id)) readIds.push(id);
        });
      }
      localStorage.setItem("btl_read_notification_ids", JSON.stringify(readIds));
    } catch (e) {
      console.warn("LocalStorage mark all read error:", e);
    }

    if (userId) {
      try {
        await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('is_read', false);
      } catch (err) {
        console.warn("Supabase mark all as read error:", err);
      }
    }
  }
};
