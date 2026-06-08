---
description: Run comprehensive security review
subtask: true
---

# Security Review: $ARGUMENTS

OWASP Top 10: injection, broken auth, data exposure, XXE, broken access, misconfiguration, XSS, insecure deserialization, known vulns (`npm audit`), insufficient logging.

Extra: secrets in code, env handling, CORS, rate limiting, CSRF, secure cookies.

Report: CRITICAL (blocker) / HIGH (fix before release) / Recommendations.
