# Outreach tracker

One row per person in `OUTREACH_TRACKER.csv`. Not a CRM, and it should never
become one — the moment it needs a tool, the volume is wrong.

## Columns

| Column | Meaning |
|---|---|
| `date` | When you sent the first message (YYYY-MM-DD) |
| `name_or_handle` | Whatever identifies them to you |
| `channel` | `instagram` · `facebook` · `linkedin` · `email` · `in-person` |
| `source_of_lead` | Where you found them. This is the column that eventually tells you which rooms are worth being in |
| `personalised_note` | The specific thing you said. **If you cannot fill this in, do not send the message** |
| `status` | `contacted` → `replied` → `interested` → `registered` → `activated` → `active`, or `declined` / `no_reply` |
| `replied` · `registered` · `verified` · `added_client` | `yes` / `no` |
| `notes` | What they actually said. The most valuable column in the file |
| `follow_up_due` | One follow-up, 5–7 days out, only if they read it and did not reply. Blank after that — never a second |

## The weekly check

Compare this file against the admin funnel. If five people here say
`registered` and the funnel shows two, that gap is a broken registration to
investigate, not a bookkeeping slip.

## What not to do

- No second follow-up.
- No message to anyone who has declined.
- No identical text to two people in the same group or thread.
- No entry you cannot personalise.

## Privacy

This file lives in a private repository and holds handles and notes about real
people. Do not publish it, do not paste it anywhere, and delete a row when
someone asks to be left alone.
