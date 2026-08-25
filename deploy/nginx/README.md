# nginx configuration

A copy of what is actually running on the production host, kept here so the
server config is reviewable in a diff instead of only readable over SSH.

**This directory is a copy, not the source of truth.** nginx reads
`/etc/nginx/sites-available/treniko` and `/etc/nginx/snippets/`. Editing a file
here changes nothing until it is copied across and nginx is reloaded. Copy in
both directions when either side changes, or this becomes documentation that
lies.

| Here | On the host |
|---|---|
| `treniko.conf` | `/etc/nginx/sites-available/treniko` (symlinked from `sites-enabled/`) |
| `snippets/treniko-security.conf` | `/etc/nginx/snippets/treniko-security.conf` |
| `snippets/treniko-csp.conf` | `/etc/nginx/snippets/treniko-csp.conf` |

## Applying a change

```bash
scp deploy/nginx/treniko.conf          root@HOST:/etc/nginx/sites-available/treniko
scp deploy/nginx/snippets/*.conf       root@HOST:/etc/nginx/snippets/

ssh root@HOST 'cp /etc/nginx/sites-available/treniko /root/nginx-backups/treniko.$(date +%F-%H%M%S).conf'
ssh root@HOST 'nginx -t'               # must pass — reload only if it does
ssh root@HOST 'systemctl reload nginx' # reload, not restart: no dropped connections

node frontend/scripts/check-headers.mjs   # then verify, do not assume
```

Backups live in `/root/nginx-backups/`. Rollback is copying one back and
reloading.

## Two things that will bite

**`nginx -t` is not optional.** A regex location containing `{` or `}` must be
quoted — `location ~ "^/assets-static/[a-z]+\.[0-9a-f]{10}\.(css|js)$"` — because
nginx otherwise reads the `{` as the start of a block and the directive ends
mid-pattern. This exact mistake was made here and `nginx -t` caught it before
the reload; without the test the site would have gone down.

**`add_header` does not inherit.** A location with its own `add_header`
discards every one declared in the enclosing block. That is why the security
headers are `include`d inside each location rather than declared once at server
level, and why adding a new location means adding both `include` lines to it.

## Why /api has no security headers here

The Express app already sends a complete helmet header set on every API
response — HSTS, `X-Frame-Options: DENY`, and a much stricter
`default-src 'none'` CSP appropriate to JSON. Adding a second copy from nginx
would emit duplicate headers, and where the two disagree (`SAMEORIGIN` here
against `DENY` there) the result is ambiguous rather than merely redundant.

`location /api` is therefore the one place these snippets are deliberately not
included. Verified: no duplicate header names on an API response.

## The one weak directive

`style-src` carries `'unsafe-inline'`, and that is a real gap rather than an
oversight. React writes inline `style` attributes during render, and a
statically built bundle has no server-side step in which to mint a per-response
nonce. Removing it needs either request-time nonce injection or the elimination
of every inline style in the application.

`script-src` has no such escape hatch — no `'unsafe-inline'`, no hashes, no
nonces. That is only possible because the page-view beacon was moved out of the
content pages into `/assets-static/beacon.<hash>.js`.
