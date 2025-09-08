const hamburger = document.getElementById('hamburger');
const navCenter = document.querySelector('.nav-center');

function closeNav() {
  if (!navCenter) return;
  navCenter.classList.remove('open');
  hamburger.classList.remove('is-active');
  hamburger.setAttribute('aria-expanded', 'false');
  navCenter.setAttribute('aria-hidden', 'true');
}

function openNav() {
  if (!navCenter) return;
  navCenter.classList.add('open');
  hamburger.classList.add('is-active');
  hamburger.setAttribute('aria-expanded', 'true');
  navCenter.setAttribute('aria-hidden', 'false');
}

if (hamburger) {
  if (navCenter) navCenter.setAttribute('aria-hidden', 'true');

  hamburger.addEventListener('click', (e) => {
    const expanded = hamburger.getAttribute('aria-expanded') === 'true';
    if (expanded) closeNav(); else openNav();
    e.stopPropagation();
  });

  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navCenter.contains(e.target)) {
      if (navCenter.classList.contains('open')) {
        closeNav();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) {
      if (navCenter.classList.contains('open')) closeNav();
    }
  });
}