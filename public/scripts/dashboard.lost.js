window.addEventListener("load", async () => {
  const Clerk = window.Clerk;
  if (!Clerk) {
    console.error("Clerk SDK not found on window.");
    return;
  }

  try {
    await Clerk.load();

    if (!Clerk.user) {
      window.location.href = "./index_clerk.html";
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
    return str.length > 12
        ? `${str.slice(0, 5)}...${str.slice(-4)}`
        : str;
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
        <td>${escapeHtml(report.item_description)}</td>
        <td>${fmtDate(report.date_reported)}</td>
        <td>#${shortenId(report.report_id)}</td>
        <td><span class="status status-${statusClass}">${displayStatus}</span></td>
        <td><a href="../report/${encodeURIComponent( report.report_id )}" class="action-btn-table">View Details</a></td>
      `;
      tableBody.appendChild(row);
    });
  }

  function applyFilters() {
    let filtered = [...reports];
    const searchText = searchInput.value.toLowerCase();
    const status = statusFilter.value;

    if (searchText) {
      filtered = filtered.filter((r) =>
        String(r.item_description || "").toLowerCase().includes(searchText)
      );
    }

    if (status !== "all") {
      filtered = filtered.filter((r) => r.status === status);
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
      link.className =
        "pagination-link" + (page === currentPage ? " active" : "");
      link.textContent = label;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        currentPage = page;
        updateUI();
      });
      return link;
    };

    if (currentPage > 1)
      pagination.appendChild(makeLink(currentPage - 1, "Previous"));
    for (let i = 1; i <= totalPages; i++) pagination.appendChild(makeLink(i));
    if (currentPage < totalPages)
      pagination.appendChild(makeLink(currentPage + 1, "Next"));
  }

  function updateUI() {
    const filtered = applyFilters();
    const paginated = paginate(filtered);
    renderReports(paginated);
    renderPagination(filtered.length);
  }

  reports = await fetchLostReports();
  updateUI();

  searchInput.addEventListener("input", updateUI);
  statusFilter.addEventListener("change", updateUI);
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