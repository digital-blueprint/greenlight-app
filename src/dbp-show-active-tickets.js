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
import {InfoTooltip} from '@dbp-toolkit/tooltip';
import {Activity} from "./activity";
import metadata from "./dbp-show-active-tickets.metadata.json";


class ShowActiveTickets extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);
        this.loading = false;
        this.ticketLoading = false;
        this.ticketOpen = false;
        this.activeTickets = [];
        this.locationName = 'Ticket';
        this.currentTicket = {};
        this.currentTicketImage = '';
        this.greenPassHash = '';
        this.hasValidProof = false;
        this.isSelfTest = false;

        this.setTimeoutIsSet = false;
        this.timer = '';

        this.boundUpdateTicket = this.updateTicketWrapper.bind(this);


    }

    static get scopedElements() {
        return {
          'dbp-icon': Icon,
          'dbp-mini-spinner': MiniSpinner,
          'dbp-loading-button': LoadingButton,
          'dbp-inline-notification': InlineNotification,
          'dbp-info-tooltip': InfoTooltip,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            loading: { type: Boolean, attribute: false },
            ticketLoading: { type: Boolean, attribute: false },
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
        window.removeEventListener('focus', this.boundUpdateTicket);
        super.disconnectedCallback();
    }


    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('focus', this.boundUpdateTicket);
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
        this.checkForValidProofLocalWrapper();
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

    async updateTicketWrapper() {
        this.setTimeoutIsSet = false; //reset timer if focus event is triggered
        this.updateTicket();
    }

    /**
     * Updates a ticket and sets a timer for next update
     * Notifies the user if something went wrong
     *
     * @returns {boolean}
     */
    async updateTicket() {
        if (this.ticketOpen === false || this.currentTicket && Object.keys(this.currentTicket).length === 0)
            return false;

        const i18n = this._i18n;
        let responseData = await this.getActiveTicketRequest(this.currentTicket.identifier);
        let responseBody = "";
        try {
            responseBody = await responseData.clone().json();
        } catch (e) {
            this.setTimeoutIsSet = false;
            this.setTimer(6000);
            return false;
        }

        if (responseData.status === 404) { // Ticket not found
            this.getListOfActiveTickets();
            send({
                "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                "body":  i18n.t('show-active-tickets.delete-ticket-notfound-body', { place: this.locationName }),
                "type": "warning",
                "timeout": 5,
            });
            return false;
        }
        if (responseData.status === 200) { // Success
            this.currentTicket = responseBody;
            this.currentTicketImage = responseBody.image;
            this.setTimer(responseBody.imageValidFor * 1000 + 1000 || 3000);
            return true;
        }

        this.getListOfActiveTickets();
        send({
            "summary": i18n.t('show-active-tickets.other-error-title'),
            "body":  i18n.t('show-active-tickets.other-error-body'),
            "type": "danger",
            "timeout": 5,
        });
        this.setTimeoutIsSet = false;
        this.setTimer(6000);
        return false;
    }

    /**
     * Sets a timer: this.timer
     * and resets the old if this.setTimeoutIsSet
     *
     * @param {number} time in milliseconds
     */
    setTimer(time) {
        const that = this;
        if (!this.setTimeoutIsSet) {
            this.setTimeoutIsSet = true;
            clearTimeout(this.timer);
            this.timer = setTimeout(function () {
                that.setTimeoutIsSet = false;
                let boundUpdateTicket = that.updateTicket.bind(that);
                boundUpdateTicket();
            },  time);
        }
    }


    async checkForValidProofLocalWrapper() {
        this.loading = true;
        await this.checkForValidProofLocal();
        if (this.greenPassHash === '' || this.greenPassHash === -1) {
            this.hasValidProof = false;
            this.isSelfTest = false;
        }
        this.loading = false;
    }

    /**
     * Generate a QR Code at #qr-code-hash
     * if a valid local stored evidence is found
     *
     */
    async generateQrCode() {
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
    }

    /**
     * Generate a QR Code if a hash is avaible and valid,
     * updates the ticket and shows it in modal view
     *
     * @param ticket
     */
    async showTicket(ticket) {
        this.ticketLoading = true;
        if (this._('#show-ticket-modal')) {
            this.ticketOpen = true;
            MicroModal.show(this._('#show-ticket-modal'), {
                disableScroll: true,
                onClose: modal => {
                    this.ticketLoading = false;
                    this.ticketOpen = false;
                },
            });
        }
        await this.generateQrCode();
        console.log("sucess generate qr");
        this.currentTicket = ticket;
        let success = await this.updateTicket();
        if (!success) {
            this.currentTicket = {};
            console.log("update ticket failed");
        }
        this.ticketLoading = false;
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
            ${commonStyles.getActivityCSS()}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getButtonCSS()}
            ${commonStyles.getModalDialogCSS()}
            ${commonStyles.getLinkCss()}
          
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
            
            .header {
                display: grid;
                align-items: center;
            }           

            .btn {
                display: flex;
                justify-content: space-between;
                column-gap: 0.5em;
            }
            
            .border {
                margin-top: 2rem;
                padding-top: 2rem;
                border-top: 1px solid black;
            }

            #ticket-modal-box {
                display: flex;
                flex-direction: column;
                padding: 0px;
                min-width: 700px;
                max-width: 880px;
                min-height: unset;
                height: auto;
            }
            
            #qr-code-hash svg{
                display: block;
                width: 80%;
                margin: auto;
            }
            
            .green-pass-evidence {
                line-height: 30px;
            }
            
            .proof-container, .information-container{
                background-color: #245b78;
                color: white;
                padding: 40px 10px;
                display: flex;
                flex-direction: column;
                justify-content: space-evenly;
                align-items: center;
                text-align: center;
            }
            
            .proof-container {
                text-align: center;
            }
            
            .proof-container .int-link-external, .proof-container .int-link-internal, .information-container .int-link-internal{
                border-bottom: 1px solid white;;
            }
            
            .proof-container .int-link-external::after{
                filter: invert(100%);
                -webkit-filter: invert(100%);
            }
            
            .foto-container{
                width: 80%;
            }
            
            .foto-container img{
                width: 100%;
                display: block;
            }
            
            .left-container h3, .proof-container h4, .information-container h4 {
                margin: 0px 0px 10px 0px;
                line-height: 30px;
            }
            
            .left-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 40px 10px;
                justify-content: space-evenly;
            }
            
            .content-wrapper{
                padding-right: 44px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-gap: 10px;
                grid-auto-rows: 100%;
            }
            
            .modal-close {
                position: absolute;
                right: 10px;
                top: 5px;
            }
            
            .hidden {
                display: none;
            }
            
            .self-test-qr {
                margin: 20px auto;
                width: 60%;
            }
            
            .red {
                color: var(--dbp-override-danger-bg-color);
            }
            
            .green {
                color: var(--dbp-override-success-bg-color);
            }
            
            .ticket h3  {
                margin-bottom: 0.2rem;
            }
            
            .ticket-loading {
                font-size: 1.3rem;
            }
            
            @media only screen
            and (orientation: landscape)
            and (max-width:768px) {
                #ticket-modal-box {
                    height: 100%;
                    width: 100%;
                    max-width: unset;
                    max-heigth: unset;
                }
                
                #ticket-modal-content, #ticket-modal-content > div:first-of-type, .content-wrapper{
                    height: 100%;                   
                }
                
                .left-container, .proof-container, .information-container{
                    justify-content: space-evenly;
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
                    padding: 0px;
                }
                
                .left-container{
                    padding: 11px 20px 20px 20px;
                }
                
                .foto-container{
                    width: 90%;
                }
                
                #qr-code-hash svg{
                    width: 100%;
                }
                
                .content-wrapper{
                    display: flex;
                    flex-direction: column;
                    padding: 0px;    
                    grid-gap: inherit;
                    min-height: 100vh;
                }
    
                .proof-container, .information-container {
                    padding: 20px;
                    flex-grow: 1;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        const link3gRules = 'https://corona-ampel.gv.at/aktuelle-massnahmen/bundesweite-massnahmen/#toc-3-g-regel';
        const validTill = i18n.t('valid-till')
            + i18n.t('date-time', {clock: this.person.validUntil ? this.formatValidUntilTime(this.person.validUntil) : '', date: this.person.validUntil ? this.formatValidUntilDate(this.person.validUntil) : ''})
            + ". "
            + i18n.t('validity-tooltip') + "<a href='" + link3gRules + "' target='_blank'>" + i18n.t('validity-tooltip-2') + "</a>";

        console.log(".............", validTill);
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

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    ${this.activity.getDescription(this.lang)}
                </p>
                <p>${i18n.t('show-active-tickets.description')}</p>
                
                <div class="border tickets ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    <div class="${classMap({hidden: this.loading})}">
                    ${ this.activeTickets.map(ticket => html`
                        <div class="ticket">
                            <span class="header">
                                <h3>${i18n.t('show-active-tickets.entry-ticket')}: ${this.locationName}</h3>
                                <span class="header ${classMap({hidden: !this.hasValidProof})}">
                                    <span> 
                                        <b>${i18n.t('show-active-tickets.status')}<span class="green">aktiv</span></b>
                                    </span>
                                    <span class="${classMap({hidden: this.isSelfTest})}">
                                        <b>3-G-Nachweis: <span class="green">gültig</span></b>
                                        <dbp-info-tooltip class="tooltip" text-content="${validTill}" interactive></dbp-info-tooltip>
                                        <br>
                                        Auf diesem Gerät wurde ein gültiger 3-G-Nachweis gefunden. Bitte beachten Sie, dass dieser Nachweis nur auf diesem Gerät für eine bestimmte Zeit gespeichert ist. Kontrollieren Sie regelmäßig Ihr Ticket.
                                    </span>
                                    <span class="${classMap({hidden: !this.isSelfTest})}">
                                        Auf diesem Gerät wurde ein Selbsttest gefunden. Bitte überprüfen Sie die Gültigkeit und beachten Sie, dass dieser Nachweis nur auf diesem Gerät für eine bestimmte Zeit gespeichert ist. Kontrollieren Sie regelmäßig Ihr Ticket.
                                    </span>
                                </span>
                                <span class="header ${classMap({hidden: this.hasValidProof})}">
                                   <b>Status: <span class="red">inaktiv</span></b>
                                   <span>Auf diesem Gerät wurde kein gültiger 3-G-Nachweis gefunden. Vielleicht haben Sie Ihren Nachweis auf einem anderen Gerät importiert.
                                  Zeigen Sie ihren Nachweis manuell vor oder laden Sie einen neuen Nachweis hoch, indem Sie ein neues Ticket unter
                                        <a href='acquire-3g-ticket' title='Eintrittsticket erstellen' target='_self' class='int-link-internal'>
                                        <span>Eintrittsticket erstellen</span>
                                        </a>
                                    anfordern.</span>
                                   
                                </span>
                            </span>
                            <div class="btn">
                                <dbp-loading-button class="${classMap({hidden: !this.hasValidProof})}" type="is-primary" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${() => { this.showTicket(ticket); }}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <a class="${classMap({hidden: this.hasValidProof})}" href="acquire-3g-ticket"> 
                                    <button class="button">Neues Ticket anfordern</button>
                                </a>
                                <dbp-loading-button id="delete-btn" value="${i18n.t('show-active-tickets.delete-btn-text')}" @click="${() => { this.deleteTicket(ticket); }}" title="${i18n.t('show-active-tickets.delete-btn-text')}"></dbp-loading-button>
                            </div>
                        </div>
                    `)}
                    </div>
                    <span class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                    
                    <div class="no-tickets ${classMap({hidden: !this.isLoggedIn() || this.loading || this.activeTickets.length !== 0})}">${i18n.t('show-active-tickets.no-tickets-message')}</div>
                </div>

            </div>
            
            <div class="modal micromodal-slide" id="show-ticket-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div class="modal-container" id="ticket-modal-box" role="dialog" aria-modal="true"
                         aria-labelledby="ticket-modal-title">
                        <main class="modal-content" id="ticket-modal-content">
                            <span class="control ticket-loading ${classMap({hidden: !this.ticketLoading})}">
                                <span class="loading">
                                    <dbp-mini-spinner text=${i18n.t('show-active-tickets.loading-message-ticket')}></dbp-mini-spinner>
                                </span>
                            </span>
                            
                            <div class="content-wrapper">
                                <div class="left-container ${classMap({hidden: this.ticketLoading})}">
                                    <h3 id="ticket-modal-title">${i18n.t('show-active-tickets.show-ticket-title')}<strong>${this.locationName}</strong></h3>
                                    <div class="foto-container">
                                        <img src="${this.currentTicketImage || ''}" alt="Ticketfoto" />
                                    </div>
                                </div>
                                
                              
                                <div class="information-container ${classMap({hidden: this.hasValidProof || this.ticketLoading})}">
                                    <div class="${classMap({hidden: this.hasValidProof})}">
                                        <span>
                                                <h4>${i18n.t('show-active-tickets.no-3g-evidence')}</h4>
                                        </span>
                                        <slot name="greenlight-reference">
                                            <p>${i18n.t('show-active-tickets.no-evidence')}</p>
                                        </slot>
                                    </div>
                                </div>
                              
                                <div class="proof-container ${classMap({hidden: !this.hasValidProof || this.ticketLoading})}">
                                    <div class="green-pass-evidence ${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                        <span>
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

                                <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => { this.closeDialog(); }}">
                                    <dbp-icon title="${i18n.t('file-sink.modal-close')}" name="close" class="close-icon"></dbp-icon>
                                </button>
                            </div>
                            
                        </main>
                        
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-active-tickets', ShowActiveTickets);