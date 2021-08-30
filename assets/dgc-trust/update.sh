#!/usr/bin/bash

set -e

DGC_TRUST_URL="https://dgc-trust.qr.gv.at"

curl --fail "${DGC_TRUST_URL}/trustlist" -o ./trustlist
curl --fail "${DGC_TRUST_URL}/trustlistsig" -o ./trustlistsig
curl --fail "${DGC_TRUST_URL}/rules" -o ./rules
curl --fail "${DGC_TRUST_URL}/rulessig" -o ./rulessig
curl --fail "${DGC_TRUST_URL}/valuesets" -o ./valuesets
curl --fail "${DGC_TRUST_URL}/valuesetssig" -o ./valuesetssig
