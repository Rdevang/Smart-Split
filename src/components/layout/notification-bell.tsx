"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X, Loader2, Users, Trash2, CheckCircle, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import {
    notificationsService,
    type Notification,
    type GroupInvitation,
} from "@/services/notifications";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface NotificationBellProps {
    userId: string;
}

// Backup polling interval (5 minutes) - safety net if WebSocket disconnects
const BACKUP_POLL_INTERVAL = 5 * 60 * 1000;

export function NotificationBell({ userId }: NotificationBellProps) {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    const loadData = useCallback(async () => {
        const [notifs, invites, count] = await Promise.all([
            notificationsService.getNotifications(userId, 10),
            notificationsService.getPendingInvitations(userId),
            notificationsService.getUnreadCount(userId),
        ]);
        setNotifications(notifs);
        setInvitations(invites);
        setUnreadCount(count + invites.length);
        setIsLoading(false);
    }, [userId]);

    // Handle new notification from Realtime
    const handleNewNotification = useCallback((payload: RealtimePostgresChangesPayload<Notification>) => {
        const newNotification = payload.new as Notification;
        setNotifications((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === newNotification.id)) return prev;
            return [newNotification, ...prev].slice(0, 10);
        });
        if (!newNotification.is_read) {
            setUnreadCount((prev) => prev + 1);
        }
    }, []);

    // Handle notification update from Realtime (e.g., marked as read)
    const handleNotificationUpdate = useCallback((payload: RealtimePostgresChangesPayload<Notification>) => {
        const updated = payload.new as Notification;
        setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
        );
        // If notification was marked as read, decrement unread count
        if (updated.is_read && payload.old) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }
    }, []);

    // Handle notification delete from Realtime
    const handleNotificationDelete = useCallback((payload: RealtimePostgresChangesPayload<Notification>) => {
        const old = payload.old as { id: string };
        const deletedId = old.id;
        setNotifications((prev) => {
            const notification = prev.find((n) => n.id === deletedId);
            if (notification && !notification.is_read) {
                setUnreadCount((c) => Math.max(0, c - 1));
            }
            return prev.filter((n) => n.id !== deletedId);
        });
    }, []);

    // Handle new group invitation from Realtime
    type InvitationPayload = { id: string; invited_user_id: string; status: string };
    const handleNewInvitation = useCallback(async (payload: RealtimePostgresChangesPayload<InvitationPayload>) => {
        const newInvite = payload.new as InvitationPayload;
        // Only handle pending invitations for this user
        if (newInvite.status !== "pending" || newInvite.invited_user_id !== userId) return;

        // Fetch full invitation with group and inviter details
        const invites = await notificationsService.getPendingInvitations(userId);
        const invitation = invites.find((i) => i.id === newInvite.id);
        if (invitation) {
            setInvitations((prev) => {
                if (prev.some((i) => i.id === invitation.id)) return prev;
                return [invitation, ...prev];
            });
            setUnreadCount((prev) => prev + 1);
        }
    }, [userId]);

    // Handle invitation update from Realtime (accepted/declined)
    const handleInvitationUpdate = useCallback((payload: RealtimePostgresChangesPayload<InvitationPayload>) => {
        const updated = payload.new as InvitationPayload;
        if (updated.status !== "pending") {
            // Remove from list if accepted or declined
            setInvitations((prev) => {
                const existed = prev.some((i) => i.id === updated.id);
                if (existed) {
                    setUnreadCount((c) => Math.max(0, c - 1));
                }
                return prev.filter((i) => i.id !== updated.id);
            });
        }
    }, []);

    // Setup Supabase Realtime subscription
    useEffect(() => {
        const supabase = createClient();

        // Initial load - schedule to avoid synchronous setState in effect
        const initialLoad = setTimeout(() => {
            loadData();
        }, 0);

        // Create Realtime channel
        const channel = supabase
            .channel(`user_${userId}_notifications`)
            // Notifications table subscriptions
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                handleNewNotification
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                handleNotificationUpdate
            )
            .on(
                "postgres_changes",
                {
                    event: "DELETE",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                handleNotificationDelete
            )
            // Group invitations table subscriptions
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "group_invitations",
                    filter: `invited_user_id=eq.${userId}`,
                },
                handleNewInvitation
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "group_invitations",
                    filter: `invited_user_id=eq.${userId}`,
                },
                handleInvitationUpdate
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    setIsConnected(true);
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setIsConnected(false);
                }
            });

        channelRef.current = channel;

        // Backup polling every 5 minutes (safety net)
        const backupInterval = setInterval(loadData, BACKUP_POLL_INTERVAL);

        // Cleanup
        return () => {
            clearTimeout(initialLoad);
            clearInterval(backupInterval);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [
        userId,
        loadData,
        handleNewNotification,
        handleNotificationUpdate,
        handleNotificationDelete,
        handleNewInvitation,
        handleInvitationUpdate,
    ]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAcceptInvitation = async (invitation: GroupInvitation) => {
        setProcessingId(invitation.id);
        const result = await notificationsService.acceptInvitation(invitation.id, userId);

        if (result.success) {
            success(`You've joined "${invitation.group?.name}"!`);
            setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
            setUnreadCount((prev) => Math.max(0, prev - 1));
            router.refresh();
        } else {
            showError(result.error || "Failed to accept invitation");
        }
        setProcessingId(null);
    };

    const handleDeclineInvitation = async (invitation: GroupInvitation) => {
        setProcessingId(invitation.id);
        const result = await notificationsService.declineInvitation(invitation.id, userId);

        if (result.success) {
            setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } else {
            showError(result.error || "Failed to decline invitation");
        }
        setProcessingId(null);
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.is_read) {
            await notificationsService.markAsRead(notification.id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        // SECURITY: Only navigate to internal paths (starting with /)
        // This prevents potential injection if action_url is compromised
        if (notification.action_url &&
            notification.action_url.startsWith("/") &&
            !notification.action_url.startsWith("//") &&
            !notification.action_url.includes("://")) {
            router.push(notification.action_url);
            setIsOpen(false);
        }
    };

    const handleMarkAllRead = async () => {
        await notificationsService.markAllAsRead(userId);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(invitations.length); // Keep invitation count
    };

    const handleMarkSingleRead = async (e: React.MouseEvent, notification: Notification) => {
        e.stopPropagation(); // Prevent triggering the notification click
        if (notification.is_read) return;

        await notificationsService.markAsRead(notification.id);
        setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
        e.stopPropagation(); // Prevent triggering the notification click
        const result = await notificationsService.deleteNotification(notificationId);
        if (result) {
            setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        } else {
            showError("Failed to delete notification");
        }
    };

    const handleDeleteAllRead = async () => {
        const result = await notificationsService.deleteAllRead(userId);
        if (result) {
            setNotifications((prev) => prev.filter((n) => !n.is_read));
            success("Cleared all read notifications");
        } else {
            showError("Failed to clear notifications");
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
                {/* Connection status indicator */}
                {!isConnected && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-amber-500" title="Reconnecting...">
                        <WifiOff className="h-2 w-2 text-white" />
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Notifications
                            </h3>
                            {!isConnected && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                    <WifiOff className="h-3 w-3" />
                                    Offline
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {notifications.some((n) => n.is_read) && (
                                <button
                                    onClick={handleDeleteAllRead}
                                    className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                                >
                                    Clear read
                                </button>
                            )}
                            {notifications.some((n) => !n.is_read) && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="max-h-96 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : invitations.length === 0 && notifications.length === 0 ? (
                            <div className="flex flex-col items-center py-8 text-center">
                                <Bell className="h-10 w-10 text-gray-300 dark:text-gray-600" />
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    No notifications
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Group Invitations */}
                                {invitations.map((invitation) => (
                                    <div
                                        key={invitation.id}
                                        className="border-b border-gray-100 p-4 dark:border-gray-800"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
                                                <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    Group Invitation
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">
                                                        {invitation.inviter?.full_name || invitation.inviter?.email}
                                                    </span>{" "}
                                                    invited you to join{" "}
                                                    <span className="font-medium">
                                                        &quot;{invitation.group?.name}&quot;
                                                    </span>
                                                </p>
                                                <div className="mt-2 flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAcceptInvitation(invitation)}
                                                        disabled={processingId === invitation.id}
                                                        className="h-7 text-xs"
                                                    >
                                                        {processingId === invitation.id ? (
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Check className="mr-1 h-3 w-3" />
                                                                Accept
                                                            </>
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDeclineInvitation(invitation)}
                                                        disabled={processingId === invitation.id}
                                                        className="h-7 text-xs text-gray-500"
                                                    >
                                                        <X className="mr-1 h-3 w-3" />
                                                        Decline
                                                    </Button>
                                                </div>
                                                <p className="mt-1 text-xs text-gray-400" suppressHydrationWarning>
                                                    {formatTime(invitation.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Regular Notifications */}
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`group relative border-b border-gray-100 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${!notification.is_read ? "bg-teal-50/50 dark:bg-teal-900/10" : ""
                                            }`}
                                    >
                                        <button
                                            onClick={() => handleNotificationClick(notification)}
                                            className="w-full text-left"
                                        >
                                            <div className="flex items-start gap-3">
                                                {!notification.is_read && (
                                                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                                                )}
                                                <div className={`flex-1 min-w-0 ${notification.is_read ? "ml-5" : ""}`}>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white pr-16">
                                                        {notification.title}
                                                    </p>
                                                    {notification.message && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 pr-16">
                                                            {notification.message}
                                                        </p>
                                                    )}
                                                    <p className="mt-1 text-xs text-gray-400" suppressHydrationWarning>
                                                        {formatTime(notification.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Action buttons */}
                                        <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            {!notification.is_read && (
                                                <button
                                                    onClick={(e) => handleMarkSingleRead(e, notification)}
                                                    className="rounded-full p-1.5 text-gray-400 hover:bg-teal-100 hover:text-teal-600 dark:hover:bg-teal-900/30 dark:hover:text-teal-400"
                                                    title="Mark as read"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </button>
                                            )}
                                            {notification.is_read && (
                                                <button
                                                    onClick={(e) => handleDeleteNotification(e, notification.id)}
                                                    className="rounded-full p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                                    title="Delete notification"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
