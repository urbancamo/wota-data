## Requirements

This is the specification for a Cluster server. This is a telnet server that accepts
connections on port 7300. The server should be written using the Node.JS net module.
It can use the existing database access routines to retrieve new spots.

This server should work the same as the SOTA Cluster Server but display WOTA spots instead.
Here is the specification for the SOTA server for reference:

The SOTA Cluster is a DXcluster look-alike but instead of taking spots from its users 
like DXcluster, SOTA Cluster is fed entirely from the same spot source as SOTAwatch. 
What this means is it is a duplicate of the spots on SOTAwatch however as the output 
format looks liek DXcluster it is easy to integrate this with the many logging programs
in use. I know that it integrates with Windows, Mac and Linux logging programs. Those 
who have set their logging program to control their radios can point and click on the spots
from the SOTA Cluster feed and have their station rigs tuned to the spot frequency.

The cluster can be found at the following address & port number “cluster.sota.org.uk 7300”.
Put those numbers into your logging program to make use of the feed. The cluster uses a simple
raw network protocol so you can connect direct from a console, this is how I use it here and 
on Linux I use nc like this “nc cluster.sota.org.uk 7300”. You need to provide your callsign
but you don’t need to provide a password.

The following commands are supported:

`sh/dx` - this shows the last 25-50 SOTA spots received.
`sh/users` - this shows the current user list
`ping5` - this causes the cluster to send you a prompt every 5 minutes
`ping1` - as ping5 but the prompt is sent every minute

`ping5` and `ping1` are useful for people with home routers that shutdown 
connections when there has not been any traffic for a while on the link. 
i.e. if there are no spots for an hour, your home router my silently close 
the connection and you would not know. Use a ping5/ping1 in conjunction with
your program’s KEEPALIVE connection timer.

Here is a typical login screen:

```someone@somebox:~$ nc cluster.sota.org.uk 7300```


```Welcome to the MM0FMF SOTA Cluster
This is version 8.10 built 14th July 2025



Set your keepalive pings to no less than 15mins

login: gm3pyu

GM3PYU de MM0FMF sota_cluster >
DX de CT2GSN:    14185.0  CT2GSN/P     CT/TM-039                      1315Z
DX de S57MS:     50153.0  S57MS/P      S5/PK-002                      1311Z
DX de G4OBK:     10122.0  F/G4OBK/P    F/MC-183                       1311Z
DX de DL6GCA:     7028.0  DL6GCA/P     DM/HE-097                      1309Z
DX de DH2ID:     14282.0  DH2ID/P      DM/BW-639                      1304Z
DX de G4OBK:     14062.0  F/G4OBK/P    F/MC-183                       1302Z
DX de HB9EVF:    21061.0  HB9EVF/P     HB/ZH-017                      1302Z
DX de HB9EVF:    10123.0  HB9EVF/P     HB/ZH-017                      1249Z
DX de S52AU:      7029.3  S52AU/P      S5/CP-005                      1315Z
DX de G4OBK:      7032.0  F/G4OBK/P    F/MC-183                       1316Z
DX de S57MS:     28360.0  S57MS/P      S5/PK-002                      1318Z
DX de S57MS:     14307.0  S57MS/P      S5/PK-002                      1325Z
DX de CT2GSN:    14185.0  CT2GSN/P     CT/TM-039                      1327Z
DX de F6HBI:    145500.0  F6HBI/P      F/AM-313                       1331Z

GM3PYU de MM0FMF sota_cluster >
```

And here is the current user list.

```
GM3PYU de MM0FMF sota_cluster >
sh/users
Node         Callsigns

MM0FMF       ON6ZQ        DO1ZL        2M0RVZ       HB9HBV       IV3DXW-2
ON6ZQ        W4GO         VE3HYK       VE2KVU       PA0B
PA7RA        W0CP         WB6POT       OK2PDT       HB9HDC
KK1W         K5CPR        GI4ONL       VE3VRW       W1WRA
VE3VRW       VE3VRW       GI0AZA       VE3VRW       PF2X
CT1DRB       CT1DRB       AF9W         GM3PYU
GM3PYU de MM0FMF sota_cluster >
```

Also note the following information from the SOTA Cluster developer:

There’s a host of stuff listening for client connections and handling various tasks 
(sh/dx sh/users etc.) And finally there’s a thread that sleeps for a minute, 
checks to see if the API says “shit has happened” and gets the new spots,
faffs about with the format of the data then runs down every collected client and spews 
all the new spots to them.

There’s plenty of exception handling around calls that can fail and that means it has
run for a very long time because the exception handlers catch the crashing things! 
I think the longest uptime is about 9months. Normally I need to reboot the server 
because of updates etc. before that.

## Implementation Notes

Here's what was implemented:

New file: server/cluster/spotCache.ts
- Centralized spot cache holding up to 100 spots in memory
- Retry logic with exponential backoff (1s → 2s → 5s → 10s → 30s)
- Database failures are transparent to users - cache keeps serving last known spots
- Single point of database access for spots

Changes to existing files:
- types.ts: Added lastSeenSpotId to track which spots each client has received
- client.ts: Initialize lastSeenSpotId to 0 for new clients
- spotPoller.ts: Uses cache instead of direct DB calls, skips already-seen spots per client
- commands.ts: sh/dx and sendInitialSpots now use the cache (synchronous), tracks lastSeenSpotId
- index.ts: Updated to match synchronous sendInitialSpots

How it works:
1. On startup, cache initializes with 100 recent spots (with retries)
2. Poller fetches new spots every 5s and adds to cache
3. When client logs in, they get spots from cache and lastSeenSpotId is set
4. When poller broadcasts new spots, it skips any the client already received
5. Manual sh/dx commands also read from cache (instant, no DB wait)
6. If DB fails, users see cached spots and retries happen silently in background                                                                                        
                                