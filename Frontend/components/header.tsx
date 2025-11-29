'use client';

import { useState, useEffect } from 'react';
import { Search, Bell, User, Settings, LogOut, Trash2, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
  createdAt: string;
}

export function Header() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (ids: string[]) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:5001/api/notifications/mark-read', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });
      // Update local state
      setNotifications(notifications.map(n =>
        ids.includes(n._id) ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - ids.length));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5001/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update local state
      const updatedNotifications = notifications.filter(n => n._id !== id);
      setNotifications(updatedNotifications);
      const wasUnread = notifications.find(n => n._id === id)?.read === false;
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      // Call logout API
      const token = localStorage.getItem('token');
      if (token) {
        await fetch('http://localhost:5001/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Clear cookie
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

    // Redirect to login
    window.location.href = '/auth/login';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-3 sm:px-4 lg:px-6">
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-xs sm:max-w-md md:max-w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search inventory, warehouses, orders..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative rounded-full p-2 hover:bg-slate-100 transition-colors">
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAsRead(notifications.filter(n => !n.read).map(n => n._id))}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <div key={notification._id} className="p-3 border-b last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className={`text-xs ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </Badge>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                          )}
                        </div>
                        <h4 className="text-sm font-medium">{notification.title}</h4>
                        <p className="text-xs text-slate-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead([notification._id])}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification._id)}
                          className="p-1 hover:bg-slate-100 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full bg-slate-100 py-2 pl-3 pr-4 hover:bg-slate-200 transition-colors">
              <Avatar className="h-6 w-6">
                <AvatarImage src="/avatars/admin.jpg" alt="Admin" />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">AD</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-slate-700">Admin</span>
            </button>
          </DropdownMenuTrigger>
          </DropdownMenu>
          
      </div>
    </header>
  );
}
