// Courses page: renders SITE.courses (data.js) with a search filter.
(function () {
  Object.assign(window.UI_STRINGS.en, {
    "c.title": "Courses",
    "c.lead": "Lecture notes, slides, lab sheets and assignments for the courses I teach. Materials are added during the semester.",
    "c.search": "Search materials…",
    "c.current": "Current courses", "c.past": "Past courses",
    "c.empty": "Materials for this course will be posted here during the semester.",
    "c.nomatch": "No materials match your search.",
    "c.week": "Week", "c.new": "New", "c.items": "{n} items",
    "c.type.slides": "Slides", "c.type.notes": "Notes", "c.type.lab": "Lab", "c.type.homework": "Assignment",
    "c.type.code": "Code", "c.type.exam": "Exam", "c.type.video": "Video", "c.type.link": "Link",
  });
  Object.assign(window.UI_STRINGS.tr, {
    "c.title": "Dersler",
    "c.lead": "Verdiğim derslerin ders notları, sunumları, laboratuvar föyleri ve ödevleri. Materyaller dönem boyunca eklenir.",
    "c.search": "Materyallerde ara…",
    "c.current": "Bu dönemki dersler", "c.past": "Geçmiş dersler",
    "c.empty": "Bu dersin materyalleri dönem içinde burada paylaşılacak.",
    "c.nomatch": "Aramanızla eşleşen materyal yok.",
    "c.week": "Hafta", "c.new": "Yeni", "c.items": "{n} materyal",
    "c.type.slides": "Sunum", "c.type.notes": "Not", "c.type.lab": "Lab", "c.type.homework": "Ödev",
    "c.type.code": "Kod", "c.type.exam": "Sınav", "c.type.video": "Video", "c.type.link": "Bağlantı",
  });

  const { t, L, esc } = window.SiteI18n;
  const $ = (id) => document.getElementById(id);
  const courses = window.SITE.courses || [];
  const NEW_DAYS = 10;
  let query = "";

  const icon = {
    file: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  };

  const isNew = (d) => d && (Date.now() - new Date(d).getTime()) / 864e5 <= NEW_DAYS;
  const matches = (m) => !query || String(L(m.title)).toLocaleLowerCase().includes(query);

  function materialRow(m) {
    const href = m.file || m.url || "#";
    const ext = m.file ? (m.file.split(".").pop() || "").toUpperCase() : "";
    const attrs = m.file ? "download" : 'target="_blank" rel="noopener"';
    const type = m.type || (m.file ? "notes" : "link");
    return `<li class="mat">
      <span class="mat-week">${m.week === undefined || m.week === "" ? "" : typeof m.week === "number" ? `${t("c.week")} ${m.week}` : esc(L(m.week))}</span>
      <span class="mat-type t-${esc(type)}">${esc(t("c.type." + type))}</span>
      <a class="mat-title" href="${esc(href)}" ${attrs}>${esc(L(m.title))}${isNew(m.date) ? ` <span class="new">${t("c.new")}</span>` : ""}</a>
      <span class="mat-meta">${ext ? esc(ext) : ""}${m.date ? `<time>${esc(m.date)}</time>` : ""}</span>
      <a class="mat-get" href="${esc(href)}" ${attrs} aria-label="${esc(L(m.title))}">${m.file ? icon.file : icon.link}</a>
    </li>`;
  }

  function courseCard(c) {
    const mats = (c.materials || []).filter(matches);
    const total = (c.materials || []).length;
    const meta = [c.code, L(c.term), L(c.level)].filter(Boolean).map(esc).join(" · ");
    let body;
    if (!total) body = `<p class="muted course-empty">${t("c.empty")}</p>`;
    else if (!mats.length) body = `<p class="muted course-empty">${t("c.nomatch")}</p>`;
    else body = `<ul class="mats">${mats.map(materialRow).join("")}</ul>`;
    return `<article class="card course" id="${esc(c.id)}">
      <div class="course-top"><span class="muted">${meta}</span>${total ? `<span class="badge">${t("c.items").replace("{n}", total)}</span>` : ""}</div>
      <h2>${esc(L(c.title))}</h2>
      ${c.description ? `<p class="course-desc">${esc(L(c.description))}</p>` : ""}
      ${body}
    </article>`;
  }

  function render() {
    const current = courses.filter((c) => c.active !== false);
    const past = courses.filter((c) => c.active === false);
    $("courseSearch").placeholder = t("c.search");
    $("courses").innerHTML = current.length
      ? `<h3 class="course-group">${t("c.current")}</h3>${current.map(courseCard).join("")}`
      : "";
    $("pastCourses").innerHTML = past.length
      ? `<details class="past" ${query ? "open" : ""}><summary><h3 class="course-group">${t("c.past")}</h3></summary>${past.map(courseCard).join("")}</details>`
      : "";
  }

  $("courseSearch").addEventListener("input", (e) => { query = e.target.value.trim().toLocaleLowerCase(); render(); });
  document.addEventListener("langchange", render);
})();
