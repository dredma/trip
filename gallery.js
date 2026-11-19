// Desktop gallery: when a group's cards don't fit side by side, show them as
// a one-row carousel with the centre card in focus, rotating every few
// seconds. Pauses on hover/focus or off screen; no autoplay with reduced
// motion. Phones keep the plain swipeable row.
(function () {
  'use strict';
  var MIN_CARD = 280;      // narrowest a card may shrink before carousel mode
  var INTERVAL = 4000;
  var wide = window.matchMedia('(min-width: 840px)');
  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  function setup(strip) {
    var items = Array.prototype.slice.call(strip.children);
    var timer = null, focus = 0, hovered = false, visible = false, raf = 0;

    function gap() { return parseFloat(getComputedStyle(strip).columnGap) || 0; }
    function needsCarousel() {
      if (!wide.matches || items.length < 2) return false;
      var need = items.length * MIN_CARD + (items.length - 1) * gap() + 40;
      return need > strip.parentElement.clientWidth;
    }
    function left(i) {
      var li = items[i];
      return li.offsetLeft - (strip.clientWidth - li.offsetWidth) / 2;
    }
    function mark(i) {
      focus = i;
      items.forEach(function (li, j) { li.classList.toggle('focus', j === i); });
    }
    function go(i, smooth) {
      i = (i + items.length) % items.length;
      mark(i);
      strip.scrollTo({ left: left(i), behavior: smooth && !still.matches ? 'smooth' : 'auto' });
    }
    function nearest() {
      var mid = strip.scrollLeft + strip.clientWidth / 2, best = 0, d = Infinity;
      items.forEach(function (li, j) {
        var dd = Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid);
        if (dd < d) { d = dd; best = j; }
      });
      return best;
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function start() {
      stop();
      if (!strip.classList.contains('carousel') || still.matches || hovered || !visible) return;
      timer = setInterval(function () { go(focus + 1, true); }, INTERVAL);
    }
    function layout() {
      var on = needsCarousel();
      strip.classList.toggle('carousel', on);
      if (on) { go(Math.min(focus || 1, items.length - 1), false); }
      else { items.forEach(function (li) { li.classList.remove('focus'); }); }
      start();
    }

    strip.addEventListener('scroll', function () {
      if (!strip.classList.contains('carousel')) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { mark(nearest()); });
    }, { passive: true });
    strip.addEventListener('mouseenter', function () { hovered = true; stop(); });
    strip.addEventListener('mouseleave', function () { hovered = false; start(); });
    strip.addEventListener('focusin', function () { hovered = true; stop(); });
    strip.addEventListener('focusout', function () { hovered = false; start(); });
    items.forEach(function (li, j) {
      li.addEventListener('click', function () {
        if (strip.classList.contains('carousel') && j !== focus) go(j, true);
      });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting; start();
      }, { threshold: 0.4 }).observe(strip);
    } else { visible = true; }

    window.addEventListener('resize', layout);
    if (wide.addEventListener) wide.addEventListener('change', layout);
    layout();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.strip'), setup);
})();
