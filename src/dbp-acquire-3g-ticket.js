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
import {send} from '@dbp-toolkit/common/notification';
import {FileSource} from '@dbp-toolkit/file-handling';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from '@dbp-toolkit/qr-code-scanner';
import {escapeRegExp, i18nKey} from './utils.js';
import {Activity} from './activity.js';
import metadata from './dbp-acquire-3g-ticket.metadata.json';
import {getQRCodeFromFile} from './qrfilescanner.js';
import {InfoTooltip} from '@dbp-toolkit/tooltip';

class Acquire3GTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);

        this.loading = false;
        this.processStarted = false;
        this.preselectionLoading = true;
        this._activationInProgress = false;
        this.preCheck = true;

        this.preselectedOption = '';
        this.preselectionCheck = true;
        this.location = '';

        this.hasValidProof = false;
        this.hasTicket = false;

        this.trustButtonChecked = false;
        this.detailedError = '';

        this.showQrContainer = false;
        this.qrParsingLoading = false;
        this.QRCodeFile = null;

        this.wrongHash = [];
        this.wrongQR = [];
        this.resetWrongQr = false;
        this.resetWrongHash = false;
        this.greenPassHash = '';
        this.isInternalTest = false;
        this.isSelfTest = false;
        this.isConfirmChecked = false;

        this.person = {};

        this.message = '';

        this.proofUploadFailed = false;
        this.showCreateTicket = false;

        this.fileHandlingEnabledTargets = 'local';
        this.nextcloudWebAppPasswordURL = '';
        this.nextcloudWebDavURL = '';
        this.nextcloudName = '';
        this.nextcloudFileURL = '';
        this.nextcloudAuthInfo = '';
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-inline-notification': InlineNotification,
            'dbp-check-in-place-select': CheckInPlaceSelect,
            'dbp-textswitch': TextSwitch,
            'dbp-qr-code-scanner': QrCodeScanner,
            'dbp-file-source': FileSource,
            'dbp-info-tooltip': InfoTooltip,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            loading: {type: Boolean, attribute: false},
            processStarted: {type: Boolean, attribute: false},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            preselectedOption: {type: String, attribute: 'preselected-option'},
            hasValidProof: {type: Boolean, attribute: false},
            hasTicket: {type: Boolean, attribute: false},
            location: {type: String, attribute: false},
            showQrContainer: {type: Boolean, attribute: false},
            qrParsingLoading: {type: Boolean, attribute: false},
            status: {type: Object, attribute: false},
            wrongQR: {type: Array, attribute: false},
            wrongHash: {type: Array, attribute: false},
            QRCodeFile: {type: Object, attribute: false},
            trustButtonChecked: {type: Boolean, attribute: false},
            isConfirmChecked: {type: Boolean, attribute: false},
            person: {type: Object, attribute: false},
            isInternalTest: {type: Boolean, attribute: false},
            isSelfTest: {type: Boolean, attribute: false},
            preselectionLoading: {type: Boolean, attribute: false},

            proofUploadFailed: {type: Boolean, attribute: false},
            showCreateTicket: {type: Boolean, attribute: false},
            detailedError: {type: String, attribute: false},

            message: {type: String, attribute: false},

            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            nextcloudWebAppPasswordURL: {type: String, attribute: 'nextcloud-web-app-password-url'},
            nextcloudWebDavURL: {type: String, attribute: 'nextcloud-webdav-url'},
            nextcloudName: {type: String, attribute: 'nextcloud-name'},
            nextcloudFileURL: {type: String, attribute: 'nextcloud-file-url'},
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
        };
    }

    connectedCallback() {
        super.connectedCallback();
    }

    update(changedProperties) {
        let that = this;
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "lang":
                    this._i18n.changeLanguage(this.lang);
                    break;
                case "status":
                    if (oldValue !== undefined) {
                        setTimeout(function () {
                            that._("#notification-wrapper").scrollIntoView({behavior: 'smooth', block: 'end'});
                        }, 10);
                    }
                    break;
            }
        });
        super.update(changedProperties);
    }


    /**
     * Init a 3g activation from a QR code scan event
     *
     * @param event
     */
    async doActivationWithQR(event) {
        let data = event.detail['code'];
        event.stopPropagation();

        if (this._activationInProgress)
            return;
        this._activationInProgress = true;
        this.detailedError = '';

        try {
            await this.checkQRCode(data);
        } finally {
            this._activationInProgress = false;
            this.loading = false;
            this.scrollToConfirmButton();
        }
    }

    /**
     * Check uploaded file and search for QR code
     * If a QR Code is found, validate it and send an Activation Request
     *
     */
    async doActivationManually() {
        const i18n = this._i18n;

        if (this._activationInProgress)
            return;
        this._activationInProgress = true;
        this.loading = true;
        this.detailedError = '';


        let data = await this.searchQRInFile();
        if (data === null) {
            send({
                "summary": i18n.t('acquire-3g-ticket.invalid-title'),
                "body": i18n.t('acquire-3g-ticket.invalid-body'),
                "type": "danger",
                "timeout": 5,
            });

            this.message = i18nKey('acquire-3g-ticket.no-qr-code');
            this.proofUploadFailed = true;
            this._activationInProgress = false;
            this.loading = false;
            return;
        }
        try {
            await this.checkQRCode(data.data);
        } finally {
            this._activationInProgress = false;
            this.loading = false;
            this.scrollToConfirmButton();
        }
    }


    /**
     * Searches in the uploaded file for an QR Code
     * If the file is a pdf the search in all pages
     * The payload is null if no QR Code is found
     *
     * @returns {object} payload
     */
    async searchQRInFile() {
        return getQRCodeFromFile(this.QRCodeFile);
    }

    /**
     * Stop QR code reader and hide container
     *
     */
    stopQRReader() {
        if (this._("#qr-scanner")) {
            this._("#qr-scanner").stopScan = true;
            this.showQrContainer = false;
        } else {
            console.log('error: qr scanner is not available. Is it already stopped?');
        }
    }


    /**
     * Start QR code reader and show container
     *
     */
    showQrReader() {
        this.showQrContainer = true;
        if (this._('#qr-scanner')) {
            this._('#qr-scanner').stopScan = false;
        }
        //this._("#manualPassUploadWrapper").classList.add('hidden');
    }

    /**
     * Show manual pass upload container
     * and stop QR code scanner
     *
     */
    showManualUpload() {
        this._("#qr-scanner").stopScan = true;
        this.showQrContainer = false;

        this._(".proof-upload-container").scrollIntoView({behavior: 'smooth', block: 'start'});

        this.openFileSource();
    }

    /**
     * Uses textswitch, switches container (manually room select or QR room select
     *
     * @param name
     */
    uploadSwitch(name) {

        this.proofUploadFailed = false;
        if (name === "manual") {
            this.showManualUpload();
        } else {
            this.showQrReader();
        }
    }

    skipUpload() {
        this.proofUploadFailed = false;
        this.isConfirmChecked = false;
        if (this._("#digital-proof-mode"))
            this._("#digital-proof-mode").checked = false;
        if (this._("#text-switch"))
            this._("#text-switch")._active = "";
    }

    /*
     * Open the file source
     *
     */
    openFileSource() {
        const fileSource = this._("#file-source");
        if (fileSource) {
            this._("#file-source").openDialog();
        }
    }

    async getFilesToActivate(event) {

        this.QRCodeFile = event.detail.file;
        this.qrParsingLoading = true;
        this.hasValidProof = false;
        this.showCreateTicket = false;

        await this.doActivationManually();

        this.qrParsingLoading = false;
    }

    async sendGetTicketsRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/permits', options);
    }

    async checkForValidTickets() {

        let responseData = await this.sendGetTicketsRequest();

        let responseBody = await responseData.clone().json();
        let status = responseData.status;

        let numTypes = parseInt(responseBody['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }

        switch (status) {
            case 200:
                for (let i = 0; i < numTypes; i++) {
                    //For the case we have more then one possible ticket (places), we need to check here if it is the same ticket as the selected
                    this.hasTicket = true;
                    console.log('Found a valid ticket for this room.');
                }
                break;

            default:
                console.log("Get valid ticket request failed");
                break;
        }
    }

    async checkCreateTicketResponse(response) {
        const i18n = this._i18n;
        let checkInPlaceSelect;

        let responseBody = await response.clone().json();

        switch (response.status) {
            case 201:

                send({
                    "summary": i18n.t('acquire-3g-ticket.create-ticket-success-title'),
                    "body": i18n.t('acquire-3g-ticket.create-ticket-success-body', {place: this.location}),
                    "type": "success",
                    "timeout": 5,
                });

                this.location = this.preselectedOption;
                this.hasTicket = true;

                this.isConfirmChecked = false;
                if (this._("#digital-proof-mode")) {
                    this._("#digital-proof-mode").checked = false;
                }

                this.processStarted = false;
                this.showCreateTicket = false;

                if (this.hasValidProof) {
                    this.hasValidProof = false; //Could be expired until now
                    this.preCheck = true;
                    this.checkForValidProofLocal();
                }

                checkInPlaceSelect = this.shadowRoot.querySelector(this.getScopedTagName('dbp-check-in-place-select'));
                if (checkInPlaceSelect !== null) {
                    checkInPlaceSelect.clear();
                }

                this.preCheck = true; //initiates a new check and sets validProof to true

                break;

            case 400: // Invalid input
                switch (responseBody['relay:errorId']) {
                    case 'greenlight:consent-assurance-not-true':
                        this.sendErrorAnalyticsEvent('CreateTicketRequest', 'InvalidInput: consent-assurance-not-true', this.location, response);
                        send({
                            "summary": i18n.t('acquire-3g-ticket.confirm-not-checked-title'),
                            "body": i18n.t('acquire-3g-ticket.confirm-not-checked-body'),
                            "type": "danger",
                            "timeout": 5,
                        });
                        break;
                    case 'greenlight:additional-information-not-valid':
                        this.sendErrorAnalyticsEvent('CreateTicketRequest', 'InvalidInput: additional-information-not-valid', this.location, response);
                        send({
                            "summary": i18n.t('acquire-3g-ticket.other-error-title'),
                            "body": i18n.t('acquire-3g-ticket.other-error-body'),
                            "type": "danger",
                            "timeout": 5,
                        });
                        break;
                    default:
                        this.sendErrorAnalyticsEvent('CreateTicketRequest', 'InvalidInput: default', this.location, response);
                        send({
                            "summary": i18n.t('acquire-3g-ticket.other-error-title'),
                            "body": i18n.t('acquire-3g-ticket.other-error-body'),
                            "type": "danger",
                            "timeout": 5,
                        });
                        break;
                }
                break;

            case 403: // Forbidden - Access Denied
                this.sendErrorAnalyticsEvent('CreateTicketRequest', 'AccessDenied', this.location, response);
                send({
                    "summary": i18n.t('acquire-3g-ticket.other-error-title'),
                    "body": i18n.t('acquire-3g-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;

            case 422: // Unprocessable entity
                this.sendErrorAnalyticsEvent('CreateTicketRequest', 'UnprocessableEntity', this.location, response);
                send({
                    "summary": i18n.t('acquire-3g-ticket.other-error-title'),
                    "body": i18n.t('acquire-3g-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;

            case 500: // Can't process Data
                this.sendErrorAnalyticsEvent('CreateTicketRequest', 'ErrorInData', this.location, response);
                send({
                    "summary": i18n.t('acquire-3g-ticket.other-error-title'),
                    "body": i18n.t('acquire-3g-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
            // Error: something else doesn't work
            default:
                this.sendErrorAnalyticsEvent('CreateTicketRequest', 'UnknownError', this.location, response);
                send({
                    "summary": i18n.t('acquire-3g-ticket.other-error-title'),
                    "body": i18n.t('acquire-3g-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });
                break;
        }
    }

    async createTicket(event) {
        const i18n = this._i18n;
        let button = event.target;
        let response;

        if (!this.isConfirmChecked) {
            send({
                "summary": i18n.t('acquire-3g-ticket.confirm-not-checked-title'),
                "body": i18n.t('acquire-3g-ticket.confirm-not-checked-body'),
                "type": "danger",
                "timeout": 8,
            });
            return;
        }

        button.start();
        try {
            response = await this.sendCreateTicketRequest();
            await this.checkCreateTicketResponse(response);
        } finally {
            button.stop();
        }
    }

    setLocation(event) {
        if (event.detail.room) {
            this.location = event.detail.name;
            this.checkForValidProofLocal(); //Check this each time because proof validity could expire
            this.checkForValidTickets();
        } else {
            this.location = '';
        }
    }

    checkConfirmCheckmark() {
        this.isConfirmChecked = this._("#digital-proof-mode") && this._("#digital-proof-mode").checked;
    }

    checkTrustButtonCheckmark() {
        this.trustButtonChecked = this._("#trust-button") && this._("#trust-button").checked;
    }

    async removeProof() {
        await this.clearLocalStorage();
        if (this._("#trust-button")) {
            this._("#trust-button").checked = true;
            this.trustButtonChecked = this._("#trust-button") && this._("#trust-button").checked;
        }
        this.hasValidProof = false;
        this.showCreateTicket = false;
        this.greenPassHash = '';
    }

    async scrollToConfirmButton() {
        await this.showCreateTicket === true;
        if (this.showCreateTicket && this._("#scrollToConfirmBtn")) {
            this._("#scrollToConfirmBtn").scrollIntoView({ behavior: 'smooth', block: 'end' });
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
            ${commonStyles.getActivityCSS()}
            ${commonStyles.getLinkCss()}
            h2 {
                margin-top: 0;
            }

            h3 {
                margin-top: 2rem;
            }

            #last-checkbox {
                margin-top: 1rem;
                margin-bottom: 1.5rem;
            }

            .checkmark {
                height: 18px;
                width: 18px;
                top: 5px;
            }

            .button-container input[type="checkbox"]:checked ~ .checkmark::after {
                top: 1px;
                left: 6px;
            }

            .info-icon {
                padding-left: 5px;
            }

            .tickets-notifications {
                margin-top: 3rem;
            }

            .store-cert-checkmark-wrapper {
                margin-top: 1rem;
            }

            .notification-wrapper {
                margin-top: 1.5rem;
            }

            .proof-upload-container {
                margin-top: 1.5rem;
            }

            .cert-found-checkbox-wrapper {
                margin-top: 1rem;
                display: flex;
            }

            .control {
                align-self: center;
            }

            .qr-loading {
                padding: 0 0 0 1em;
            }

            .btn-container {
                display: flex;
                justify-content: space-between;
            }

            .btn {
                display: contents;
            }

            .grid-container {
                margin-top: 2rem;
                padding-top: 2rem;
                flex-flow: column;
            }

            #text-switch {
                width: 50%;
            }

            /* Chrome, Safari, Edge, Opera */
            input::-webkit-outer-spin-button,
            input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }

            /* Firefox */
            input[type=number] {
                -moz-appearance: textfield;
            }

            @keyframes linkIconOut {
                0% {
                    filter: invert(100%);
                    -webkit-filter: invert(100%);
                }
                100% {
                    filter: invert(0%);
                    -webkit-filter: invert(0%);
                }
            }

            .activations-btn {
                display: grid;
                grid-template-columns: repeat(2, max-content);
                column-gap: 10px;
                row-gap: 10px;
            }

            .activations {
                display: flex;
                justify-content: space-between;
            }

            .header {
                display: grid;
                align-items: center;
            }

            .show-file {
                margin-right: 15px;
            }

            .file-block {
                margin-top: 2rem;
                display: inline-block;
                width: 100%;
            }

            label.button {
                display: inline-block;
            }

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
                margin-top: 1.5rem;
                margin-bottom: 1.5rem;
            }

            .close-icon {
                color: var(--dbp-danger-bg-color);
                display: inline;
            }

            #no-proof-continue-btn {
                margin-top: 1.5rem;
            }

            #manual-proof-checkmark {
                margin-top: 9px;
            }

            .border {
                margin-top: 2rem;
                margin-bottom: 2rem;
                border-top: 1px solid black;
            }

            .field {
                margin-top: 1rem;
            }

            .int-link-internal {
                transition: background-color 0.15s, color 0.15s;
                border-bottom: 1px solid rgba(0, 0, 0, 0.3);
            }

            .int-link-internal:hover {
                background-color: black;
                color: white;
                text-decoration: none;
            }

            .inline-notification .int-link-internal {
                border-bottom-color: var(--dbp-primary-text-color);
            }

            .check-icon {
                font-size: 18px;
                opacity: 0.7;
                padding: 0px 4px;
            }

            .g-proof-information {
                margin: 1.5em 0;
                border: var(--dbp-border-width) solid var(--dbp-border-color);
                padding: 1.25rem 1.5rem 1.25rem 1.5rem;
                border-radius: var(--dbp-border-radius);
                display: flex;
                justify-content: space-between;
            }

            .g-proof-information h4 {
                margin-top: 0px;
                margin-bottom: 0.5em;
            }

            .wrapper {
                margin: 1.5em 0;
            }

            .confirm-btn label {
                margin-top: 1em;
            }

            .element {
                margin-top: 1.5rem;
            }

            @media only screen
            and (orientation: portrait)
            and (max-width: 768px) {

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

                .btn-container {
                    flex-direction: column;
                    row-gap: 1.5em;
                }

                .qr-loading {
                    padding: 1em;
                }

                .header {
                    margin-bottom: 0.5rem;
                    white-space: initial;
                }

                .btn {
                    display: flex;
                    flex-direction: column;
                    text-align: center;
                }

                .logout {
                    width: 100%;
                    box-sizing: border-box;
                }

                #text-switch {
                    display: block;
                    width: 100%;
                }

                #refresh-btn {
                    margin-top: 0.5rem;
                }

                .loading {
                    justify-content: center;
                }

                .activations {
                    display: block;
                }

                .activations-btn {
                    display: flex;
                    flex-direction: column;
                }

                #confirm-ticket-btn, #start-ticket-btn {
                    width: 100%;
                    margin-bottom: 0.5em;
                }

                .g-proof-information {
                    flex-direction: column;
                }

                .checkmark {
                    top: 10%;
                }
            }
        `;

    }

    _onScanStarted(e) {
        // We want to scroll after the next re-layout
        requestAnimationFrame(() => {
            setTimeout(() => {
                this._("#qr-scanner").scrollIntoView({behavior: 'smooth', block: 'start'});
            }, 0);
        });
    }

    render() {
        const i18n = this._i18n;
        const matchRegexString = '.*' + escapeRegExp(this.searchHashString) + '.*';

        if (this.isLoggedIn() && !this.isLoading() && this.preCheck && !this.loading) {
            this.loading = true;
            this.checkForValidProofLocal().then(() => {
                this.loading = false;
            });
        }

        if (this.isLoggedIn() && !this.isLoading() && this.preselectedOption && this.preselectedOption !== '' && this.preselectionCheck) {
            this.location = this.preselectedOption;
            this.checkForValidTickets().then(() => {
                this.preselectionLoading = false;
            });
            this.preselectionCheck = false;
        }

        return html`
            <div class="notification is-warning ${classMap({hidden: this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-login-message')}
            </div>

            <div class="notification is-danger ${classMap({hidden: this.hasPermissions() || !this.isLoggedIn() || this.isLoading()})}">
                ${i18n.t('error-permission-message')}
            </div>

            <div class="control ${classMap({hidden: this.isLoggedIn() || !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: !this.isLoggedIn() || this.isLoading() || !this.hasPermissions()})}">

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">
                        ${this.activity.getDescription(this.lang)}
                    </slot>
                </p>
                <div>
                    <slot name="additional-information">
                        <p>${i18n.t('acquire-3g-ticket.additional-information')}</p>
                    </slot>
                </div>

                <div class="control ${classMap({hidden: !this.preCheck && !this.preselectionCheck && !this.preselectionLoading})}">
                    <span class="loading">
                        <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                    </span>
                </div>

            ${this.hasPermissions() ? 
            html` 

                    <!-- Create ticket start -->
                    <div class="container ${classMap({'hidden': this.processStarted || this.preCheck || this.preselectionCheck || this.preselectionLoading})}">
                        <div class="tickets-wrapper ${classMap({'hidden': !this.hasTicket || !this.hasValidProof})}">
                            <dbp-inline-notification class="inline-notification">
                                <div slot="body">
                                    ${i18n.t('acquire-3g-ticket.manage-tickets-text')}
                                    <a href='#' @click="${
                                            (e) => {
                                                this.dispatchEvent(new CustomEvent('dbp-show-activity', {detail: {'name': 'show-tickets'}}));
                                                e.preventDefault();
                                            }
                                    }" title='${i18n.t('acquire-3g-ticket.manage-tickets-link')}' class="int-link-internal">
                                        <span>${i18n.t('acquire-3g-ticket.manage-tickets-link')}.</span>
                                    </a>
                                </div>
                            </dbp-inline-notification>
                        </div>

                        ${!this.preselectionLoading ? html`
                            <dbp-loading-button
                                    type="${!this.hasTicket || !this.hasValidProof ? "is-primary" : ""}"
                                    id="start-ticket-btn"
                                    value="${!this.hasTicket ? i18n.t('acquire-3g-ticket.request-ticket-button-text') : i18n.t('acquire-3g-ticket.create-new-ticket')}"
                                    @click="${() => {
                                        this.processStarted = true;
                                        this.scrollToConfirmButton();
                                    }}"
                                    title="${i18n.t('acquire-3g-ticket.request-ticket-button-text')}"
                            ></dbp-loading-button>
                        ` : ``}

                    </div>
                    <!-- Create ticket start end -->

                    <div class="border ${classMap({'hidden': !this.processStarted})}"></div>

                    <div class="container ${classMap({'hidden': !this.processStarted})}">
                        <!-- Place Selector -->
                        <div class="field ${classMap({'hidden': this.preselectedOption && this.preselectedOption !== ''})}">
                            <h3>${i18n.t('acquire-3g-ticket.place-select-title')}</h3>
                            <div class="control">
                                <dbp-check-in-place-select subscribe="auth" lang="${this.lang}"
                                                        entry-point-url="${this.entryPointUrl}" @change="${(event) => {
                                    this.setLocation(event);
                                }}"></dbp-check-in-place-select>
                            </div>
                        </div>

                        <!-- 3G Proof Upload -->
                        <div class="proof-upload-container ${classMap({'hidden': this.location === '' || this.showCreateTicket})}">

                            <h3>${i18n.t('acquire-3g-ticket.3g-proof-label-text')}</h3>

                            <label id="last-checkbox" class="button-container">
                                ${i18n.t('acquire-3g-ticket.trust-and-save-1')}
                                <dbp-info-tooltip class="info-tooltip"
                                                text-content="${i18n.t('acquire-3g-ticket.trust-and-save-2')}"></dbp-info-tooltip>
                                <input type="checkbox" id="trust-button" name="trust-button" value="trust-button"
                                    @click="${this.checkTrustButtonCheckmark}">
                                <span class="checkmark" id="trust-button-checkmark"></span>
                            </label>

                            <div id="btn-container" class="btn-container wrapper">
                                <dbp-textswitch id="text-switch" name1="qr-reader"
                                                ?disabled="${!this.trustButtonChecked}"
                                                name2="manual"
                                                name="${i18n.t('acquire-3g-ticket.qr-button-text')} || ${i18n.t('acquire-3g-ticket.manually-button-text')}"
                                                class="switch"
                                                value1="${i18n.t('acquire-3g-ticket.qr-button-text')}"
                                                value2="${i18n.t('acquire-3g-ticket.manually-button-text')}"
                                                @change=${(e) => this.uploadSwitch(e.target.name)}></dbp-textswitch>
                            </div>

                            <dbp-file-source
                                    id="file-source"
                                    context="${i18n.t('acquire-3g-ticket.filepicker-context')}"
                                    allowed-mime-types="image/*,application/pdf,.pdf"
                                    nextcloud-auth-url="${this.nextcloudWebAppPasswordURL}"
                                    nextcloud-web-dav-url="${this.nextcloudWebDavURL}"
                                    nextcloud-name="${this.nextcloudName}"
                                    nextcloud-file-url="${this.nextcloudFileURL}"
                                    nexcloud-auth-info="${this.nextcloudAuthInfo}"
                                    enabled-targets="${this.fileHandlingEnabledTargets}"
                                    decompress-zip
                                    lang="${this.lang}"
                                    text="${i18n.t('acquire-3g-ticket.filepicker-context')}"
                                    button-label="${i18n.t('acquire-3g-ticket.filepicker-button-title')}"
                                    number-of-files="1"
                                    @dbp-file-source-file-selected="${this.getFilesToActivate}"
                            ></dbp-file-source>

                            <div class="border ${classMap({hidden: !this.showQrContainer})}">
                                <div class="element">
                                    <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan
                                                        match-regex="${matchRegexString}"
                                                        @scan-started="${this._onScanStarted}"
                                                        @code-detected="${(event) => {
                                                            this.doActivationWithQR(event);
                                                        }}"></dbp-qr-code-scanner>
                                </div>

                                <div class="control ${classMap({hidden: !this.loading})}">
                                        <span class="loading">
                                            <dbp-mini-spinner></dbp-mini-spinner>
                                        </span>
                                </div>
                            </div>

                            <div class="control ${classMap({hidden: !this.qrParsingLoading})}">
                                        <span class="qr-loading">
                                            <dbp-mini-spinner
                                                    text=${i18n.t('acquire-3g-ticket.manual-uploading-message')}></dbp-mini-spinner>
                                        </span>

                            </div>
                        </div>
                        <!-- End 3G Proof Upload-->

                        <!-- Show Proof -->
                        <h3 class="${classMap({hidden: !this.showCreateTicket})}">
                            ${i18n.t('acquire-3g-ticket.create-ticket')}</h3>
                        <div class="${classMap({hidden: this.location === '' || this.loading})}">
                            <div class="${classMap({'hidden': !this.hasValidProof || this.loading})}">
                                <dbp-icon name='checkmark-circle' class="check-icon"></dbp-icon>
                                ${i18n.t(this.message)}
                            </div>
                            <div class="no-proof-found ${classMap({hidden: !this.proofUploadFailed || this.loading})}">
                                <!-- <dbp-icon name='cross-circle' class="close-icon"></dbp-icon> -->
                                <div class="close-icon">${i18n.t(this.message, { place: this.location })}</div>
                                ${this.detailedError ? html`
                                    <dbp-info-tooltip class="info-tooltip"
                                                    text-content="${i18n.t('acquire-3g-ticket.invalid-document-prefix') + (this.detailedError).replaceAll(/\n/g, '<br>')}"
                                                    interactive></dbp-info-tooltip>` : ``}
                            </div>
                        </div>
                        <div class="notification-wrapper ${classMap({hidden: this.location === '' || !this.showCreateTicket})}">
                            <div class="g-proof-information">
                                <div class="${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                        <span class="header">
                                            <h4>${i18n.t('acquire-3g-ticket.3g-proof')}</h4> 
                                            <span>${i18n.t('acquire-3g-ticket.3g-proof-status')}: 
                                                <strong>${i18n.t('acquire-3g-ticket.valid-till')}${i18n.t('date-time', {
                                                    clock: this.person.validUntil ?
                                                            this.formatValidUntilTime(this.person.validUntil) : '',
                                                    date: this.person.validUntil ? this.formatValidUntilDate(this.person.validUntil) : ''
                                                })}
                                                </strong>
                                                <dbp-info-tooltip class="info-tooltip" text-content='${ i18n.t('validity-tooltip', { place: this.location }) }' interactive></dbp-info-tooltip>

                                            </span> 
                                            <br> ${i18n.t('acquire-3g-ticket.3g-proof-proof-from')}
                                            : ${this.person.firstname ? this.person.firstname + " " : ""}
                                            ${this.person.lastname} ${this.person.dob ? html`
                                            <br>${i18n.t('acquire-3g-ticket.3g-proof-birthdate')}: ${this.person.dob}` : ""}
                                        </span>
                                </div>
                                <div class="${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                        <span class="header">
                                            <h4>${i18n.t('acquire-3g-ticket.self-test')}</h4> 
                                            ${i18n.t('acquire-3g-ticket.self-test-information')}
                                            <span>${i18n.t('acquire-3g-ticket.self-test-link')}: <a
                                                    class="int-link-external"
                                                    title="${i18n.t('acquire-3g-ticket.self-test')}" target="_blank"
                                                    rel="noopener"
                                                    href="${this.greenPassHash}">${this.greenPassHash}</a></span>
                                        </span>
                                </div>
                                <dbp-loading-button id="remove-proof-btn"
                                                    value="${i18n.t('acquire-3g-ticket.remove-proof')}"
                                                    @click="${() => {
                                                        this.removeProof();
                                                    }}"
                                                    title="${i18n.t('acquire-3g-ticket.remove-proof')}"
                                ></dbp-loading-button>
                            </div>

                        </div>
                        <!-- End Show Proof -->

                        <!-- Create Ticket part -->
                        <div class="confirm-btn wrapper ${classMap({hidden: !this.showCreateTicket })}">
                            <div>
                                <label id="last-checkbox" class="button-container">
                                    ${i18n.t('acquire-3g-ticket.confirm-checkbox-valid-cert-text')}
                                    <input type="checkbox" id="digital-proof-mode" name="digital-proof-mode"
                                        value="digital-proof-mode" @click="${this.checkConfirmCheckmark}">
                                    <span class="checkmark" id="digital-proof-checkmark"></span>
                                </label>

                                <dbp-loading-button
                                        ?disabled="${this.loading || this.location === '' || !this.isConfirmChecked}"
                                        type="is-primary"
                                        id="confirm-ticket-btn"
                                        @click="${(event) => {this.createTicket(event);}}"
                                        title="${i18n.t('acquire-3g-ticket.create-ticket')}">
                                    ${i18n.t('acquire-3g-ticket.create-ticket')}
                                </dbp-loading-button>
                                <div id="scrollToConfirmBtn"></div>
                            </div>

                        </div>
                        <!-- End Create Ticket part -->
                    </div>
            ` : html`
            </div>
            `}
        `;
    }
}

commonUtils.defineCustomElement('dbp-acquire-3g-ticket', Acquire3GTicket);