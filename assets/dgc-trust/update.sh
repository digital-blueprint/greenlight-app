#!/usr/bin/env bash

set -e

DIR="$( cd "$( dirname "$0" )" && pwd )"
TRUST_DIR="${DIR}/prod"
DGC_TRUST_URL="https://dgc-trust.qr.gv.at"
DCC_RULES_URL="https://digital-blueprint.github.io/dcc-at-rule-sets/sets"
RULE_SET="${1:-TUGRAZ}"
TRUST_FILES=("trustlist" "trustlistsig" "rules" "rulessig" "valuesets" "valuesetssig")

TEMP_DIR="${TRUST_DIR}/_temp"
rm -Rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"
curl --silent --fail "${DCC_RULES_URL}/${RULE_SET}.json" -o "${TEMP_DIR}/rules.json"
for name in ${TRUST_FILES[*]}; do
    curl --silent --fail "${DGC_TRUST_URL}/${name}" -o "${TEMP_DIR}/${name}"
done
mv "${TEMP_DIR}/"* "${TRUST_DIR}"
rm -Rf "${TEMP_DIR}"