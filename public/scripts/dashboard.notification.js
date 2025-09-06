window.addEventListener("load", async () => {
  const Clerk = window.Clerk;
  if (!Clerk) {
    console.error("Clerk SDK not found on window.");
    return;
  }

  try {
    await Clerk.load();

    if (!Clerk.user) {
      window.location.href = "../index.html";
      return;
    }

    console.log("Notifications page loaded. Current user:", Clerk.user);
    initializeNotificationsPage(Clerk);
  } catch (err) {
    console.error("Clerk failed to load on notifications page:", err);
  }
});

async function initializeNotificationsPage(Clerk) {
  const notificationList = document.querySelector(".notification-list");
  const allTab = document.querySelector(".notification-tab:nth-child(1)");
  const unreadTab = document.querySelector(".notification-tab:nth-child(2)");
  const markAllBtn = document.querySelector(".action-btn-secondary");
  const activityList = document.getElementById("activity-list");

  let notifications = [];
  let currentFilter = "all";

  const fmtDate = (iso) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso || "";
    }
  };

  async function fetchNotifications() {
    try {
      const token = await Clerk.session.getToken();
      const res = await fetch("http://localhost:3001/api/notifications", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const { notifications: data } = await res.json();
      return data || [];
    } catch (err) {
      console.error("Error fetching notifications:", err);
      return [];
    }
  }

  async function fetchRecentActivity() {
    try {
      const token = await Clerk.session.getToken();
      const res = await fetch("http://localhost:3001/api/dashboard", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const { recentActivity } = await res.json();
      return recentActivity || [];
    } catch (err) {
      console.error("Error fetching recent activity:", err);
      return [];
    }
  }

  async function markAsRead(notificationId) {
    try {
      const token = await Clerk.session.getToken();
      const res = await fetch("http://localhost:3001/api/notifications/mark-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      // Update local state
      notifications = notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      updateUI();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }

  async function markAllAsRead() {
    try {
      const token = await Clerk.session.getToken();
      const res = await fetch("http://localhost:3001/api/notifications/mark-all-read", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      // Update local state
      notifications = notifications.map(n => ({ ...n, is_read: true }));
      updateUI();
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }

  function getNotificationClass(message) {
    const msg = (message || "").toLowerCase();
    if (msg.includes("match")) return { class: "matches", icon: "fa-solid fa-link" };
    if (msg.includes("filed") || msg.includes("reported")) return { class: "resolved", icon: "fa-solid fa-check" };
    if (msg.includes("claim") || msg.includes("pending")) return { class: "pending", icon: "fa-solid fa-user-check" };
    if (msg.includes("reunited") || msg.includes("approved")) return { class: "resolved", icon: "fa-solid fa-handshake" };
    return { class: "", icon: "fa-solid fa-bell" };
  }

  function getDetailLink(notif) {
    const id = notif.lost_item_id || notif.found_item_id;
    return id ? `../report/${encodeURIComponent(id)}` : "#";
  }

  function renderNotifications(list) {
    notificationList.innerHTML = "";

    if (list.length === 0) {
      notificationList.innerHTML = `
        <li class="no-notifications">
          No notifications found.
        </li>`;
      return;
    }

    list.forEach(notif => {
      const { class: activityClass, icon } = getNotificationClass(notif.message);
      const isUnread = !notif.is_read ? "unread" : "";
      const link = getDetailLink(notif);

      const li = document.createElement("li");
      li.className = `notification-item ${isUnread}`;
      li.innerHTML = `
        <div class="activity-icon ${activityClass}"><i class="${icon}"></i></div>
        <div class="notification-details">
          <p>${escapeHtml(notif.message)}</p>
          <span>${fmtDate(notif.created_at)}</span>
        </div>
        <a href="${link}" class="item-action-btn"><i class="fa-solid fa-chevron-right"></i></a>
      `;

      // Mark as read on click if unread
      if (!notif.is_read) {
        li.addEventListener("click", () => markAsRead(notif.id));
      }

      notificationList.appendChild(li);
    });
  }

  function renderActivity(list) {
    if (!activityList) return;
    activityList.innerHTML = "";

    if (list.length === 0) {
      activityList.innerHTML = `<li class="no-activity">No recent activity.</li>`;
      return;
    }

    list.forEach(activity => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="activity-icon ${escapeHtml(activity.activity_class)}"><i class="${escapeHtml(activity.icon)}"></i></div>
        <div class="activity-details">
          <p>${escapeHtml(activity.details)}</p>
          <span>${escapeHtml(activity.time_ago)}</span>
        </div>
      `;
      activityList.appendChild(li);
    });
  }

  function applyFilter() {
    return currentFilter === "all" ? notifications : notifications.filter(n => !n.is_read);
  }

  function updateUI() {
    const filtered = applyFilter();
    renderNotifications(filtered);
  }

  // Event listeners
  allTab.addEventListener("click", () => {
    allTab.classList.add("active");
    unreadTab.classList.remove("active");
    currentFilter = "all";
    updateUI();
  });

  unreadTab.addEventListener("click", () => {
    unreadTab.classList.add("active");
    allTab.classList.remove("active");
    currentFilter = "unread";
    updateUI();
  });

  markAllBtn.addEventListener("click", markAllAsRead);

  // Initial fetch and render
  notifications = await fetchNotifications();
  updateUI();

  const recentActivity = await fetchRecentActivity();
  renderActivity(recentActivity);

  // Poll for new notifications every 60s
  setInterval(async () => {
    notifications = await fetchNotifications();
    updateUI();
  }, 60000);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}