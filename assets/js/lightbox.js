// Click a photo thumbnail to see the full image in an overlay.
// Click the overlay (or press Escape) to close it again.
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const overlay = document.getElementById("lightbox-overlay");
    const overlayImg = document.getElementById("lightbox-image");
    if (!overlay || !overlayImg) return;

    document.querySelectorAll(".lightbox-trigger").forEach(function (thumb) {
      thumb.addEventListener("click", function () {
        overlayImg.src = thumb.src;
        overlayImg.alt = thumb.alt;
        overlay.classList.add("open");
      });
    });

    function close() {
      overlay.classList.remove("open");
      overlayImg.src = "";
    }

    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  });
})();
