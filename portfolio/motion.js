const motion = matchMedia('(prefers-reduced-motion: reduce)');
const targets = document.querySelectorAll(
  '#system h2, .cards article, .flow-grid > div, .flow li, .team > *, .download-grid > *'
);

if (!motion.matches && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target;
      if (!motion.matches && !element.contains(document.activeElement)) {
        element.classList.add('entered');
      }
      observer.unobserve(element);
    }
  }, { rootMargin: '0px 0px -20px 0px', threshold: 0.05 });

  targets.forEach(element => observer.observe(element));
}