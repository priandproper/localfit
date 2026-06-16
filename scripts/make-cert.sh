#!/usr/bin/env bash
#
# make-cert.sh — generate a locally-trusted TLS cert for the localfit backend.
#
# Usage:
#   ./scripts/make-cert.sh
#
# Produces:
#   certs/localfit.pem      (leaf certificate)
#   certs/localfit-key.pem  (leaf private key)
#   certs/rootCA.pem        (local CA — install on the iPhone) [openssl path only]
#
# The cert covers Aniruddhas-Mac-mini.local, 10.0.0.105, and localhost so the
# hosted Pages build (HTTPS) can reach the backend by Bonjour name or LAN IP.
# Prefers mkcert if installed; otherwise falls back to openssl (preinstalled on
# macOS). certs/ is gitignored — these never get committed.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTS="$ROOT/certs"
mkdir -p "$CERTS"

CERT_FILE="$CERTS/localfit.pem"
KEY_FILE="$CERTS/localfit-key.pem"

HOST_DNS="Aniruddhas-Mac-mini.local"
HOST_IP="10.0.0.105"

if command -v mkcert >/dev/null 2>&1; then
  echo "==> Using mkcert"
  mkcert -install
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "$HOST_DNS" "$HOST_IP" localhost
  echo
  echo "Done. Leaf cert: $CERT_FILE"
  echo
  echo "Next steps for the iPhone:"
  echo "  1. Find the mkcert root CA:  mkcert -CAROOT"
  echo "     (it is the rootCA.pem in that folder)"
  echo "  2. AirDrop that rootCA.pem to the iPhone and install the profile"
  echo "     (Settings -> General -> VPN & Device Management)."
  echo "  3. Enable full trust: Settings -> General -> About ->"
  echo "     Certificate Trust Settings -> turn ON for the mkcert root."
  exit 0
fi

echo "==> mkcert not found; falling back to openssl"

CA_CERT="$CERTS/rootCA.pem"
CA_KEY="$CERTS/rootCA-key.pem"

# 1) Local certificate authority (10 years).
if [[ ! -f "$CA_CERT" || ! -f "$CA_KEY" ]]; then
  echo "==> Creating local CA"
  openssl genrsa -out "$CA_KEY" 2048
  openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 \
    -subj "/CN=localfit local CA" -out "$CA_CERT"
fi

# 2) Leaf key + CSR.
echo "==> Creating leaf cert"
openssl genrsa -out "$KEY_FILE" 2048

EXT_FILE="$(mktemp)"
cat > "$EXT_FILE" <<EOF
subjectAltName = DNS:${HOST_DNS}, IP:${HOST_IP}, DNS:localhost
extendedKeyUsage = serverAuth
EOF

CSR_FILE="$(mktemp)"
openssl req -new -key "$KEY_FILE" -subj "/CN=${HOST_DNS}" -out "$CSR_FILE"

# 3) Sign the leaf with the CA. 800 days < iOS 825-day cap.
openssl x509 -req -in "$CSR_FILE" -CA "$CA_CERT" -CAkey "$CA_KEY" \
  -CAcreateserial -days 800 -sha256 -extfile "$EXT_FILE" -out "$CERT_FILE"

rm -f "$EXT_FILE" "$CSR_FILE"

echo
echo "Done."
echo "  Leaf cert: $CERT_FILE"
echo "  Leaf key:  $KEY_FILE"
echo "  Root CA:   $CA_CERT"
echo
echo "Next steps for the iPhone:"
echo "  1. AirDrop $CA_CERT to the iPhone and install the profile"
echo "     (Settings -> General -> VPN & Device Management)."
echo "  2. Enable full trust: Settings -> General -> About ->"
echo "     Certificate Trust Settings -> turn ON for 'localfit local CA'."
echo
echo "On the Mac, trust the root too (so Safari/Chrome accept it):"
echo "  sudo security add-trusted-cert -d -r trustRoot \\"
echo "    -k /Library/Keychains/System.keychain $CA_CERT"
