#!/bin/sh
set -e

# ./uploads and ./logs are bind-mounted from the host. Docker creates missing
# bind-mount source dirs as root:root 755, which shadows the appuser ownership
# baked into the image — appuser then can't mkdir new subdirs (e.g. logos/,
# payment-icons/) under them. Fix ownership on every start, then drop to appuser.
mkdir -p /app/uploads/logos /app/uploads/payment-icons /app/uploads/proofs /app/logs
chown -R appuser:appgroup /app/uploads /app/logs

exec gosu appuser "$@"
