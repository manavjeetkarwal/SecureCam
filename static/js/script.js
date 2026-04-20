document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".home-slideshow .slide");
  const dots = document.querySelectorAll(".home-slideshow .slide-dot");

  let currentSlideIndex = 0;
  let slideTimer = null;
  const slideInterval = 5000;

  function showSlide(index) {
    if (!slides.length || !dots.length) return;

    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === index);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });

    currentSlideIndex = index;
  }

  function nextSlide() {
    showSlide(currentSlideIndex + 1);
  }

  function startSlideShow() {
    if (!slides.length) return;
    stopSlideShow();
    slideTimer = setInterval(nextSlide, slideInterval);
  }

  function stopSlideShow() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  if (!slides.length || !dots.length) return;

  showSlide(0);
  startSlideShow();

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.dataset.slide);
      showSlide(index);
      startSlideShow();
    });
  });
});