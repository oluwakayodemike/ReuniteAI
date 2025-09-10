import { setupItemActionButtons } from "./actionModal.js";

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
    initializeFoundReports(Clerk);
  } catch (err) {
    console.error("Clerk failed to load on found reports page:", err);
  }
});

async function initializeFoundReports(Clerk) {
  const tableBody = document.getElementById("reports-table-body");
  const searchInput = document.querySelector(".search-input");
  const statusFilter = document.getElementById("status-filter");
  const pagination = document.getElementById("pagination");
  const activityList = document.getElementById("activity-list");

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

  async function fetchFoundReports() {
    try {
      const token = await Clerk.session.getToken();
      const r = await fetch("https://reuniteai-production.up.railway.app/api/dashboard/found-reports", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!r.ok) throw new Error("Failed to fetch found reports");
      const data = await r.json();
      return data.reports || [];
    } catch (err) {
      console.error("Error fetching found reports:", err);
      return [];
    }
  }

  async function fetchRecentActivity() {
    try {
      const token = await Clerk.session.getToken();
      const dashRes = await fetch("https://reuniteai-production.up.railway.app/api/dashboard", {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const dashJson = dashRes.ok ? await dashRes.json() : {};
      return dashJson.recentActivity || [];
    } catch (err) {
      console.error("Error fetching recent activity:", err);
      return [];
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
      const dateField = report.date_found || report.date_reported;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(report.item_description)}</td>
        <td>${fmtDate(dateField)}</td>
        <td>#${shortenId(report.report_id)}</td>
        <td><span class="status status-${statusClass}">${displayStatus}</span></td>
        <td>
          <a href="#" 
             class="action-btn-table view-details-btn" 
             data-id="${escapeHtml(report.report_id)}" 
             data-description="${escapeHtml(report.item_description)}" 
             data-status="${displayStatus}" 
             data-status-class="${statusClass}" 
             data-image-url="${escapeHtml(report.image_url || '')}">
            View Details
          </a>
        </td>
      `;
      tableBody.appendChild(row);
    });
    setupItemActionButtons();
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
      filtered = filtered.filter((r) => String(r.status || "").toLowerCase() === status);
    }

    return filtered;
  }

  function paginate(list) {
    const start = (currentPage - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }

  function updateUI() {
    const filtered = applyFilters();
    const paginated = paginate(filtered);
    renderReports(paginated);
    renderPagination(filtered.length);
  }
  
  reports = await fetchFoundReports();
  updateUI();

  const recentActivity = await fetchRecentActivity();
  renderActivity(recentActivity);

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