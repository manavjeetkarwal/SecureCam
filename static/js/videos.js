function formatDuration(seconds) {
  const totalSeconds = Number(seconds) || 0;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}
async function loadVideos() {
  const grid = document.getElementById("videoGrid");
  grid.innerHTML = '<div class="loading-state">Loading videos...</div>';
  try {
    const res = await fetch("/api/videos");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      grid.innerHTML = '<div class="empty-state">No videos recorded yet.</div>';
      return;
    }
    grid.innerHTML = "";
    data.forEach(video => {
      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `
        <video controls preload="metadata">
          <source src="${video.path}" type="video/webm">
          Your browser does not support video playback.
        </video>
        <div class="video-info">
          <div class="info-chip">Date: ${video.date || "-"}</div>
          <div class="info-chip">Time: ${video.time || "-"}</div>
          <div class="info-chip">Duration: ${formatDuration(video.duration)}</div>
        </div>
        <div class="video-buttons">
          <button class="btn-success" onclick="downloadVideo(${video.seq})">Download</button>
          <button class="btn-danger" onclick="deleteVideo(${video.seq})">Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Failed to load videos.</div>';
  }
}
function downloadVideo(seq) {
  window.location.href = "/download/video/" + seq;
}
async function deleteVideo(seq) {
  const ok = await openConfirm({ title: "Delete Video", message: "Do you want to delete this video?", okText: "Delete", danger: true });
  if (!ok) return;
  try {
    const res = await fetch("/delete/video/" + seq, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed");
    showToast("success", "Video deleted", "The video was removed successfully.");
    loadVideos();
  } catch (e) {
    showToast("error", "Delete failed", e.message || "Failed to delete video.");
  }
}
document.addEventListener("DOMContentLoaded", loadVideos);