(function () {
  'use strict';

  var ids = ['rate', 'length', 'prep', 'travel', 'messaging', 'admin', 'blockSize', 'discount'];
  var el = {};
  ids.forEach(function (id) { el[id] = document.getElementById(id); });
  var out = document.getElementById('results');
  if (!out || ids.some(function (id) { return !el[id]; })) return;

  function num(node) {
    var v = parseFloat(String(node.value).replace(',', '.'));
    return isFinite(v) && v >= 0 ? v : 0;
  }

  // Money is formatted without a currency symbol on purpose: the trainer's
  // currency is unknown, and guessing one would put a wrong unit on every
  // figure. The page says "in your currency" once, next to the first input.
  function money(v) {
    return (Math.round(v * 100) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  // Hours went through the same formatter as money for one reason: without it
  // they printed with a JavaScript dot while every money figure beside them
  // used the reader's locale separator, so a Croatian visitor saw "1.67 h"
  // next to "24,00". Two decimal conventions in one table reads as a bug.
  function hours2(v) {
    return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function calc() {
    var rate = num(el.rate);
    var minutes = num(el.length) + num(el.prep) + num(el.travel) + num(el.messaging) + num(el.admin);
    var hours = minutes / 60;
    var realHourly = hours > 0 ? rate / hours : 0;

    var block = Math.max(1, Math.round(num(el.blockSize)));
    var discount = Math.min(100, num(el.discount));
    var listTotal = rate * block;
    var packageTotal = listTotal * (1 - discount / 100);
    var perSession = block > 0 ? packageTotal / block : 0;
    var given = listTotal - packageTotal;
    var packageHourly = hours > 0 ? perSession / hours : 0;

    var rows = [
      ['Time you actually spend per session',
       minutes + ' min' + (minutes !== 60 ? ' (' + hours2(Math.round(hours * 100) / 100) + ' h)' : ''),
       'The session plus everything around it.'],
      ['What that hour really pays', money(realHourly) + ' / hour',
       'Your headline rate divided by the time the session actually costs you.'],
      ['Block of ' + block + ' at list price', money(listTotal), ''],
      ['Block of ' + block + ' at ' + (Math.round(discount * 10) / 10) + '% off', money(packageTotal),
       'Per session: ' + money(perSession)],
      ['What the discount gives away', money(given),
       given > 0 ? 'Over the block. Ask what it buys — cash up front, or commitment.' : 'No discount applied.'],
      ['Real hourly rate inside the package', money(packageHourly) + ' / hour',
       'This is the number to compare against what you would accept.']
    ];

    var html = '<div class="table-scroll"><table><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r[0] + '</td><td><strong>' + r[1] + '</strong>' +
              (r[2] ? '<br><span style="color:#6b7280;font-size:14px">' + r[2] + '</span>' : '') +
              '</td></tr>';
    });
    html += '</tbody></table></div>';

    if (rate > 0 && minutes > num(el.length)) {
      var lost = rate - realHourly;
      if (lost > 0.005) {
        html += '<p style="margin-top:14px">Charging ' + money(rate) +
          ' for the session but spending ' + minutes + ' minutes on it means the unpaid ' +
          (minutes - num(el.length)) + ' minutes cost you ' + money(lost) +
          ' of every hour. That is not an argument for charging more — it is the number to know ' +
          'before you agree to a discount on top of it.</p>';
      }
    }

    out.innerHTML = html;
  }

  ids.forEach(function (id) {
    el[id].addEventListener('input', calc);
    el[id].addEventListener('change', calc);
  });
  calc();
})();
