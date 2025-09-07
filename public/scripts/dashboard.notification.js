import { fetchNotifications, markAsRead, markAllAsRead, getNotificationClass, escapeHtml } from './notifications.js';

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
  const pagination = document.getElementById("pagination");

  let allFetchedNotifications = [];

  let currentPage = 1;
  const pageSize = 10;
  let currentFilter = "all"; 

  const fmtDate = (iso) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return iso || ""; }
  };
  const getDetailLink = (notif) => {
    const id = notif.lost_item_id || notif.found_item_id;
    return id ? `../report/${encodeURIComponent(id)}` : "#";
  };

  async function fetchRecentActivity() {
    try {
      const token = await Clerk.session.getToken();
      console.log(token);

      const res = await fetch("https://reuniteai-production.up.railway.app/api/dashboard", { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const { recentActivity } = await res.json();
      return recentActivity || [];
    } catch (err) {
      console.error("Error fetching recent activity:", err);
      return [];
    }
  }

  async function refreshNotificationsFromServer() {
    const data = await fetchNotifications(Clerk, 200, 0);
    allFetchedNotifications = data.notifications;
    updateUI();
  }

  function renderNotifications(listToRender) {
    notificationList.innerHTML = "";
    if (listToRender.length === 0) {
      notificationList.innerHTML = `<li class="no-notifications">No notifications found.</li>`;
      return;
    }

    listToRender.forEach(notif => {
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

      // click handler now updates the local state, not the server
      if (!notif.is_read) {
        li.addEventListener("click", () => handleMarkAsRead(notif.id));
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
        </div>`;
      activityList.appendChild(li);
    });
  }

  function renderPagination(totalItems) {
    pagination.innerHTML = "";
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1) return;

    const makeLink = (page, label = page) => {
      const link = document.createElement("a");
      link.href = "#";
      link.className = "pagination-link" + (page === currentPage ? " active" : "");
      link.textContent = label;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        currentPage = page;
        updateUI();
      });
      return link;
    };

    if (currentPage > 1) pagination.appendChild(makeLink(currentPage - 1, "Previous"));
    for (let i = 1; i <= totalPages; i++) pagination.appendChild(makeLink(i));
    if (currentPage < totalPages) pagination.appendChild(makeLink(currentPage + 1, "Next"));
  }

  function updateUI() {
    let filteredList = allFetchedNotifications;
    if (currentFilter === 'unread') {
      filteredList = allFetchedNotifications.filter(notif => !notif.is_read);
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedList = filteredList.slice(startIndex, endIndex);

    renderNotifications(paginatedList);
    renderPagination(filteredList.length);
  }

  async function handleMarkAsRead(notificationId) {
    const success = await markAsRead(Clerk, notificationId);
    if (success) {
      const notification = allFetchedNotifications.find(n => n.id === notificationId);
      if (notification) {
        notification.is_read = true;
      }
      updateUI();
    }
  }

  async function handleMarkAllAsRead() {
    const success = await markAllAsRead(Clerk);
    if (success) {
      allFetchedNotifications.forEach(n => n.is_read = true);
      updateUI();
    }
  }

  allTab.addEventListener("click", () => {
    allTab.classList.add("active");
    unreadTab.classList.remove("active");
    currentFilter = "all";
    currentPage = 1;
    updateUI();
  });

  // instead of refetching, just update the filter and re-render
  unreadTab.addEventListener("click", () => { 
    unreadTab.classList.add("active");
    allTab.classList.remove("active");
    currentFilter = "unread";
    currentPage = 1;
    updateUI();
  });

  markAllBtn.addEventListener("click", handleMarkAllAsRead);

  await refreshNotificationsFromServer();
  const recentActivity = await fetchRecentActivity();
  renderActivity(recentActivity);
  setInterval(refreshNotificationsFromServer, 60000);
}