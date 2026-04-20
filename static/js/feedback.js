document.addEventListener("DOMContentLoaded", () => {
  const inquiryForm = document.getElementById("inquiryForm");
  const submitFeedbackBtn = document.getElementById("submitFeedback");

  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      first_name: document.getElementById("inquiryName").value,
      last_name: document.getElementById("inquiryLast").value,
      email: document.getElementById("inquiryEmail").value,
      phone: document.getElementById("inquiryPhone").value,
      subject: document.getElementById("inquirySubject").value,
      message: document.getElementById("inquiryMessage").value
    };
    try {
      const res = await fetch("/submit_inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Submit failed");
      inquiryForm.reset();
      showToast("success", "Inquiry sent", "Your inquiry was submitted successfully.");
    } catch (e2) {
      showToast("error", "Inquiry failed", "Unable to submit inquiry right now.");
    }
  });

  submitFeedbackBtn.addEventListener("click", async () => {
    const message = document.getElementById("feedbackMessage").value.trim();
    const ratingElement = document.querySelector('input[name="rating"]:checked');
    if (!ratingElement) {
      showToast("warning", "Select rating", "Please select a rating emoji first.");
      return;
    }
    if (!message) {
      showToast("warning", "Write feedback", "Please enter your feedback before submitting.");
      return;
    }
    try {
      const res = await fetch("/submit_feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, rating: ratingElement.value })
      });
      if (!res.ok) throw new Error("Submit failed");
      document.getElementById("feedbackMessage").value = "";
      ratingElement.checked = false;
      showToast("success", "Feedback sent", "Thank you for sharing your feedback.");
    } catch (e2) {
      showToast("error", "Feedback failed", "Unable to submit feedback right now.");
    }
  });
});