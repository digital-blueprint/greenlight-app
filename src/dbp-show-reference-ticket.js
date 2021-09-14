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
        this.ticketLoading = false;

        this.referenceImage = '';

        this.setTimeoutIsSet = false;
        this.timer = '';

        this.boundFocusHandler = this.updateReferenceTicket.bind(this);

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
            lang: { type: String },
            entryPointUrl: { type: String, attribute: 'entry-point-url' },
            loading: { type: Boolean, attribute: false },
            ticketLoading: { type: Boolean, attribute: false },
            referenceImage: { type: String, attribute: false },
        };
    }

    disconnectedCallback() {
        clearTimeout(this.timer);
        window.removeEventListener('focus', this.boundFocusHandler);
        super.disconnectedCallback();
    }

    async connectedCallback() {
        super.connectedCallback();
        window.addEventListener('focus', this.boundFocusHandler);
        this.updateComplete.then(() => {
            this.boundFocusHandler();
        });
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
     * Updates the referenceTicket and sets a timer for next update
     * Notifies the user if something went wrong
     *
     */
    async updateReferenceTicket() {
        const i18n = this._i18n;
        let responseData = await this.getReferenceTicketRequest();
        let responseBody = await responseData.clone().json();
        console.log("++++++++++++++++", responseBody);
        if (responseData.status === 200) { // Success
            console.log("-------------____----");
            this.referenceImage = responseBody['hydra:member'][0].image || '';
            const that = this;
            if (!this.setTimeoutIsSet) {
                that.setTimeoutIsSet = true;
                that.timer = setTimeout(function () {
                    let boundUpdateTicket = that.updateReferenceTicket.bind(that);
                    boundUpdateTicket();
                    that.setTimeoutIsSet = false;
                }, responseBody['hydra:member'][0].imageValidFor * 1000 + 1000 || 3000);
            }
            return true;
        } else {  // Other Error
            send({
                "summary": i18n.t('show-active-tickets.other-error-title'), //TODO anpassen
                "body":  i18n.t('show-active-tickets.other-error-body'),
                "type": "danger",
                "timeout": 5,
            });
            return false;
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
     * @param ticket
     */
    async showTicket(ticket) {
        this.ticketLoading = true;
        if (this._('#show-ticket-modal')) {
            MicroModal.show(this._('#show-ticket-modal'), {
                disableScroll: true,
                onClose: modal => {
                    this.ticketLoading = false;
                },
            });
        }
        let success = await this.updateReferenceTicket();
        if (!success) {
        }
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
                margin-top: 2em;
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
                max-width: 700px;
                min-height: unset;
                height: auto;
            }
            
            #qr-code-hash svg{
                display: block;
                width: 80%;
                margin: auto;
            }
            
            .green-pass-evidence {
                line-height: 20px;
            }
            
            .proof-container, .information-container{
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
            
            .proof-container .int-link-external, .proof-container .int-link-internal, .information-container .int-link-internal{
                border-bottom: 1px solid white;;
            }
            
            .proof-container .int-link-external::after{
                filter: invert(100%);
                -webkit-filter: invert(100%);
            }
            
            .foto-container{
                width: 80%;
            }
            
            .foto-container img{
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
            
            .content-wrapper{
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
            
            .hidden {
                display: none;
            }
            
            .self-test-qr {
                margin: 20px auto;
                width: 60%;
            }
            
            .tooltip{
                margin-left: 5px;
            }
            
            .red {
                color: var(--dbp-override-danger-bg-color);
            }
            
            .green {
                color: var(--dbp-override-success-bg-color);
            }
            
            .ticket h3  {
                margin-bottom: 0.2rem;
            }
            
            .ticket-loading {
                font-size: 1.3rem;
            }
            
            @media only screen
            and (orientation: landscape)
            and (max-width:768px) {
                #ticket-modal-box {
                    height: 100%;
                    width: 100%;
                    max-width: unset;
                    max-heigth: unset;
                }
                
                #ticket-modal-content, #ticket-modal-content > div:first-of-type, .content-wrapper{
                    height: 100%;                   
                }
                
                .left-container, .proof-container, .information-container{
                    justify-content: space-evenly;
                }
            }

            @media only screen
            and (orientation: portrait)
            and (max-width:768px) {

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
                
                .left-container{
                    padding: 11px 20px 20px 20px;
                }
                
                .foto-container{
                    width: 90%;
                }
                
                #qr-code-hash svg{
                    width: 100%;
                }
                
                .content-wrapper{
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
            }
        `;
    }

    render() {
        const i18n = this._i18n;
        return html`

            <div class="control ${classMap({hidden: !this.isLoading()})}">
                <span class="loading">
                    <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                </span>
            </div>

            <div class="${classMap({hidden: this.isLoading()})}">

                <h2>${this.activity.getName(this.lang)}</h2>
                <p class="subheadline">
                    ${this.activity.getDescription(this.lang)}
                </p>
                <p>${i18n.t('show-active-tickets.description')}</p>
                
                <div class="border tickets ${classMap({hidden: this.isLoading()})}">
                    <div class="${classMap({hidden: this.loading})}">
                        <div class="ticket">
                            <span class="header">
                                <h3>${i18n.t('show-active-tickets.entry-ticket')}: LocationName</h3> <!-- TODO Übersetzen -->
                                <span class="header">
                                   <b>Status: 3-G-Nachweis <span class="green">gültig</span>/<span class="red">ungültig</span></b>
                                   <span>Hier wird die Gültigkeit eines Tickets angezeigt.</span>
                                   
                                </span>
                            </span>
                            <div class="btn">
                                <dbp-loading-button type="is-primary" value="${i18n.t('show-active-tickets.show-btn-text')}" @click="${() => { this.showTicket(); }}" title="${i18n.t('show-active-tickets.show-btn-text')}"></dbp-loading-button>
                                <dbp-loading-button id="delete-btn" value="${i18n.t('show-active-tickets.delete-btn-text')}" disabled></dbp-loading-button>
                            </div>
                        </div>
                    </div>
                    <span class="control ${classMap({hidden: !this.loading})}">
                        <span class="loading">
                            <dbp-mini-spinner text=${i18n.t('loading-message')}></dbp-mini-spinner>
                        </span>
                    </span>
                   
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
                                    <h3 id="ticket-modal-title">${i18n.t('show-active-tickets.show-ticket-title')}<strong>LocationName</strong></h3><!--TODO Übersetzen -->
                                    <div class="foto-container">
                                        <img src="${this.referenceImage || ''}" alt="Ticketfoto" />
                                    </div>
                                </div>
                                
                              
                                <div class="information-container ${classMap({hidden: this.ticketLoading})}">
                                    
                                    <h4> Der 3-G-Nachweis</h3>
                                    <p>
                                    Ist ein Nachweis einer geringen epidemiologischen Gefahr (3-G-Regel) lokal gespeichert, dann wird dieser hier angezeigt.
                                    </p>
                                    <p>                            
                                        Ist ein 3-G-Nachweis in Form eines validen <strong>grünen Passes</strong> lokal gespeichert, wird das Ticket in Farbe und der Grüne Pass QR Code angezeigt. Dieser kann dann auf
                                        <a href="https://greencheck.gv.at/" title="Greencheck" taget="_blank">Green Check</a> gescannt und validiert werden.
                                        <br><br>
                                            Ist ein 3-G-Nachweis in Form eines <strong>Selbsttests</strong> des Landes Steiermarks oder Kärntens lokal gespeichert, wird das Ticket in Graustufen und der QR Code vom Selbsttest angezeigt. 
                                            Dieser QR-Code enthält einen Link und kann mit einem QR-Code Scanner aufgerufen und manuell validiert werden.   
                                    </p>
                                   
                               
                                </div>

                                <button title="Close" class="modal-close" aria-label="Close modal" @click="${() => { this.closeDialog(); }}">
                                    <dbp-icon title="${i18n.t('file-sink.modal-close')}" name="close" class="close-icon"></dbp-icon>
                                </button>
                            </div>
                            
                        </main>
                        
                    </div>
                </div>
            </div>
        `;
        /*return html`
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
        `;*/
    }
}

commonUtils.defineCustomElement('dbp-show-reference-ticket', ShowReferenceTicket);