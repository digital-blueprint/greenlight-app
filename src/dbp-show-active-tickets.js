import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPGreenlightLitElement from "./dbp-greenlight-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {LoadingButton, Icon, MiniSpinner, InlineNotification} from '@dbp-toolkit/common';
import {classMap} from 'lit-html/directives/class-map.js';
import * as commonStyles from '@dbp-toolkit/common/styles';
import * as CheckinStyles from './styles';


class ShowActiveTickets extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activeTickets = [];
        this.loading = false;
        this._initialFetchDone = false;
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
            initialTicketsLoading: { type: Boolean, attribute: false },
            loading: { type: Boolean, attribute: false },
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

        //TODO
        list[0] = { location: { name: 'Test Location' }, endTime: new Date() };

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

    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getNotificationCSS()}
            ${CheckinStyles.getCheckinCss()}
            ${commonStyles.getButtonCSS()}
            
            .tickets {
                display: flex;
                justify-content: space-between;
                column-gap: 15px;
                row-gap: 1.5em;
                align-items: center;
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

                        <span class="header">
                            <strong>${i.location.name}</strong>
                            ${this.getReadableDate(i.endTime)}
                        </span>
                        <div class="btn">
                            <dbp-loading-button type="is-primary" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${(event) => {}}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                            <dbp-loading-button id="refresh-btn" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.refresh-btn-text')}" @click="${(event) => {}}" title="${i18n.t('show-active-tickets.refresh-btn-text')}"></dbp-loading-button>
                            <dbp-loading-button id="delete-btn" ?disabled="${this.loading}" value="${i18n.t('show-active-tickets.delete-btn-text')}" @click="${(event) => {}}" title="${i18n.t('show-active-tickets.delete-btn-text')}"></dbp-loading-button>
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
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-active-tickets', ShowActiveTickets);