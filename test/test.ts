// Copyright (c) 2018-2025, Brandon Lehmann <brandonlehmann@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import * as assert from 'assert';
import { describe, it } from 'mocha';
import { Redis, Memory, Database } from '../src';

const engines = [Memory, Redis, Database];

for (const Engine of engines) {
    describe(Engine.type, async function () {
        const storage = new Engine();

        before(async function () {
            try {
                await storage.connect();

                await storage.clear();
            } catch {}
        });

        const test = <Key = any, Value = any>(key: Key, value: Value) => {
            after(async function () {
                if (storage.isReady) {
                    await storage.clear();
                }
            });

            it('Set', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                await storage.set(key, value);

                assert.equal(await storage.includes(key), true);
            });

            it('Includes', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                assert.equal(await storage.includes(key), true);
            });

            it('Get', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                const data = await storage.get(key);

                assert.deepEqual(data, value);
            });

            it('Keys', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                const keys = [key];

                const _keys = await storage.keys<Key>();

                assert.deepEqual(keys, _keys);
            });

            it('List', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                const records = new Map<Key, Value>();

                records.set(key, value);

                const _records = await storage.list<Value, Key>();

                assert.deepEqual(records, _records);
            });

            it('Remove', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                await storage.del('test');

                assert.equal(await storage.includes('test'), false);
            });

            it('Clear', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                await storage.clear();

                assert.equal(await storage.includes(key), false);
            });

            it('MSet', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                await storage.mset<Value, Key>([key], [value]);

                assert.equal(await storage.includes(key), true);
            });

            it('MDel', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                await storage.mdel<Key>([key]);

                assert.equal(await storage.includes(key), false);
            });

            it('Take', async function () {
                if (!storage.isReady) {
                    this.skip();
                }

                await storage.set(key, value);

                const _value = await storage.take<Value>(key);

                assert.deepEqual(value, _value);
                assert.equal(await storage.includes(key), false);
            });
        };

        describe('Simple Keys', async function () {
            const key = 'test_key';

            describe('Simple Values', async function () {
                test(key, true);
            });

            describe('Complex Values', async function () {
                test(key, { value: true, value1: 9, value3: 9.4, value4: 'test' });
            });
        });

        describe('Complex Keys', async function () {
            const key = { key: 'test' };

            describe('Simple Values', async function () {
                test(key, true);
            });

            describe('Complex Values', async function () {
                test(key, { value: true, value1: 9, value3: 9.4, value4: 'test' });
            });
        });
    });
}
