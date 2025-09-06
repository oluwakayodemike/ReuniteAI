export async function fetchNotifications(Clerk, limit = 100, offset = 0) {
  try {
    const token = await Clerk.session.getToken();
    let url = `http://localhost:3001/api/notifications?limit=${limit}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error("Failed to fetch notifications");
    return await res.json();
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return { notifications: [], total: 0 };
  }
}

export async function markAsRead(Clerk, notificationId) {
  try {
    const token = await Clerk.session.getToken();
    const res = await fetch("http://localhost:3001/api/notifications/mark-read", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    if (!res.ok) throw new Error("Failed to mark as read");
    return true;
  } catch (err) {
    console.error("Error marking as read:", err);
    return false;
  }
}

export async function markAllAsRead(Clerk) {
  try {
    const token = await Clerk.session.getToken();
    const res = await fetch("http://localhost:3001/api/notifications/mark-all-read", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed to mark all as read");
    return true;
  } catch (err) {
    console.error("Error marking all as read:", err);
    return false;
  }
}

export function getNotificationClass(message) {
  const msg = (message || "").toLowerCase();
  if (msg.includes("match")) return { class: "matches", icon: "fa-solid fa-link" };
  if (msg.includes("filed") || msg.includes("reported")) return { class: "resolved", icon: "fa-solid fa-check" };
  if (msg.includes("claim") || msg.includes("pending")) return { class: "pending", icon: "fa-solid fa-user-check" };
  if (msg.includes("reunited") || msg.includes("approved")) return { class: "resolved", icon: "fa-solid fa-handshake" };
  return { class: "", icon: "fa-solid fa-bell" };
}

export function formatNotificationDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function initializeNotificationDropdown(Clerk) {
  const notifIcon = document.querySelector('.notification-icon');
  const dropdown = document.getElementById('notification-dropdown');
  const badge = document.getElementById('notification-badge');
  const list = document.getElementById('notification-list');

  if (!notifIcon || !dropdown || !badge || !list) return;

  let allNotifications = [];

  function renderDropdown() {
    list.innerHTML = '';
    let unreadCount = 0;

    if (allNotifications.length === 0) {
      list.innerHTML = '<li class="no-notifications">You have no new notifications!</li>';
    } else {
      allNotifications.forEach(notif => {
        if (!notif.is_read) unreadCount++;

        const li = document.createElement('li');
        li.className = `notification-item ${!notif.is_read ? 'unread' : ''}`;
        const { icon } = getNotificationClass(notif.message);
        const avatarIcon = `<i class="${icon}"></i>`;

        li.innerHTML = `
          <div class="notif-avatar">${avatarIcon}</div>
          <div class="notif-content">
            <p class="notif-text">${escapeHtml(notif.message)}</p>
            <p class="notif-time">${formatNotificationDate(notif.created_at)}</p>
          </div>
          ${!notif.is_read ? '<div class="unread-dot"></div>' : ''}
        `;

        li.addEventListener('click', async () => {
          const url = notif.lost_item_id ? `./search-result.html?lostItemId=${notif.lost_item_id}` : '#';

          if (!notif.is_read) {
            const success = await markAsRead(Clerk, notif.id);
            if (success) {
              notif.is_read = true;
              renderDropdown();
            }
          }
          window.location.href = url;
        });

        list.appendChild(li);
      });
    }

    badge.textContent = unreadCount;
    badge.classList.toggle('visible', unreadCount > 0);
  }

  async function refreshNotificationsFromServer() {
    const { notifications } = await fetchNotifications(Clerk);
    allNotifications = notifications;
    renderDropdown();
  }

  notifIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      refreshNotificationsFromServer();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !notifIcon.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  refreshNotificationsFromServer();
  setInterval(refreshNotificationsFromServer, 60000);
}