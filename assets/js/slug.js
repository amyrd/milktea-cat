// Rotating tagline shown in the header. Click it to cycle to the next one.
// Edit the phrases list below to make it your own.
(function () {
  const phrases = [
    "The things you own end up owning you.",
    "🐈‍⬛",
    "ᓚ₍ ^. ̫ .^₎",
   "ᓚᘏᗢ ♡ ᗢᘏᓗ",
    "meow",
    "this is my site! wow!",
    "hi angie",
  ];

  let index = Math.floor(Math.random() * phrases.length);

  function render() {
    const el = document.getElementById("slug");
    if (!el) return;
    el.textContent = phrases[index];
  }

  document.addEventListener("DOMContentLoaded", function () {
    const el = document.getElementById("slug");
    if (!el) return;
    render();
    el.addEventListener("click", function () {
      index = (index + 1) % phrases.length;
      render();
    });
  });
})();
