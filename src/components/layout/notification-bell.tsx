"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, Check, X, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
    notificationsService,
    type Notification,
    type GroupInvitation,
} from "@/services/notifications";

interface NotificationBellProps {
    userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
        
        // Poll for new notifications every 30 seconds
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadData = async () => {
        const [notifs, invites, count] = await Promise.all([
            notificationsService.getNotifications(userId, 10),
            notificationsService.getPendingInvitations(userId),
            notificationsService.getUnreadCount(userId),
        ]);
        setNotifications(notifs);
        setInvitations(invites);
        setUnreadCount(count + invites.length);
        setIsLoading(false);
    };

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
        
        if (notification.action_url) {
            router.push(notification.action_url);
            setIsOpen(false);
        }
    };

    const handleMarkAllRead = async () => {
        await notificationsService.markAllAsRead(userId);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(invitations.length); // Keep invitation count
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
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Notifications
                        </h3>
                        {notifications.some((n) => !n.is_read) && (
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400"
                            >
                                Mark all read
                            </button>
                        )}
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
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {formatTime(invitation.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Regular Notifications */}
                                {notifications.map((notification) => (
                                    <button
                                        key={notification.id}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full border-b border-gray-100 p-4 text-left transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${
                                            !notification.is_read ? "bg-teal-50/50 dark:bg-teal-900/10" : ""
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {!notification.is_read && (
                                                <div className="mt-1.5 h-2 w-2 rounded-full bg-teal-500" />
                                            )}
                                            <div className={`flex-1 ${notification.is_read ? "ml-5" : ""}`}>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {notification.title}
                                                </p>
                                                {notification.message && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        {notification.message}
                                                    </p>
                                                )}
                                                <p className="mt-1 text-xs text-gray-400">
                                                    {formatTime(notification.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

