import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPGreenlightLitElement from "./dbp-greenlight-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';
import {CheckInPlaceSelect} from '@dbp-toolkit/check-in-place-select';


class AcquireTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.hasValidProof = false;
    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-inline-notification': InlineNotification,
          'dbp-check-in-place-select': CheckInPlaceSelect, //TODO replace with correct place selector
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            hasValidProof: { type: Boolean, attribute: false },
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    this._i18n.changeLanguage(this.lang);
                    break;
            }
            //console.log("######", propName);
        });

        super.update(changedProperties);
    }

    async checkForValidProof() { //TODO show loading spinner until the function has finished
        let responseData = await this.sendGetCertificatesRequest();
        let status = responseData.status;
        let responseBody = await responseData.clone().json();

        if (status === 200) {
            if (responseBody['hydra:totalItems'] > 0) {
                this.isActivated = true;
                this.activationEndTime = responseBody['hydra:member'][0]['validFor'];
                this.identifier = responseBody['hydra:member'][0]['identifier'];
                console.log('Found a valid 3G proof for the current user.');
                this.hasValidProof = true;
            }
        } else {
            //TODO
            this.hasValidProof = false;
        }
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getRadioAndCheckboxCss()}

            #manual-proof-checkmark {
                margin-top: 9px;
            }

            .border {
                margin-top: 2rem;
                margin-bottom: 2rem;
                border-top: 1px solid black;
            }

            .notification-wrapper {
                /*margin-top: 1.2em;*/
                margin-bottom: 1.2em;
            }

            .checkbox-wrapper {
                margin-top: 1.5rem;
            }
        
            .confirm-btn {
                margin-top: 1.5rem;
                display: flex;
                justify-content: space-between;
            }

            .field {
                margin-top: 1rem;
            }

            .int-link-internal{
                transition: background-color 0.15s, color 0.15s;
                border-bottom: 1px solid rgba(0,0,0,0.3);
            }
            
            .int-link-internal:hover{
                background-color: black;
                color: white;
            }
            
            .int-link-internal:after{
                content: "\\00a0\\00a0\\00a0";
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%228.6836mm%22%20width%3D%225.2043mm%22%20version%3D%221.1%22%20xmlns%3Acc%3D%22http%3A%2F%2Fcreativecommons.org%2Fns%23%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20viewBox%3D%220%200%2018.440707%2030.768605%22%3E%3Cg%20transform%3D%22translate(-382.21%20-336.98)%22%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23000%3Bstroke-linecap%3Around%3Bstroke-miterlimit%3A10%3Bstroke-width%3A2%3Bfill%3Anone%22%20d%3D%22m383.22%20366.74%2016.43-14.38-16.43-14.37%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E');
                background-size: 73%;
                background-repeat: no-repeat;
                background-position: center center;
                margin: 0 0 0 3px;
                padding: 0 0 0.25% 0;
                animation: 0.15s linkIconOut;
                font-size: 103%;
            }
            
            .int-link-internal:hover::after{
                content: "\\00a0\\00a0\\00a0";
                background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3Ardf%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2F02%2F22-rdf-syntax-ns%23%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%228.6836mm%22%20width%3D%225.2043mm%22%20version%3D%221.1%22%20xmlns%3Acc%3D%22http%3A%2F%2Fcreativecommons.org%2Fns%23%22%20xmlns%3Adc%3D%22http%3A%2F%2Fpurl.org%2Fdc%2Felements%2F1.1%2F%22%20viewBox%3D%220%200%2018.440707%2030.768605%22%3E%3Cg%20transform%3D%22translate(-382.21%20-336.98)%22%3E%3Cpath%20style%3D%22stroke-linejoin%3Around%3Bstroke%3A%23FFF%3Bstroke-linecap%3Around%3Bstroke-miterlimit%3A10%3Bstroke-width%3A2%3Bfill%3Anone%22%20d%3D%22m383.22%20366.74%2016.43-14.38-16.43-14.37%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E');
                background-size: 73%;
                background-repeat: no-repeat;
                background-position: center center;
                margin: 0 0 0 3px;
                padding: 0 0 0.25% 0;
                animation: 0s linkIconIn;
                font-size: 103%;
            }

            @media only screen
            and (orientation: portrait)
            and (max-width:768px) {
                
                .confirm-btn {
                    display: flex;
                    flex-direction: column;
                    row-gap: 10px;
                }
            }
        `;

    }

    render() {
        const i18n = this._i18n;
        if (this.isLoggedIn() && !this.isLoading() && !this.hasValidProof) {
            this.checkForValidProof().then(r =>  console.log('3G proof validation done'));
        }

        return html`

            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
            
                 <div class="notification-wrapper">
                    ${ this.hasValidProof ?
                        html`<dbp-inline-notification type="success" body="${i18n.t('acquire-ticket.valid-proof-found-message')}"></dbp-inline-notification>`
                        : html`
                            <dbp-inline-notification type="warning" 
                                body="${i18n.t('acquire-ticket.no-proof-found-message')}
                                <a href='activate-3g-proof' title='${i18n.t('acquire-ticket.activation-link')}' target='_self' class='int-link-internal'>
                                    <span>${i18n.t('acquire-ticket.activation-link')}</span>.
                                </a>"
                            </dbp-inline-notification>`
                    }
                </div>
                
                <h2>${i18n.t('acquire-ticket.title')}</h2>
                <div>
                    <p class="">${i18n.t('acquire-ticket.description')}</p>
                    <slot name="additional-information">
                        <p>
                            ${i18n.t('acquire-ticket.additional-information')}
                            <a href="activate-3g-proof" title="${i18n.t('acquire-ticket.activation-link')}" target="_self" class="int-link-internal"> 
                                <span>${i18n.t('acquire-ticket.activation-link')} </span>
                            </a>
                            ${i18n.t('acquire-ticket.additional-information-2')}
                        </p>
                    </slot>
                </div>

                <div class="border"></div>
                    
                <div class="field">
                    <label class="label">${i18n.t('acquire-ticket.place-select-title')}</label>
                    <div class="control">
                        <dbp-check-in-place-select subscribe="auth" lang="${this.lang}" entry-point-url="${this.entryPointUrl}" @change="${(event) => {}}"></dbp-check-in-place-select>
                    </div>
                </div>

                <div class="checkbox-wrapper ${classMap({'hidden': this.hasValidProof})}">
                    <label id="" class="button-container">${i18n.t('acquire-ticket.manual-proof-text')}
                        <input type="checkbox" id="manual-proof-mode" name="manual-proof-mode" value="manual-proof-mode">
                        <span class="checkmark" id="manual-proof-checkmark"></span>
                    </label>
                </div>

                <div class="confirm-btn">
                    <dbp-loading-button ?disabled="${this.loading}" type="is-primary" value="${i18n.t('acquire-ticket.confirm-button-text')}" @click="${(event) => {}}" title="${i18n.t('acquire-ticket.confirm-button-text')}"></dbp-loading-button>
                    ${!this.hasValidProof ? html`<dbp-loading-button ?disabled="${this.loading}" value="${i18n.t('acquire-ticket.activation-link')}" @click="${(event) => {}}" title="${i18n.t('acquire-ticket.activation-link')}"></dbp-loading-button>` : ``}
                </div>
                  

            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-acquire-ticket', AcquireTicket);