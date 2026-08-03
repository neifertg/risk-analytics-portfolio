<button id="toggle-dark" style="position:fixed;top:1rem;right:1rem;z-index:1000;">🌙 Toggle Dark Mode</button>
<style>
body.dark-mode {
  background: #181a1b !important;
  color: #e8e6e3 !important;
}
body.dark-mode a { color: #8ab4f8 !important; }
body.dark-mode h1, body.dark-mode h2, body.dark-mode h3,
body.dark-mode h4, body.dark-mode h5, body.dark-mode h6 { color: #fff !important; }
body.dark-mode blockquote {
  border-left: 4px solid #444;
  color: #b0b0b0;
  background: #232526;
}
body.dark-mode hr { border-color: #333; }
</style>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('toggle-dark');
    const setMode = (on) => {
      document.body.classList.toggle('dark-mode', on);
      localStorage.setItem('darkMode', on ? '1' : '');
    };
    btn.onclick = () => setMode(!document.body.classList.contains('dark-mode'));
    // On load
    if (localStorage.getItem('darkMode')) setMode(true);
  });
</script>

---
layout: home
title: "Risk & Audit Analytics Portfolio"
description: "Data-driven internal audit, risk analytics, and automation projects by G. Seth Neifert"
---

# Welcome to My Risk & Audit Analytics Portfolio

I work in internal audit data analytics and am building toward applying
advanced analytics, machine learning, and automation to internal audit,
enterprise risk, and governance challenges. This site tracks real, working
projects as they ship — nothing here is a mockup or a hypothetical.

---

## 🔍 Projects

Nothing published yet. The first project — a retrieval-augmented question
answering assistant grounded in public audit-standards documentation — is
in progress. Check back soon.

---

## 📄 Contact

- [GitHub](https://github.com/neifertg)
- [Email](mailto:gsneifert@gmail.com)

---

> "Better data leads to better questions. Better questions lead to better audits."

