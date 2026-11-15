#!/bin/sh
# Login for Packshot Studio (runs when the web container starts).
# PACKSHOT_USERS="name:password,name2:password2" turns the login on (no commas or colons in passwords).
# The app is only shared on the network (PACKSHOT_BIND=0.0.0.0) when logins exist.
set -e
CONF=/etc/nginx/conf.d/auth.inc
if [ -n "$PACKSHOT_USERS" ]; then
  : > /etc/nginx/.htpasswd
  echo "$PACKSHOT_USERS" | tr ',' '\n' | while IFS=: read -r user pass; do
    [ -z "$user" ] && continue
    if [ -z "$pass" ]; then echo "Packshot Studio: user '$user' has no password" >&2; exit 1; fi
    case "$pass" in *:*) echo "Packshot Studio: the password of '$user' contains ':', which is not allowed" >&2; exit 1;; esac
    # nginx reads "{PLAIN}" passwords; the file is only inside the container, like .env on disk
    printf '%s:{PLAIN}%s\n' "$user" "$pass" >> /etc/nginx/.htpasswd
  done
  printf 'auth_basic "Packshot Studio";\nauth_basic_user_file /etc/nginx/.htpasswd;\n' > "$CONF"
  echo "Packshot Studio: login on for $(wc -l < /etc/nginx/.htpasswd) user(s)"
else
  if [ "${PACKSHOT_BIND:-127.0.0.1}" != "127.0.0.1" ]; then
    echo "Packshot Studio: refusing to share on the network without logins. Set PACKSHOT_USERS in .env" >&2
    exit 1
  fi
  : > "$CONF"
  echo "Packshot Studio: no login (only reachable on this computer)"
fi
