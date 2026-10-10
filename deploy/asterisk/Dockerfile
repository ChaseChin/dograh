# Dograh's Asterisk gateway.
#
# Asterisk 22 with the modules this integration needs already present: chan_pjsip
# for the carrier trunks, res_ari + app_stasis + res_stasis for Dograh to drive
# calls, and chan_websocket + res_websocket_client to carry the audio out to the
# API over a WebSocket. They are checked at startup rather than assumed — see
# entrypoint.sh — because an image that lacks one of them produces a gateway
# that answers calls and then goes silent, with nothing in the log to say why.
FROM andrius/asterisk:22

COPY entrypoint.sh /usr/local/bin/dograh-gateway-entrypoint.sh
RUN chmod 0755 /usr/local/bin/dograh-gateway-entrypoint.sh

# Prepends the config render and the reload watcher to the base image's
# entrypoint, which is left to do its own job (adapting uid/gid for the mounted
# volume). It is invoked, not reimplemented, so a change upstream still applies.
ENTRYPOINT ["/usr/local/bin/dograh-gateway-entrypoint.sh"]

# The base image's command, kept verbatim: Asterisk runs in the foreground as
# PID 1, so the container lives exactly as long as the gateway does.
CMD ["/usr/sbin/asterisk", "-vvvdddf", "-T", "-W", "-U", "asterisk", "-p"]