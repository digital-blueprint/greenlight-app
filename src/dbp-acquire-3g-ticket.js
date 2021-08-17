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
import {escapeRegExp, parseGreenPassQRCode} from './utils.js';
import {name as pkgName} from './../package.json';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';


class QrScanner {
    constructor() {
        this._engine = null;
        this._canvas = document.createElement("canvas");
        this._scanner = null;
    }

    async scanImage(image) {
        if (this._scanner === null)  {
            this._scanner = (await import('qr-scanner')).default;
            this._scanner.WORKER_PATH = commonUtils.getAssetURL(pkgName, 'qr-scanner-worker.min.js');
        }
        if (this._engine === null) {
            this._engine = await this._scanner.createQrEngine(this._scanner.WORKER_PATH);
        }
        try {
            await this._scanner.scanImage(image)
                .then(result => console.log("QR found", result))
                .catch(error => console.log("Error", error || 'No QR code found.'));
            return {data: await this._scanner.scanImage(image)};
        } catch (e) {
            return null;
        }
    }
}


class Acquire3GTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
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

        this.activationEndTime = '';
        this.identifier = '';
        this.agent = '';
        this.showQrContainer = false;
        this.searchHashString = '';
        this.wrongHash = [];
        this.wrongQR = [];
        this._activationInProgress = false;
        this.preCheck = true;
        this.qrParsingLoading = false;
        this.loadingMsg = '';
        this.status = null;
        this.resetWrongQr = false;
        this.resetWrongHash = false;
        this.greenPassHash = '';
        this.isActivated = false;
        this.isRefresh = false;
        this.isExpiring = false;
        this.QRCodeFile = null;
        this.isUploadSkipped = false;
        this.isConfirmChecked = false;
        this.storeCertificate = false;

        this.useLocalStorage = false;

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
            showPreselectedSelector: { type: String, attribute: 'show-preselected' },
            preselectedOption: { type: String, attribute: 'preselected-option' },
            hasValidProof: { type: Boolean, attribute: false },
            hasTicket: { type: Boolean, attribute: false },
            hasTicketForThisPlace: { type: Boolean, attribute: false },
            location: { type: String, attribute: false },
            isCheckboxVisible: { type: Boolean, attribute: false },
            isCheckmarkChecked: { type: Boolean, attribute: false },
            showQrContainer: { type: Boolean, attribute: false},
            activationEndTime: { type: String, attribute: false },
            loadingMsg: { type: String, attribute: false },
            searchHashString: { type: String, attribute: 'gp-search-hash-string' },
            qrParsingLoading: {type: Boolean, attribute: false},
            status: { type: Object, attribute: false },
            wrongQR : { type: Array, attribute: false },
            wrongHash : { type: Array, attribute: false },
            isActivated: { type: Boolean, attribute: false },
            isRefresh: { type: Boolean, attribute: false },
            isExpiring: { type: Boolean, attribute: false },
            QRCodeFile: { type: Object, attribute: false },
            isUploadSkipped: { type: Boolean, attribute: false },
            isConfirmChecked: { type: Boolean, attribute: false },
            storeCertificate: { type: Boolean, attribute: false },

            fileHandlingEnabledTargets: {type: String, attribute: 'file-handling-enabled-targets'},
            nextcloudWebAppPasswordURL: { type: String, attribute: 'nextcloud-web-app-password-url' },
            nextcloudWebDavURL: { type: String, attribute: 'nextcloud-webdav-url' },
            nextcloudName: { type: String, attribute: 'nextcloud-name' },
            nextcloudFileURL: { type: String, attribute: 'nextcloud-file-url' },
            nextcloudAuthInfo: {type: String, attribute: 'nextcloud-auth-info'},
        };
    }

    connectedCallback() {
        super.connectedCallback();
        pdfjs.GlobalWorkerOptions.workerSrc = commonUtils.getAssetURL(pkgName, 'pdfjs/pdf.worker.js');
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
            //console.log("######", propName);
        });

        super.update(changedProperties);
    }

    /**
     * Returns the content of the file
     *
     * @param {File} file The file to read
     * @returns {string} The content
     */
    readBinaryFileContent = async (file) => {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result);
            };
            reader.onerror = () => {
                reject(reader.error);
            };
            reader.readAsBinaryString(file);
        });
    };

    /**
     * Converts a PDF file to an Canvas Image Array
     *
     * @param {File} file
     */
    async getImageFromPDF(file) {
        const data = await this.readBinaryFileContent(file);
        let pages = [], heights = [], width = 0, height = 0, currentPage = 1;
        let scale = 3;
        let canvasImages = [];
        try {
            let pdf = await pdfjs.getDocument({data: data}).promise;
            await this.getPage(pdf, pages, heights, width, height, currentPage, scale, canvasImages);
            return canvasImages;
        }
        catch (error) {
            //TODO Throw error if pdf cant converted to image
            this.sendSetPropertyEvent('analytics-event', {'category': 'ActivateGreenPass', 'action': 'PdfToImageConversionFailed'});
            console.error(error);
            return -1;
        }
    }

    async getPage(pdf, pages, heights, width, height, currentPage, scale, canvasImages) {
        let page = await pdf.getPage(currentPage);
        let viewport = page.getViewport({scale});
        let canvas = document.createElement('canvas') , ctx = canvas.getContext('2d');
        let renderContext = { canvasContext: ctx, viewport: viewport };
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render(renderContext).promise;
        console.log("page rendered");
        pages.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

        heights.push(height);
        height += canvas.height;
        if (width < canvas.width) width = canvas.width;

        if (currentPage < pdf.numPages) {
            currentPage++;
            await this.getPage(pdf, pages, heights, width, height, currentPage, scale, canvasImages);
        }
        else {
            let canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;
            for(let i = 0; i < pages.length; i++)
                ctx.putImageData(pages[i], 0, heights[i]);
            canvasImages.push(canvas);
        }
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
     */
    async checkActivationResponse(responseData, greenPassHash, category) {
        const i18n = this._i18n;

        let status = responseData.status;
        // let responseBody = await responseData.clone().json(); //TODO
        let responseBody = responseData.data;
        switch (status) {
            case 201:
                this.activationEndTime = responseBody['expires'];
                this.identifier = responseBody['identifier'];
                // console.log('id:', this.identifier, ' , time: ', this.activationEndTime);

                this.stopQRReader();
                this.QRCodeFile = null;
                this.showQrContainer = false;

                this.isActivated = true;
                this.isRefresh = false;

                this._("#text-switch")._active = "";
                this._("#manualPassUploadWrapper").classList.add('hidden');

                send({
                    "summary": i18n.t('green-pass-activation.success-activation-title'),
                    "body": i18n.t('green-pass-activation.success-activation-body'),
                    "type": "success",
                    "timeout": 5,
                });

                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationSuccess', 'name': locationName});
                break;

            // Error: something else doesn't work
            default:
                this.saveWrongHashAndNotify('title', 'description', greenPassHash);
                //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailed', 'name': locationName});
                break;
        }
    }

    /**
     * Sends a request to active a certificate
     *
     * @param greenPassHash
     * @returns {object} response
     */
    async sendActivationRequest(greenPassHash) {
        // let formData = new FormData();
        // formData.append('digital_covid_certificate_data', greenPassHash);

        // const options = {
        //     method: 'POST',
        //     headers: {
        //         Authorization: "Bearer " + this.auth.token
        //     },
        //     body: new URLSearchParams(formData)
        // };

        // return await this.httpGetAsync(this.entryPointUrl + '/eu-dcc/digital-covid-certificate-reviews', options);
        let response = { status: 201, data: { expires: new Date(), identifier: 1234567890 } }; //TODO return correct validation results
        return response;
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
     */
    async doActivation(greenPassHash, category) {
        const i18n = this._i18n;

        // Error: no valid hash detected
        if (greenPassHash.length <= 0) {
            this.saveWrongHashAndNotify(i18n.t('green-pass-activation.invalid-qr-code-title'), i18n.t('green-pass-activation.invalid-qr-code-body'), greenPassHash);
            //this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': 'ActivationFailedNoGreenPassHash'});
            return;
        }

        let responseData = await this.sendActivationRequest(greenPassHash);
        await this.checkActivationResponse(responseData, greenPassHash, category);
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
            let check = await this.decodeUrl(data);
            if (check) {
                await this.doActivation(this.greenPassHash, 'ActivationRequest');
            }
        } finally {
            this._activationInProgress = false;
            this.loading = false;
            this.loadingMsg = "";
        }
    }

    /**
     * Check uploaded file and search for QR code
     * If a QR Code is found, validate it and send an Activation Request
     *
     */
    async doActivationManually() {
        const i18n = this._i18n;

        let data = await this.searchQRInFile();
        if (data === null) {
            send({
                "summary": i18n.t('green-pass-activation.no-qr-code-title'),
                "body":  i18n.t('green-pass-activation.no-qr-code-body'),
                "type": "danger",
                "timeout": 5,
            });
        } else {
            let check = await this.decodeUrl(data.data);
            if (check) {
                await this.doActivation(this.greenPassHash, 'ActivationRequest');
            }
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
        if (this.QRCodeFile.type === "application/pdf") {
            let pages = await this.getImageFromPDF(this.QRCodeFile);
            let payload = null;
            let scanner = new QrScanner();
            for (const page of pages) {
                payload = await scanner.scanImage(page);
                if (payload !== null)
                    break;
            }
            return payload;
        } else {
            let payload = "";
            let scanner = new QrScanner();
            payload = await scanner.scanImage(this.QRCodeFile);
            return payload;
        }
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
     * Decode data from QR code
     * Check if it is a valid string for this application with this.searchHashString
     * Saves invalid QR codes, so we don't have to process than more than once
     * Check if input QR code is already a invalid QR code
     *
     * @param data
     * @returns {boolean} true if data is valid not yet send QR code data
     * @returns {boolean} false if data is invalid QR code data
     */
    async decodeUrl(data) {
        const i18n = this._i18n;
        let passData;
        try {
            passData = parseGreenPassQRCode(data, this.searchHashString);
        } catch(error) {
            let checkAlreadySend = await this.wrongQR.includes(data);
            if (checkAlreadySend) {
                const that = this;
                if (!this.resetWrongQr) {
                    this.resetWrongQr = true;
                    setTimeout( function () {
                        that.wrongQR.splice(0,that.wrongQR.length);
                        that.wrongQR.length = 0;
                        that.resetWrongQr = false;
                    }, 3000);
                }
                return false;
            }
            this.wrongQR.push(data);
            send({
                "summary": i18n.t('green-pass-activation.invalid-qr-code-title'),
                "body":  i18n.t('green-pass-activation.invalid-qr-code-body'),
                "type": "danger",
                "timeout": 5,
            });
            return false;
        }

        this.greenPassHash = passData;

        let gpAlreadySend = await this.wrongHash.includes(this.greenPassHash);
        if (gpAlreadySend) {
            const that = this;
            if (!this.resetWrongHash) {
                this.resetWrongHash = true;
                setTimeout( function () {
                    that.wrongHash.splice(0,that.wrongHash.length);
                    that.wrongHash.length = 0;
                    that.resetWrongHash = false;
                }, 3000);
            }
        }
        return !gpAlreadySend;
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
        this._("#manualPassUploadWrapper").classList.add('hidden');
    }

    /**
     * Show manual pass upload container
     * and stop QR code scanner
     *
     */
    showManualUpload() {
        this._("#qr-scanner").stopScan = true;
        this.showQrContainer = false;

        this._("#manualPassUploadWrapper").scrollIntoView({ behavior: 'smooth', block: 'start' });
        this._("#manualPassUploadWrapper").classList.remove('hidden');

        this.openFileSource();
    }

    /**
     * Parse an incoming date to a readable date
     *
     * @param date
     * @returns {string} readable date
     */
    getReadableActivationDate(date) {
        const i18n = this._i18n;
        let newDate = new Date(date);
        let month = newDate.getMonth() + 1;
        this.isExpiring = !this.checkIfCertificateIsExpiring();

        return i18n.t('green-pass-activation.valid-until', {date: newDate.getDate() + "." + month + "." + newDate.getFullYear(), clock: newDate.getHours() + ":" + ("0" + newDate.getMinutes()).slice(-2) });
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
        if (name === "manual") {
            this.showManualUpload();
        } else {
            this.showQrReader();
        }
    }

    skipUpload(event) {
        this.isUploadSkipped = true;
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

        await this.doActivationManually();

        this.qrParsingLoading = false;
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

                this.isConfirmChecked = false;
                if (this._("#digital-proof-mode")) {
                    this._("#digital-proof-mode").checked = false;
                }

                this.useLocalStorage = false;
                if (this._("#cert-found-mode")) {
                    this._("#cert-found-mode").checked = false;
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

    checkConfirmCheckmark() {
        this.isConfirmChecked = this._("#digital-proof-mode") && this._("#digital-proof-mode").checked;
    }

    checkCertFoundCheckmark() {
        this.useLocalStorage = this._("#cert-found-mode") && this._("#cert-found-mode").checked;
    }

    checkStoreCertCheckmark() {
        this.storeCertificate = this._("#store-cert-mode") && this._("#store-cert-mode").checked;
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

            h2 {
                margin-top: 0;
            }

            #confirm-ticket-btn {
                margin-bottom: 1.5rem;
            }
            
            #last-checkbox {
                margin-top: 1.5rem;
                margin-bottom: 1.5rem;
            }

            .proof-upload-container {
                margin-top: 1.5rem;
            }

            .cert-found-checkbox-wrapper {
                margin-top: 1rem;
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

            #select-seat {
                padding-left: 8px;
                font-weight: 300;
                color: inherit;
                border: 1px solid #aaa;
                line-height: 100%;
                margin-bottom: 0.75rem;
                height: 28px;
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
                margin-bottom: 1.5rem;
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
                #select-seat{
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

        if (this.isLoggedIn() && !this.isLoading() && this.preCheck) {
            this.checkForValidProof().then(r =>  console.log('3G proof validation done')); //TODO check for valid cert in local storage
            this.preCheck = false;
        }

        if (this.isLoggedIn() && !this.isLoading() && this.showPreselectedSelector && this.preselectionCheck) {
            this.location = { room: '', name: this.preselectedOption };
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
                
                <h2>${i18n.t('acquire-3g-ticket.title')}</h2>
                <div>
                    <p class="">${i18n.t('acquire-3g-ticket.description')}</p>
                    <slot name="additional-information">
                        <p>${i18n.t('acquire-3g-ticket.additional-information')}</p>
                        <p> 
                            ${i18n.t('acquire-3g-ticket.data-protection')} 
                            <a href="${privacyURL}" title="${i18n.t('acquire-3g-ticket.data-protection-link')}" target="_blank" class="int-link-internal"> 
                                <span>${i18n.t('acquire-3g-ticket.data-protection-link')} </span>
                            </a>
                        </p>
                    </slot>
                </div>
                
                
                <div class="field">
                    <label class="label">${i18n.t('acquire-3g-ticket.place-select-title')}</label>
                    <div class="control">
                        <dbp-check-in-place-select class="${classMap({'hidden': this.showPreselectedSelector})}" subscribe="auth" lang="${this.lang}" entry-point-url="${this.entryPointUrl}" @change="${(event) => { this.setLocation(event); }}"></dbp-check-in-place-select>
                        <select class="${classMap({'hidden': !this.showPreselectedSelector})}" disabled><option selected="selected">${this.preselectedOption}</option></select>
                    </div>
                </div>
                
                <div class="proof-upload-container ${classMap({'hidden': this.location === '' || this.isActivated || this.isUploadSkipped })}">

                    <label class="label">${i18n.t('acquire-3g-ticket.3g-proof-label-text')}</label>

                    <div id="btn-container" class="btn-container">
                        <dbp-textswitch id="text-switch" name1="qr-reader"
                            name2="manual"
                            name="${i18n.t('acquire-3g-ticket.qr-button-text')} || ${i18n.t('acquire-3g-ticket.manually-button-text')}"
                            class="switch"
                            value1="${i18n.t('acquire-3g-ticket.qr-button-text')}"
                            value2="${i18n.t('acquire-3g-ticket.manually-button-text')}"
                            @change=${ (e) => this.uploadSwitch(e.target.name) }></dbp-textswitch>

                        <div class="control ${classMap({hidden: !this.qrParsingLoading})}">
                            <span class="qr-loading">
                                <dbp-mini-spinner text=${i18n.t('acquire-3g-ticket.manual-uploading-message')}></dbp-mini-spinner>
                            </span>
                        </div>

                        <dbp-loading-button id="no-upload-btn" value="${i18n.t('acquire-3g-ticket.skip-button-text')}" 
                                            @click="${(event) => { this.skipUpload(event); }}"
                                            title="${i18n.t('acquire-3g-ticket.skip-button-text')}"
                        ></dbp-loading-button>
                    </div>
                </div>
                
                <div id="manualPassUploadWrapper" class="${classMap({hidden: (this.isActivated && this.showQrContainer) || this.loading})}">
                    <div class="upload-wrapper">
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
                    </div>
                </div>
                
                <div class="border ${classMap({hidden: !this.showQrContainer})}">
                    <div class="element ${classMap({hidden: (this.isActivated && !this.showQrContainer) || this.loading})}">
                        <dbp-qr-code-scanner id="qr-scanner" lang="${this.lang}" stop-scan match-regex="${matchRegexString}" @scan-started="${this._onScanStarted}" @code-detected="${(event) => { this.doActivationWithQR(event);}}"></dbp-qr-code-scanner>
                    </div>

                    <div class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${this.loadingMsg}></dbp-mini-spinner>
                        </span>
                    </div>
                </div>
           
                
                <div class="notification-wrapper ${classMap({'hidden': (this.location === '' || (!this.isActivated && !this.isUploadSkipped))})}">
                   
                    <div class="${classMap({'hidden': (!this.hasValidProof && !this.isActivated) || this.loading})}">
                        <dbp-icon name='checkmark-circle' class="${classMap({'hidden': (!this.hasValidProof && !this.isActivated) || this.location === ''})}"></dbp-icon>
                        ${i18n.t('acquire-3g-ticket.valid-proof-found-message')}
                    </div>

                    <div class="${classMap({'hidden': this.hasValidProof || this.isActivated || this.isCheckboxVisible || this.loading})}">
                        <div>
                            <dbp-icon name='cross-circle' class="close-icon ${classMap({'hidden': this.hasValidProof || this.isActivated || this.location === ''})}"></dbp-icon>
                            ${i18n.t('acquire-3g-ticket.no-proof-found-message')}
                        </div>
                        <dbp-loading-button id="no-proof-continue-btn" value="${i18n.t('acquire-3g-ticket.no-proof-continue')}" @click="${this.showCheckbox}" title="${i18n.t('acquire-3g-ticket.no-proof-continue')}"></dbp-loading-button>
                    </div>

                    <div class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading-proof">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </div>
                    
                </div>

                <div class="checkbox-wrapper ${classMap({'hidden': this.location === '' || this.hasValidProof || !this.isCheckboxVisible})}">
                    <label id="" class="button-container">${i18n.t('acquire-3g-ticket.manual-proof-text')}
                        <input type="checkbox" id="manual-proof-mode" name="manual-proof-mode" value="manual-proof-mode" @click="${this.checkCheckmark}">
                        <span class="checkmark" id="manual-proof-checkmark"></span>
                    </label>
                </div>

                <div class="cert-found-checkbox-wrapper ${classMap({'hidden': this.location === ''})}">
                    ${ this.hasValidProof ? html`
                        <label id="" class="button-container">${i18n.t('acquire-3g-ticket.valid-cert-found-text')}
                            <input type="checkbox" id="cert-found-mode" name="cert-found-mode" value="cert-found-mode" @click="${this.checkCertFoundCheckmark}">
                            <span class="checkmark" id="cert-found-checkmark"></span>
                        </label>`
                    : html`
                        <label id="" class="button-container">${i18n.t('acquire-3g-ticket.store-valid-cert-text')}
                            <input type="checkbox" id="store-cert-mode" name="store-cert-mode" value="store-cert-mode" @click="${this.checkStoreCertCheckmark}">
                            <span class="checkmark" id="store-cert-checkmark"></span>
                        </label>
                    `}
                </div>

                <div class="confirm-btn ${classMap({'hidden': this.location === '' || (!this.hasValidProof && !this.isCheckmarkChecked && !this.isActivated)})}">

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
        `;
    }
}

commonUtils.defineCustomElement('dbp-acquire-3g-ticket', Acquire3GTicket);