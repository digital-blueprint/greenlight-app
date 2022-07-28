import '@webcomponents/scoped-custom-element-registry';
import {AppShell} from '@dbp-toolkit/app-shell';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Translated} from '@dbp-toolkit/common/src/translated';
import {Logo} from '@tugraz/web-components';
import {Icon} from '@dbp-toolkit/common';

commonUtils.defineCustomElement('dbp-greenlight', AppShell);
commonUtils.defineCustomElement('dbp-translated', Translated);
commonUtils.defineCustomElement('dbp-icon', Icon);
commonUtils.defineCustomElement('tug-logo', Logo);
