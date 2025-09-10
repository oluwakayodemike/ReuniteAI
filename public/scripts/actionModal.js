export function setupItemActionButtons() {
  const actionButtons = document.querySelectorAll(".item-action-btn, .view-details-btn");
  const modal = document.getElementById("item-details-modal");
  const closeModal = modal.querySelector(".close-btn");
  const modalImage = document.getElementById("modal-item-image");

  actionButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const itemData = btn.dataset;
      document.getElementById("modal-item-id").textContent = itemData.id || "N/A";
      document.getElementById("modal-item-description").textContent = itemData.description || "N/A";
      const statusSpan = document.getElementById("modal-item-status");
      statusSpan.textContent = itemData.status || "N/A";
      statusSpan.className = `status status-${itemData.statusClass || "unknown"}`;

      const imageUrl = itemData.imageUrl || "";
      if (imageUrl.trim()) {
        modalImage.src = imageUrl;
        modalImage.style.display = "block";
        modalImage.alt = itemData.description ? `Image of ${itemData.description}` : "Item image";
      } else {
        modalImage.style.display = "none";
        modalImage.src = "";
        modalImage.alt = "No image available";
      }

      modal.style.display = "flex";
    });
  });

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
    modal.querySelector("#modal-item-image").src = "";
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
      modal.querySelector("#modal-item-image").src = "";  
    }
  });
}