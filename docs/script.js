// TaskHive Docs — sidebar highlight + simple search
(function () {
  const links = document.querySelectorAll('.sidebar a[href^="#"]');
  const sections = Array.from(document.querySelectorAll('.content section'));
  const search = document.getElementById('search');

  // Smooth scroll + active link toggling
  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      links.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      history.replaceState(null, '', '#' + id);
    });
  });

  // IntersectionObserver to update active link on scroll
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  );
  sections.forEach((s) => io.observe(s));

  // Search: hide sections that don't match, highlight matches
  function clearMarks(root) {
    root.querySelectorAll('mark').forEach((m) => {
      const t = document.createTextNode(m.textContent);
      m.parentNode.replaceChild(t, m);
    });
    root.normalize();
  }
  function highlight(root, query) {
    if (!query) return;
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentNode.closest('pre,code,h2,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!re.test(n.nodeValue)) return;
      const span = document.createElement('span');
      span.innerHTML = n.nodeValue.replace(re, '<mark>$1</mark>');
      n.parentNode.replaceChild(span, n);
    });
  }

  let t;
  search?.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const q = search.value.trim().toLowerCase();
      sections.forEach((s) => clearMarks(s));
      if (!q) {
        sections.forEach((s) => s.classList.remove('hidden'));
        return;
      }
      sections.forEach((s) => {
        const hit = s.textContent.toLowerCase().includes(q);
        s.classList.toggle('hidden', !hit);
        if (hit) highlight(s, q);
      });
    }, 120);
  });
})();