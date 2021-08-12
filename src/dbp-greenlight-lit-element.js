import DBPLitElement from '@dbp-toolkit/common/dbp-lit-element';
import {getStackTrace} from "@dbp-toolkit/common/error";
import {send} from "@dbp-toolkit/common/notification";

/**
 * Dummy function to mark strings as i18next keys for i18next-scanner
 *
 * @param {string} key
 * @param {object} [options]
 * @returns {string} The key param as is
 */
function i18nKey(key, options) {
    return key;
}

export default class DBPGreenlightLitElement extends DBPLitElement {
    constructor() {
        super();
        this.isSessionRefreshed = false;
        this.auth = {};
    }

    static get properties() {
        return {
            ...super.properties,
            auth: { type: Object },
        };
    }

    connectedCallback() {
        super.connectedCallback();

        this._loginStatus = '';
        this._loginState = [];
    }

    /**
     *  Request a re-render every time isLoggedIn()/isLoading() changes
     */
    _updateAuth() {
        this._loginStatus = this.auth['login-status'];

        let newLoginState = [this.isLoggedIn(), this.isLoading()];
        if (this._loginState.toString() !== newLoginState.toString()) {
            this.requestUpdate();
        }
        this._loginState = newLoginState;
    }

    update(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            switch (propName) {
                case "auth":
                    this._updateAuth();
                    break;
            }
        });

        super.update(changedProperties);
    }

    /**
     * Returns if a person is set in or not
     *
     * @returns {boolean} true or false
     */
    isLoggedIn() {
        return (this.auth.person !== undefined && this.auth.person !== null);
    }

    /**
     * Returns true if a person has successfully logged in
     *
     * @returns {boolean} true or false
     */
    isLoading() {
        if (this._loginStatus === "logged-out")
            return false;
        return (!this.isLoggedIn() && this.auth.token !== undefined);
    }


    /**
     * Send a fetch to given url with given options
     *
     * @param url
     * @param options
     * @returns {object} response (error or result)
     */
    async httpGetAsync(url, options) {
        let response = await fetch(url, options).then(result => {
            if (!result.ok) throw result;
            return result;
        }).catch(error => {
            return error;
        });

        return response;
    }

    /**
     * Sends an analytics error event for the request of a room
     *
     * @param category
     * @param action
     * @param room
     * @param responseData
     */
    async sendErrorAnalyticsEvent(category, action, room, responseData = {}) {
        let responseBody = {};

        // Use a clone of responseData to prevent "Failed to execute 'json' on 'Response': body stream already read"
        // after this function, but still a TypeError will occur if .json() was already called before this function
        try {
            responseBody = await responseData.clone().json();
        } catch (e) {
            // NOP
        }

        const data = {
            status: responseData.status || '',
            url: responseData.url || '',
            description: responseBody['hydra:description'] || '',
            room: room,
            // get 5 items from the stack trace
            stack: getStackTrace().slice(1, 6)
        };

        // console.log("sendErrorEvent", data);
        this.sendSetPropertyEvent('analytics-event', {'category': category, 'action': action, 'name': JSON.stringify(data)});
    }

    /**
     * Sends a request to get all certificates
     *
     * @returns {object} response
     */
    async sendGetCertificatesRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
                Authorization: "Bearer " + this.auth.token
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/eu-dcc/digital-covid-certificate-reviews', options);
    }

    async sendCreateTicketRequest() { //TODO request
        // const options = {
        //     method: 'POST',
        //     headers: {
        //         Authorization: "Bearer " + this.auth.token
        //     },
        // };
        //TODO check if there is a valid ticket for this place -> after response we should send 'ticket was refreshed' and not 'created'

        //TODO change to correct request parameters
        //return await this.httpGetAsync(this.entryPointUrl + '/eu-dcc/digital-covid-certificate-reviews/' + identifier, options);
        let response = { status: 201 }; //TODO delete hardcoded response
        return response;
    }

    saveWrongHashAndNotify(title, body, hash) {
        send({
            "summary": title,
            "body": body,
            "type": "danger",
            "timeout": 5,
        });
        if (this.wrongHash)
            this.wrongHash.push(hash);
    }

    /**
     * Parse a incoming date to a readable date
     *
     * @param date
     * @returns {string} readable date
     */
    getReadableDate(date) {
        const i18n = this._i18n;
        let newDate = new Date(date);

        let hours = newDate.getHours();
        let minutes = newDate.getMinutes();

        let result = i18n.t('show-active-tickets.valid-until-message-1');
        result += hours > 0 ? i18n.t('show-active-tickets.valid-until-message-2', { hours: hours }) : i18n.t('show-active-tickets.valid-until-message-3', { minutes: ("0" + minutes).slice(-2) });

        return result;
    }

    async checkForValidProof() {

        this.loading = true;

        let responseData = await this.sendGetCertificatesRequest();
        let status = responseData.status;
        let responseBody = await responseData.clone().json();

        if (status === 200) {
            console.log('received items: ', responseBody['hydra:totalItems']);
            if (responseBody['hydra:totalItems'] > 0) {
                this.isActivated = true;
                this.activationEndTime = responseBody['hydra:member'][0]['expires'];
                this.identifier = responseBody['hydra:member'][0]['identifier'];
                console.log('Found a valid 3G proof for the current user.');
                this.hasValidProof = true;
            } else {
                this.hasValidProof = false;
                console.log('Found no valid 3G proof for the current user.');
            }
        } else { //TODO request returned an error
            send({
                "summary": responseBody['hydra:title'],
                "body": responseBody['hydra:description'],
                "type": "danger",
                "timeout": 5,
            });
        }

        this.loading = false;
    }
}