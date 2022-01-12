# Greenlight Application

[GitLab Repository](https://gitlab.tugraz.at/dbp/greenlight/greenlight) |
[npmjs package](https://www.npmjs.com/package/@dbp-topics/greenlight) |
[Unpkg CDN](https://unpkg.com/browse/@dbp-topics/greenlight/)

## Local development

```bash
# get the source
git clone git@gitlab.tugraz.at:dbp/greenlight/greenlight.git
cd greenlight
git submodule update --init

# install dependencies
yarn install

# constantly build dist/bundle.js and run a local web-server on port 8001 
yarn run watch

# run tests
yarn test
```

Jump to <https://localhost:8001> and you should get a Single Sign On login page.

## Using this app as pre-built package

### Install app

If you want to install the DBP greenlight App in a new folder `greenlight-app` you can call:

```bash
npx @digital-blueprint/cli install-app greenlight greenlight-app /
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

Afterwards you can point your Apache web-server to `greenlight-app/public`.

Make sure you are allowing `.htaccess` files in your Apache configuration.

Also make sure to add all of your resources you are using (like your API and Keycloak servers) to the
`Content-Security-Policy` in your `greenlight-app/public/.htaccess`, so the browser allows access to those sites.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/greenlight/)
for example like this: [dbp-greenlight/index.html](https://gitlab.tugraz.at/dbp/greenlight/greenlight/-/tree/main/examples/dbp-greenlight/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the DBP greenlight App in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app greenlight
```

**Warning:** There may be issues when you run these commands as root user, best use a non-root user, like `www-data`.
To do this you can for example open a shell with `runuser -u www-data -- bash`.

## Cron job for Updating the Trust Data

The app depends on the official trust list, value sets and business rules which
are provided via
https://github.com/Federal-Ministry-of-Health-AT/green-pass-overview

In addition it depends on a set of business rules which are maintained at
https://github.com/digital-blueprint/dcc-at-rule-sets

Both data sets need to be updated regularly via a cron job.

```
0    *    *    *    *     /<my-path>/greenlight-app/public/app/update.sh TUGRAZ
```

The first argument passed to update.sh defines the rule set which should be
downloaded. The script depends on `curl` being installed.

You will find the certificates downloaded in `/<my-path>/greenlight-app/public/app/local/@dbp-topics/greenlight/dgc-trust/prod`.

NOTE: Failing to update the data will result in signatures expiring after 2 days
which breaks the core functionality of the app.

## Activities

### dbp-acquire-3g-ticket

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
    - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
    - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
    - example auth property: `{token: "THE_BEARER_TOKEN"}`
    - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `gp-search-hash-string`: String used in the qr code to determine if the qr code is a valid 3G proof
  - example `gp-search-hash-string="HC1"`
- `gp-search-self-test-string-array`: String used in the qr code to determine if the qr code is a valid selfetestlink. Link prefixes, seperated by comma
  - example `gp-search-self-test-string-array="https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id="`
- `gp-self-test-valid`: Boolean attribute: if self tests are valid or not
  - example `gp-self-test-valid`
- `preselected-option`: String used in the Ticket, to show where it should be valid
  - example `preselected-option="University"`
- `file-handling-enabled-targets` (optional, default: `local`): sets which destination are enabled
  - you can use `local` and `nextcloud`
  - example `file-handling-enabled-targets="local,nextcloud,clipboard"`
- `nextcloud-web-app-password-url` (optional): Nextcloud Auth Url to use with the Nextcloud file picker
  - example `nextcloud-web-app-password-url="http://localhost:8081/index.php/apps/webapppassword"`
  - `nextcloud-web-dav-url` also needs to be set for the Nextcloud file picker to be active
- `nextcloud-web-dav-url` (optional): Nextcloud WebDav Url to use with the Nextcloud file picker
  - example `nextcloud-web-dav-url="http://localhost:8081/remote.php/dav/files"`
  - `nextcloud-auth-url` also needs to be set for the Nextcloud file picker to be active
- `nextcloud-file-url` (optional): Nextcloud File Url to use with the Nextcloud file picker
  - example `nextcloud-file-url="http://localhost:8081/apps/files/?dir="`
- `nextcloud-auth-info` (optional): Additional authentication information text that is shown in the Nextcloud file picker
  - example `nextcloud-auth-info="You need special permissions for this function"`
- `nextcloud-name` (optional): the name of the nextcloud
  - example `nextcloud-name="Your university cloud"`
  

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### description

The content of this slot will be shown below the headline and can be used to provide
further information about the page.

Example:

```html
<dbp-acquire-3g-ticket lang="de">
  <template slot="description">
    <dbp-translated subscribe="lang">
      <div slot="de">
          Erstellt ein Ticket für den Zugang zu Räumlichkeiten der TU Graz.
      </div>
      <div slot="en">
          Creates a ticket for access to premises of TU Graz.
      </div>
    </dbp-translated>
  </template>
</dbp-acquire-3g-ticket>
```

##### additional-information

The content of this slot will be shown below the other text and can be used to provide
further information about the process to report a risk. For example a link to a page with
more information about how to report a risk can be provided.

Example:

```html
<dbp-acquire-3g-ticket lang="de">
  <template slot="additional-information">
    <dbp-translated subscribe="lang">
      <div slot="de">
          Sie können Ihren 3G Nachweis vorab prüfen, indem sie den entsprechenden QR Code scannen oder ein vorhandenes PDF
          oder Bild hochladen und sich damit ein Ticket für einen Ort ausstellen lassen. Alternativ können Sie auch manuell
          bestätigen, dass Sie einen 3G Nachweis bei sich tragen und diesen im Falle einer Kontrolle nachweisen können.
      </div>
      <div slot="en">
          You can check your 3G proof in advance by scanning the corresponding QR code or uploading an existing PDF or
          image and using it to issue a ticket for a location. Alternatively, you can manually confirm that you have a
          3G certificate with you and that you can prove it in the event of a control.
      </div>
    </dbp-translated>
  </template>
</dbp-acquire-3g-ticket>
```

### dbp-show-active-tickets

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
  - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
  - example `entry-point-url="https://api-dev.tugraz.at"`
- `auth` object: you need to set that object property for the auth token
  - example auth property: `{token: "THE_BEARER_TOKEN"}`
  - note: most often this should be an attribute that is not set directly, but subscribed at a provider
- `gp-search-hash-string`: String used in the qr code to determine if the qr code is a valid 3G proof
  - example `gp-search-hash-string="HC1"`
- `gp-search-self-test-string-array`: String used in the qr code to determine if the qr code is a valid selfetestlink. Link prefixes, seperated by comma
  - example `gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id='`
- `gp-self-test-valid`: Boolean attribute: if self tests are valid or not
  - example `gp-self-test-valid`
- `preselected-option`: String used in the Ticket, to show where it should be valid
  - example `preselected-option="University"`

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### description

The content of this slot will be shown in the ticket reference activity description.

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="description">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <p>
          Zeigt eine Liste erstellter Tickets an.
        </p>
      </div>
      <div slot="en">
        <p>
          Shows a list of created tickets.
        </p>
      </div>
    </dbp-translated>
  </div>
</template>
```

##### ticket-place

The content of this slot will be shown as the ticket place.

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="ticket-place">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <p>
          Tu Graz
        </p>
      </div>
      <div slot="en">
        <p>
          TU Graz
        </p>
      </div>
    </dbp-translated>
  </div>
</template>
```

##### greenlight-reference

The content of this slot will be shown in a ticket if there was no valid 3-G-evidence found.

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="greenlight-reference">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Es wurde kein gültiger gespeicherter 3-G-Nachweis gefunden. Zeigen Sie ihren Nachweis manuell vor oder laden Sie einen neuen Nachweis hoch, indem Sie ein neues Ticket unter Eintrittsticket erstellen anfordern.
      </div>
      <div slot="en">
        No valid stored 3-G-evidence was found. Show your proof manually or upload a new proof by requesting a new ticket under Create entry ticket.
      </div>
    </dbp-translated>
  </div>
</template>
```

##### greenlight-reference-invalid

The content of this slot will be shown in a ticket if there was a self-test found.

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="greenlight-reference-invalid">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Es wurde kein gültiger gespeicherter 3-G-Nachweis gefunden. Zeigen Sie ihren Nachweis manuell vor oder laden Sie einen neuen Nachweis hoch, indem Sie ein neues Ticket unter Eintrittsticket erstellen anfordern.
      </div>
      <div slot="en">
        No valid stored 3-G-evidence was found. Show your proof manually or upload a new proof by requesting a new ticket under Create entry ticket.
      </div>
    </dbp-translated>
  </div>
</template>
```

##### 3-g-evidence-invalid-text

Use this slot and add a link to faq

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="3-g-evidence-invalid-text">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <a href="/link-to-faq">FAQ</a>
        Eventuell haben Sie Ihren Nachweis auf einem anderen Gerät importiert, der Nachweis ist nicht mehr gültig oder die Applikation wurde für einen längeren Zeitraum nicht genutzt.      
      </div>
      <div slot="en">
        <a href="/link-to-faq">FAQ</a>
        You may have imported your evidence on another device, the evidence is no longer valid or the application has not been used for a longer period of time.      
      </div>
    </dbp-translated>
  </div>
</template>
```

### dbp-show-reference-ticket

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

#### Attributes

- `lang` (optional, default: `de`): set to `de` or `en` for German or English
  - example `lang="de"`
- `entry-point-url` (optional, default is the TU Graz entry point url): entry point url to access the api
  - example `entry-point-url="https://api-dev.tugraz.at"`


#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### description

The content of this slot will be shown in the ticket reference activity description.

Example:

```html
<template id="dbp-show-reference-ticket">
  <div slot="description">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <p>
          Hier können Sie das aktuell gültige Referenzticket zum Zweck der Kontrolle einsehen. Dieses Ticket berechtigt nicht zum Eintritt an die TU Graz.
        </p>
      </div>
      <div slot="en">
        <p>
          Here you can view the currently valid reference ticket for the purpose of control. This ticket does not entitle you to enter the TU Graz.
        </p>
      </div>
    </dbp-translated>
  </div>
</template>
```

##### place

The content of this slot will be shown as the ticket headline in the modal dialogue.

Example:

```html
<template id="dbp-show-reference-ticket">
  <div slot="place">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <p>
          Ticket: Tu Graz
        </p>
      </div>
      <div slot="en">
        <p>
          Ticket: Tu Graz
        </p>
      </div>
    </dbp-translated>
  </div>
</template>
```

##### ticket-place

The content of this slot will be shown as the ticket place in the ticket overview.

Example:

```html
<template id="dbp-show-reference-ticket">
  <div slot="ticket-place">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <p>
          Tu Graz
        </p>
      </div>
      <div slot="en">
        <p>
          TU Graz
        </p>
      </div>
    </dbp-translated>
  </div>
</template>
```

##### ticket-description

The content of this slot will be shown in the ticket reference activity description.

Example:

```html
<template id="dbp-show-reference-ticket">
  <div slot="ticket-description">
    <dbp-translated subscribe="lang">
      <div slot="de">
        <span>
            Hier wird die Gültigkeit eines Eintrittstickets angezeigt. Ob ein Ticket aktiv oder inaktiv ist hängt von dem auf diesem Gerät importierten 3-G-Nachweis ab. Das Referenzticket berechtigt nicht zum Eintritt an die Universität.
        </span>
      </div>
      <div slot="en">
        <span>
            The validity of the access test is displayed here. Depending on the available evidence the ticket is shown as active or inactive. The reference ticket does not entitle you to enter the university.
        </span>
      </div>
    </dbp-translated>
  </div>
</template>
```

##### information-container

The content of this slot will be shown under the reference ticket in the reference ticket activity.

Example:

```html
<template id="dbp-show-reference-ticket">
  <div slot="information-container">
    <dbp-translated subscribe="lang">
      <div slot="de">
          <h4>Informationen zum 3-G-Nachweis</h4>
          <p>
              Ist ein <strong>gültiger grüner Pass</strong> auf dem Gerät importiert, wird dessen QR-Code angezeigt das Ticket in Farbe dargestellt.
          </p>
      </div>
      <div slot="en">
          <h4>Information about 3-G evidence</h4>
          <p>
              If a <strong>valid health certitificate</strong> is available on this device then its QR-code is displayed and the ticked is shown in color.
          </p>
      </div>
    </dbp-translated>
  </div>
</template>
```

## "dbp-greenlight" Slots

These are common slots for the appshell. You can find the documentation of these slot in the `README.md` of the appshell webcomponent.

## Design Note

To ensure a uniform and responsive design these activities should occupy 100% width of the window when the activities width are under 768 px.

## Mandatory attributes

If you are not using the `provider-root` attribute to "terminate" all provider attributes
you need to manually add these attributes so that the topic will work properly:

```html
<dbp-greenlight
    auth
    requested-login-status
    analytics-event
>
</dbp-greenlight>
```
