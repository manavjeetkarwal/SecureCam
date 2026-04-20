function showSignup() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
}
function showLogin() {
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
}
function goHome() {
  window.location.href = "/";
}
async function validateLogin() {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  let valid = true;
  document.getElementById("loginUserError").innerText = "";
  document.getElementById("loginPassError").innerText = "";
  if (!username) {
    document.getElementById("loginUserError").innerText = "Username required";
    valid = false;
  }
  if (!password) {
    document.getElementById("loginPassError").innerText = "Password required";
    valid = false;
  } else if (password.length < 6) {
    document.getElementById("loginPassError").innerText = "Password must be at least 6 characters";
    valid = false;
  }
  if (!valid) return;
  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  const res = await fetch("/login", { method: "POST", body: formData });
  if (res.redirected) {
    showToast("success", "Login successful", "Redirecting to your dashboard...", 1200);
    setTimeout(() => { window.location.href = res.url; }, 900);
  } else {
    const text = await res.text();
    showToast("error", "Login failed", text || "Unable to sign in.");
  }
}
async function validateSignup() {
  const username = document.getElementById("signupUsername").value.trim();
  const password = document.getElementById("signupPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const email = document.getElementById("email").value.trim();
  const dob = document.getElementById("dob").value;
  const phone = document.getElementById("phone").value.trim();
  let valid = true;
  ["signupUserError","signupPassError","confirmPassError","emailError","dobError","phoneError"].forEach(id => document.getElementById(id).innerText = "");
  if (!username) {
    document.getElementById("signupUserError").innerText = "Username required";
    valid = false;
  }
  if (password.length < 6) {
    document.getElementById("signupPassError").innerText = "Password must be at least 6 characters";
    valid = false;
  }
  if (password !== confirm) {
    document.getElementById("confirmPassError").innerText = "Passwords do not match";
    valid = false;
  }
  if (!email) {
    document.getElementById("emailError").innerText = "Email required";
    valid = false;
  }
  if (!dob) {
    document.getElementById("dobError").innerText = "Select date of birth";
    valid = false;
  }
  if (!/^\d{10}$/.test(phone)) {
    document.getElementById("phoneError").innerText = "Phone must be 10 digits";
    valid = false;
  }
  if (!valid) return;
  const formData = new FormData();
  formData.append("username", username);
  formData.append("password", password);
  formData.append("email", email);
  formData.append("phone", phone);
  formData.append("dob", dob);
  const res = await fetch("/signup", { method: "POST", body: formData });
  if (res.redirected) {
    showToast("success", "Account created", "Your account was created successfully.", 1200);
    setTimeout(() => { window.location.href = res.url; }, 900);
  } else {
    const text = await res.text();
    showToast("error", "Signup failed", text || "Unable to create account.");
  }
}