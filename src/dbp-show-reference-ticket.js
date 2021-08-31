import {createInstance} from './i18n.js';
import {css, html} from 'lit-element';
import DBPGreenlightLitElement from "./dbp-greenlight-lit-element";
import {ScopedElementsMixin} from '@open-wc/scoped-elements';
import * as commonUtils from '@dbp-toolkit/common/utils';
import {Activity} from './activity.js';
import metadata from './dbp-show-reference-ticket.metadata.json';
import * as commonStyles from '@dbp-toolkit/common/styles';
import {classMap} from 'lit-html/directives/class-map.js';

class ShowReferenceTicket extends ScopedElementsMixin(DBPGreenlightLitElement) {
    constructor() {
        super();
        this._i18n = createInstance();
        this.lang = this._i18n.language;
        this.entryPointUrl = '';
        this.activity = new Activity(metadata);
        this.referenceImage = '';
        this.error = false;
        this.refreshInterval = false;
    }

    static get scopedElements() {
        return {
        };
    }

    static get properties() {
        return {
            ...super.properties,
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            referenceImage: { type: String, attribute: false },
        };
    }

    disconnectedCallback() {
        const that = this;
        window.removeEventListener('focus', that.updateReferenceTicket);
        window.clearInterval(this.refreshInterval);// 5min = 300000 ms

        super.disconnectedCallback();
    }

    async connectedCallback() {
        super.connectedCallback();
        this.updateComplete.then(() => {
            that.updateReferenceTicket(that);
        });
        const that = this;
        this.refreshInterval = window.setInterval(that.updateReferenceTicket, 300000, that);// 5min = 300000 ms TODO deregister
        window.addEventListener('focus', function() {that.updateReferenceTicket(that);});

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

    firstUpdated() {
    }

    async updateReferenceTicket(that) {
        let responseData = await that.getReferenceTicketRequest();
        let responseBody = await responseData.clone().json();

        if(responseData.status === 200) {
            console.log("refreshed");
            that.referenceImage = responseBody['hydra:member'][0].image || '';
            that.error = false;

        } else {
            that.error = true;
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


    static get styles() {
        // language=css
        return css`
            ${commonStyles.getThemeCSS()}
            ${commonStyles.getGeneralCSS(false)}
            ${commonStyles.getActivityCSS()}

        `;
    }

    render() {
        const i18n = this._i18n;
        return html`
            <div class="${classMap({hidden: this.isLoading()})}">

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    ${this.activity.getDescription(this.lang)}
                </p>
                
                <p>
                    Hier wird das aktuelle Referenzticket angezeigt. 
                </p>
                
                <image src="${this.referenceImage}">
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-reference-ticket', ShowReferenceTicket);