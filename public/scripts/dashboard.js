window.addEventListener("load", async () => {
  const Clerk = window.Clerk;
  if (!Clerk) {
    console.error("Clerk SDK not found on window.");
    return;
  }

  try {
    await Clerk.load();

    if (!Clerk.user) {
      window.location.href = "./index.html";
      return;
    }

    console.log("Dashboard loaded. Current user:", Clerk.user);
    initializeDashboard(Clerk);
  } catch (err) {
    console.error("Clerk failed to load on dashboard page:", err);
  }
});


async function initializeDashboard(Clerk) {
  const welcomeElem = document.getElementById("welcome-message");
  const statsGrid = document.getElementById("stats-grid");
  const reportList = document.getElementById("report-list");
  const activityList = document.getElementById("activity-list");
  const notifBadge = document.getElementById("notification-badge");
  const notifList = document.getElementById("notification-list");
  const userNameElem = document.getElementById("user-name");
  const userEmailElem = document.getElementById("user-email");

  if (welcomeElem) welcomeElem.textContent = `Welcome back, ${Clerk.user.firstName || "User"}!`;
  if (userNameElem) userNameElem.textContent = Clerk.user.fullName || "User";
  if (userEmailElem) userEmailElem.textContent = Clerk.user.primaryEmailAddress?.emailAddress || "";


  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return iso || "";
    }
  };

  const reportIconFor = (desc = "") => {
    const d = String(desc).toLowerCase();
    if (d.includes("wallet")) return "fa-solid fa-wallet";
    if (d.includes("mifi")) return "fa-solid fa-wifi";
    if (d.includes("powerbank")) return "fa-solid fa-charging-station";
    if (d.includes("bottle")) return "fa-solid fa-bottle-water";
    if (d.includes("phone") || d.includes("iphone") || d.includes("mobile")) return "fa-solid fa-mobile-screen";
    return "fa-solid fa-flag-checkered";
  };

  try {
    const token = await Clerk.session.getToken();

    const r = await fetch("http://localhost:3001/api/dashboard", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
    if (!r.ok) throw new Error("Failed to fetch dashboard data");
    const { stats = {}, recentReports = [], recentActivity = [] } = await r.json();

    if (statsGrid) {
      statsGrid.innerHTML = "";
      const statData = [
        { label: "Active Reports", value: stats.active_reports, icon: "fa-solid fa-hourglass-half", cls: "searching" },
        { label: "Items with Matches", value: stats.items_with_matches, icon: "fa-solid fa-link", cls: "matches" },
        { label: "Items Claimed", value: stats.items_resolved, icon: "fa-solid fa-check-circle", cls: "resolved" }
      ];
      statData.forEach(s => {
        const card = document.createElement("div");
        card.className = "stat-card";
        card.innerHTML = `
          <div class="stat-icon ${s.cls}"><i class="${s.icon}"></i></div>
          <div class="stat-info">
            <p>${s.label}</p>
            <span>${Number(s.value || 0)}</span>
          </div>
        `;
        statsGrid.appendChild(card);
      });
    }

    if (reportList) {
      reportList.innerHTML = "";
      if (!recentReports || recentReports.length === 0) {
        reportList.innerHTML = `<div class="no-reports">No reports yet.</div>`;
      } else {
        recentReports.forEach(report => {
          const iconClass = reportIconFor(report.description);
          const item = document.createElement("div");
          item.className = "report-item";
          item.innerHTML = `
            <div class="item-icon"><i class="${iconClass}"></i></div>
            <p class="item-description">${escapeHtml(report.description || "No description")}</p>
            <span class="status status-${escapeHtml(report.status_class || "unknown")}">${escapeHtml(report.display_status || "Unknown")}</span>
            <p class="item-date">${fmtDate(report.item_date)}</p>
            <a href="/dashboard/report-details.html?id=${encodeURIComponent(report.id)}" class="item-action-btn"><i class="fa-solid fa-chevron-right"></i></a>
          `;
          reportList.appendChild(item);
        });
      }
    }

    if (activityList) {
      activityList.innerHTML = "";
      if (!recentActivity || recentActivity.length === 0) {
        activityList.innerHTML = `<li class="no-activity">No recent activity.</li>`;
      } else {
        recentActivity.forEach(activity => {
          const li = document.createElement("li");
          li.innerHTML = `
            <div class="activity-icon ${escapeHtml(activity.activity_class || "")}"><i class="${escapeHtml(activity.icon || "fa-solid fa-info")}"></i></div>
            <div class="activity-details">
              <p>${escapeHtml(activity.details || "")}</p>
              <span>${escapeHtml(activity.time_ago || "")}</span>
            </div>
          `;
          activityList.appendChild(li);
        });
      }
    }

    if (notifBadge && notifList) {
      try {
        const nres = await fetch("http://localhost:3001/api/notifications", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        if (!nres.ok) throw new Error("Failed to fetch notifications");
        const { notifications = [] } = await nres.json();

        const unread = notifications.filter(n => !n.is_read).length;
        notifBadge.textContent = unread;

        notifList.innerHTML = "";
        if (notifications.length === 0) {
          notifList.innerHTML = `<li class="no-notifs">No notifications</li>`;
        } else {
          notifications.forEach(notif => {
            const li = document.createElement("li");
            li.textContent = notif.message;
            li.dataset.id = notif.id;
            li.addEventListener("click", async () => {
              try {
                const clickToken = await Clerk.session.getToken();
                await fetch("http://localhost:3001/api/notifications/mark-read", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${clickToken}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ notificationId: notif.id })
                });
                // locally decrement unread count (guard against negative)
                const cur = Math.max(0, parseInt(notifBadge.textContent || "0") - 1);
                notifBadge.textContent = cur;
                li.classList.add("notif-read");
              } catch (err) {
                console.error("Failed to mark notification read:", err);
              }
            });
            notifList.appendChild(li);
          });
        }
      } catch (err) {
        console.warn("Notifications load failed:", err);
      }
    }

  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    // fallback UI updates
    if (statsGrid) statsGrid.innerHTML = `<div class="error">Failed to load stats.</div>`;
    if (reportList) reportList.innerHTML = `<div class="error">Failed to load reports.</div>`;
    if (activityList) activityList.innerHTML = `<li class="error">Failed to load activity.</li>`;
    if (notifList) notifList.innerHTML = `<li class="error">Failed to load notifications.</li>`;
  }
}


// util to avoid HTML injection for simple strings
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
