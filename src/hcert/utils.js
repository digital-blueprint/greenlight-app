import * as commonUtils from '@dbp-toolkit/common/utils';
import {name as pkgName} from './../../package.json';

/**
 * Returns the hcert-kotlin module
 * 
 * @returns {Promise<object>} The module
 */
export async function importHCert() {
    // The bundle can only be loaded as a normal module, so
    // we inject it into the body, extract it from window
    // and then try to cover all traces of what we did.
    // So we can kinda pretend that this is like an ES module..
    let promise = importHCert._pomise;
    if (promise === undefined) {
        promise = new Promise((resolve, reject) => {
            let script = document.createElement('script');
            script.onload = function () {
                let hcert = window.hcert;
                delete window.hcert;
                document.head.removeChild(script);
                resolve(hcert);
            };
            script.onerror = function (e) {
                document.head.removeChild(script);
                reject(e);
            };
            script.src = commonUtils.getAssetURL(pkgName, 'hcert-kotlin.js');
            document.head.appendChild(script);
          });
          importHCert._pomise = promise;
    }
    return promise;
}
