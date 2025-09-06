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

    console.log("Lost Reports loaded. Current user:", Clerk.user);
    initializeLostReports(Clerk);
  } catch (err) {
    console.error("Clerk failed to load on lost reports page:", err);
  }
});

async function initializeLostReports(Clerk) {
  const tableBody = document.getElementById("reports-table-body");
  const searchInput = document.querySelector(".search-input");
  const statusFilter = document.getElementById("status-filter");
  const pagination = document.getElementById("pagination");
  const activityList = document.getElementById("activity-list");
  const notifBadge = document.getElementById("notification-badge");
  const notifList = document.getElementById("notification-list");

  let reports = [];
  let currentPage = 1;
  const pageSize = 5;

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    } catch {
      return iso || "";
    }
  };

  function shortenId(id) {
    if (!id) return "";
    const str = String(id);
    return str.length > 12 ? `${str.slice(0, 5)}...${str.slice(-4)}` : str;
  }

  async function fetchLostReports() {
    try {
      const token = await Clerk.session.getToken();
      const r = await fetch("http://localhost:3001/api/dashboard/lost-reports", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!r.ok) throw new Error("Failed to fetch lost reports");
      const data = await r.json();
      return data.reports || [];
    } catch (err) {
      console.error("Error fetching lost reports:", err);
      return [];
    }
  }

  async function fetchActivityAndNotifications() {
    try {
      const token = await Clerk.session.getToken();
      const dashRes = await fetch("http://localhost:3001/api/dashboard", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const dashJson = dashRes.ok ? await dashRes.json() : {};
      const recentActivity = dashJson.recentActivity || [];

      let notifications = [];
      try {
        const nres = await fetch("http://localhost:3001/api/notifications", {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (nres.ok) {
          const njson = await nres.json();
          notifications = njson.notifications || [];
        }
      } catch (nerr) {
        console.warn("Failed to fetch notifications:", nerr);
      }

      return { recentActivity, notifications };
    } catch (err) {
      console.error("Error fetching recent activity:", err);
      return { recentActivity: [], notifications: [] };
    }
  }

  function renderReports(list) {
    tableBody.innerHTML = "";

    if (!list || list.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:var(--text-secondary)">
            No reports found.
          </td>
        </tr>`;
      return;
    }

    list.forEach((report) => {
      const statusClass = escapeHtml(report.status_class || "unknown");
      const displayStatus = escapeHtml(report.display_status || (report.status || "Unknown"));

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="max-width:420px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(report.item_description)}</td>
        <td>${fmtDate(report.date_reported)}</td>
        <td>#${shortenId(report.report_id)}</td>
        <td><span class="status status-${statusClass}">${displayStatus}</span></td>
        <td><a href="../report/${encodeURIComponent(report.report_id)}" class="action-btn-table">View Details</a></td>
      `;
      tableBody.appendChild(row);
    });
  }

  function renderActivity(list) {
    if (!activityList) return;
    activityList.innerHTML = "";

    if (!list || list.length === 0) {
      activityList.innerHTML = `<li class="no-activity">No recent activity.</li>`;
      return;
    }

    list.forEach((activity) => {
      const li = document.createElement("li");
      const activityClass = escapeHtml(activity.activity_class || "");
      const icon = escapeHtml(activity.icon || "fa-solid fa-info");
      const details = escapeHtml(activity.details || "");
      const timeAgo = escapeHtml(activity.time_ago || new Date(activity.created_at || "").toLocaleString());

      li.innerHTML = `
        <div class="activity-icon ${activityClass}"><i class="${icon}"></i></div>
        <div class="activity-details">
          <p>${details}</p>
          <span>${timeAgo}</span>
        </div>
      `;
      activityList.appendChild(li);
    });
  }

  function renderNotificationsDropdown(notifications) {
    if (!notifBadge || !notifList) return;

    const unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
      notifBadge.classList.add("visible");
      notifBadge.textContent = String(unreadCount);
    } else {
      notifBadge.classList.remove("visible");
      notifBadge.textContent = "0";
    }

    notifList.innerHTML = "";
    if (!notifications || notifications.length === 0) {
      notifList.innerHTML = `<li class="no-notifs">No notifications</li>`;
      return;
    }

    notifications.forEach(notif => {
      const li = document.createElement("li");
      li.className = "notification-item" + (!notif.is_read ? " unread" : "");
      li.innerHTML = `
        <div class="notif-avatar">${escapeHtml((notif.message || "").slice(0,1) || "•")}</div>
        <div class="notif-content">
          <div class="notif-text">${escapeHtml(notif.message || "")}</div>
          <div class="notif-time">${escapeHtml(new Date(notif.created_at || "").toLocaleString())}</div>
        </div>
      `;
      li.addEventListener("click", async () => {
        try {
          const clickToken = await Clerk.session.getToken();
          await fetch("http://localhost:3001/api/notifications/mark-read", {
            method: "POST",
            headers: { "Authorization": `Bearer ${clickToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId: notif.id })
          });
          li.classList.remove("unread");
          const cur = Math.max(0, parseInt(notifBadge.textContent || "0") - 1);
          notifBadge.textContent = cur;
        } catch (err) {
          console.error("Failed to mark notification read:", err);
        }
      });
      notifList.appendChild(li);
    });
  }

  function applyFilters() {
    let filtered = [...reports];
    const searchText = (searchInput.value || "").toLowerCase();
    const status = statusFilter.value;

    if (searchText) {
      filtered = filtered.filter((r) =>
        String(r.item_description || "").toLowerCase().includes(searchText)
      );
    }

    if (status !== "all") {
      filtered = filtered.filter((r) => {
        const cls = String(r.status_class || "").toLowerCase();
        const st = String(r.status || "").toLowerCase();
        if (status === "searching") return cls === "searching" || st === "lost";
        if (status === "matches-found") return cls === "matches" || st === "found";
        if (status === "claim-pending") return cls === "pending" || st === "claimed";
        if (status === "resolved") return cls === "resolved" || st === "reunited" || st === "claimed";
        return cls === status || st === status;
      });
    }

    return filtered;
  }

  function paginate(list) {
    const start = (currentPage - 1) * pageSize;
    return list.slice(start, start + pageSize);
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
    const filtered = applyFilters();
    const paginated = paginate(filtered);
    renderReports(paginated);
    renderPagination(filtered.length);
  }

  reports = await fetchLostReports();
  updateUI();

  const { recentActivity, notifications } = await fetchActivityAndNotifications();
  renderActivity(recentActivity);
  renderNotificationsDropdown(notifications);

  searchInput.addEventListener("input", () => {
    currentPage = 1;
    updateUI();
  });
  statusFilter.addEventListener("change", () => {
    currentPage = 1;
    updateUI();
  });
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
