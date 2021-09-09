import {assert} from 'chai';

import * as storage from '../src/storage';

suite('storage', () => {
    test('storage.clear', async () => {
        await storage.clear('foo');
    });

    test('storage save and clear', async () => {
        await storage.save('cert', 'public', 'private');

        assert.equal(await storage.fetch('public', 'private'), 'cert');

        await storage.clear('public');
        assert.isNull(await storage.fetch('public', 'private'));
    });

    test('storage save and fetch with wrong key', async () => {
        await storage.save('cert', 'public', 'private');

        assert.isNull(await storage.fetch('public', 'private2'));
        assert.equal(await storage.fetch('public', 'private'), 'cert');
    });

    test('storage multiple', async () => {
        await storage.save('cert', 'public', 'private');
        await storage.save('cert2', 'public2', 'private2');

        assert.equal(await storage.fetch('public2', 'private2'), 'cert2');
        assert.equal(await storage.fetch('public', 'private'), 'cert');

        await storage.clear('public');
        assert.isNull(await storage.fetch('public', 'private'));
        assert.equal(await storage.fetch('public2', 'private2'), 'cert2');

        await storage.clear('public2');
        assert.isNull(await storage.fetch('public2', 'private2'));
    });

    test('storage expiresAt', async () => {
        let timestamp = 42;

        await storage.save('cert', 'public', 'private', timestamp + 10);

        assert.equal(await storage.fetch('public', 'private', timestamp + 9), 'cert');
        assert.isNull(await storage.fetch('public', 'private2', timestamp + 10));
        assert.isNull(await storage.fetch('public', 'private2', timestamp + 9));
    });
});
