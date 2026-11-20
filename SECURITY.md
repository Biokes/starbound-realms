# Security Policy

## Supported versions

Starbound Realms is deployed on **Stellar testnet only**. There is no mainnet deployment and no
token with monetary value, so no real funds are at risk today. Contract bugs are still worth
reporting privately — a mint, burn, or battle bug found now is one less surprise at mainnet launch.

Fixes are applied to the contracts and code on the `main` branch; there are no versioned releases
to patch.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.** Public issues give everyone
(including an attacker) the same information at the same time.

Report privately using GitHub's private vulnerability reporting:

**<https://github.com/OlaGreat/starbound-realms/security/advisories/new>**

If the reporting form is not visible, private vulnerability reporting may not yet be enabled for
this repository — open a [GitHub Discussion](https://github.com/OlaGreat/starbound-realms/discussions)
asking a maintainer to enable it (Settings → Code security → Private vulnerability reporting),
then submit the report through the form above.

## Scope

**In scope:**

- Smart contracts under `contracts/` (`galaxy-map`, `resources`, `fleet`, `battle`)
- TypeScript SDK under `sdk/`
- Backend indexer and API under `backend/`
- Frontend under `frontend/`
- Deployment and CI configuration in this repository

**Out of scope:**

- Vulnerabilities that already require a player's Freighter wallet or private keys to be
  compromised
- Social engineering, phishing, and physical attacks
- Denial-of-service against public RPC endpoints or third-party infrastructure
- Vulnerabilities in upstream dependencies that are already reported to the dependency's own
  security process

## What to include

- The affected component (contract, SDK, backend, frontend) and the commit or deployment
- A description of the issue and its potential impact
- Steps to reproduce, or a proof of concept — testnet is sufficient
- A suggested fix, if you have one

## Response

Maintainers will acknowledge the report, confirm whether it is in scope, and work toward a fix.
Your report will be kept private until a fix is released (or until you agree otherwise), and
credit will be given in the fix's release notes unless you prefer to remain anonymous.

## Safe harbor

Good-faith security research on this repository, conducted under this policy, is considered
authorized. We will not pursue legal action against researchers who:

- Make a reasonable effort to avoid privacy violations and data destruction
- Report findings privately and promptly
- Do not exploit the issue beyond what is needed to demonstrate it
- Do not access, modify, or disrupt data that is not their own
