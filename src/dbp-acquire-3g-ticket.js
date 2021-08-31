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
import {FileSource} from '@dbp-toolkit/file-handling';
import {TextSwitch} from './textswitch.js';
import {QrCodeScanner} from '@dbp-toolkit/qr-code-scanner';
import {escapeRegExp} from './utils.js';
//import tippy from 'tippy.js';
import stringSimilarity from 'string-similarity';
import {Activity} from './activity.js';
import metadata from './dbp-acquire-3g-ticket.metadata.json';
import {getQRCodeFromFile} from './qrfilescanner.js';
import {hcertValidation} from './hcert';

//console.log('ok nice!', tippy);

class Acquire3GTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);

        this.loading = false;
        this.preselectedOption = '';
        this.preselectionCheck = true;

        this.hasValidProof = false;
        this.hasLocalStorageProof = false;
        this.hasTicket = false;
        this.hasTicketForThisPlace = false;
        this.location = '';
        this.isCheckmarkChecked = false;

        this.activationEndTime = '';
        this.identifier = '';
        this.agent = '';

        this.showQrContainer = false;
        this.qrParsingLoading = false;
        this.QRCodeFile = null;

        this.searchHashString = '';
        this.searchSelfTestStringArray = '';
        this.wrongHash = [];
        this.wrongQR = [];
        this.resetWrongQr = false;
        this.resetWrongHash = false;
        this.greenPassHash = '';

        this._activationInProgress = false;
        this.preCheck = true;

        this.isSelfTest = false;
        this.isUploadSkipped = false;
        this.isConfirmChecked = false;
        this.storeCertificate = false;
        this.uploadNewProof = false;
        this.useLocalStorage = false;
        this.showCertificateSwitch = true;

        this.person = {};

        this.fileHandlingEnabledTargets = 'local';

        this.nextcloudWebAppPasswordURL = '';
        this.nextcloudWebDavURL = '';
        this.nextcloudName = '';
        this.nextcloudFileURL = '';
        this.nextcloudAuthInfo = '';

        //this.tippy = '';

        this.message = '';

        this.showProofUpload = true;
        this.proofUploadFailed = false;
        this.showCreateTicket = false;
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
            'dbp-inline-notification': InlineNotification,
            'dbp-check-in-place-select': CheckInPlaceSelect, //TODO replace with correct place selector
            'dbp-textswitch': TextSwitch,
            'dbp-qr-code-scanner': QrCodeScanner,
            'dbp-file-source': FileSource,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            loading: { type: Boolean, attribute: false },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            preselectedOption: { type: String, attribute: 'preselected-option' },
            hasValidProof: { type: Boolean, attribute: false },
            hasTicket: { type: Boolean, attribute: false },
            hasTicketForThisPlace: { type: Boolean, attribute: false },
            location: { type: String, attribute: false },
            isCheckmarkChecked: { type: Boolean, attribute: false },
            showQrContainer: { type: Boolean, attribute: false},
            activationEndTime: { type: String, attribute: false },
            searchHashString: { type: String, attribute: 'gp-search-hash-string' },
            qrParsingLoading: {type: Boolean, attribute: false},
            status: { type: Object, attribute: false },
            wrongQR : { type: Array, attribute: false },
            wrongHash : { type: Array, attribute: false },
            hasLocalStorageProof: { type: Boolean, attribute: false },
            QRCodeFile: { type: Object, attribute: false },
            isUploadSkipped: { type: Boolean, attribute: false },
            isConfirmChecked: { type: Boolean, attribute: false },
            storeCertificate: { type: Boolean, attribute: false },
            uploadNewProof: { type: Boolean, attribute: false },
            useLocalStorage: { type: Boolean, attribute: false },
            showCertificateSwitch: { type: Boolean, attribute: false },
            person: { type: Object, attribute: false },
            isSelfTest: { type: Boolean, attribute: false },

            showProofUpload: { type: Boolean, attribute: false },
            proofUploadFailed: { type: Boolean, attribute: false },
            showCreateTicket: { type: Boolean, attribute: false },

            message: { type: String, attribute: false },

            searchSelfTestStringArray: { type: String, attribute: 'gp-search-self-test-string-array' },

            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            nextcloudWebAppPasswordURL: { type: String, attribute: 'nextcloud-web-app-password-url' },
            nextcloudWebDavURL: { type: String, attribute: 'nextcloud-webdav-url' },
            nextcloudName: { type: String, attribute: 'nextcloud-name' },
            nextcloudFileURL: { type: String, attribute: 'nextcloud-file-url' },
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
        };
    }

    firstUpdated() {
        /*if (this._('[data-tippy-content]')) {
            console.log("tippy it", this._('[data-tippy-content]'));

           tippy('#singleElement', {
                content: 'Tooltip',
            });
            tippy (this._('[data-tippy-content]'))

        }
        else {
            console.log("no tippy");
        };*/
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
                            that._("#notification-wrapper").scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }, 10);
                    }
                    break;
            }
        });

        super.update(changedProperties);
    }

    /**
     * Splits a birthday string.
     *
     * @param string | null string
     * @returns {Array} birthdate
     */
    async splitBirthdayString(string)
    {
        let parts = string.split('-');
        let birthdate = {};
        birthdate.year = parts[0] ? parts[0] : null;
        birthdate.month = parts[1] ? parts[1] : null;
        birthdate.day = parts[2] ? parts[2] : null;

        return birthdate;
    }



    /**
     * Compares two birthday strings.
     *
     * @param {?string} string1 - an empty string, only a day, day and month or the full birthdate
     * @param {?string} string2 - an empty string, only a day, day and month or the full birthdate
     * @returns {(number | boolean)} matcher - returns the maximal matching number
     */
    async compareBirthdayStrings(string1, string2)
    {
        if (string1 === null || string1 === '' || string2 === null || string2 === '') {
            // if a birthday is not set, return true
            return true;
        }
        let parts1 = await this.splitBirthdayString(string1);
        let parts2 = await this.splitBirthdayString(string2);
        let matcher = 0;

        if (parts1.day && parts2.day && parts1.day !== parts2.day) {
            // if days are set but don't match, return false
            return false;
        } else {
            matcher = matcher + 1;
            if (parts1.month && parts2.month && parts1.month !== parts2.month) {
                // if months are set but don't match, return false
                return false;
            } else {
                matcher = matcher + 1;
                if (parts1.year !== parts2.year) {
                    // if years don't match, return false
                    return false;
                }
            }
        }
        matcher = matcher + 1;


        return matcher;
    }

    /**
     * Checks if a person is another person
     *
     * @param {string} firstName
     * @param {string} lastName
     * @param {string} dob
     * @param {string} personFirstName
     * @param {string} personLastName
     * @param {string} personDob
     * @returns {boolean} - returns if the person mathes with the other person
     */
    async checkPerson(firstName, lastName, dob, personFirstName, personLastName, personDob) {
        let match = await this.compareBirthdayStrings(personDob, dob);
        if (!match) {
            return false;
        }


        // if birdthdate could be checked in day, month and year then we can lower the impact of the name matching
        const percent = match === 3 ? 80 : 50;

        let firstNameSimilarityPercent = 0;
        // check firstname if there is one set in the certificate
        if (firstName !== "") {

            let personFirstNameShorted = personFirstName.split(" ");
            let firstNameShorted = firstName.split(" ");
            firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[0]) * 100;

            if (personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
                firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[0]) * 100;
            }
            if (firstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
                firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[0], firstNameShorted[1]) * 100;
            }
            if (firstNameShorted[1] !== null && personFirstNameShorted[1] !== null && firstNameSimilarityPercent <= match) {
                firstNameSimilarityPercent = stringSimilarity.compareTwoStrings(personFirstNameShorted[1], firstNameShorted[1]) * 100;
            }
            // return false if firstname isn't similar enough
            if (firstNameSimilarityPercent < percent) {
                return false;
            }
        }
        let lastNameSimilarityPercent = stringSimilarity.compareTwoStrings(lastName, personLastName) * 100;

        // return false if lastname isn't similar enough
        return lastNameSimilarityPercent >= percent;
    }

    /**
     * Parse the response of a green pass activation request
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: activation, refresh session, invalid input, green pass hash wrong
     * no permissions, any other errors, green pass hash empty
     *
     * @param responseData
     * @param greenPassHash
     * @param category
     * @param preCheck
     */
    async checkActivationResponse(responseData, greenPassHash, category, preCheck) {
        const i18n = this._i18n;

        let status = responseData.status;
        let responseBody = responseData.data;
        switch (status) {
            case 201:
                // Check Person
                if (this.auth && this.auth.person && !await this.checkPerson(responseBody.firstname, responseBody.lastname, responseBody.dob, this.auth.person.givenName, this.auth.person.familyName, this.auth.person.birthDate))
                {

                    send({
                        "summary": i18n.t('green-pass-activation.failed-activation-wrong-person-title'),
                        "body": i18n.t('green-pass-activation.failed-activation-wrong-person-body'),
                        "type": "warning",
                        "timeout": 5,
                    });

                    this.proofUploadFailed = true;
                    this.hasValidProof = false;
                    this.message = i18n.t('acquire-3g-ticket.not-same-person');
                    return;

                }

                this.person.firstname = responseBody.firstname;
                this.person.lastname = responseBody.lastname;
                this.person.dob = responseBody.dob;

                this.stopQRReader();
                this.QRCodeFile = null;
                this.showQrContainer = false;

                this.hasValidProof = true;
                this.proofUploadFailed = false;

                this.isSelfTest = false;

                if (this.uploadNewProof) {
                    this.uploadNewProof = false;
                }

                this._("#text-switch")._active = "";


                if (preCheck) {
                    console.log("Found a proof in local storage");
                    this.hasLocalStorageProof = true;
                    this.storeCertificate = true;
                    if (this._("#store-cert-mode")) {
                        this._("#store-cert-mode").checked = true;
                    }
                    this.message = i18n.t('acquire-3g-ticket.found-valid-3g-preCheck');
                } else {
                    this.message = i18n.t('acquire-3g-ticket.found-valid-3g');
                    send({
                        "summary": i18n.t('green-pass-activation.found-valid-3g-title'),
                        "body": i18n.t('green-pass-activation.found-valid-3g-body'),
                        "type": "success",
                        "timeout": 5,
                    });
                }
                break;
            case 403: // HCert has expired
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.hcert-invalid');
                this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.hcert-invalid-title'), i18n.t('acquire-3g-ticket.hcert-invalid-body', greenPassHash));
                break;
            case 422: // HCert has expired
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.hcert-invalid');
                this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.hcert-invalid-title'), i18n.t('acquire-3g-ticket.hcert-invalid-body', greenPassHash));
                break;
            case 500: // Can't process Data
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.cannot-process-data');
                this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.cannot-process-data-title'), i18n.t('acquire-3g-ticket.cannot-process-body', greenPassHash));
                break;
            // Error: something else doesn't work
            default:
                this.proofUploadFailed = true;
                this.hasValidProof = false;
                this.message = i18n.t('acquire-3g-ticket.validate-error');
                this.saveWrongHashAndNotify(i18n.t('acquire-3g-ticket.validate-error-title'), i18n.t('acquire-3g-ticket.validate-error-body', greenPassHash));
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailed', 'name': locationName});
                break;
        }
    }






    /**
     * Sends an activation request and do error handling and parsing
     * Include message for user when it worked or not
     * Saves invalid QR codes in array in this.wrongHash, so no multiple requests are send
     *
     * Possible paths: activation, invalid input, gp hash wrong
     * no permissions, any other errors, gp hash empty
     *
     * @param greenPassHash
     * @param category
     * @param precheck
     */
    async doActivation(greenPassHash, category, precheck = false) {
        const i18n = this._i18n;
        // Error: no valid hash detected
        if (greenPassHash.length <= 0) {
            this.saveWrongHashAndNotify(i18n.t('green-pass-activation.invalid-qr-code-title'), i18n.t('green-pass-activation.invalid-qr-code-body'), greenPassHash);
            return;
        }

        let responseData = await hcertValidation(greenPassHash);
        await this.checkActivationResponse(responseData, greenPassHash, category, precheck);
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

        try {
            await this.checkQRCode(data);
        } finally {
            this._activationInProgress = false;
            this.loading = false;
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


        let data = await this.searchQRInFile();
        if (data === null) {
            send({
                "summary": i18n.t('green-pass-activation.no-qr-code-title'),
                "body": i18n.t('green-pass-activation.no-qr-code-body'),
                "type": "danger",
                "timeout": 5,
            });

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
        }
    }

    async checkQRCode(data) {
        let check = await this.decodeUrlWithoutCheck(data, this.searchHashString);
        if (check) {
            this.greenPassHash = data;
            console.log("gp", this.greenPassHash);
            this.isSelfTest = false;
            this.hasValidProof = true;
            this.proofUploadFailed = false;

            await this.doActivation(this.greenPassHash, 'ActivationRequest', this.preCheck);
            return;
        }

        let selfTestURL = '';
        const array = this.searchSelfTestStringArray.split(",");
        for (const selfTestString of array) {
            check = await this.decodeUrlWithoutCheck(data, selfTestString);
            if (check) {
                selfTestURL = data;
                break;
            }
        }

        if (check && selfTestURL !== '') {
            const i18n = this._i18n;

            if (!this.preCheck) {
                send({
                    "summary": i18n.t('green-pass-activation.selfetest-title'),
                    "body":  i18n.t('green-pass-activation.selfetest-body'),
                    "type": "success",
                    "timeout": 5,
                });
                this.message = i18n.t('acquire-3g-ticket.found-valid-selfetest');
            } else {
                this.message = i18n.t('acquire-3g-ticket.found-valid-selfetest-preCheck');
                this.hasLocalStorageProof = true;
            }

            this.isSelfTest = true;
            this.greenPassHash = selfTestURL;

            this.stopQRReader();
            this.QRCodeFile = null;
            this.showQrContainer = false;

            this.hasValidProof = true;
            this.proofUploadFailed = false;

            if (this.uploadNewProof) {
                this.uploadNewProof = false;
            }

            this._("#text-switch")._active = "";


        } else {
            await this.checkAlreadySend(data.data, this.resetWrongQr, this.wrongQR);
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
        if ( this._('#qr-scanner') ) {
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

        this._(".proof-upload-container").scrollIntoView({ behavior: 'smooth', block: 'start' });

        this.openFileSource();
    }

    /**
     * Checks if the validity of the 3G proof expires in the next 12 hours
     *
     * @returns {boolean} true if the 3G proof is valid for the next 12 hours
     */
    checkIfCertificateIsExpiring() {
        const hours = 12;
        let newDate = new Date();
        let currDate = new Date(this.activationEndTime);
        newDate.setTime(newDate.getTime() + (hours * 60 * 60 * 1000));
        currDate.setTime(currDate.getTime() + (hours * 60 * 60 * 1000));
        // console.log('computed minimal validity: ', newDate.getDate() + '.' + (newDate.getMonth() + 1) + '.' + newDate.getFullYear() + ' at ' + newDate.getHours() + ':' + ("0" + newDate.getMinutes()).slice(-2));
        // console.log('current 3G proof validity: ', currDate.getDate() + '.' + (currDate.getMonth() + 1) + '.' + currDate.getFullYear() + ' at ' + currDate.getHours() + ':' + ("0" + currDate.getMinutes()).slice(-2));
        return currDate.getTime() >= newDate.getTime();
    }

    /**
     * Uses textswitch, switches container (manually room select or QR room select
     *
     * @param name
     */
    uploadSwitch(name) {

        this.isUploadSkipped = false;
        if (name === "manual") {
            this.showManualUpload();
        } else {
            this.showQrReader();
        }
    }

    skipUpload() {
        this.proofUploadFailed = false;
        this.isUploadSkipped = true;
        this._("#text-switch")._active = "";
        console.log('upload skipped is true');
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
        this.isUploadSkipped = false;

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
        //const i18n = this._i18n;

        let responseData = await this.sendGetTicketsRequest();

        let responseBody = await responseData.clone().json();
        let status = responseData.status;

        let numTypes = parseInt(responseBody['hydra:totalItems']);
        if (isNaN(numTypes)) {
            numTypes = 0;
        }

        switch (status) {
            case 200:   
                for (let i = 0; i < numTypes; i++ ) {

                    // console.log('resp2: ', responseBody['hydra:member'][i]);
                    //let item = responseBody['hydra:member'][i];

                    // if (item['place'] === this.location) { //only if this is the same ticket as selected 
                    //     //TODO check if item is still valid
                        this.hasTicketForThisPlace = true;
                        console.log('Found a valid ticket for this room.');
                    // } 
                }
                break;

            default: //TODO error handling - more cases
               /* send({
                    "summary": i18n.t('acquire-ticket.other-error-title'),
                    "body": i18n.t('acquire-ticket.other-error-body'),
                    "type": "danger",
                    "timeout": 5,
                });*/
                break;
        }
    }

    async checkCreateTicketResponse(response) {
        const i18n = this._i18n;
        let checkInPlaceSelect;

        switch(response.status) {
            case 201:

                if (this.hasTicketForThisPlace) {
                    send({
                        "summary": i18n.t('acquire-3g-ticket.refresh-ticket-success-title'),
                        "body":  i18n.t('acquire-3g-ticket.refresh-ticket-success-body', { place: this.location }),
                        "type": "success",
                        "timeout": 5,
                    });
                    //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'RefreshTicketSuccess', 'name': this.location});
                } else {
                    send({
                        "summary": i18n.t('acquire-3g-ticket.create-ticket-success-title'),
                        "body":  i18n.t('acquire-3g-ticket.create-ticket-success-body', { place: this.location }),
                        "type": "success",
                        "timeout": 5,
                    });
                    //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'CreateTicketSuccess', 'name': this.location});
                }

                this.location = this.preselectedOption;
                this.hasTicket = true;

                this.isUploadSkipped = false;


                this.isCheckmarkChecked = false;
                if (this._("#manual-proof-mode")) {
                    this._("#manual-proof-mode").checked = false;
                }

                this.isConfirmChecked = false;
                if (this._("#digital-proof-mode")) {
                    this._("#digital-proof-mode").checked = false;
                }

                this.useLocalStorage = false;
                this.uploadNewProof = false;
                this.showCertificateSwitch = true;
                this.showCreateTicket = false;

                if (this.hasValidProof) {
                    this.hasValidProof = false; //Could be expired until now
                    this.preCheck = true;
                    this.checkForValidProofLocal().then(function(){console.log('3G proof importing done');});
                }

                checkInPlaceSelect = this.shadowRoot.querySelector(this.getScopedTagName('dbp-check-in-place-select'));
                if (checkInPlaceSelect !== null) {
                    checkInPlaceSelect.clear();
                }

                this._("#checkin-reference").scrollIntoView({ behavior: 'smooth', block: 'start' }); //TODO doesn't work?
                this.preCheck = true; //initiates a new check and sets validProof to true

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
        if ( this._("#store-cert-mode") && this._("#store-cert-mode").checked)
        {
            await this.encryptAndSaveHash();
        } else {
            await this.clearLocalStorage();
            this.hasLocalStorageProof = false;
        }
        try {
            response = await this.sendCreateTicketRequest();
        } finally {
            button.stop();
        }
        await this.checkCreateTicketResponse(response);
    }

    setLocation(event) {
        if(event.detail.room) {
            this.location = event.detail.name;
            this.checkForValidProofLocal().then(() =>  console.log('3G proof importing done')); //Check this each time because proof validity could expire
            this.checkForValidTickets().then(() =>  console.log('Fetch for valid tickets done'));
        } else {
            this.location = '';
        }
    }

    checkCheckmark() {
        this.isCheckmarkChecked = this._("#manual-proof-mode") && this._("#manual-proof-mode").checked;
    }

    checkConfirmCheckmark() {
        this.isConfirmChecked = this._("#digital-proof-mode") && this._("#digital-proof-mode").checked;
    }

    checkStoreCertCheckmark() {
        this.storeCertificate = this._("#store-cert-mode") && this._("#store-cert-mode").checked;
    }

    useCertificateSwitch(name) {
        if (name === "no-cert") {
            this.uploadNewProof = true;
            this.useLocalStorage = false;
            this.hasValidProof = false;
            this.showCertificateSwitch = false;
        } else {
            this.useLocalStorage = true;
            this.uploadNewProof = false;
        }
    }

    useProof() {
        this.showCreateTicket = true;
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
            
            h3{
                margin-top: 2rem;
            }
            
            #last-checkbox {
                margin-top: 1rem;
                margin-bottom: 1.5rem;
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

            .element {
                margin-top: 1.5rem;
            }

            .border {
                margin-top: 2rem;
                border-top: 1px solid black;
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

            @keyframes linkIconOut{
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

            .inline-notification {
                margin-top: 2rem;
                display: block;
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
            }

            .close-icon {
                color: red;
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
            
            .check-icon{
                padding: 0px 4px;
            }
            
            .g-proof-information{
                margin: 1.5em 0;
                border: var(--dbp-border-width) solid var(--dbp-border-color);
                padding: 1.25rem 2.5rem 1.25rem 1.5rem;
                position: relative;
                border-radius: var(--dbp-border-radius);
              }
              
            .g-proof-information h4{
                margin-top: 0px;
                margin-bottom: 0.5em;
              }
            
            .wrapper {
                margin: 1.5em 0;
            }
            
            .confirm-btn label{
                margin-top: 1em;
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

                .btn-container {
                    flex-direction: column;
                    row-gap: 1.5em;
                }

                .qr-loading {
                    padding: 1em;
                }

                .header {
                    margin-bottom: 0.5rem;
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

                .loading{
                    justify-content: center;
                }

                .activations {
                    display: block;
                }

                .activations-btn {
                    display: flex;
                    flex-direction: column;
                }
            }
        `;

    }

    _onScanStarted(e) {
        // We want to scroll after the next re-layout
        requestAnimationFrame(() => {
            setTimeout(() => {
                this._("#qr-scanner").scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 0);
        });
    }

    render() {
        const i18n = this._i18n;
        let privacyURL = commonUtils.getAssetURL('@dbp-topics/greenlight', 'datenschutzerklaerung-tu-graz-greenlight.pdf'); //TODO replace dummy PDF file
        const matchRegexString = '.*' + escapeRegExp(this.searchHashString) + '.*';


        if (this.isLoggedIn() && !this.isLoading() && this.preCheck && !this.loading) {
            this.checkForValidProofLocal().then(() =>  console.log('3G proof importing done'));
        }

        if (this.isLoggedIn() && !this.isLoading() && this.preselectedOption && this.preselectedOption !== '' && this.preselectionCheck) {
            this.location = this.preselectedOption;
            this.checkForValidTickets().then(() =>  console.log('Fetch for valid tickets done'));
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
    
                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    ${this.activity.getDescription(this.lang)}
                </p>
                <div>
                    <slot name="additional-information">
                        <p>${i18n.t('acquire-3g-ticket.additional-information')}</p>
                    </slot>
                </div>
                
                <div class="border">
                    <div class="container">
                        
                        <!-- Place Selector -->
                        <div class="field ${classMap({'hidden': this.preselectedOption && this.preselectedOption !== '' })}">
                            <h3>${i18n.t('acquire-3g-ticket.place-select-title')}</h3>
                            <div class="control">
                                <dbp-check-in-place-select subscribe="auth" lang="${this.lang}" entry-point-url="${this.entryPointUrl}" @change="${(event) => { this.setLocation(event); }}"></dbp-check-in-place-select>
                                <select disabled class="${classMap({'hidden': !(this.preselectedOption && this.preselectedOption !== '') })}"><option selected="selected">${this.preselectedOption}</option></select>
                            </div>
                        </div>
                        
                        <!-- 3G Proof Upload -->

                         <div class="proof-upload-container ${classMap({'hidden': !this.showProofUpload || this.location === ''})}">
        
                            <h3>${i18n.t('acquire-3g-ticket.3g-proof-label-text')}</h3>
                             

                             <div id="btn-container" class="btn-container wrapper">
                                <dbp-textswitch id="text-switch" name1="qr-reader"
                                    name2="manual"
                                    name="${i18n.t('acquire-3g-ticket.qr-button-text')} || ${i18n.t('acquire-3g-ticket.manually-button-text')}"
                                    class="switch"
                                    value1="${i18n.t('acquire-3g-ticket.qr-button-text')}"
                                    value2="${i18n.t('acquire-3g-ticket.manually-button-text')}"
                                    @change=${ (e) => this.uploadSwitch(e.target.name) }></dbp-textswitch>
        
                                
        
                                <dbp-loading-button id="no-upload-btn" value="${i18n.t('acquire-3g-ticket.skip-button-text')}" 
                                                    @click="${(event) => { this.skipUpload(event); }}"
                                                    title="${i18n.t('acquire-3g-ticket.skip-button-text')}"
                                ></dbp-loading-button>
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
                                                text="TODO Upload area text"
                                                button-label="${i18n.t('acquire-3g-ticket.filepicker-button-title')}"
                                                number-of-files="1"
                                                @dbp-file-source-file-selected="${this.getFilesToActivate}"
                             ></dbp-file-source>
                             
                             <div class="border ${classMap({hidden: !this.showQrContainer})}">
                                <div class="element">
                                    <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan match-regex="${matchRegexString}" @scan-started="${this._onScanStarted}" @code-detected="${(event) => { this.doActivationWithQR(event);}}"></dbp-qr-code-scanner>
                                </div>
            
                                <div class="control ${classMap({hidden: !this.loading})}">
                                    <span class="loading">
                                        <dbp-mini-spinner></dbp-mini-spinner>
                                    </span>
                                </div>
                            </div>

                             <div class="control ${classMap({hidden: !this.qrParsingLoading})}">
                                    <span class="qr-loading">
                                        <dbp-mini-spinner text=${i18n.t('acquire-3g-ticket.manual-uploading-message')}></dbp-mini-spinner>
                                    </span>
                             </div>
                         </div>
                        <!-- End 3G Proof Upload-->
                             
                        <!-- Show Proof -->
                        <div class="notification-wrapper ${classMap({hidden: this.isUploadSkipped || this.loading || this.location === ''})}">

                            <div class="${classMap({'hidden': !this.hasLocalStorageProof})}">
                                <dbp-icon name='checkmark-circle' class="check-icon"></dbp-icon>
                                ${ this.message }
                            </div>
                            <div class="no-proof-found ${classMap({hidden: !this.proofUploadFailed})}">
                                <div>
                                    <dbp-icon name='cross-circle' class="close-icon"></dbp-icon>
                                    ${this.message} <!-- TODO Search for other uses of this part -->
                                </div>
                                <dbp-loading-button id="no-proof-continue-btn" value="${i18n.t('acquire-3g-ticket.no-proof-continue')}" @click="${this.skipUpload}" title="${i18n.t('acquire-3g-ticket.no-proof-continue')}"></dbp-loading-button>
                            </div>
                            
                            <div class="g-proof-information ${classMap({hidden: this.isSelfTest || !this.hasValidProof})}">
                                <span class="header">
                                    <h4>3-G Nachweis</h4> <span>Status: <strong>gültig</strong></span> <br> Von: ${this.person.firstname ? this.person.firstname + " " : "" } <!-- TODO Übersetzen -->
                                    ${this.person.lastname} ${this.person.dob ? html`<br>Geburtsdatum: ${this.person.dob}` : "" }
                                </span>
                            </div>
                            <div class="g-proof-information ${classMap({hidden: !this.isSelfTest || !this.hasValidProof})}">
                                <span class="header">
                                    <h4>Selbsttest</h4> 
                                    Bitte überprüfen Sie ob der Nachweis noch gültig ist.
                                    <span>Link: <a class="int-link-external" target="_blank" rel="noopener" href="${this.greenPassHash}">${this.greenPassHash}</a></span><!-- TODO Übersetzen -->
                                </span>
                            </div>
                            
                            <button class="button is-primary ${classMap({hidden: !this.isSelfTest && !this.hasValidProof})}" value="${i18n.t('acquire-3g-ticket.use-3g-proof')}" @click="${this.useProof}" title="${i18n.t('acquire-3g-ticket.use-3g-proof')}">${i18n.t('acquire-3g-ticket.use-3g-proof')}</button>
                            
                        </div>
                        <!-- End Show Proof -->
             
                        <!-- Create Ticket part -->
                        <div class="confirm-btn wrapper ${classMap({hidden: !this.showCreateTicket && !this.isUploadSkipped})}">
                            <h3>${i18n.t('acquire-3g-ticket.create-ticket')}</h3> 
                            <div class="${classMap({hidden: !this.isUploadSkipped})}">
                                <label class="button-container">
                                    ${i18n.t('acquire-3g-ticket.manual-proof-text')}
                                    <input type="checkbox" id="manual-proof-mode" name="manual-proof-mode" value="manual-proof-mode" @click="${this.checkCheckmark}">
                                    <span class="checkmark" id="manual-proof-checkmark"></span>
                                </label>
                            </div>
                            
                            <div class="${classMap({hidden: !this.hasValidProof || this.isUploadSkipped})}">
                                <label class="button-container">
                                    ${i18n.t('acquire-3g-ticket.store-valid-cert-text')}
                                    <input type="checkbox" id="store-cert-mode" name="store-cert-mode" value="store-cert-mode" @click="${this.checkStoreCertCheckmark}">
                                    <span class="checkmark" id="store-cert-checkmark"></span>
                                </label>
                            </div>
                           
                            <div class="${classMap({hidden: !this.isCheckmarkChecked && this.isUploadSkipped})}">
                                <label id="last-checkbox" class="button-container">
                                    ${ this.isCheckmarkChecked ? i18n.t('acquire-3g-ticket.confirm-checkbox-no-cert-text') : i18n.t('acquire-3g-ticket.confirm-checkbox-valid-cert-text') }
                                    <input type="checkbox" id="digital-proof-mode" name="digital-proof-mode" value="digital-proof-mode" @click="${this.checkConfirmCheckmark}">
                                    <span class="checkmark" id="digital-proof-checkmark"></span>
                                </label>
                                
                                <dbp-loading-button ?disabled="${this.loading || this.location === '' || !this.isConfirmChecked}"
                                                type="is-primary" 
                                                id="confirm-ticket-btn"
                                                value="${ !this.hasTicketForThisPlace ? i18n.t('acquire-3g-ticket.confirm-button-text') : i18n.t('acquire-3g-ticket.refresh-button-text') }" 
                                                @click="${(event) => { this.createTicket(event); }}" 
                                                title="${i18n.t('acquire-3g-ticket.confirm-button-text')}"
                                ></dbp-loading-button>
                            </div>
                            
                        </div>
                        <!-- End Create Ticket part -->
                        
                        
                        <!-- Ticket Notification -->
                         <div class="tickets-notifications">
                            <div class="tickets-wrapper ${classMap({'hidden': (!this.hasTicket && !this.hasTicketForThisPlace)})}">
                                <dbp-inline-notification type="" body="${i18n.t('acquire-3g-ticket.manage-tickets-text')}
                                            <a href='show-active-tickets' title='${i18n.t('acquire-3g-ticket.manage-tickets-link')}' target='_self' class='int-link-internal'>
                                                <span>${i18n.t('acquire-3g-ticket.manage-tickets-link')}.</span>
                                            </a>"
                                ></dbp-inline-notification>
                            </div>
                            <div class="tickets-wrapper ${classMap({'hidden': (!this.hasTicket)})}" id="checkin-reference">
                                <dbp-inline-notification type="" body="${i18n.t('acquire-3g-ticket.check-in-link-description')}
                                            <a href='checkin.tugraz.at' title='${i18n.t('acquire-3g-ticket.check-in-link-text')}' target='_self' class='int-link-internal'>
                                                <span>${i18n.t('acquire-3g-ticket.check-in-link-text')}.</span>
                                            </a>"
                                ></dbp-inline-notification>
                            </div>
                        </div>
                        <!-- End Ticket Notification -->
                        
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-acquire-3g-ticket', Acquire3GTicket, Acquire3GTicket);