(function () {
    try {
      var p = location.pathname.replace(/\/$/, '') || '/';
      var q = new URLSearchParams(location.search);
      var body = { path: p };
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
        var v = q.get(k);
        if (v) body[k] = String(v).trim().slice(0, 255);
      });
      if (document.referrer) {
        try {
          var u = new URL(document.referrer);
          if (u.host && u.host !== location.host) body.referrer_host = u.host.slice(0, 255);
        } catch (e) { /* unparseable referrer is simply not recorded */ }
      }
      var payload = JSON.stringify(body);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/view', new Blob([payload], { type: 'application/json' }));
      }

      // Hand any incoming campaign tags to the app, so first-touch attribution
      // survives a landing that was not the landing page.
      var carry = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .filter(function (k) { return q.get(k); })
        .map(function (k) { return k + '=' + encodeURIComponent(q.get(k)); })
        .join('&');
      if (carry) {
        document.querySelectorAll('a[href="/"], a[href="/register"]').forEach(function (a) {
          a.setAttribute('href', a.getAttribute('href') + '?' + carry);
        });
      }
    } catch (e) { /* a counter must never break the page it counts */ }
  })();
