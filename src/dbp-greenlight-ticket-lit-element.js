import {css, html} from 'lit';
import {createInstance} from './i18n';
import {Icon, LoadingButton, MiniSpinner} from '@dbp-toolkit/common';
import {send} from '@dbp-toolkit/common/notification';
import MicroModal from './micromodal.es';
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import DBPGreenlightLitElement from './dbp-greenlight-lit-element';
import {classMap} from 'lit-html/directives/class-map.js';

export default class DbpGreenlightTicketLitElement extends ScopedElementsMixin(
    DBPGreenlightLitElement
) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';

        this.loading = false;
        this.ticketLoading = false;
        this.ticketOpen = false;
        this.ticketImage = '';

        this.timer = '';
        this.setTimeoutIsSet = false;
        this.showReloadButton = false;
        this.forceTicketGrayscale = false;
        this.boundUpdateTicketwrapper = this.updateTicketWrapper.bind(this);
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
            forceTicketGrayscale: {type: Boolean, attribute: false},
        };
    }

    static get scopedElements() {
        return {
            'dbp-icon': Icon,
            'dbp-mini-spinner': MiniSpinner,
            'dbp-loading-button': LoadingButton,
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
                case 'lang':
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
                summary: i18n.t('reload-error-title'),
                body: i18n.t('reload-error-body'),
                type: 'danger',
                timeout: 5,
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
        // Implemented in subclasses
        return true;
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
            }, time);
        }
    }

    /**
     * Opens the modal with the ticket
     *
     * @param {string} category
     */
    async openTicket(category) {
        if (this._('#show-ticket-modal')) {
            this.ticketOpen = true;
            MicroModal.show(this._('#show-ticket-modal'), {
                disableScroll: true,
                onClose: (modal) => {
                    this.ticketLoading = false;
                    this.ticketOpen = false;
                },
            });
            this.sendSuccessAnalyticsEvent(category, 'Success', '');
        }
    }

    /**
     * Close modal dialog #show-ticket-modal
     *
     */
    closeDialog() {
        if (this._('#show-ticket-modal')) MicroModal.close(this._('#show-ticket-modal'));
    }

    /**
     * Returns a list of ticket and the html for the modal dialogue of the ticket
     *
     * @param permissions
     * @param ticketList
     * @param additionalInformation
     * @param [buttonArea]
     * @returns {html}
     */
    getTicketUI(permissions, ticketList, additionalInformation, buttonArea = null) {
        const i18n = this._i18n;
        return html`
            <div class="${classMap({hidden: permissions})}">
                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    <slot name="description">${this.activity.getDescription(this.lang)}</slot>
                </p>

                <div
                    class="no-tickets ${classMap({
                        hidden:
                            this.loading ||
                            !this.activeTickets ||
                            this.activeTickets.length !== 0 ||
                            this.loadingTickets,
                    })}">
                    ${i18n.t('no-tickets-message')}
                    <div>
                        <a
                            class="button is-primary create-ticket-button"
                            href="#"
                            @click="${(e) => {
                                this.dispatchEvent(
                                    new CustomEvent('dbp-show-activity', {
                                        detail: {name: 'acquire-3g-ticket'},
                                    })
                                );
                                e.preventDefault();
                            }}"
                            title="${i18n.t('show-active-tickets.acquire-ticket')}">
                            ${i18n.t('show-active-tickets.acquire-ticket')}
                        </a>
                    </div>
                </div>
                <div class="tickets ${classMap({hidden: this.isLoading()})}">
                    <div class="${classMap({hidden: this.loading})}">${ticketList}</div>
                </div>
                <span class="control ${classMap({hidden: !this.loading && !this.loadingTickets})}">
                    <span class="loading">
                        <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                    </span>
                </span>
            </div>

            <div class="modal micromodal-slide" id="show-ticket-modal" aria-hidden="true">
                <div class="modal-overlay" tabindex="-2" data-micromodal-close>
                    <div
                        class="modal-container"
                        id="ticket-modal-box"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ticket-modal-title">
                        <main class="modal-content" id="ticket-modal-content">
                            <span
                                class="control ticket-loading ${classMap({
                                    hidden: !this.ticketLoading,
                                })}">
                                <span class="loading">
                                    <dbp-mini-spinner
                                        text=${i18n.t('loading-message-ticket')}></dbp-mini-spinner>
                                </span>
                            </span>

                            <div class="content-wrapper">
                                <div
                                    class="left-container ${classMap({
                                        hidden: this.ticketLoading,
                                    })}">
                                    <h3 id="ticket-modal-title">
                                        <slot name="ticket-place">
                                            ${i18n.t('show-ticket-title')}
                                            <strong>${this.locationName}</strong>
                                        </slot>
                                    </h3>
                                    <div
                                        class="reload-failed ${classMap({
                                            hidden: !this.showReloadButton,
                                        })}">
                                        <p>${i18n.t('reload-failed')}</p>
                                        <button
                                            id="reload-btn"
                                            class="button"
                                            @click="${() => {
                                                this.updateTicketAndNotify();
                                            }}"
                                            title="${i18n.t('reload')}">
                                            <dbp-icon
                                                title="${i18n.t('reload')}"
                                                name="reload"
                                                class="reload-icon"></dbp-icon>
                                        </button>
                                    </div>
                                    <div class="foto-container">
                                        <img
                                            class="${classMap({
                                                filterGrayscale: this.forceTicketGrayscale,
                                                filterNone: !this.forceTicketGrayscale,
                                            })}"
                                            src="${this.ticketImage || ''}"
                                            alt="${i18n.t('image-alt-text')}" />
                                        ${buttonArea ?? html``}
                                    </div>
                                </div>
                                ${additionalInformation}
                                <button
                                    title="Close"
                                    class="modal-close"
                                    aria-label="Close modal"
                                    @click="${() => {
                                        this.closeDialog();
                                    }}">
                                    <dbp-icon
                                        title="${i18n.t('file-sink.modal-close')}"
                                        name="close"
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

export function getTicketCss() {
    // language=css
    return css`
        .no-tickets {
            display: flex;
            flex-direction: column;
            row-gap: 2em;
        }

        .ticket {
            display: flex;
            justify-content: space-between;
            column-gap: 15px;
            row-gap: 1.5em;
            margin-bottom: 2em;
            padding: 1.25rem 1.5rem 1.25rem 1.5rem;
            border: var(--dbp-border);
            border-radius: var(--dbp-border-radius);
        }

        .tickets {
            margin-top: 2.3em;
        }

        .header {
            display: grid;
            align-items: center;
            grid-row-gap: 4px;
        }

        .btn {
            display: flex;
            justify-content: space-between;
            column-gap: 0.5em;
            align-items: start;
        }

        .filterNone {
            filter: none;
            transition-duration: 0.5s;
        }

        .filterGrayscale {
            filter: grayscale(100%);
            transition-duration: 0.5s;
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

        .proof-container,
        .information-container {
            background-color: var(--dbp-info);
            color: var(--dbp-text-inverted);
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

        .proof-container .int-link-external,
        .proof-container .int-link-internal,
        .information-container .int-link-internal,
        .information-container .int-link-external {
            border-bottom: var(--dbp-border);
            border-color: var(--dbp-text-inverted);
            color: var(--dbp-text-inverted);
        }

        .proof-container .int-link-external::after,
        .information-container .int-link-external::after {
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

        .left-container h3,
        .proof-container h4,
        .information-container h4 {
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
            color: var(--dbp-danger);
            margin-top: 0px;
            margin-bottom: 0px;
        }

        #reload-btn {
            margin-left: 10px;
        }

        .hidden {
            display: none;
        }

        @media only screen and (orientation: landscape) and (max-width: 768px) {
            #ticket-modal-box {
                height: 100%;
                width: 100%;
                max-width: unset;
                max-height: unset;
            }

            #ticket-modal-content,
            #ticket-modal-content > div:first-of-type,
            .content-wrapper {
                height: 100%;
            }

            .left-container,
            .proof-container,
            .information-container {
                justify-content: space-evenly;
            }
        }

        @media only screen and (orientation: portrait) and (max-width: 768px) {
            .create-ticket-button {
                display: flex;
                flex-direction: column;
                min-height: 24px;
            }

            .no-tickets {
                justify-content: space-between;
                align-items: normal;
                row-gap: 1.5em;
                margin-top: 2.3em;
            }

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

            .btn {
                flex-direction: column;
                align-items: normal;
                row-gap: 1em;
                padding-top: 0.5em;
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

            .content-wrapper {
                display: flex;
                flex-direction: column;
                padding: 0px;
                grid-gap: inherit;
                min-height: 100vh;
            }

            .proof-container,
            .information-container {
                padding: 12px 20px 20px 20px;
                flex-grow: 1;
            }

            .reload-failed {
                width: 90%;
            }
        }
    `;
}
