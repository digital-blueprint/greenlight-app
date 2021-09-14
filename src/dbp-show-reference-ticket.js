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
        this.setTimeoutIsSet = false;
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
            console.log("refreshed", responseBody['hydra:member'][0].imageValidFor );
            that.referenceImage = responseBody['hydra:member'][0].image || '';
            that.error = false;
            const that_ = that;
            if (!this.setTimeoutIsSet) {
                that_.setTimeoutIsSet = true;
                setTimeout(function () {
                    that_.updateReferenceTicket(that_);
                    that_.setTimeoutIsSet = false;
                }, responseBody['hydra:member'][0].imageValidFor * 1000 + 1000 || 3000);
            }
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
        return html`
            <div class="${classMap({hidden: this.isLoading()})}">

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    ${this.activity.getDescription(this.lang)}
                </p>
                
                <p>
                    Hier können Sie sich das aktuelle Referenzticket anzeigen lassen.
                </p>
                <h3> Das Ticketbild </h3>                 
                <p>Das Ticket besteht entweder aus einem Ausweisbild in Graustufen oder einem X (bei denen kein Bild hinterlegt sind). Der Hintergrund zeigt ob das vorgezeigte Ticket aktuell ist. Der Hintergrund ist bei allen aktuellen Tickets gleich.</p>
                <!--<h3> Der 3-G-Nachweis</h3>
                <p>
                Ist ein Nachweis einer geringen epidemiologischen Gefahr (3-G-Regel) lokal gespeichert, dann wird dieser angezeigt.
                Hierbei gibt es 3 Möglichkeite: 3-G-Nachweis nicht gefunden oder abgelaufe, dann wird kein QR Code angezeigt <br>
                3-G-Nachweis in Form eines validen grünen Passes gefunden, wird das Ticket in Farbe und der Grüne Pass QR Code angezeigt. Dieser kann dann auf
                <a href="https://greencheck.gv.at/" title="Greencheck" taget="_blank">Green Check</a> gescannt und validiert werden. <br>
                Ist ein Selbsttests des Landes Steiermarks oder Kärntens lokal gespeichert, wird das Ticket in Graustufen und der QR Code vom Selbsttest angezeigt. Dieser QR-Code ist ein Link und kann mit einer QR Code scanner aufgerufen und manuell validiert werden.<br>
                    Ist kein 3-G-Nachweis vorhanden, wird das Ticket in Graustufen angezeigt und kein QR-Code. Der 3-G-Nachweis muss zusätzlich erbracht erbracht werden.
                </p>-->
                    
                    
               
                
                <image src="${this.referenceImage}">
            </div>
        `;
    }
}

commonUtils.defineCustomElement('dbp-show-reference-ticket', ShowReferenceTicket);