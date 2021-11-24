import {css, html} from 'lit';
import DBPGreenlightTicketLitElement, {getTicketCss} from "./dbp-greenlight-ticket-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Activity} from './activity.js';
import metadata from './dbp-show-reference-ticket.metadata.json';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';
import {classMap} from 'lit/directives/class-map.js';


class ShowReferenceTicket extends ScopedElementsMixin(DBPGreenlightTicketLitElement) {
    constructor() {
        super();

        this.activity = new Activity(metadata);
        this.locationName = this._i18n.t('show-reference-ticket.place-name');
    }


    static get scopedElements() {
        return {
            ...super.scopedElements,
        };
    }


    static get properties() {
        return {
            ...super.properties,
            locationName: {type: String, attribute: false},
        };
    }


    /**
     * Updates the referenceTicket and sets a timer for next update
     * Notifies the user if something went wrong
     *
     * @returns {boolean}
     */
    async updateTicket() {
        if (this.ticketOpen === false)
            return false;

        let responseData = await this.getReferenceTicketRequest();
        let responseBody = "";

        try {
            responseBody = await responseData.clone().json();
        } catch (e) {
            this.setTimeoutIsSet = false;
            this.showReloadButton = true;
            return false;
        }

        if (responseData.status === 200) { // Success
            this.sendSuccessAnalyticsEvent('UpdateReferenceTicketRequest', 'Success', '');
            this.showReloadButton = false;
            this.ticketImage = responseBody['hydra:member'][0].image || '';
            this.setTimer(responseBody['hydra:member'][0].imageValidFor * 1000 + 1000);
            return true;
        }
        // Other Error
        // fail soft if we cant update it
        this.sendErrorAnalyticsEvent('UpdateReferenceTicketRequest', 'UnknownError', "", responseData);
        console.log("Update reference ticket failed");
        this.setTimeoutIsSet = false;
        this.showReloadButton = true;
        return false;
    }


    async getReferenceTicketRequest() {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/ld+json',
            },
        };

        return await this.httpGetAsync(this.entryPointUrl + '/greenlight/reference-permits?page=1', options);
    }


    /**
     * Generate a QR Code if a hash is available and valid,
     * updates the ticket and shows it in modal view
     *
     */
    async showTicket() {
        this.ticketLoading = true;
        await this.openTicket('ShowReferenceTicket');
        await this.updateTicket();
        this.ticketLoading = false;
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
            ${getTicketCss()}

        `;
    }


    render() {
        const i18n = this._i18n;

        const additionalInformation = html`
            <div class="information-container ${classMap({hidden: this.ticketLoading})}">
                <slot name="information-container">
                    <h4>${i18n.t('show-reference-ticket.information-container-headline')}</h4>
                    ${i18n.t('show-reference-ticket.information-container-body')}
                </slot>
            </div>
        `;

        const ticketList = html`
            <div class="ticket">
                <span class="header">
                    <h3>
                        <slot name="place">
                            ${i18n.t('entry-ticket')}: ${this.locationName}
                        </slot>
                    </h3>
                    <span class="header">
                        <slot name="ticket-description">
                            <span>${i18n.t('show-reference-ticket.description')}</span>
                        </slot>
                    </span>
                </span>
                <div class="btn">
                    <dbp-loading-button type="is-primary"
                                        @click="${() => {this.showTicket();}}"
                                        title="${i18n.t('show-btn-text')}">
                        ${i18n.t('show-btn-text')}
                    </dbp-loading-button>
                    <dbp-loading-button id="delete-btn"
                                        value="${i18n.t('delete-btn-text')}"
                                       disabled >
                        ${i18n.t('delete-btn-text')}
                    </dbp-loading-button>
                </div>
            </div>
        `;

        const permissions = this.isLoading();

        return html`

            <div class="control ${classMap({hidden: !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            ${this.getTicketUI(permissions, ticketList, additionalInformation)}
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-reference-ticket', ShowReferenceTicket);