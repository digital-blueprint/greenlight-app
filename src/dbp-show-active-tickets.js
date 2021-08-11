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
        this.locationName = '';
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
            //console.log("######", propName);
        });

        super.update(changedProperties);
    }

    parseActiveTickets(response) {
        let list = [];

        //TODO request to fetch list of my active tickets
        //TODO parse response and send correct errors
        list[0] = { location: { name: 'Test Location' }, endTime: new Date() };
        list[1] = { location: { name: 'TU Graz' }, endTime: new Date() };
        this.activeTicketsCounter = 2;

        return list;
    }

    async getActiveTickets() {
        let response = { };

        //TODO
        response.status = 200;

        return response;
    }

    /**
     * Get a list of active checkins
     *
     * @returns {Array} list
     */
    async getListOfActiveTickets() {
        this.initialTicketsLoading = !this._initialFetchDone;
        try {
            let response = await this.getActiveTickets();
            let responseBody = await response; //await response.json(); //TODO
            if (responseBody !== undefined && responseBody.status !== 403) {
                this.activeTickets = this.parseActiveTickets(responseBody);
            }
        } finally {
            this.initialTicketsLoading = false;
            this._initialFetchDone = true;
        }
    }

    showTicket(event, entry) {
        this.locationName = entry.location.name;
        MicroModal.show(this._('#show-ticket-modal'), {
            disableScroll: true,
            onClose: modal => {
                this.statusText = "";
                this.loading = false;
            },
        });
    }

    refreshTicket(event, entry) {
        //TODO request to create ticket for this room again
        //TODO do not update something - fetch list again
        let date = new Date();
        date.setHours(23);
        console.log(date);
        const index = this.activeTickets.indexOf(entry);
        if (index > -1) {
            this.activeTickets[index] = { location: { name: entry.location.name }, endTime: date };
        }
        this.activeTicketsCounter++;
    }

    deleteTicket(event, entry) {
        //TODO request to delete the ticket
        const index = this.activeTickets.indexOf(entry);
        if (index > -1) {
            this.activeTickets.splice(index, 1); //TODO do not delete something from the list - fetch the list again
        }
        this.activeTicketsCounter--;
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
            
            .foto-container {
                width: 144px;
                height: 190px;
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
                justify-content: center;
                padding: 30px;
                max-height: 400px;
                min-height: 400px;
                min-width: 680px;
                max-width: 680px;
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

            #ticket-modal-box .modal-content {
                display: flex;
                flex-direction: row;
                height: 100%;
                column-gap: 2em;
            }

            #ticket-modal-box .modal-content label {
                display: block;
                width: 100%;
                text-align: left;
            }

            #ticket-modal-box .modal-content div {
                display: flex;
                flex-direction: column;
                margin-top: 33px;
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

            @media only screen
            and (orientation: portrait)
            and (max-width:768px) {

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
                
                .loading{
                    justify-content: center;
                }
            }
        `;
    }

    render() {
        const i18n = this._i18n;

        if (this.isLoggedIn() && !this.isLoading() && !this._initialFetchDone && !this.initialTicketsLoading) {
            this.getListOfActiveTickets();
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
                
                <h2>${i18n.t('show-active-tickets.title')}</h2>
                <p>${i18n.t('show-active-tickets.description')}</p>
                
                <div class="border tickets ${classMap({hidden: !this.isLoggedIn() || this.isLoading()})}">
                    ${ this.activeTickets.map(i => html`
                        <div class="ticket">
                            <span class="header">
                                <strong>${i.location.name}</strong>
                                ${this.getReadableDate(i.endTime)}
                            </span>
                            <div class="btn">
                                <dbp-loading-button type="is-primary" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${(event) => { this.showTicket(event, i); }}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <dbp-loading-button id="refresh-btn" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.refresh-btn-text')}" @click="${(event) => { this.refreshTicket(event, i); }}" title="${i18n.t('show-active-tickets.refresh-btn-text')}"></dbp-loading-button>
                                <dbp-loading-button id="delete-btn" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.delete-btn-text')}" @click="${(event) => { this.deleteTicket(event, i); }}" title="${i18n.t('show-active-tickets.delete-btn-text')}"></dbp-loading-button>
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
                            <h2 id="ticket-modal-title">${i18n.t('show-active-tickets.show-ticket-title')}<strong>${this.locationName}</strong></h2>
                            <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => { this.closeDialog(); }}">
                                <dbp-icon title="${i18n.t('file-sink.modal-close')}" name="close" class="close-icon"></dbp-icon>
                            </button>
                        </header>
                        <main class="modal-content" id="ticket-modal-content">
                            <div class="foto-container">
                                <img src="${commonUtils.getAssetURL('@dbp-topics/greenlight', 'wbstudkart.jpeg')}" alt="Foto">
                            </div>
                            <div>
                                TODO: Content
                            </div>
                        </main>
                        <footer class="modal-footer">
                            <div class="modal-footer-btn">
                                <!--Footer Text-->
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-active-tickets', ShowActiveTickets);