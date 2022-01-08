import {AppShell} from '@dbp-toolkit/app-shell';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Translated} from "@dbp-toolkit/common/src/translated";
import {TUGrazLogo} from "@dbp-toolkit/app-shell/src/tugraz-logo";
import {Icon} from '@dbp-toolkit/common';

commonUtils.defineCustomElement('dbp-greenlight', AppShell);
commonUtils.defineCustomElement('dbp-translated', Translated);
commonUtils.defineCustomElement('dbp-tugraz-logo', TUGrazLogo);
commonUtils.defineCustomElement('dbp-icon', Icon);