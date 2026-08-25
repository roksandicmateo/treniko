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

      // Count downloads of the free tracker.
      //
      // The file is served straight off disk by nginx, so a download never
      // reaches the application and never appears in page_view. That left the
      // most important step of the whole funnel unmeasured: we could see how
      // many people reached the tracker page and had no idea how many of them
      // actually took the file. Views without downloads and views with them are
      // the difference between a page that needs rewriting and one that works.
      //
      // The download's own path is sent as the event, so it shows up in the
      // admin page breakdown next to the page that led to it, with whatever
      // campaign tags brought the visitor in. Same beacon, same endpoint, no new
      // table and nothing identifying.
      document.querySelectorAll('a[href^="/downloads/"]').forEach(function (a) {
        a.addEventListener('click', function () {
          try {
            var d = { path: a.getAttribute('href').split('?')[0] };
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
              if (body[k]) d[k] = body[k];
            });
            if (body.referrer_host) d.referrer_host = body.referrer_host;
            if (navigator.sendBeacon) {
              navigator.sendBeacon(
                '/api/metrics/view',
                new Blob([JSON.stringify(d)], { type: 'application/json' })
              );
            }
          } catch (e) { /* a click must never be blocked by its own counter */ }
        });
      });
    } catch (e) { /* a counter must never break the page it counts */ }
  })();
