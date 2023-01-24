#!/usr/bin/env bash
# This script updates the trust data (trustlist/valuesets/rules) in place.
#
# The first arugment is the ID of the rule set that should be used,
# see https://github.com/digital-blueprint/dcc-at-rule-sets for details
#
# It's recommended to run this every hour in a cron job

set -e

DIR="$( cd "$( dirname "$0" )" && pwd )"

RULE_SET="${1:-TUGRAZ}"

"${DIR}/local/@digital-blueprint/greenlight-app/dgc-trust/update.sh" "${RULE_SET}"