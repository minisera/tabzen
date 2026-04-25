# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Tab Zen, **please do not open a public GitHub issue**. Instead, report it privately so we can address it before public disclosure.

### Preferred channel

- Use **[GitHub's private vulnerability reporting](https://github.com/minisera/tabzen/security/advisories/new)** (Security tab → Report a vulnerability).

### What to include

- Affected version (e.g. `v1.0.1`)
- Steps to reproduce
- Impact assessment (what an attacker could achieve)
- Suggested mitigation, if any

### Response expectations

- Acknowledgement: within **1 week**
- Fix or mitigation plan: within **2 weeks** of acknowledgement (best effort; this is a personal-OSS project)
- Public disclosure: coordinated with the reporter via a [GitHub Security Advisory](https://github.com/minisera/tabzen/security/advisories)

## Supported Versions

Only the latest released version on the Chrome Web Store receives security updates. Previous versions are not patched.

| Version         | Supported |
| --------------- | --------- |
| latest released | ✅        |
| older           | ❌        |

## Scope

In scope:

- Vulnerabilities in code shipped to users (extension runtime)
- Manifest / permission misuse that affects user privacy
- Storage handling that could leak user data

Out of scope:

- Build-tool vulnerabilities that do not affect the published extension (these are tracked via Dependabot for hygiene but are not user-facing)
- Issues in upstream dependencies — please report those to the relevant projects (npm, GitHub Advisory Database, etc.)
- Findings that require physical access to the user's device
