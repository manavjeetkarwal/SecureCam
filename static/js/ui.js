function ensureUiShell() {
  if (!document.getElementById("sideMenuOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "sideMenuOverlay";
    overlay.className = "side-menu-overlay";
    overlay.addEventListener("click", closeMenu);
    document.body.appendChild(overlay);
  }
  if (!document.getElementById("toastWrap")) {
    const wrap = document.createElement("div");
    wrap.id = "toastWrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  if (!document.getElementById("confirmBackdrop")) {
    const confirm = document.createElement("div");
    confirm.id = "confirmBackdrop";
    confirm.className = "confirm-backdrop";
    confirm.innerHTML = `
      <div class="confirm-box">
        <h3 id="confirmTitle">Confirm Action</h3>
        <p id="confirmMessage">Are you sure?</p>
        <div class="confirm-actions">
          <button class="btn-ghost" id="confirmCancelBtn" type="button">Cancel</button>
          <button class="btn-danger" id="confirmOkBtn" type="button">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirm);
    confirm.addEventListener("click", (e) => {
      if (e.target === confirm) {
        closeConfirm(false);
      }
    });
    document.getElementById("confirmCancelBtn").addEventListener("click", () => closeConfirm(false));
    document.getElementById("confirmOkBtn").addEventListener("click", () => closeConfirm(true));
  }
  if (!document.getElementById("floatingMediaToast")) {
    const media = document.createElement("div");
    media.id = "floatingMediaToast";
    media.className = "media-toast";
    media.innerHTML = `
      <div class="media-toast-head">
        <h4 id="mediaToastTitle">Saved</h4>
        <span id="mediaToastTime"></span>
      </div>
      <div class="media-toast-preview" id="mediaToastPreview"></div>
      <div class="meta" id="mediaToastMeta"></div>
    `;
    document.body.appendChild(media);
  }
}
function toggleMenu() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("sideMenuOverlay");
  if (!menu) return;
  const willOpen = !menu.classList.contains("open");
  menu.classList.toggle("open", willOpen);
  if (overlay) overlay.classList.toggle("show", willOpen);
  document.body.classList.toggle("menu-open", willOpen);
}
function closeMenu() {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("sideMenuOverlay");
  if (menu) menu.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
  document.body.classList.remove("menu-open");
}
function markActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll(".side-menu a").forEach(a => {
    const href = a.getAttribute("href");
    if (href && (href === path || (path === "/" && href === "/"))) {
      a.classList.add("active");
    }
  });
  document.querySelectorAll("[data-nav-path]").forEach(a => {
    if (a.getAttribute("data-nav-path") === path) {
      a.classList.add("active");
    }
  });
}
function showToast(type, title, message, duration = 3200) {
  const wrap = document.getElementById("toastWrap");
  if (!wrap) return;
  const item = document.createElement("div");
  item.className = `toast ${type || "info"}`;
  item.innerHTML = `
    <span class="toast-dot"></span>
    <div>
      <b>${title || "Notice"}</b>
      <p>${message || ""}</p>
    </div>
    <button type="button" aria-label="Close">&times;</button>
  `;
  const close = () => {
    item.style.opacity = "0";
    item.style.transform = "translateY(-6px)";
    setTimeout(() => item.remove(), 220);
  };
  item.querySelector("button").addEventListener("click", close);
  wrap.appendChild(item);
  if (duration > 0) {
    setTimeout(close, duration);
  }
}
let confirmResolver = null;
function openConfirm({ title = "Confirm Action", message = "Are you sure?", okText = "Confirm", danger = true } = {}) {
  const backdrop = document.getElementById("confirmBackdrop");
  const titleEl = document.getElementById("confirmTitle");
  const messageEl = document.getElementById("confirmMessage");
  const okBtn = document.getElementById("confirmOkBtn");
  if (!backdrop || !titleEl || !messageEl || !okBtn) return Promise.resolve(false);
  titleEl.innerText = title;
  messageEl.innerText = message;
  okBtn.innerText = okText;
  okBtn.className = danger ? "btn-danger" : "btn";
  backdrop.classList.add("show");
  return new Promise(resolve => {
    confirmResolver = resolve;
  });
}
function closeConfirm(value) {
  const backdrop = document.getElementById("confirmBackdrop");
  if (backdrop) backdrop.classList.remove("show");
  if (confirmResolver) {
    confirmResolver(value);
    confirmResolver = null;
  }
}
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("show");
  document.body.classList.add("menu-open");
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("show");
  document.body.classList.remove("menu-open");
}
function showMediaToast({ type = "photo", url = "", title = "", meta = "" } = {}) {
  const box = document.getElementById("floatingMediaToast");
  const preview = document.getElementById("mediaToastPreview");
  const titleEl = document.getElementById("mediaToastTitle");
  const timeEl = document.getElementById("mediaToastTime");
  const metaEl = document.getElementById("mediaToastMeta");
  if (!box || !preview || !titleEl || !timeEl || !metaEl) return;
  titleEl.innerText = title || (type === "video" ? "Video saved" : "Photo saved");
  timeEl.innerText = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  metaEl.innerText = meta || "";
  preview.innerHTML = type === "video"
    ? `<video src="${url}" autoplay muted playsinline controls></video>`
    : `<img src="${url}" alt="Preview">`;
  box.classList.add("show");
  clearTimeout(box._hideTimer);
  box._hideTimer = setTimeout(() => {
    box.classList.remove("show");
    const node = preview.querySelector("video");
    if (node) {
      try { node.pause(); } catch (e) {}
    }
  }, 4200);
}
document.addEventListener("DOMContentLoaded", () => {
  ensureUiShell();
  markActiveNav();
  document.querySelectorAll(".modal-backdrop").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
        document.body.classList.remove("menu-open");
      }
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMenu();
      document.querySelectorAll(".modal-backdrop.show").forEach(modal => modal.classList.remove("show"));
      const confirm = document.getElementById("confirmBackdrop");
      if (confirm && confirm.classList.contains("show")) {
        closeConfirm(false);
      }
      document.body.classList.remove("menu-open");
    }
  });
});
