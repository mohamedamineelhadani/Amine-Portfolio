(function () {
  var rm = matchMedia("(prefers-reduced-motion: reduce)").matches,
    $ = function (s, c) {
      return (c || document).querySelector(s);
    },
    $$ = function (s, c) {
      return [].slice.call((c || document).querySelectorAll(s));
    };
  /* theme */
  var root = document.documentElement;
  $("#theme").onclick = function () {
    var d = root.dataset.theme
      ? root.dataset.theme === "dark"
      : !matchMedia("(prefers-color-scheme: light)").matches;
    root.dataset.theme = d ? "light" : "dark";
  };
  /* scroll progress */
  var bar = $("#bar"),
    tk = 0;
  addEventListener(
    "scroll",
    function () {
      if (tk) return;
      tk = requestAnimationFrame(function () {
        var h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = "scaleX(" + (h > 0 ? scrollY / h : 0) + ")";
        tk = 0;
      });
    },
    { passive: true },
  );
  /* reveal + counters */
  var io = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          var s = $(".stat", e.target);
          if (s && !s.done) count(s);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  $$(".rv").forEach(function (el) {
    io.observe(el);
  });
  function count(el) {
    el.done = 1;
    var n = +el.dataset.n,
      s = el.dataset.s;
    if (rm) {
      el.textContent = n + s;
      return;
    }
    var t0 = performance.now();
    (function f(t) {
      var p = Math.min((t - t0) / 1300, 1);
      el.textContent =
        Math.round(n * (1 - Math.pow(1 - p, 3))) + (p === 1 ? s : "");
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  /* active nav */
  var links = $$("nav a"),
    so = new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) {
              a.classList.toggle(
                "on",
                a.getAttribute("href") === "#" + e.target.id,
              );
              a.toggleAttribute(
                "aria-current",
                a.getAttribute("href") === "#" + e.target.id,
              );
            });
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
  $$("section[id]").forEach(function (s) {
    so.observe(s);
  });
  /* typing */
  var words = [
      "Full Stack Developer",
      "Laravel & PHP engineer",
      "React & Node.js builder",
      "Clean-architecture fan",
    ],
    tp = $("#typed");
  if (rm) {
    tp.textContent = words[0];
  } else {
    var wi = 0,
      ci = 0,
      del = 0;
    (function tick() {
      var w = words[wi];
      ci += del ? -1 : 1;
      tp.textContent = w.slice(0, ci);
      var d = del ? 35 : 70;
      if (!del && ci === w.length) {
        del = 1;
        d = 1600;
      } else if (del && ci === 0) {
        del = 0;
        wi = (wi + 1) % words.length;
        d = 350;
      }
      setTimeout(tick, d);
    })();
  }
  /* glow follows mouse on cards */
  $$(".card").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });
  /* 3D tilt */
  if (!rm && matchMedia("(hover:hover)").matches)
    $$(".proj").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(),
          x = (e.clientX - r.left) / r.width - 0.5,
          y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transition = "border-color .3s";
        c.style.transform =
          "rotateY(" +
          x * 14 +
          "deg) rotateX(" +
          -y * 14 +
          "deg) translateY(-4px)";
      });
      c.addEventListener("pointerleave", function () {
        c.style.transition = "";
        c.style.transform = "";
      });
    });
  /* filter */
  $$(".filters button").forEach(function (b) {
    b.onclick = function () {
      $$(".filters button").forEach(function (x) {
        x.setAttribute("aria-pressed", x === b);
      });
      $$(".proj").forEach(function (p) {
        p.classList.toggle(
          "hide",
          b.dataset.f !== "all" && p.dataset.c !== b.dataset.f,
        );
      });
    };
  });
  /* cursor follower */
  if (matchMedia("(hover:hover) and (pointer:fine)").matches && !rm) {
    document.body.classList.add("cursor-on");
    var cur = $("#cur"),
      dot = $("#dot"),
      x = 0,
      y = 0,
      cx = 0,
      cy = 0;
    addEventListener(
      "pointermove",
      function (e) {
        x = e.clientX;
        y = e.clientY;
        dot.style.transform = "translate(" + x + "px," + y + "px)";
      },
      { passive: true },
    );
    (function loop() {
      cx += (x - cx) * 0.16;
      cy += (y - cy) * 0.16;
      cur.style.transform = "translate(" + cx + "px," + cy + "px)";
      requestAnimationFrame(loop);
    })();
    $$("a,button,input,textarea").forEach(function (el) {
      el.addEventListener("pointerenter", function () {
        cur.classList.add("big");
      });
      el.addEventListener("pointerleave", function () {
        cur.classList.remove("big");
      });
    });
  }
  /* magnetic button */
  var mag = $("#mag");
  if (!rm && matchMedia("(hover:hover)").matches) {
    mag.addEventListener("pointermove", function (e) {
      var r = mag.getBoundingClientRect(),
        dx = e.clientX - (r.left + r.width / 2),
        dy = e.clientY - (r.top + r.height / 2);
      mag.firstElementChild.style.transform =
        "translate(" + dx * 0.35 + "px," + dy * 0.35 + "px)";
    });
    mag.addEventListener("pointerleave", function () {
      mag.firstElementChild.style.transform = "";
    });
  }
  /* form validity */
  var API =
    location.protocol === "file:" ||
    (location.hostname === "localhost" &&
      location.port &&
      location.port !== "3000")
      ? "http://localhost:3000"
      : "";

  var f = $("#form"),
    send = $("#send"),
    st = $("#status");
  f.addEventListener("input", function () {
    send.disabled = !f.checkValidity();
  });
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    send.disabled = true;
    st.textContent = "Sending...";
    fetch(API + "/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(f))),
    })
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (j) {
            if (!r.ok)
              throw new Error(
                j.error ||
                  "Server answered " +
                    r.status +
                    ". Is the Node server running?",
              );
            return j;
          });
      })
      .then(function () {
        st.textContent = "Message sent. Thank you!";
        f.reset();
      })
      .catch(function (err) {
        console.error(err);
        st.textContent = /fetch|network/i.test(err.message)
          ? "Cannot reach the server. Make sure it is running (npm start)."
          : err.message;
        send.disabled = false;
      });
  });
})();
