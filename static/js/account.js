let currentAccountData = null;
async function loadAccount() {
  try {
    const res = await fetch("/account_data");
    const data = await res.json();
    currentAccountData = data;
    document.getElementById("userid").innerText = data.id || "-";
    document.getElementById("profileUsername").innerText = data.username || "-";
    document.getElementById("profileEmail").innerText = data.email || "-";
    document.getElementById("profilePhone").innerText = data.phone || "-";
    document.getElementById("profileDob").innerText = data.dob || "-";
    document.getElementById("updateUsername").value = data.username || "";
    document.getElementById("updatePassword").value = data.password || "";
    document.getElementById("retypePassword").value = data.password || "";
  } catch (e) {
    showToast("error", "Load failed", "Unable to load account information.");
  }
}
function openUpdateModal() {
  if (!currentAccountData) return;
  document.getElementById("updateUsername").value = currentAccountData.username || "";
  document.getElementById("updatePassword").value = currentAccountData.password || "";
  document.getElementById("retypePassword").value = currentAccountData.password || "";
  openModal("updateModal");
}
function closeUpdateModal() {
  closeModal("updateModal");
}
async function updateAccount() {
  if (!currentAccountData) return;
  const username = document.getElementById("updateUsername").value.trim();
  const password = document.getElementById("updatePassword").value.trim();
  const retype = document.getElementById("retypePassword").value.trim();
  if (!username) {
    showToast("warning", "Username required", "Please enter a username.");
    return;
  }
  if (password.length < 6) {
    showToast("warning", "Weak password", "Password must be at least 6 characters.");
    return;
  }
  if (password !== retype) {
    showToast("warning", "Password mismatch", "Both password fields must match.");
    return;
  }
  const formData = new FormData();
  formData.append("username", username);
  formData.append("email", currentAccountData.email || "");
  formData.append("phone", currentAccountData.phone || "");
  formData.append("dob", currentAccountData.dob || "");
  formData.append("password", password);
  try {
    const res = await fetch("/update_account", { method: "POST", body: formData });
    const msg = await res.text();
    closeUpdateModal();
    if (!res.ok) {
      showToast("error", "Update failed", msg || "Unable to update account.");
      return;
    }
    showToast("success", "Account updated", msg || "Your account was updated successfully.");
    await loadAccount();
    if ((msg || "").toLowerCase().includes("login again")) {
      setTimeout(() => { window.location.href = "/login"; }, 1300);
    }
  } catch (e) {
    showToast("error", "Update failed", "Unable to update account right now.");
  }
}
async function deleteAccount() {
  const ok = await openConfirm({
    title: "Delete Account",
    message: "This will permanently remove your account. Do you want to continue?",
    okText: "Delete",
    danger: true
  });
  if (!ok) return;
  try {
    const res = await fetch("/delete_account", { method: "POST" });
    const msg = await res.text();
    showToast(res.ok ? "success" : "error", res.ok ? "Account deleted" : "Delete failed", msg || "Request completed.");
    if (res.ok) {
      setTimeout(() => { window.location.href = "/login"; }, 1200);
    }
  } catch (e) {
    showToast("error", "Delete failed", "Unable to delete account right now.");
  }
}
function logout() {
  window.location.href = "/logout";
}
document.addEventListener("DOMContentLoaded", loadAccount);