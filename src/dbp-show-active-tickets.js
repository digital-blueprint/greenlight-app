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
        this.activeTickets = [];
        this.activeTicketsCounter = 0;
        this.loading = false;
        this._initialFetchDone = false;
        this.locationName = 'TU Graz';
        this.identifier = '';
        this.currentTicket = {};
        this.currentTicketImage = '';

        this.searchHashString = '';
        this.greenPassHash = '';
        this.isSelfTest = false;
        this.hasValidProof = false;

        this.preCheck = true;
        this.error = false; // TODO
        this.setTimeoutIsSet = false;

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
            activeTickets: { type: Array, attribute: false },
            activeTicketsCounter: { type: Number, attribute: false },
            initialTicketsLoading: { type: Boolean, attribute: false },
            loading: { type: Boolean, attribute: false },
            locationName: { type: String, attribute: false },
            identifier: { type: String, attribute: false },
            greenPassHash: { type: String, attribute: false },
            preCheck: { type: Boolean, attribute: false },
            searchHashString: { type: String, attribute: 'gp-search-hash-string' },
            searchSelfTestStringArray: { type: String, attribute: 'gp-search-self-test-string-array' },
            currentTicket: { type: Object, attribute: false },
            currentTicketImage: { type: String, attribute: false },
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
        });

        super.update(changedProperties);
    }

    loginCallback() {
        super.loginCallback();

        this.getListOfActiveTickets();
    }

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

    async sendDeleteTicketRequest() {
        const options = {
            method: 'DELETE',
            headers: {
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + this.identifier, options);
    }

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

    async updateTicket(that) {
        let responseData = await that.getActiveTicketsRequest();
        let responseBody = await responseData.clone().json();

        if(responseData.status === 200) {
            that.currentTicketImage = responseBody['hydra:member'][0].image || '';
            that.error = false;
            const that_ = that;
            if (!this.setTimeoutIsSet) {
                that_.setTimeoutIsSet = true;
                setTimeout(function () {
                    that_.updateTicket(that_);
                    that_.setTimeoutIsSet = false;
                }, responseBody['hydra:member'][0].imageValidFor * 1000 + 1000 || 3000);
            }
        } else {
            that.error = true;
        }
    }

    async generateQrCode() {
        this.loading = true;

        await this.checkForValidProofLocal();
        if (this.greenPassHash !== '' && this.greenPassHash !== -1 && this.hasValidProof) {
            this.loading = true;
            let typeNumber = 0;
            let errorCorrectionLevel = 'H';
            let qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(this.greenPassHash);
            qr.make();
            let opts = {};
            opts.cellSize = 2;
            opts.margin = 0;
            opts.scalable = true;
            this._("#qr-code-hash").innerHTML = qr.createSvgTag(opts);
        } else {
            console.log("wrong code detected");
            this.hasValidProof = false;
            this.isSelfTest = false;
        }
        this.loading = false;
        this.preCheck = false;

    }

    /**
     * Get a list of active tickets
     *
     * @returns {Array} list
     */
    async getListOfActiveTickets() {
        this.initialTicketsLoading = !this._initialFetchDone;
        try {
            let response = await this.getActiveTicketsRequest();
            let responseBody = await response.clone().json();
            if (responseBody !== undefined && responseBody.status !== 403) {
                this.activeTickets = this.parseActiveTickets(responseBody);
                this.activeTicketsCounter++;
            }
        } finally {
            this.initialTicketsLoading = false;
            this._initialFetchDone = true;
        }
    }

    async checkDeleteTicketResponse(response) {
        const i18n = this._i18n;

        switch(response.status) {
            case 204:
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-success-title'),
                    "body":  i18n.t('show-active-tickets.delete-ticket-success-body', { place: this.locationName }),
                    "type": "success",
                    "timeout": 5,
                });
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location.name});
                this.locationName = '';
                this.identifier = '';

                break;

            default: //TODO error handling - more cases
                send({
                    "summary": i18n.t('show-active-tickets.other-error-title'),
                    "body":  i18n.t('show-active-tickets.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
    }

    // async checkRefreshTicketResponse(response) {
    //     const i18n = this._i18n;

    //     switch(response.status) {
    //         case 201:
    //             send({
    //                 "summary": i18n.t('show-active-tickets.refresh-ticket-success-title'),
    //                 "body":  i18n.t('show-active-tickets.refresh-ticket-success-body', { place: this.locationName }),
    //                 "type": "success",
    //                 "timeout": 5,
    //             });
    //             //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location.name});
    //             this.locationName = '';
    //             this.identifier = '';

    //             break;

    //         default: //TODO error handling - more cases
    //             send({
    //                 "summary": i18n.t('show-active-tickets.other-error-title'),
    //                 "body":  i18n.t('show-active-tickets.other-error-body'),
    //                 "type": "danger",
    //                 "timeout": 5,
    //             });
    //             break;
    //     }
    // }

    async showTicket(event, ticket) {
        await this.generateQrCode();
        await this.updateTicket(this);

        this.currentTicket = ticket;
        MicroModal.show(this._('#show-ticket-modal'), {
            disableScroll: true,
            onClose: modal => {
                this.statusText = "";
                this.loading = false;
            },
        });
    }

    // async refreshTicket(event, entry) {
    //     this.locationName = entry.place;
    //     let response = await this.sendCreateTicketRequest();
    //     await this.checkRefreshTicketResponse(response);

    //     response = await this.getActiveTicketsRequest();
    //     let responseBody = await response.json();
    //     if (responseBody !== undefined && responseBody.status !== 403) {
    //         this.activeTickets = this.parseActiveTickets(responseBody);
    //         this.activeTicketsCounter++;
    //     }
    // }

   async deleteTicket(event, entry) {
        this.identifier = entry.identifier;
        let response = await this.sendDeleteTicketRequest();
        let responseBody = await response.clone();
        await this.checkDeleteTicketResponse(responseBody);
        
        response = await this.getActiveTicketsRequest();
        responseBody = await response.clone().json();
        if (responseBody !== undefined && responseBody.status !== 403) {
            this.activeTickets = this.parseActiveTickets(responseBody);
            this.activeTicketsCounter--;
        }

    }

    closeDialog(e) {
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
            
            .proof-container {
                height: 100%;
                display: flex;
                flex-direction: column;
                text-align: center;
            }
            
            #qr-code-hash {
                flex-grow: 1;
                display: flex;
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
                padding: 30px;
                max-height: unset;
                min-height: 50%;
                min-width: 680px;
                max-width: 680px;
                height: auto;
            }

            #ticket-modal-box .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
            }

            #ticket-modal-box .modal-header h2 {
                font-size: 1.2rem;
                padding-right: 5px;
            }

            #ticket-modal-box .content-wrapper{
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-gap: 10px;
                grid-auto-rows: 100%;
            }

            #ticket-modal-box .content-wrapper label {
                display: block;
                width: 100%;
                text-align: left;
            }

            #ticket-modal-box .modal-footer {
                padding-top: 15px;
            }

            #ticket-modal-box .modal-footer .modal-footer-btn {
                display: flex;
                justify-content: space-between;
                padding-bottom: 15px;
            }
            
            #ticket-modal-box .modal-header {
                padding: 0px;
            }

            #ticket-modal-content {
                padding: 0px;
                align-items: start;
            }

            #ticket-modal-box .modal-header h2 {
                text-align: left;
            }
            
            #qr-code-hash img {
                margin: auto;
                display: block;
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
                    min-height: 100vh;
                    padding: 10px;
                }
                
                #ticket-modal-box .content-wrapper {
                    flex-direction: column;
                    justify-content: center;
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

                .proof-container h4 {
                    margin-bottom: 0px;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        if (this.isLoggedIn() && !this.isLoading() && !this.loading && this.preCheck) {
            this.generateQrCode();
        }

        if (this.isLoggedIn() && !this.isLoading() && !this._initialFetchDone && !this.initialTicketsLoading) {
            // this.getListOfActiveTickets();
        }
      //  this.generateQrCode();

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
                                ${this.getReadableDate(ticket.validFrom, ticket.validUntil)}
                            </span>
                            <div class="btn">
                                <dbp-loading-button type="is-primary" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${(event) => { this.showTicket(event, ticket); }}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <!-- <dbp-loading-button id="refresh-btn" value="${i18n.t('show-active-tickets.refresh-btn-text')}" @click="${(event) => { this.refreshTicket(event, ticket); }}" title="${i18n.t('show-active-tickets.refresh-btn-text')}"></dbp-loading-button>  -->
                                <dbp-loading-button id="delete-btn" value="${i18n.t('show-active-tickets.delete-btn-text')}" @click="${(event) => { this.deleteTicket(event, ticket); }}" title="${i18n.t('show-active-tickets.delete-btn-text')}"></dbp-loading-button>
                            </div>
                        </div>
                    `)}
                    <span class="control ${classMap({hidden: this.isLoggedIn() && !this.initialTicketsLoading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                    
                    <div class="no-tickets ${classMap({hidden: !this.isLoggedIn() || this.initialTicketsLoading || this.activeTickets.length !== 0})}">${i18n.t('show-active-tickets.no-tickets-message')}</div>
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
                                    <div class="foto-container">
                                        <img src="${this.currentTicketImage || ''}" alt="Ticketfoto" />
                                    </div>
                                  
                                    <div class="information-container ${classMap({hidden: this.hasValidProof})}">
                                        <span class="header">
                                                <h4>${i18n.t('show-active-tickets.3g-evidence')}</h4>
                                        </span>
                                        <slot name="additional-information">
                                            <p>${i18n.t('show-active-tickets.no-evidence')}</p>
                                        </slot>
                                        <p> 
                                            Es wurde kein gültiger gespeicherter 3-G Nachweis gefunden. Zeigen Sie ihren Nachweis manuell vor. <br><br>
                                            Sie können Ihren Nachweis hochladen, indem Sie ein neues Ticket unter "Eintrittsticket erstellen" anfordern.
                                        </p>
                                    </div>
                                  
                                    <div class="proof-container ${classMap({hidden: !this.hasValidProof})}">
                                        <div class="${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                            <span class="header">
                                                <h4>${i18n.t('acquire-3g-ticket.3g-proof')}</h4>
                                            </span>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <span class="header">
                                                <h4>${i18n.t('show-active-tickets.3g-evidence')}</h4> 
                                                <strong>${i18n.t('show-active-tickets.self-test-found')}</strong>
                                                <br>
                                                ${i18n.t('show-active-tickets.self-test-information')}
                                                <span><a class="int-link-external" title="${i18n.t('show-active-tickets.self-test')}" target="_blank" rel="noopener" href="${this.greenPassHash}">${i18n.t('show-active-tickets.self-test-link')}</a></span>
                                            </span>
                                        </div>
                                        <div id="qr-code-hash"></div>
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