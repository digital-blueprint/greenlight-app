#!/usr/bin/bash

set -e

DIR="$( cd "$( dirname "$0" )" && pwd )"

DGC_TRUST_URL="https://dgc-trust.qr.gv.at"

curl --silent --fail "${DGC_TRUST_URL}/trustlist" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${DIR}/trustlistsig"
curl --silent --fail "${DGC_TRUST_URL}/trustlistsig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${DIR}/trustlistsig"
curl --silent --fail "${DGC_TRUST_URL}/rules" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${DIR}/rules"
curl --silent --fail "${DGC_TRUST_URL}/rulessig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${DIR}/rulessig"
curl --silent --fail "${DGC_TRUST_URL}/valuesets" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${DIR}/valuesets"
curl --silent --fail "${DGC_TRUST_URL}/valuesetssig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${DIR}/valuesetssig"
