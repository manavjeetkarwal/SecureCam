async function loadPhotos() {
  const grid = document.getElementById("photoGrid");
  grid.innerHTML = '<div class="loading-state">Loading photos...</div>';
  try {
    const res = await fetch("/api/photos");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      grid.innerHTML = '<div class="empty-state">No photos available yet.</div>';
      return;
    }
    grid.innerHTML = "";
    data.forEach(photo => {
      const card = document.createElement("div");
      card.className = "photo-card";
      card.innerHTML = `
        <img src="${photo.path}" alt="Stored Photo">
        <div class="photo-info">
          <div class="info-chip">Date: ${photo.date || "-"}</div>
          <div class="info-chip">Time: ${photo.time || "-"}</div>
        </div>
        <div class="photo-buttons">
          <button class="btn-success" onclick="downloadPhoto(${photo.seq})">Download</button>
          <button class="btn-danger" onclick="deletePhoto(${photo.seq})">Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Failed to load photos.</div>';
  }
}
function downloadPhoto(seq) {
  window.location.href = "/download/photo/" + seq;
}
async function deletePhoto(seq) {
  const ok = await openConfirm({ title: "Delete Photo", message: "Do you want to delete this photo?", okText: "Delete", danger: true });
  if (!ok) return;
  try {
    const res = await fetch("/delete/photo/" + seq, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed");
    showToast("success", "Photo deleted", "The photo was removed successfully.");
    loadPhotos();
  } catch (e) {
    showToast("error", "Delete failed", e.message || "Failed to delete photo.");
  }
}
document.addEventListener("DOMContentLoaded", loadPhotos);