#!/usr/bin/bash

set -e

DIR="$( cd "$( dirname "$0" )" && pwd )"
PROD_DIR="${DIR}/prod"
DGC_TRUST_URL="https://dgc-trust.qr.gv.at"


mkdir -p "${PROD_DIR}"
curl --silent --fail "${DGC_TRUST_URL}/trustlist" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${PROD_DIR}/trustlist"
curl --silent --fail "${DGC_TRUST_URL}/trustlistsig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${PROD_DIR}/trustlistsig"
curl --silent --fail "${DGC_TRUST_URL}/rules" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${PROD_DIR}/rules"
curl --silent --fail "${DGC_TRUST_URL}/rulessig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${PROD_DIR}/rulessig"
curl --silent --fail "${DGC_TRUST_URL}/valuesets" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${PROD_DIR}/valuesets"
curl --silent --fail "${DGC_TRUST_URL}/valuesetssig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${PROD_DIR}/valuesetssig"
