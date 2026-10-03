# Nginx deployment

Copy \`security-headers.conf\` to:

\`\`\`
/etc/nginx/snippets/lingo-security-headers.conf
\`\`\`

Then install \`lingo-store.conf\` in the active Nginx configuration and mount TLS certificates at:

\`\`\`
/etc/nginx/tls/fullchain.pem
/etc/nginx/tls/privkey.pem
\`\`\`

Validate with \`nginx -t\` before reload. The repository configuration is a template; it does not install or enable Nginx automatically.
