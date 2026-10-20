# Private security backport, not an upstream release

This directory contains npm `braces` 3.0.3 (MIT), with the five source-file changes
from upstream-proposed PR #87 at the exact commit in SECURITY-BACKPORT.json.
The patch is not merged or released by upstream. The local package is explicitly
named `@naturalis-historia/braces-patched`, private, and retains the base version
3.0.3. It is installed as `braces` with a root file dependency and an override so
all transitive callers resolve to this implementation. There is no postinstall
mutation and no remote Git dependency. Upstream development dependencies and
build scripts are not part of this vendored runtime manifest.

The patch rejects brace and parenthesis nesting beyond 100, limits supplied AST
walks, and detects parent-chain cycles. It does not promise arbitrary glob inputs
are safe or remove combinatorial expansion hazards; this site uses local trusted
build patterns. The site does not expose a user-supplied glob API.

`npm audit` checks the registry dependency graph and has no advisory record for
this private fork. A clean audit therefore **does not prove this backport is safe**.
The release gate separately checks the exact source hashes, every installed
resolution, normal glob behavior and adversarial nested/cyclic input in bounded
child processes. Keep those checks and the MIT licence with the fork.

Replace the local fork with an upstream release once it contains an equivalent
fix and passes the same regressions. Do not rename or bump the package merely
to avoid an audit finding. Source tarball integrity and before/after file hashes
are recorded in SECURITY-BACKPORT.json. Backport contribution: akahungryy,
https://github.com/akahungryy/braces . Original author and licence are retained.
