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
        this.ticketImage = '';
        this.greenPassHash = '';
        this.hasValidProof = false;
        this.isSelfTest = false;
        this.isInternalTest = false;
        this.loadingTickets = true;
        this.setTimeoutIsSet = false;
        this.timer = '';
        this.showReloadButton = false;
        this.preCheck = false;

        this.boundUpdateTicketwrapper = this.updateTicketWrapper.bind(this);
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
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            loading: {type: Boolean, attribute: false},
            ticketLoading: {type: Boolean, attribute: false},
            activeTickets: {type: Array, attribute: false},
            locationName: {type: String, attribute: 'preselected-option'},
            currentTicket: {type: Object, attribute: false},
            ticketImage: {type: String, attribute: false},
            greenPassHash: {type: String, attribute: false},
            hasValidProof: {type: Boolean, attribute: false},
            isSelfTest: {type: Boolean, attribute: false},
            isInternalTest: {type: Boolean, attribute: false},
            loadingTickets: {type: Boolean, attribute: false},
            showReloadButton: {type: Boolean, attribute: false},
        };
    }

    disconnectedCallback() {
        clearTimeout(this.timer);
        window.removeEventListener('focus', this.boundUpdateTicketwrapper);
        super.disconnectedCallback();
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('focus', this.boundUpdateTicketwrapper);
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
        for (let i = 0; i < numTypes; i++) {
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
     * @returns {object} response
     */
    async getActiveTicketRequest(ticketID) {

        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        const additionalInformation = this.hasValidProof && !this.isSelfTest ? 'local-proof' : '';

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits/' + ticketID + '?additional-information=' +
            encodeURIComponent(additionalInformation), options);
    }

    /**
     * Gets the active tickets
     *
     * @returns {object} response
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
     * A wrapper for update ticket for calling it in an event handler
     * Sets this.setTimeoutIsSet to false and calls this.upddateTicket()
     *
     */
    async updateTicketWrapper() {
        this.setTimeoutIsSet = false; //reset timer if focus event is triggered
        this.showReloadButton = false;
        this.updateTicket();
    }

    /**
     * A wrapper for update ticket for calling it in an event handler
     * Sets this.setTimeoutIsSet to false and calls this.upddateTicket()
     *
     */
    async updateTicketAndNotify() {
        this.setTimeoutIsSet = false; //reset timer if focus event is triggered
        this.showReloadButton = false;
        let check = await this.updateTicket();
        if (!check && this.showReloadButton) {
            const i18n = this._i18n;
            send({
                "summary": i18n.t('show-active-tickets.reload-error-title'),
                "body":  i18n.t('show-active-tickets.reload-error-body'),
                "type": "danger",
                "timeout": 5,
            });
            this.showReloadButton = true;
        }
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
            this.showReloadButton = true;
            return false;
        }

        let ret;

        switch (responseData.status) {
            case 200: // Success
                this.sendSuccessAnalyticsEvent('UpdateTicketRequest', 'Success', '');
                this.showReloadButton = false;
                this.currentTicket = responseBody;
                this.ticketImage = responseBody.image;
                this.setTimer(responseBody.imageValidFor * 1000 + 1000);
                ret = true;
                break;

            case 401:
                this.sendErrorAnalyticsEvent('UpdateTicketRequest', 'LoggedOut', this.location, responseData);
                this.getListOfActiveTickets();
                send({
                    "summary": i18n.t('show-active-tickets.logged-out-title'),
                    "body": i18n.t('show-active-tickets.logged-out-body', {place: this.locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
                this.showReloadButton = false;
                this.setTimeoutIsSet = false;
                ret = false;
                break;

            case 404:
                this.sendErrorAnalyticsEvent('UpdateTicketRequest', 'NotFound', this.location, responseData);
                this.getListOfActiveTickets();
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                    "body": i18n.t('show-active-tickets.delete-ticket-notfound-body', {place: this.locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
                this.showReloadButton = false;
                this.setTimeoutIsSet = false;
                ret = false;
                break;

            default:
                this.sendErrorAnalyticsEvent('UpdateTicketRequest', 'UnknownError', this.location, responseData);
                this.getListOfActiveTickets();
                console.log("Update ticket failed");
                this.setTimeoutIsSet = false;
                this.showReloadButton = true;
                ret = false;
                break;
        }

       return ret;
    }

    /**
     * Sets a timer: this.timer
     * and resets the old if this.setTimeoutIsSet
     *
     * @param {number} time in milliseconds
     */
    setTimer(time) {
        const that = this;
        if (this.setTimeoutIsSet)
            return;

        this.setTimeoutIsSet = true;
        clearTimeout(this.timer);
        this.timer = setTimeout(function () {
            that.setTimeoutIsSet = false;
            let boundUpdateTicket = that.updateTicket.bind(that);
            boundUpdateTicket();
        }, time);
    }

    /**
     * Check if a local Proof exists wrapper
     *
     */
    async checkForValidProofLocalWrapper() {
        this.loading = true;
        this.preCheck = true;
        await this.checkForValidProofLocal();
        if (!this.greenPassHash || this.greenPassHash === -1) {
            this.hasValidProof = false;
            this.isSelfTest = false;
            this.isInternalTest = false;
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
        if (this.greenPassHash && this.greenPassHash !== -1 && this.hasValidProof) {
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
            this.isInternalTest = false;
            this.isSelfTest = false;
        }
    }

    /**
     * Generate a QR Code if a hash is avaible and valid,
     * updates the ticket and shows it in modal view
     *
     * @param {object} ticket
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
            await this.sendSuccessAnalyticsEvent('ShowTicket', 'Success', '');
        }
        await this.generateQrCode();
        this.currentTicket = ticket;
        let success = await this.updateTicket();
        if (!success) {
            this.currentTicket = {};
        }
        this.ticketLoading = false;

    }

    /**
     * Sends a delete Ticket Request for the specific entry,
     * Checks the response and update the listview
     *
     * @param {object} ticket
     */
    async deleteTicket(ticket) {
        let response = await this.sendDeleteTicketRequest(ticket.identifier);
        let responseBody = await response.clone();
        await this.checkDeleteTicketResponse(responseBody);

        await this.getListOfActiveTickets();
    }

    /**
     * Checks the response from DeleteTicketRequest
     * and notify the user
     *
     * @param {object} response
     */
    async checkDeleteTicketResponse(response) {
        const i18n = this._i18n;
        switch (response.status) {
            case 204:
                this.sendSuccessAnalyticsEvent("DeleteTicketRequest", 'Success', "");
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-success-title'),
                    "body": i18n.t('show-active-tickets.delete-ticket-success-body', {place: this.locationName}),
                    "type": "success",
                    "timeout": 5,
                });
                break;

            case 401:
                this.sendErrorAnalyticsEvent('DeleteTicketRequest', 'Loggedout', this.location, response);
                send({
                    "summary": i18n.t('show-active-tickets.logged-out-title'),
                    "body": i18n.t('show-active-tickets.logged-out-body'),
                    "type": "warning",
                    "timeout": 5,
                });
                break;

            case 404:
                this.sendErrorAnalyticsEvent('DeleteTicketRequest', 'NotFound', this.location, response);
                send({
                    "summary": i18n.t('show-active-tickets.delete-ticket-notfound-title'),
                    "body": i18n.t('show-active-tickets.delete-ticket-notfound-body', {place: this.locationName}),
                    "type": "warning",
                    "timeout": 5,
                });
                break;

            default:
                this.sendErrorAnalyticsEvent('DeleteTicketRequest', 'UnknownError', this.location, response);
                send({
                    "summary": i18n.t('show-active-tickets.other-error-title'),
                    "body": i18n.t('show-active-tickets.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
        this.locationName = '';
    }

    /**
     * Get a list of active tickets and checks the response of the request
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
     * @param {object} response
     */
    async checkActiveTicketsRequest(response) {
        let responseBody = await response.clone().json();
        if (responseBody !== undefined && response.status === 200) {
            this.activeTickets = this.parseActiveTickets(responseBody);
        } else {
            // else it failed, but we want to fail soft
            console.log("Update tickets failed");
        }
        this.loadingTickets = false;
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
                margin-top: 2.3em;
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

            #ticket-modal-box {
                display: flex;
                flex-direction: column;
                padding: 0px;
                min-width: 700px;
                max-width: 880px;
                min-height: unset;
                height: auto;
            }

            #qr-code-hash svg {
                display: block;
                width: 80%;
                margin: auto;
            }

            .green-pass-evidence {
                line-height: 30px;
            }

            .proof-container, .information-container {
                background-color: var(--dbp-info-bg-color);;
                color: var(--dbp-info-text-color);;
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

            .proof-container .int-link-external, .proof-container .int-link-internal, .information-container .int-link-internal {
                border-bottom: 1px solid white;;
            }

            .proof-container .int-link-external::after {
                filter: invert(100%);
                -webkit-filter: invert(100%);
            }

            .foto-container {
                width: 80%;
            }

            .foto-container img {
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

            .content-wrapper {
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

            .qr-code-wrapper.self-test-qr {
                margin: 20px auto;
                width: 60%;
            }

            .red {
                color: var(--dbp-danger-bg-color);
            }

            .green {
                color: var(--dbp-success-bg-color);
            }

            .warning {
                color: var(--dbp-info-bg-color);
            }

            .ticket h3 {
                margin-bottom: 0.2rem;
            }

            .ticket-loading {
                font-size: 1.3rem;
            }

            .flex {
                display: flex;
            }

            .flex-center {
                justify-content: center;
            }

            .reload-failed {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 1em;
            }

            .reload-failed p {
                color: var(--dbp-danger-bg-color);
                margin-top: 0px;
                margin-bottom: 0px;
            }

            #reload-btn {
                margin-left: 10px;
            }

            .hidden {
                display: none;
            }
            
            .qr-code-wrapper  {
                width: 100%;
            }

            @media only screen
            and (orientation: landscape)
            and (max-width: 768px) {
                #ticket-modal-box {
                    height: 100%;
                    width: 100%;
                    max-width: unset;
                    max-height: unset;
                }

                #ticket-modal-content, #ticket-modal-content > div:first-of-type, .content-wrapper, #qr-code-hash svg {
                    height: 100%;
                }

                .left-container, .proof-container, .information-container {
                    justify-content: space-evenly;
                }
                
                #qr-code-wrapper {
                    width: 80%;
                }
                
            }

            @media only screen
            and (orientation: portrait)
            and (max-width: 768px) {

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

                .left-container {
                    padding: 11px 20px 20px 20px;
                }

                .foto-container {
                    width: 100%;
                }

                #qr-code-hash svg {
                    width: 100%;
                }

                .content-wrapper {
                    display: flex;
                    flex-direction: column;
                    padding: 0px;
                    grid-gap: inherit;
                    min-height: 100vh;
                }

                .proof-container, .information-container {
                    padding: 12px 20px 20px 20px;
                    flex-grow: 1;
                }

                .new-ticket-button {
                    width: 100%;
                    display: block;
                    margin: auto;
                    box-sizing: border-box;
                }

                .reload-failed {
                    width: 90%;
                }
            }
        `;
    }


    render() {
        const i18n = this._i18n;
        const validTill = i18n.t('valid-till')
            + i18n.t('date-time', {
                clock: this.person.validUntil ? this.formatValidUntilTime(this.person.validUntil) : '',
                date: this.person.validUntil ? this.formatValidUntilDate(this.person.validUntil) : ''
            })
            + ". "
            + i18n.t('validity-tooltip', {place: this.locationName})
            + " "
            + i18n.t('validity-tooltip-ticket-text');

        const ticketTitle = html`
            ${i18n.t('show-active-tickets.show-ticket-title')}
            <strong>${this.locationName}</strong>
           `;


        const additionalInformation = html`
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

                                    <div class="proof-container ${classMap({hidden: !this.hasValidProof || this.ticketLoading, 'flex-center': this.isInternalTest})}">
                                        <div class="green-pass-evidence ${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                            <span class="${classMap({hidden: this.isInternalTest})}">
                                                <h4>${i18n.t('show-active-tickets.3-g-evidence-greenpass')}</h4>
                                            </span>
                                            <span class="${classMap({hidden: !this.isInternalTest})}">
                                                <h4>
                                                    <slot name="found-university-internal-test">
                                                        ${i18n.t('show-active-tickets.internal-test-found')}
                                                    </slot>
                                                </h4>
                                            </span>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <span>
                                                <h4>${i18n.t('show-active-tickets.self-test-found')}</h4>
                                                ${i18n.t('show-active-tickets.self-test-information')}
                                                <a class="int-link-external" title="${i18n.t('show-active-tickets.self-test')}" target="_blank" rel="noopener" href="${this.greenPassHash}">${i18n.t('show-active-tickets.self-test-link')}</a>
                                            </span>
                                        </div>
                                        <div class="qr-code-wrapper ${classMap({'self-test-qr': this.isSelfTest, hidden: this.isInternalTest})}">
                                            <div id="qr-code-hash"></div>
                                        </div>
                                        <div class="${classMap({hidden: !this.isInternalTest})}">
                                            <slot name="internal-test-text">
                                                <p>${i18n.t('show-active-tickets.internal-test-text')}</p>
                                            </slot>
                                        </div>
                                        <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                            <slot name="greenlight-reference-invalid">
                                                ${i18n.t('show-active-tickets.invalid-evidence')}
                                            </slot>
                                        </div>
                                    </div>

        `;

        const loading = html`
            <span class="control ${classMap({hidden: !this.loading && !this.loadingTickets})}">
                            <span class="loading">
                                <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                            </span>
                        </span>
        `;

        const noTickets = html`
            <div class="no-tickets ${classMap({hidden: !this.isLoggedIn() || this.loading || this.activeTickets.length !== 0 || this.loadingTickets})}">
                ${i18n.t('show-active-tickets.no-tickets-message')}
            </div>
        `;

        return html`

            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="notification is-danger ${classMap({hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-permission-message')}
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || !this.hasPermissions()})}">

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    ${this.activity.getDescription(this.lang)}
                </p>

                <div class="tickets ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    <div class="${classMap({hidden: this.loading})}">
                    ${this.activeTickets.map(ticket => html`
                        <div class="ticket">
                            <span class="header">
                                <h3>${i18n.t('show-active-tickets.entry-ticket')}: ${this.locationName}</h3>
                                <span class="header ${classMap({hidden: !this.hasValidProof})}">
                                    <span>
                                        <b>${i18n.t('show-active-tickets.status')}<span class="green">${i18n.t('show-active-tickets.status-active')}</span></b>
                                    </span>
                                    <span class="${classMap({hidden: this.isSelfTest || this.isInternalTest})}">
                                        <b>${i18n.t('show-active-tickets.3-g-evidence')}: <span class="green">${i18n.t('show-active-tickets.3-g-evidence-green-pass-valid')}</span></b>
                                        <dbp-info-tooltip class="tooltip" text-content="${validTill}" interactive></dbp-info-tooltip>
                                    </span>
                                    <span class="${classMap({hidden: !this.isSelfTest})}">
                                        <b>${i18n.t('show-active-tickets.3-g-evidence')}: <span class="warning">${i18n.t('show-active-tickets.3-g-evidence-selftest')}</span></b>
                                    </span>
                                    <span class="flex ${classMap({hidden: !this.isInternalTest})}">
                                        <slot name="internal-test-valid">
                                            <b>
                                                ${i18n.t('show-active-tickets.3-g-evidence')}:&nbsp
                                                <span class="green">
                                                    ${i18n.t('show-active-tickets.3-g-evidence-internal-test')}
                                                </span>
                                            </b>
                                        </slot>
                                        <dbp-info-tooltip class="tooltip" text-content="${validTill}" interactive></dbp-info-tooltip>
                                    </span>
                                </span>
                                <span class="header ${classMap({hidden: this.hasValidProof})}">
                                    <b>${i18n.t('show-active-tickets.status')}<span class="red">${i18n.t('show-active-tickets.status-inactive')}</span></b>
                                    <b>${i18n.t('show-active-tickets.3-g-evidence')}: <span class="red">${i18n.t('show-active-tickets.3-g-evidence-invalid')}</span></b>
                                    <span>
                                        <slot name="3-g-evidence-invalid-text"> <!-- TODO Use this slot and add a link to faq-->
                                            ${i18n.t('show-active-tickets.3-g-evidence-invalid-text')}
                                            ${i18n.t('show-active-tickets.3-g-evidence-maximize-saving')}
                                        </slot>
                                    </span>
                                </span>
                            </span>
                            <div class="btn">
                                <dbp-loading-button class="${classMap({hidden: !this.hasValidProof})}"
                                                    type="is-primary"
                                                    @click="${() => {this.showTicket(ticket);}}"
                                                    title="${i18n.t('show-active-tickets.show-btn-text')}">
                                    ${i18n.t('show-active-tickets.show-btn-text')}
                                </dbp-loading-button>
                                <a class="${classMap({hidden: this.hasValidProof})}" href="acquire-3g-ticket">
                                    <button class="button new-ticket-button" title="${i18n.t('show-active-tickets.new-ticket')}">${i18n.t('show-active-tickets.new-ticket')}</button>
                                </a>
                                <dbp-loading-button id="delete-btn"
                                                    @click="${() => {this.deleteTicket(ticket);}}"
                                                    title="${i18n.t('delete-btn-text')}">
                                    ${i18n.t('delete-btn-text')}
                                </dbp-loading-button>
                            </div>
                        </div>
                    `)}
                    </div>
                    ${noTickets}
                    ${loading}
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
                                        <h3 id="ticket-modal-title">
                                        ${ticketTitle}
                                    </h3>
                                    <div class="reload-failed ${classMap({hidden: !this.showReloadButton})}">
                                        <p> ${i18n.t('reload-failed')}</p>
                                        <button id="reload-btn" 
                                                class="button" 
                                                @click="${() => {this.updateTicketAndNotify();}}"
                                                title="${i18n.t('reload')}">
                                            <dbp-icon title="${i18n.t('reload')}" 
                                                    name="reload" class="reload-icon"></dbp-icon>
                                        </button>
                                    </div>
                                    <div class="foto-container">
                                        <img src="${this.ticketImage || ''}" 
                                                alt="${i18n.t('image-alt-text')}" />
                                    </div>
                                </div>
                                ${additionalInformation}
                                <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => {this.closeDialog();}}">
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