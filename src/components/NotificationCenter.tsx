import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { notificationService, Notification } from "@/services/notificationService";
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Info, 
  AlertTriangle, 
  AlertOctagon, 
  Clipboard, 
  RefreshCw, 
  MessageSquare,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shake, setShake] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch initial notifications and count
  useEffect(() => {
    if (!user?.id) return;

    const fetchInitialData = async () => {
      const data = await notificationService.getNotifications(user.id);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    };

    fetchInitialData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification;
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
            setShake(true);
            setTimeout(() => setShake(false), 800);
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotif = payload.new as Notification;
            setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? updatedNotif : n));
            // Recalculate unread count
            setNotifications(prev => {
              setUnreadCount(prev.filter(n => !n.is_read).length);
              return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
            setNotifications(prev => {
              setUnreadCount(prev.filter(n => !n.is_read).length);
              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleMarkAsRead = async (id: string, actionUrl?: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    await notificationService.markAsRead(id);
    
    if (actionUrl) {
      navigate(actionUrl);
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    
    await notificationService.markAllAsRead(user.id);
  };

  // Group notifications
  const groupNotifications = (list: Notification[]) => {
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const older: Notification[] = [];

    const now = new Date();
    const todayStr = now.toDateString();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toDateString();

    list.forEach(n => {
      const d = new Date(n.created_at);
      const dStr = d.toDateString();
      if (dStr === todayStr) {
        today.push(n);
      } else if (dStr === yesterdayStr) {
        yesterday.push(n);
      } else {
        older.push(n);
      }
    });

    return { today, yesterday, older };
  };

  const { today, yesterday, older } = groupNotifications(notifications);

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <Check className="w-4 h-4 text-emerald-600" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case "error":
        return <AlertOctagon className="w-4 h-4 text-rose-600" />;
      case "assignment":
        return <Clipboard className="w-4 h-4 text-blue-600" />;
      case "status_change":
        return <RefreshCw className="w-4 h-4 text-indigo-600" />;
      case "feedback":
        return <MessageSquare className="w-4 h-4 text-violet-600" />;
      default:
        return <Info className="w-4 h-4 text-[#0083a2]" />;
    }
  };

  const getIconContainerColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-emerald-50 border-emerald-100";
      case "warning":
        return "bg-amber-50 border-amber-100";
      case "error":
        return "bg-rose-50 border-rose-100";
      case "assignment":
        return "bg-blue-50 border-blue-100";
      case "status_change":
        return "bg-indigo-50 border-indigo-100";
      case "feedback":
        return "bg-violet-50 border-violet-100";
      default:
        return "bg-[#0083a2]/5 border-[#0083a2]/15";
    }
  };

  // Get accent border for user roles
  const getRoleAccent = () => {
    if (!user?.role) return "border-t-[#0083a2]";
    switch (user.role) {
      case "admin":
        return "border-t-[#0083a2]";
      case "supervisor":
        return "border-t-indigo-600";
      case "technician":
        return "border-t-amber-600";
      case "customer":
        return "border-t-emerald-600";
      default:
        return "border-t-slate-600";
    }
  };

  // Format time
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full bg-white border border-slate-200/80 shadow-sm text-slate-600 hover:text-[#0083a2] hover:bg-slate-50 transition-all flex items-center justify-center"
        aria-label="Notifications"
      >
        <motion.div
          animate={shake ? {
            rotate: [0, -15, 15, -15, 15, -10, 10, -5, 5, 0],
            scale: [1, 1.1, 1.1, 1.1, 1.1, 1, 1, 1, 1, 1]
          } : {}}
          transition={{ duration: 0.8 }}
        >
          <Bell className="w-5 h-5" />
        </motion.div>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center px-1 border-2 border-white shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 mt-3.5 w-80 md:w-96 max-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl z-50 flex flex-col border-t-4 ${getRoleAccent()}`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-rose-50 text-rose-600 font-bold px-1.5 py-0.5 rounded border border-rose-100">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-[#0083a2] hover:text-[#0083a2]/80 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[400px] scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm font-medium">All caught up!</p>
                  <p className="text-slate-400 text-xs mt-0.5">No notifications yet.</p>
                </div>
              ) : (
                <>
                  {/* Today */}
                  {today.length > 0 && (
                    <div className="bg-slate-50/30">
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 border-b border-slate-100">
                        Today
                      </div>
                      {today.map(n => renderNotificationItem(n))}
                    </div>
                  )}

                  {/* Yesterday */}
                  {yesterday.length > 0 && (
                    <div className="bg-slate-50/30">
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 border-b border-slate-100">
                        Yesterday
                      </div>
                      {yesterday.map(n => renderNotificationItem(n))}
                    </div>
                  )}

                  {/* Older */}
                  {older.length > 0 && (
                    <div className="bg-slate-50/30">
                      <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 border-b border-slate-100">
                        Older
                      </div>
                      {older.map(n => renderNotificationItem(n))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  function renderNotificationItem(n: Notification) {
    return (
      <div
        key={n.id}
        onClick={() => handleMarkAsRead(n.id, n.action_url)}
        className={`px-4 py-3 flex gap-3 hover:bg-slate-50/80 transition-all cursor-pointer items-start relative border-l-2 ${
          n.is_read ? "border-l-transparent" : "bg-blue-50/10 border-l-[#0083a2]"
        }`}
      >
        <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${getIconContainerColor(n.type)}`}>
          {getIcon(n.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <h4 className={`text-xs truncate ${n.is_read ? "text-slate-600 font-medium" : "text-slate-900 font-bold"}`}>
              {n.title}
            </h4>
            <span className="text-[10px] text-slate-400 font-medium shrink-0">
              {formatTime(n.created_at)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
            {n.message}
          </p>
        </div>
        {!n.is_read && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#0083a2] absolute right-2 top-1/2 -translate-y-1/2" />
        )}
      </div>
    );
  }
}
