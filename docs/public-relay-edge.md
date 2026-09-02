# Public relay edge cutover

Buzz uses the relay URL as part of the community identity. A public deployment
therefore has two distinct address roles:

- The canonical community identity is a stable domain such as
  `wss://relay.example.edu`.
- An optional LAN transport such as `ws://10.0.0.82:3000` is only a faster path
  to the same community.

Do not configure the reverse proxy's IPv4 address as a Community URL. The edge
address can move, while the domain and the Buzz community must remain stable.
Desktop and mobile store the optional LAN address separately and preserve the
canonical domain for Host routing, authentication, invitations, and media.

## Reverse proxy contract

The public edge must:

1. Terminate TLS for the canonical domain.
2. Preserve the original `Host` header when forwarding to the origin.
3. Forward HTTP/1.1 `Upgrade: websocket` and `Connection: Upgrade` headers.
4. Route both ordinary HTTPS and WSS traffic to the same Buzz origin.
5. Return the Buzz NIP-11 document from `/` when the request sends
   `Accept: application/nostr+json`.

If the upstream edge connects to origin port 80, a minimal Caddy origin is:

```caddyfile
:80 {
    reverse_proxy 127.0.0.1:3000
}
```

Allow the edge network to reach origin TCP/80 in the host firewall. Do not
redirect origin port 80 to 443 when TLS terminates at the upstream edge.

Buzz currently owns the domain root. Additional HTTP services can be routed
under a reserved operator namespace such as `/labservices/<service>/`, while
the catch-all root continues to proxy to Buzz. Do not move Buzz itself under a
path prefix.

## Acceptance probe

Before DNS publication, test the edge IP while retaining the domain for TLS
SNI and the HTTP Host header:

```bash
node scripts/check-relay-edge.mjs \
  --url wss://relay.example.edu \
  --connect-ip 203.0.113.10
```

After DNS publication, require DNS to include the expected edge address:

```bash
node scripts/check-relay-edge.mjs \
  --url wss://relay.example.edu \
  --expected-ip 203.0.113.10
```

The probe succeeds only when all three layers pass:

- DNS resolves the canonical domain.
- HTTPS returns a Buzz NIP-11 document advertising NIP-11 and NIP-42.
- WSS returns `101 Switching Protocols` with a valid WebSocket handshake.

An HTTPS `200` combined with a WSS failure is not a usable Buzz deployment. If
the WSS probe reports HTTP 200, the edge served the normal page but stripped or
ignored the WebSocket Upgrade headers.

## Community migration

Change the existing community's primary host to the canonical domain and keep
old hosts only as temporary aliases. Do not let relay startup create a second,
empty community for the new domain. Verify event, user, and channel counts
before deleting any obsolete alias or community record.

Set runtime configuration to the canonical identity:

```dotenv
RELAY_URL=wss://relay.example.edu
BUZZ_RELAY_URL=wss://relay.example.edu
```

Client configuration then uses the same public URL plus the optional LAN
transport. A future reverse-proxy IPv4 migration only changes DNS and edge
infrastructure; it does not change client community identity.
