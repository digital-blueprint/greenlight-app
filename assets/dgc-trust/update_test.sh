#!/usr/bin/env bash

set -e

DIR="$( cd "$( dirname "$0" )" && pwd )"
TRUST_DIR="${DIR}/test"
DGC_TRUST_URL="https://dgc-trusttest.qr.gv.at"
DCC_RULES_URL="https://digital-blueprint.github.io/dcc-at-rule-sets/sets"
RULE_SET="${1:-TUGRAZ}"

mkdir -p "${TRUST_DIR}"
curl --silent --fail "${DCC_RULES_URL}/${RULE_SET}.json" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/rules.json"
curl --silent --fail "${DGC_TRUST_URL}/trustlist" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/trustlist"
curl --silent --fail "${DGC_TRUST_URL}/trustlistsig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/trustlistsig"
curl --silent --fail "${DGC_TRUST_URL}/rules" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/rules"
curl --silent --fail "${DGC_TRUST_URL}/rulessig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/rulessig"
curl --silent --fail "${DGC_TRUST_URL}/valuesets" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/valuesets"
curl --silent --fail "${DGC_TRUST_URL}/valuesetssig" -o "${DIR}/_temp" && mv "${DIR}/_temp" "${TRUST_DIR}/valuesetssig"
