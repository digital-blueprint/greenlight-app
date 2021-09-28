import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPGreenlightLitElement from "./dbp-greenlight-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Activity} from './activity.js';
import metadata from './dbp-show-reference-ticket.metadata.json';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';
import {classMap} from 'lit-html/directives/class-map.js';
import MicroModal from "./micromodal.es";
import {Icon, LoadingButton, MiniSpinner} from "@dbp-toolkit/common";
import {send} from "@dbp-toolkit/common/notification";

class ShowReferenceTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);
        this.loading = false;
        this.isReferenceTicket = true;
        this.ticketLoading = false;
        this.ticketOpen = false;
        this.ticketImage = '';
        this.setTimeoutIsSet = false;
        this.timer = '';
        this.showReloadButton = false;

        this.boundUpdateTicket = this.updateReferenceTicketWrapper.bind(this);
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: {type: String},
            entryPointUrl: {type: String, attribute: 'entry-point-url'},
            loading: {type: Boolean, attribute: false},
            ticketLoading: {type: Boolean, attribute: false},
            showReloadButton: {type: Boolean, attribute: false},
            ticketImage: {type: String, attribute: false},
        };
    }

    disconnectedCallback() {
        clearTimeout(this.timer);
        window.removeEventListener('focus', this.boundUpdateTicket);
        super.disconnectedCallback();
    }

    async connectedCallback() {
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

    /**
     * A wrapper for update ticket for calling it in an event handler
     * Sets this.setTimeoutIsSet to false and calls this.upddateTicket()
     *
     */
    async updateReferenceTicketWrapper() {
        this.setTimeoutIsSet = false; //reset timer if focus event is triggered
        this.updateReferenceTicket();
    }

    /**
     * A wrapper for update ticket for calling it in an event handler
     * Sets this.setTimeoutIsSet to false and calls this.upddateTicket()
     *
     */
    async updateTicketAndNotify() {
        this.setTimeoutIsSet = false; //reset timer if focus event is triggered
        this.showReloadButton = false;
        let check = await this.updateReferenceTicket();
        if (!check) {
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
     * Updates the referenceTicket and sets a timer for next update
     * Notifies the user if something went wrong
     *
     * @returns {boolean}
     */
    async updateReferenceTicket() {
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
            this.showReloadButton = false;
            this.ticketImage = responseBody['hydra:member'][0].image || '';
            this.setTimer(responseBody['hydra:member'][0].imageValidFor * 1000 + 1000);
            return true;
        }
        // Other Error
        // fail soft if we cant update it

        console.log("Update reference ticket failed");
        this.setTimeoutIsSet = false;
        this.showReloadButton = true;
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
                let boundUpdateTicket = that.updateReferenceTicket.bind(that);
                boundUpdateTicket();
            }, time);
        }
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
        }
        await this.updateReferenceTicket();
        this.ticketLoading = false;
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

            #qr-code-hash svg {
                display: block;
                width: 80%;
                margin: auto;
            }

            .green-pass-evidence {
                line-height: 20px;
            }

            .proof-container, .information-container {
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

            .proof-container .int-link-external, .information-container .int-link-external, .proof-container .int-link-internal, .information-container .int-link-internal {
                border-bottom: 1px solid white;
            }

            .proof-container .int-link-external::after, .information-container .int-link-external::after {
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

            .self-test-qr {
                margin: 20px auto;
                width: 60%;
            }

            .tooltip {
                margin-left: 5px;
            }

            .ticket h3 {
                margin-bottom: 0.2rem;
            }

            .ticket-loading {
                font-size: 1.3rem;
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

            @media only screen
            and (orientation: landscape)
            and (max-width: 768px) {
                #ticket-modal-box {
                    height: 100%;
                    width: 100%;
                    max-width: unset;
                    max-heigth: unset;
                }

                #ticket-modal-content, #ticket-modal-content > div:first-of-type, .content-wrapper {
                    height: 100%;
                }

                .left-container, .proof-container, .information-container {
                    justify-content: space-evenly;
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
                    width: 90%;
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
                    padding: 20px;
                    flex-grow: 1;
                }

                .reload-failed {
                    width: 90%;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        const ticketTitle = html`
            <slot name="ticket-place">
                ${i18n.t('show-active-tickets.show-ticket-title')}<strong>${i18n.t('show-reference-ticket.place-name')}</strong>
            </slot>
        `;

        const additionalInformation = html `
            <div class="information-container ${classMap({hidden: this.ticketLoading})}">
                <slot name="information-container">
                    <h4>${i18n.t('show-reference-ticket.information-container-headline')}</h4>
                    ${i18n.t('show-reference-ticket.information-container-body')}
                </slot>
            </div>
        `;

        const loading = html`
            <span class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
        `;

        const noTickets = html``;

        return html`

            <div class="control ${classMap({hidden: !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: this.isLoading()})}">

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">
                        ${this.activity.getDescription(this.lang)}
                    </slot>
                </p>

                <div class="tickets ${classMap({hidden: this.isLoading()})}">
                    <div class="${classMap({hidden: this.loading})}">
                        <div class="ticket">
                            <span class="header">
                                <h3>
                                    <slot name="place">
                                        ${i18n.t('show-active-tickets.entry-ticket')}: ${i18n.t('show-reference-ticket.place-name')}
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
                                                    value="${i18n.t('show-active-tickets.show-btn-text')}"
                                                    @click="${() => {
                                                        this.showTicket();
                                                    }}"
                                                    title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <dbp-loading-button id="delete-btn"
                                                    value="${i18n.t('delete-btn-text')}"
                                                   disabled >
                                    ${i18n.t('delete-btn-text')}
                                </dbp-loading-button>
                            </div>
                        </div>
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
                                             alt="${i18n.t('image-alt-text')}"/>
                                    </div>
                                </div>
                                ${additionalInformation}
                                
                                <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => {
                                    this.closeDialog();
                                }}">
                                    <dbp-icon title="${i18n.t('file-sink.modal-close')}" name="close"
                                              class="close-icon"></dbp-icon>
                                </button>
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-reference-ticket', ShowReferenceTicket);