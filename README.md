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
npx @digital-blueprint/cli install-app greenlight greenlight-app
```

Afterwards you can point your Apache web-server to `greenlight-app/public`.

You can also use this app directly from the [Unpkg CDN](https://unpkg.com/browse/@dbp-topics/greenlight/)
for example like this: [dbp-greenlight/index.html](https://gitlab.tugraz.at/dbp/greenlight/greenlight/-/tree/main/examples/dbp-greenlight/index.html)

Note that you will need a Keycloak server along with a client id for the domain you are running this html on.

### Update app

If you want to update the DBP greenlight App in the current folder you can call:

```bash
npx @digital-blueprint/cli update-app greenlight
```

## Cron job

Before you can use this app you need to download the business rules. There is a script `assets/dgc-trust/update.sh`
which can do this. You need to call it regularly in a cron job.

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
- `gp-search-hash-internal-test-string`: String used in the qr code to determine if the qr code is a valid 3G proof for university internal tests
  - example `gp-search-hash-internal-test-string="TGCT"`
- `gp-search-self-test-string-array`: String used in the qr code to determine if the qr code is a valid selfetestlink. Link prefixes, seperated by comma
  - example `gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id='`
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

##### contact-tracing-information

The content of this slot will be shown in an inline notification for a contact tracing suggestion.

Example:

```html
<dbp-acquire-3g-ticket lang="de">
  <template slot="contact-tracing-information">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Möchten Sie auch am Contact Tracing der Universität teilnehmen?
      </div>
      <div slot="en">
        Do you want to use contact tracing at the university?
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
- `gp-search-hash-internal-test-string`: String used in the qr code to determine if the qr code is a valid 3G proof for university internal tests
  - example `gp-search-hash-internal-test-string="TGCT"`
- `gp-search-self-test-string-array`: String used in the qr code to determine if the qr code is a valid selfetestlink. Link prefixes, seperated by comma
  - example `gpSearchSelfTestStringArray: 'https://selbsttest.stmk.gv.at/public-result?id=,https://selbsttest.ktn.gv.at/public-result?id='`
- `preselected-option`: String used in the Ticket, to show where it should be valid
  - example `preselected-option="University"`

#### Slots

You use templates tags to inject slots into the activity.
These templates will be converted to div containers when the page is loaded and will not show up before that.

##### found-university-internal-test

The content of this slot will be shown in a ticket if a university internal test is found and valid. 
Without this slot "university internal test" is shown here.

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="found-university-internal-test">
    <dbp-translated subscribe="lang">
      <div slot="de">
        TU Graz Test gefunden
      </div>
      <div slot="en">
        Found TU Graz test
      </div>
    </dbp-translated>
  </div>
</template>
```

##### internal-test-text

The content of this slot will be shown in a ticket. 
Without this slot "university internal test" default text is shown here.

Example:

```html
<template id="dbp-show-active-tickets">
  <div slot="internal-test-text">
    <dbp-translated subscribe="lang">
      <div slot="de">
        Der Test der Teststraße der TU Graz wurde beim Import validiert. Eine manuelle Kontrolle ist nur mit dem Originaldokument möglich.
      </div>
      <div slot="en">
        The test of the test lane at TU Graz was validated during the import. A manual check is only possible with the original document.
      </div>
    </dbp-translated>
  </div>
</template>
```

##### internal-test-valid

The content of this slot will be shown in the overview of the tickets.
Without this slot "university internal test" default text is shown here.

Example:

```html

<template id="dbp-show-active-tickets">
    <div slot="internal-test-valid">
        <dbp-translated subscribe="lang">
            <div slot="de">
                <b>
                    3-G-Nachweis:
                    <span class="green">
                        TU Graz Test auf diesem Gerät importiert und gültig
                    </span>
                </b>
            </div>
            <div slot="en">
                <b>
                    3-G-evidence:
                    <span class="green">
                        TU Graz test imported on this device and valid
                    </span>
                </b>
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

##### information-container

The content of this slot will be shown when you open the reference ticket in the reference ticket activity.

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

### Design Note

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
