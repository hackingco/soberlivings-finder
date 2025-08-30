#!/bin/bash
# Generate self-signed SSL certificate for staging

SSL_DIR="./nginx/ssl-staging"
mkdir -p "$SSL_DIR"

# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/staging.key" \
    -out "$SSL_DIR/staging.crt" \
    -subj "/C=US/ST=State/L=City/O=SoberLivings/CN=staging.soberlivings.com"

echo "✅ Self-signed SSL certificate generated for staging"
echo "   Certificate: $SSL_DIR/staging.crt"
echo "   Private Key: $SSL_DIR/staging.key"