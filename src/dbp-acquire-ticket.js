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
import { send } from '@dbp-toolkit/common/notification';


class AcquireTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.loading = false;
        this.preselectedOption = '';
        this.preselectionCheck = true;
        this.entryPointUrl = '';
        this.showPreselectedSelector = false;
        this.hasValidProof = false;
        this.hasTicket = false;
        this.hasTicketForThisPlace = false;
        this.location = '';
        this.isCheckboxVisible = false;
        this.isCheckmarkChecked = false;
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
            loading: { type: Boolean, attribute: false },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            showPreselectedSelector: { type: String, attribute: 'show-preselected' },
            preselectedOption: { type: String, attribute: 'preselected-option' },
            hasValidProof: { type: Boolean, attribute: false },
            hasTicket: { type: Boolean, attribute: false },
            hasTicketForThisPlace: { type: Boolean, attribute: false },
            location: { type: String, attribute: false },
            isCheckboxVisible: { type: Boolean, attribute: false },
            isCheckmarkChecked: { type: Boolean, attribute: false },
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

    async checkForValidTickets() {
        const i18n = this._i18n;

        let responseData = { responseBody: '', status: 200 }; //await this.GetActiveTicketRequest(this.location.name); //TODO change to correct request - maybe there is a request to fetch only tickets for this room?
        let status = responseData.status;
        let responseBody = { location: { room: '', name: 'TU Graz' }};//await responseData.clone().json(); //TODO change to response data

        switch (status) {
            case 200:
                if (responseBody.location.name === this.location.name) { //only if this is the same ticket as selected
                    console.log('Found a valid ticket for this room.');
                    this.hasTicketForThisPlace = true;
                } else {
                    console.log('Could not find a valid ticket for this room.');
                    this.hasTicketForThisPlace = false;
                }
                break;

            default: //TODO error handling - more cases
                send({
                    "summary": i18n.t('acquire-ticket.other-error-title'),
                    "body": i18n.t('acquire-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
    }

    async checkCreateTicketResponse(response) { //TODO add refresh option?
        const i18n = this._i18n;
        let checkInPlaceSelect;

        switch(response.status) {
            case 201:
                send({
                    "summary": i18n.t('acquire-ticket.create-ticket-success-title'),
                    "body":  i18n.t('acquire-ticket.create-ticket-success-body', { place: this.location.name }),
                    "type": "success",
                    "timeout": 5,
                });
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location.name});

                this.location = "";
                this.hasTicket = true;
                this.isCheckboxVisible = false;
                this.isCheckmarkChecked = false;
                if (this._("#manual-proof-mode")) {
                    this._("#manual-proof-mode").checked = false;
                }
                if (this.hasValidProof) {
                    this.hasValidProof = false; //Could be expired until now
                }
            
                checkInPlaceSelect = this.shadowRoot.querySelector(this.getScopedTagName('dbp-check-in-place-select'));
                if (checkInPlaceSelect !== null) {
                    checkInPlaceSelect.clear();
                }

                this._("#checkin-reference").scrollIntoView({ behavior: 'smooth', block: 'start' }); //TODO fix this

                break;

            default: //TODO error handling - more cases
                send({
                    "summary": i18n.t('acquire-ticket.other-error-title'),
                    "body":  i18n.t('acquire-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
    }

    async createTicket(event) {
        let button = event.target;
        let response;

        button.start();
        try {
            response = await this.sendCreateTicketRequest();
        } finally {
            button.stop();
        }
        await this.checkCreateTicketResponse(response);
    }

    showCheckbox() {
        this.isCheckboxVisible = true;
    }

    setLocation(event) {
        if(event.detail.room) {
            this.location = { room: event.detail.room, name: event.detail.name };
            this.checkForValidProof().then(r =>  console.log('3G proof validation done')); //Check this each time because proof validity could expire
            this.checkForValidTickets().then(r =>  console.log('Fetch for valid tickets done'));
        } else {
            this.location = '';
        }
    }

    checkCheckmark() {
        this.isCheckmarkChecked = this._("#manual-proof-mode") && this._("#manual-proof-mode").checked;
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
            
            select:not(.select) {
                /*background-size: 13px;*/
                /*background-position-x: calc(100% - 0.4rem);*/
                /*padding-right: 1.3rem;*/
                background-image: none;
                width: 100%;
                height: 29px;
                font-weight: 300;
                border: 1px solid #aaa;
            }
            
            .loading-proof {
                padding: 0;
            }
            
            .tickets-wrapper {
                margin-top: 2rem;
            }

            .close-icon {
                color: red;
            }

            #no-proof-continue-btn {
                margin-top: 1rem;
            }

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
                margin-top: 0.75em;
            }

            .checkbox-wrapper {
                margin-top: 0.75rem;
            }
        
            .confirm-btn {
                /*margin-top: 1.5rem;*/
                margin-top: 1rem;
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

                .confirm-btn.hidden {
                    display: none;
                }
                
                #no-proof-continue-btn {
                    display: block;
                }
            }
        `;

    }

    render() {
        const i18n = this._i18n;

        if (this.isLoggedIn() && !this.isLoading() && this.showPreselectedSelector && this.preselectionCheck) {
            this.location = { room: '', name: this.preselectedOption };
            this.checkForValidProof().then(r =>  console.log('3G proof validation done')); //Check this each time because proof validity could expire
            this.checkForValidTickets().then(r =>  console.log('Fetch for valid tickets done'));
            this.preselectionCheck = false;
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
                
                <h2>${i18n.t('acquire-ticket.title')}</h2>
                <div>
                    <p class="">${i18n.t('acquire-ticket.description')}</p>
                    <slot name="additional-information">
                        <p>
                            ${i18n.t('acquire-ticket.additional-information')}
                            <a href="activate-3g-proof" title="${i18n.t('acquire-ticket.activation-link')}" target="_self" class="int-link-internal"> 
                                <span>${i18n.t('acquire-ticket.activation-link')}</span>
                            </a>
                            ${i18n.t('acquire-ticket.additional-information-2')}
                        </p>
                    </slot>
                </div>

                <div class="border"></div>
                    
                <div class="field">
                    <label class="label">${i18n.t('acquire-ticket.place-select-title')}</label>
                    <div class="control">
                        <dbp-check-in-place-select class="${classMap({'hidden': this.showPreselectedSelector})}" subscribe="auth" lang="${this.lang}" entry-point-url="${this.entryPointUrl}" @change="${(event) => { this.setLocation(event); }}"></dbp-check-in-place-select>
                        <select class="${classMap({'hidden': !this.showPreselectedSelector})}" disabled><option selected="selected">${this.preselectedOption}</option></select>
                    </div>
                </div>

                <div class="notification-wrapper ${classMap({'hidden': (this.location === '')})}">
                   
                    <div class="${classMap({'hidden': !this.hasValidProof || this.loading})}">
                        <dbp-icon name='checkmark-circle' class="${classMap({'hidden': !this.hasValidProof || this.location === ''})}"></dbp-icon>
                        ${i18n.t('acquire-ticket.valid-proof-found-message')}
                    </div>

                    <div class="${classMap({'hidden': this.hasValidProof || this.isCheckboxVisible || this.loading})}">
                        <div>
                            <dbp-icon name='cross-circle' class="close-icon ${classMap({'hidden': this.hasValidProof || this.location === ''})}"></dbp-icon>
                            ${i18n.t('acquire-ticket.no-proof-found-message')}
                            <a href='activate-3g-proof' title='${i18n.t('acquire-ticket.activation-link')}' target='_self' class='int-link-internal'>
                                <span>${i18n.t('acquire-ticket.activation-link')}</span>
                            </a>.
                        </div>
                        <dbp-loading-button id="no-proof-continue-btn" value="${i18n.t('acquire-ticket.no-proof-continue')}" @click="${this.showCheckbox}" title="${i18n.t('acquire-ticket.no-proof-continue')}"></dbp-loading-button>
                    </div>

                    <div class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading-proof">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </div>
                    
                </div>

                <div class="checkbox-wrapper ${classMap({'hidden': this.location === '' || this.hasValidProof || !this.isCheckboxVisible})}">
                    <label id="" class="button-container">${i18n.t('acquire-ticket.manual-proof-text')}
                        <input type="checkbox" id="manual-proof-mode" name="manual-proof-mode" value="manual-proof-mode" @click="${this.checkCheckmark}">
                        <span class="checkmark" id="manual-proof-checkmark"></span>
                    </label>
                </div>

                <div class="confirm-btn ${classMap({'hidden': (!this.hasValidProof && !this.isCheckmarkChecked)})}">
                    <dbp-loading-button ?disabled="${this.loading || this.location === '' ||  
                                            (!this.hasValidProof && !this.isCheckmarkChecked)}"
                                        type="is-primary" 
                                        id="confirm-ticket-btn"
                                        value="${ !this.hasTicketForThisPlace ? i18n.t('acquire-ticket.confirm-button-text') : i18n.t('acquire-ticket.refresh-button-text') }" 
                                        @click="${(event) => { this.createTicket(event); }}" 
                                        title="${i18n.t('acquire-ticket.confirm-button-text')}"
                    ></dbp-loading-button>
                </div>
                <div class="tickets-wrapper ${classMap({'hidden': (!this.hasTicket && !this.hasTicketForThisPlace)})}">
                    <dbp-inline-notification type="" body="${i18n.t('acquire-ticket.manage-tickets-text')}
                                <a href='show-active-tickets' title='${i18n.t('acquire-ticket.manage-tickets-link')}' target='_self' class='int-link-internal'>
                                    <span>${i18n.t('acquire-ticket.manage-tickets-link')}.</span>
                                </a>"
                    ></dbp-inline-notification>
                </div>
                <div class="tickets-wrapper ${classMap({'hidden': (!this.hasTicket)})}" id="checkin-reference">
                    <dbp-inline-notification type="" body="${i18n.t('acquire-ticket.check-in-link-description')}
                                <a href='checkin.tugraz.at' title='${i18n.t('acquire-ticket.check-in-link-text')}' target='_self' class='int-link-internal'>
                                    <span>${i18n.t('acquire-ticket.check-in-link-text')}.</span>
                                </a>"
                    ></dbp-inline-notification>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-acquire-ticket', AcquireTicket);