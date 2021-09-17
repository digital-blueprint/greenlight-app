This directory contains the trustlist/businessrules/valuesets from
https://dgc-trust.qr.gv.at

The update.sh script fetches the latest versions and should be called
in a cron job regularly.

## Overrides

rulesoverrides.*.json:

* For each entry in "remove", every rule matching all specified fields will be removed
* Each each entry in "add" the rule will be added to the set of rules (before filtering)