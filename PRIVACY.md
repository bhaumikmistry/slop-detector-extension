# Privacy Policy — Slop Detector

**Last updated:** 7 August 2026

## The short version

Slop Detector collects nothing, stores nothing, and sends nothing anywhere.

Every part of it runs locally in your browser tab. There is no server, no
account, no analytics, and no telemetry of any kind. The extension has no way to
transmit data even if it wanted to — it requests no network permissions and the
shipped code contains no networking calls at all.

## What the extension does

When you view a post on `x.com` or `twitter.com`, Slop Detector reads the text of
that post from the page you are already looking at, runs it through a set of
pattern-matching rules on your own machine, and displays a small score badge next
to it. Clicking the badge shows which patterns matched.

That is the whole of it. The post text is held in memory only for as long as it
takes to score it, and is never written to disk, saved to browser storage, or
transmitted.

## What is collected

Nothing.

- **No personal information.** Not your name, email, account, or identity.
- **No browsing history.** The extension does not record which posts you view,
  which accounts you visit, or anything else about your session.
- **No content.** Post text is scored in memory and discarded. It is never
  stored or sent.
- **No analytics or telemetry.** No usage statistics, no crash reports, no
  fingerprinting, no advertising identifiers.
- **No cookies.** The extension sets none and reads none.

## What is shared or sold

Nothing, because nothing is collected. No data is shared with the developer,
with any third party, or with any service. Nothing is sold, transferred, or used
for advertising, credit assessment, or any purpose unrelated to the extension's
single function.

## Permissions

The extension requests **no Chrome permissions at all** — its `permissions` and
`host_permissions` lists are both empty.

It declares two content-script matches, `https://x.com/*` and
`https://twitter.com/*`, which are what allow it to read post text on those sites
and place a badge next to each post. It cannot run on, read, or affect any other
website.

## Verifying this yourself

You do not have to take our word for any of the above. The extension is open
source under the MIT license:

**https://github.com/bhaumikmistry/slop-detector-extension**

The claims on this page are mechanically checkable against the shipped build:

```bash
# No networking, no storage, no dynamic code execution:
grep -c "fetch(\|XMLHttpRequest\|WebSocket\|sendBeacon" dist/content.js   # 0
grep -c "localStorage\|sessionStorage\|indexedDB\|chrome.storage" dist/content.js  # 0
grep -c "eval(\|new Function" dist/content.js                            # 0
```

The scoring engine is a separate open-source package,
[`@slop-detector/slop-detector`](https://www.npmjs.com/package/@slop-detector/slop-detector),
which is likewise dependency-free and makes no network calls.

## Children's privacy

The extension collects no data from anyone, including children under 13.

## Changes to this policy

If the extension's behaviour ever changes in a way that affects this policy, the
policy will be updated here and the change recorded in the repository's commit
history, which is public and timestamped. Any future version that collected data
would require new permissions, which Chrome would surface to you before the
update installed.

## Contact

Questions or concerns: open an issue at
**https://github.com/bhaumikmistry/slop-detector-extension/issues**
