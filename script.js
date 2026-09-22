const navToggle = document.querySelector('.nav-toggle');
const mainNav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');
const yearNode = document.getElementById('year');
const contactForm = document.getElementById('contactForm');
const formStatus = document.querySelector('.form-status');

if (yearNode) yearNode.textContent = new Date().getFullYear();

const closeMenu = () => {
  if (!mainNav || !navToggle) return;
  mainNav.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
};

if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
}

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('visible'));
}

if (contactForm && formStatus) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = contactForm.querySelector('#name')?.value.trim() || 'There';
    formStatus.textContent = `Thanks, ${name}. Your inquiry has been received. We will be in touch soon.`;
    contactForm.reset();
  });
}
