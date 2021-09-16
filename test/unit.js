import {assert} from 'chai';

import '../src/dbp-greenlight.js';

suite('dbp-greenlight-app basics', () => {
  let node;

  suiteSetup(async () => {
    node = document.createElement('dbp-app');
    document.body.appendChild(node);
    await node.updateComplete;
  });

  suiteTeardown(() => {
    node.remove();
  });

  test('should render', () => {
    assert(node.shadowRoot !== undefined);
  });
});

