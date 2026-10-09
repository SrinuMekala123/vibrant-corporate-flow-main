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
      const targetActionUrl = actionUrl || (ticketId ? `/complaints/${ticketId}` : '/');
      const isInstallation = targetActionUrl.includes('/installations');

      // Resolve effective user_id in profiles/auth
      let effectiveUserId = userId;
      try {
        const { data: prof } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (!prof) {
          const { data: cust } = await supabase.from('customers').select('user_id').eq('id', userId).maybeSingle();
          if (cust?.user_id) {
            effectiveUserId = cust.user_id;
          }
        }
      } catch {
        // ignore
      }

      if (excludeUserId && effectiveUserId === excludeUserId) {
        return null;
      }
      
      // 1. Insert in-app notification into DB
      let { error } = await supabase.from('notifications').insert({
        user_id: effectiveUserId,
        ticket_id: isInstallation ? null : ticketId,
        type,
        title,
        message,
        phase,
        action_url: targetActionUrl,
        is_read: false
      });

      // If foreign key constraint fails (e.g. ticket is an installation or non-existent in complaints), retry with ticket_id: null
      if (error && (error.code === '23503' || error.message?.includes('foreign key constraint'))) {
        const retryResult = await supabase.from('notifications').insert({
          user_id: effectiveUserId,
          ticket_id: null,
          type,
          title,
          message,
          phase,
          action_url: targetActionUrl,
          is_read: false
        });
        error = retryResult.error;
      }

      if (error) {
        console.warn('Error inserting notification:', error);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notification-refresh'));
      }

      // 2. Fetch target user's email to send email notification
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.warn('Error fetching user email for notification:', profileError);
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

  // Helper function to send in-app notification cleanly
  async sendInAppNotification(
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback' = 'info',
    ticketId?: string,
    phase: number = 1,
    actionUrl?: string,
    excludeUserId?: string
  ) {
    return this.notifyUser(userId, ticketId || '', type, title, message, phase, actionUrl, excludeUserId);
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

  // Get Admin profiles with phone numbers for WhatsApp dispatch
  async getAdminProfiles(): Promise<{ id: string; name: string; phone: string }[]> {
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'admin');

      return (admins || [])
        .filter((a: any) => a.phone && String(a.phone).trim().length > 0)
        .map((a: any) => ({
          id: a.id,
          name: a.full_name || 'Admin',
          phone: String(a.phone).trim()
        }));
    } catch {
      return [];
    }
  },

  // Insert notification for a single user, multiple users (array), or options object, with deduplication
  async insertNotification(
    userIdsOrOptions: string | string[] | {
      userId?: string;
      userIds?: string | string[];
      ticketId?: string;
      type?: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback' | string;
      title: string;
      message: string;
      phase?: number;
      actionUrl?: string;
      excludeUserId?: string;
    },
    ticketId?: string,
    type: 'info' | 'success' | 'warning' | 'error' | 'assignment' | 'status_change' | 'feedback' = 'info',
    title?: string,
    message?: string,
    phase: number = 1,
    actionUrl?: string,
    excludeUserId?: string
  ) {
    try {
      let ids: string[] = [];
      let effTicketId = ticketId || '';
      let effType = type;
      let effTitle = title || '';
      let effMessage = message || '';
      let effPhase = phase;
      let effActionUrl = actionUrl;
      let effExcludeUserId = excludeUserId;

      if (typeof userIdsOrOptions === 'object' && !Array.isArray(userIdsOrOptions)) {
        const opts = userIdsOrOptions;
        const targetIds = opts.userIds || opts.userId;
        ids = Array.isArray(targetIds) ? targetIds : (targetIds ? [targetIds] : []);
        effTicketId = opts.ticketId || '';
        effType = (opts.type as any) || 'info';
        effTitle = opts.title || '';
        effMessage = opts.message || '';
        effPhase = opts.phase || 1;
        effActionUrl = opts.actionUrl;
        effExcludeUserId = opts.excludeUserId;
      } else {
        ids = Array.isArray(userIdsOrOptions) ? userIdsOrOptions : (userIdsOrOptions ? [userIdsOrOptions] : []);
      }

      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      const targetActionUrl = effActionUrl || (effTicketId ? `/complaints/${effTicketId}` : '/');
      
      await Promise.all(
        uniqueIds.map(id =>
          this.notifyUser(id, effTicketId, effType as any, effTitle, effMessage, effPhase, targetActionUrl, effExcludeUserId)
        )
      );
    } catch (err) {
      console.error('Failed to insert notification:', err);
    }
  },

  // Fetch notifications for a user (combining database records and operational system alerts)
  async getNotifications(userId?: string): Promise<Notification[]> {
    let directNotifs: Notification[] = [];
    let userRole = 'admin';
    let customerRecordId: string | null = null;
    let techInstallationIds: string[] = [];

    if (userId) {
      try {
        // Resolve user role
        const { data: prof } = await supabase.from('profiles').select('role, full_name').eq('id', userId).maybeSingle();
        if (prof?.role) userRole = prof.role;

        // If customer, find linked customer row
        if (userRole === 'customer') {
          const { data: cRec } = await supabase.from('customers').select('id').eq('user_id', userId).maybeSingle();
          if (cRec?.id) customerRecordId = cRec.id;
        }

        // If technician, find assigned installation IDs
        if (userRole === 'technician') {
          const { data: techRows } = await supabase
            .from('installation_technicians')
            .select('installation_id')
            .eq('technician_id', userId);
          if (techRows) {
            techInstallationIds = techRows.map((t: any) => t.installation_id);
          }
        }

        const targetUserIds = [userId];
        if (customerRecordId) targetUserIds.push(customerRecordId);

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .in('user_id', targetUserIds)
          .order('created_at', { ascending: false })
          .limit(30);

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
          if (
            (userRole === "admin" || userRole === "supervisor") &&
            (c.status === "registered" || !c.assigned_technician || c.assigned_technician === "Unassigned")
          ) {
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
            (userRole === "admin" || userRole === "supervisor") &&
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
            c.status !== "resolved" &&
            c.status !== "closed"
          ) {
            const notifId = `notif-comp-urgent-${c.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: c.id,
              type: "error",
              title: `Critical Ticket: ${formattedId}`,
              message: `High-priority issue (${c.title || 'Complaint'}) requires urgent supervisor attention.`,
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
        .select("id, ticket_id, status, scheduled_date, scheduled_time, non_btl_customer_name, customer_id, customer:customers(id, full_name, user_id), created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (installations) {
        installations.forEach((i: any) => {
          const formattedId = formatInstallationTicketId(i);
          const cust = (i.customer as any)?.full_name || i.non_btl_customer_name || "Client";
          const statusLower = (i.status || "").toLowerCase();

          // Alert for Admin/Supervisor: Unassigned installation
          if ((userRole === 'admin' || userRole === 'supervisor') && (statusLower === 'unassigned' || !i.status)) {
            const notifId = `notif-inst-unassigned-${i.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: i.id,
              type: "warning",
              title: `Unassigned Installation: ${formattedId}`,
              message: `New installation job for ${cust} requires scheduling & crew assignment.`,
              phase: 1,
              action_url: `/installations/${i.id}`,
              is_read: readIds.includes(notifId),
              created_at: i.created_at
            });
          }

          // Alert for Technician: Assigned installation job
          if (userRole === 'technician' && techInstallationIds.includes(i.id)) {
            const notifId = `notif-inst-tech-${i.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: i.id,
              type: "assignment",
              title: `Assigned Installation: ${formattedId}`,
              message: `You are assigned to installation for ${cust}. Scheduled: ${i.scheduled_date || 'Pending'} ${i.scheduled_time || ''}.`,
              phase: 2,
              action_url: `/installations/${i.id}`,
              is_read: readIds.includes(notifId),
              created_at: i.created_at
            });
          }

          // Alert for Customer: Their installation
          if (userRole === 'customer' && (i.customer_id === customerRecordId || (i.customer as any)?.user_id === userId)) {
            const notifId = `notif-inst-cust-${i.id}-${i.status}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: i.id,
              type: statusLower === 'completed' || statusLower === 'verified' ? 'success' : 'info',
              title: `Installation Update: ${formattedId}`,
              message: `Your equipment installation is currently ${i.status}.`,
              phase: statusLower === 'completed' || statusLower === 'verified' ? 4 : 2,
              action_url: `/installations/${i.id}`,
              is_read: readIds.includes(notifId),
              created_at: i.created_at
            });
          }

          // Active alert for Admin / Supervisor
          if (
            (userRole === 'admin' || userRole === 'supervisor') && 
            (statusLower === "assigned" || statusLower === "scheduled" || statusLower === "in progress" || statusLower === "in_progress")
          ) {
            const notifId = `notif-inst-active-${i.id}`;
            operationalNotifs.push({
              id: notifId,
              user_id: userId || "",
              ticket_id: i.id,
              type: "assignment",
              title: `Installation In-Progress: ${formattedId}`,
              message: `Field deployment for ${cust} currently ${i.status}.`,
              phase: 2,
              action_url: `/installations/${i.id}`,
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
    return unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30);
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
