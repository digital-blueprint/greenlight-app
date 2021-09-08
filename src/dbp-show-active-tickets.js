import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPGreenlightLitElement from "./dbp-greenlight-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit-html/directives/class-map.js';
import MicroModal from './micromodal.es';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';
import {send} from "@dbp-toolkit/common/notification";
import qrcode from "qrcode-generator";

class ShowActiveTickets extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.loading = false;

        this.activeTickets = [];
        this.locationName = 'Ticket';
        this.currentTicket = {};
        this.currentTicketImage = '';
        this.greenPassHash = '';
        this.hasValidProof = false;
        this.isSelfTest = false;

        this.setTimeoutIsSet = false;
        this.timer = '';

    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-inline-notification': InlineNotification,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            loading: { type: Boolean, attribute: false },
            activeTickets: { type: Array, attribute: false },
            locationName: { type: String, attribute: 'preselected-option' },
            currentTicket: { type: Object, attribute: false },
            currentTicketImage: { type: String, attribute: false },
            greenPassHash: { type: String, attribute: false },
            hasValidProof: { type: Boolean, attribute: false },
            isSelfTest: { type: Boolean, attribute: false },
        };
    }

    disconnectedCallback() {
        clearTimeout(this.timer);
        super.disconnectedCallback();
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
        });

        super.update(changedProperties);
    }

    loginCallback() {
        super.loginCallback();
        this.getListOfActiveTickets();
        this.generateQrCode();
    }


    /**
     * Parse an activeTicket response and return a list
     *
     * @param response
     * @returns {Array} list
     */
    parseActiveTickets(response) {
        let list = [];

        let numTypes = parseInt(response['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }
        for (let i = 0; i < numTypes; i++ ) {
            list[i] = response['hydra:member'][i];
        }

        return list;
    }

    /**
     * Sends a delete Ticket request
     *
     * @param ticketID
     */
    async sendDeleteTicketRequest(ticketID) {
        const options = {
            method: 'DELETE',
            headers: {
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + ticketID, options);
    }

    /**
     * Gets a specific ticket
     *
     * @param ticketID
     */
    async getActiveTicketRequest(ticketID) {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };
        const additionalInformation = this.hasValidProof ? 'local-proof' : '';

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + ticketID + '?additional-information=' +
            encodeURIComponent(additionalInformation), options);
    }

    /**
     * Gets the active tickets
     *
     */
    async getActiveTicketsRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };
        const additionalInformation = this.hasValidProof ? 'local-proof' : '';

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits?additional-information=' +
            encodeURIComponent(additionalInformation), options);
    }

    /**
     * Updates a ticket and sets a timer for next update
     * Notifies the user if something went wrong
     *
     * @param that
     * @param ticket
     */
    async updateTicket(that, ticket) {
        const i18n = this._i18n;

        let responseData = await that.getActiveTicketRequest(ticket.identifier);
        let responseBody = await responseData.clone().json();


        if (responseData.status === 404) { // Ticket not found
            that.getListOfActiveTickets();
            send({
                "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                "body":  i18n.t('show-active-tickets.delete-ticket-notfound-body', { place: this.locationName }),
                "type": "warning",
                "timeout": 5,
            });
            return false;
        } else if (responseData.status === 200) { // Success
            that.currentTicket = responseBody;
            that.currentTicketImage = responseBody.image;

            const that_ = that;
            if (!this.setTimeoutIsSet) {
                that_.setTimeoutIsSet = true;
                that_.timer = setTimeout(function () {
                    that_.updateTicket(that_, ticket);
                    that_.setTimeoutIsSet = false;
                }, responseBody.imageValidFor * 1000 + 1000 || 3000);
            }
            return true;
        } else {  // Other Error
            that.getListOfActiveTickets();
            send({
                "summary": i18n.t('show-active-tickets.other-error-title'),
                "body":  i18n.t('show-active-tickets.other-error-body'),
                "type": "danger",
                "timeout": 5,
            });
            return false;
        }
    }

    /**
     * Generate a QR Code at #qr-code-hash
     * if a valid local stored evidence is found
     *
     */
    async generateQrCode() {
        this.loading = true;

        await this.checkForValidProofLocal();
        if (this.greenPassHash !== '' && this.greenPassHash !== -1 && this.hasValidProof) {
            let typeNumber = 0;
            let errorCorrectionLevel = 'H';
            let qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(this.greenPassHash);
            qr.make();
            let opts = {};
            opts.cellSize = 2;
            opts.margin = 2;
            opts.scalable = true;
            if (this._("#qr-code-hash"))
                this._("#qr-code-hash").innerHTML = qr.createSvgTag(opts);
        } else {
            this.hasValidProof = false;
            this.isSelfTest = false;
        }
        this.loading = false;
    }

    /**
     * Generate a QR Code if a hash is avaible and valid,
     * updates the ticket and shows it in modal view
     *
     * @param ticket
     */
    async showTicket(ticket) {
        await this.generateQrCode();
        let success = await this.updateTicket(this, ticket);
        if (success) {
            this.currentTicket = ticket;
            if (this._('#show-ticket-modal')) {
                MicroModal.show(this._('#show-ticket-modal'), {
                    disableScroll: true,
                    onClose: modal => {
                        this.loading = false;
                    },
                });
            }
        }
    }

    /**
     * Sends a delete Ticket Request for the specific entry,
     * Checks the response and update the listview
     *
     * @param ticket
     */
    async deleteTicket(ticket) {
        let response = await this.sendDeleteTicketRequest(ticket.identifier);
        let responseBody = await response.clone();
        await this.checkDeleteTicketResponse(responseBody);

        response = await this.getActiveTicketsRequest();
        await this.checkActiveTicketsRequest(response);
    }

    /**
     * Checks the response from DeleteTicketRequest
     * and notify the user
     *
     * @param response
     */
    async checkDeleteTicketResponse(response) {
        const i18n = this._i18n;
        this.locationName = '';
        switch(response.status) {
            case 204:
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-success-title'),
                    "body":  i18n.t('show-active-tickets.delete-ticket-success-body', { place: this.locationName }),
                    "type": "success",
                    "timeout": 5,
                });
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location.name});
                break;

            case 404:
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                    "body":  i18n.t('show-active-tickets.delete-ticket-notfound-body', { place: this.locationName }),
                    "type": "warning",
                    "timeout": 5,
                });
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketNotfound', 'name': this.location.name});
                break;

            default:
                send({
                    "summary": i18n.t('show-active-tickets.other-error-title'),
                    "body":  i18n.t('show-active-tickets.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
    }

    /**
     * Get a list of active tickets
     *
     */
    async getListOfActiveTickets() {
        let response = await this.getActiveTicketsRequest();
        await this.checkActiveTicketsRequest(response);
    }

    /**
     * Checks the response from getActiveTicketsRequest
     * updates the ticket list
     * and notify the user if something went wrong
     *
     * @param response
     */
    async checkActiveTicketsRequest(response) {
        const i18n = this._i18n;

        let responseBody = await response.clone().json();
        if (responseBody !== undefined && response.status === 200) {
            this.activeTickets = this.parseActiveTickets(responseBody);
        } else {
            send({
                "summary": i18n.t('show-active-tickets.other-error-title'),
                "body":  i18n.t('show-active-tickets.other-error-body'),
                "type": "danger",
                "timeout": 5,
            });
        }
    }

    /**
     * Close modal dialog #show-ticket-modal
     *
     */
    closeDialog() {
        if (this._('#show-ticket-modal'))
            MicroModal.close(this._('#show-ticket-modal'));
    }

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getLinkCss()}
            
            .proof-container, .information-container   {
                height: 100%;
                display: flex;
                flex-direction: column;
                text-align: center;
                align-items: center;
            }
            
            .foto-container {
                width: 60%;
            }

            .qr-code-wrapper {
                width: 100%;
            }


            .self-test-qr {
                width: 40%;
            }
            
            #qr-code-hash {
                flex-grow: 1;
                width: 80%;
                display: block;
                margin: 0em auto;
            }
            
             #qr-code-hash img {
                margin: auto;
                display: block;
            }
            
            .self-test-qr #qr-code-hash {
                margin: 1em auto;
            }

            .foto-container img {
                width: 100%;
                display: block;
            }
            
            .proof-container h4 {
                margin-top: 0px;
            }
            
            .ticket {
                display: flex;
                justify-content: space-between;
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
                margin-bottom: 2em;
            }
            
            .tickets {
                margin-top: 2em;
            }

            .btn {
                display: flex;
                justify-content: space-between;
                column-gap: 0.5em;
            }

            .header {
                display: grid;
                align-items: center;
            }
            
            .border {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid black;
            }

            #ticket-modal-box {
                display: flex;
                flex-direction: column;
                padding: 10px 14px 40px 14px;
                max-height: 100%;
                min-height: unset;
                min-width: 680px;
                max-width: 680px;
                height: auto;
            }

            #ticket-modal-box .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
            }

            #ticket-modal-box .content-wrapper{
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-gap: 10px;
                grid-auto-rows: 100%;
            }
            
            
            #ticket-modal-box .modal-header {
                padding: 0px;
            }

            #ticket-modal-content {
                padding: 0px;
                align-items: start;
            }
            
            .hidden {
                display: none;
            }
            
            .left-container {
                justify-content: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                row-gap: 1em;
            }

            @media only screen
            and (orientation: landscape)
            and (max-width:768px) {
                #ticket-modal-box {
                    height: 100%;
                }
            }

            @media only screen
            and (orientation: portrait)
            and (max-width:768px) {

                .ticket {
                    display: block;
                    margin-bottom: 0;
                }

                .tickets {
                    display: block;
                }

                .header {
                    margin-bottom: 0.5rem;
                }

                #delete-btn {
                    margin-bottom: 2rem;
                }

                .btn {
                    flex-direction: column;
                    row-gap: 0.5em;
                }
                
                .loading {
                    justify-content: center;
                }
                
                #ticket-modal-box {
                    width: 100%;
                    height: 100%;
                    min-width: 100%;
                    min-height: 100%;
                    padding: 10px;
                }
                
                #ticket-modal-box .content-wrapper {
                    flex-direction: column;
                    justify-content: flex-start;
                    text-align: center;
                    align-items: center;
                    row-gap: 2em;
                    height: 100%;
                    display: flex;
                }
                
                .foto-container {
                    width: 60%;
                }
                
                .proof-container {
                    width: 100%;
                }

                #ticket-modal-title {
                    width: 100%;
                    text-align: center;
                    margin: 0px;
                    line-height: 37px; 
                }
                
                #ticket-modal-box .modal-close {
                    position: absolute;
                    right: 20px;
                }
                
                #ticket-modal-box {
                    padding: 0px;
                }

                #ticket-modal-content {
                    height: 100%;
                    display: flex;
                }
                
                #ticket-modal-content div {
                    height: 100%;
                }
                
                #ticket-modal-box .modal-header, #ticket-modal-content {
                    padding-top: 10px;
                }
                
                .foto-container {
                    width: 80%;
                }
                
                .proof-container, .information-container {
                    padding: 30px 10px; 
                    background-color: #245b78;
                    color: white;
                }
                
                .proof-container .int-link-external, .information-container .int-link-external{
                    border-bottom: 1px solid white;
                }
                
                .proof-container .int-link-external::after, .information-container .int-link-external:after{
                    filter: invert(100%);
                    -webkit-filter: invert(100%);
                }
                
                .proof-container .int-link-internal, .information-container .int-link-internal{
                    border-bottom: 1px solid white;
                }
                
                .self-test-qr {
                    width: 60%;
                }
                
                #qr-code-hash {
                    width: 90%;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;


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
                
                <h2>${i18n.t('show-active-tickets.title')}</h2>
                <p>${i18n.t('show-active-tickets.description')}</p>
                
                <div class="border tickets ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    ${ this.activeTickets.map(ticket => html`
                        <div class="ticket">
                            <span class="header">
                                <strong>${this.locationName}</strong>
                                ${this.getReadableDate(ticket.validUntil)}
                            </span>
                            <div class="btn">
                                <dbp-loading-button type="is-primary" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${() => { this.showTicket(ticket); }}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <dbp-loading-button id="delete-btn" value="${i18n.t('show-active-tickets.delete-btn-text')}" @click="${() => { this.deleteTicket(ticket); }}" title="${i18n.t('show-active-tickets.delete-btn-text')}"></dbp-loading-button>
                            </div>
                        </div>
                    `)}
                    <span class="control ${classMap({hidden: this.isLoggedIn()})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                    
                    <div class="no-tickets ${classMap({hidden: !this.isLoggedIn() || this.activeTickets.length !== 0})}">${i18n.t('show-active-tickets.no-tickets-message')}</div>
                </div>

            </div>
            
            <div class="modal micromodal-slide" id="show-ticket-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div class="modal-container" id="ticket-modal-box" role="dialog" aria-modal="true"
                         aria-labelledby="ticket-modal-title">
                        <header class="modal-header">
                            <h3 id="ticket-modal-title">${i18n.t('show-active-tickets.show-ticket-title')}<strong>${this.locationName}</strong></h3>
                            <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => { this.closeDialog(); }}">
                                <dbp-icon title="${i18n.t('file-sink.modal-close')}" name="close" class="close-icon"></dbp-icon>
                            </button>
                        </header>
                        <main class="modal-content" id="ticket-modal-content">
                            <div class="${classMap({hidden: this.loading})}">
                                <div class="content-wrapper ${classMap({hidden: this.loading})}">
                                    <div class="left-container">
                                        <div class="foto-container">
                                            <img src="${this.currentTicketImage || ''}" alt="Ticketfoto" />
                                        </div>
                                    </div>
                                    
                                  
                                    <div class="information-container ${classMap({hidden: this.hasValidProof})}">
                                        <div class="${classMap({hidden: this.hasValidProof})}">
                                            <span class="header">
                                                    <h4>${i18n.t('show-active-tickets.no-3g-evidence')}</h4>
                                            </span>
                                            <slot name="greenlight-reference">
                                                <p>${i18n.t('show-active-tickets.no-evidence')}</p>
                                            </slot>
                                        </div>
                                    </div>
                                  
                                    <div class="proof-container ${classMap({hidden: !this.hasValidProof})}">
                                        <div class="${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                            <span class="header">
                                                <h4>${i18n.t('show-active-tickets.3g-evidence')}</h4>
                                            </span>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <span>
                                                <h4>${i18n.t('show-active-tickets.self-test-found')}</h4>
                                                ${i18n.t('show-active-tickets.self-test-information')}
                                                <a class="int-link-external" title="${i18n.t('show-active-tickets.self-test')}" target="_blank" rel="noopener" href="${this.greenPassHash}">${i18n.t('show-active-tickets.self-test-link')}</a>
                                            </span>
                                        </div>
                                        <div class="qr-code-wrapper ${classMap({'self-test-qr': this.isSelfTest})}">
                                            <div id="qr-code-hash"></div>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <slot name="greenlight-reference-invalid">
                                                <p>${i18n.t('show-active-tickets.invalid-evidence')}</p>
                                            </slot>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <span class="control ${classMap({hidden: !this.loading})}">
                                    <span class="loading">
                                        <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                                    </span>
                            </span>
                        </main>
                        
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-active-tickets', ShowActiveTickets);