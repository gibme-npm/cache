// Copyright (c) 2018-2024, Brandon Lehmann <brandonlehmann@gmail.com>
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

import NodeCache, { Options as MemoryOptions } from 'node-cache';
import Cache from './common';

export { MemoryOptions, Cache };

export default class Memory extends Cache {
    public readonly client: NodeCache;
    private readonly options: Readonly<MemoryOptions>;
    private ready = false;

    /**
     * Constructs a new instance of a memory-based cache
     *
     * @param options
     */
    constructor (options: Partial<MemoryOptions> = {}) {
        super();

        options.stdTTL ??= 300;
        options.checkperiod ??= 30;

        this.options = options;

        this.client = new NodeCache(options);

        this.client.on('set', (key, value) =>
            this.emit('set', this.unstringify(key), this.unstringify(value)));
        this.client.on('expired', (key, value) =>
            this.emit('expired', this.unstringify(key), this.unstringify(value)));
        this.client.on('del', (key, value) =>
            this.emit('del', this.unstringify(key), this.unstringify(value)));
        this.client.on('flush', () => this.emit('flush'));
        this.client.on('flush_stats', () => this.emit('flush_stats'));
        this.client.on('error', error => this.emit('error', error));

        this.ready = true;
    }

    public on(event: 'set', listener: (key: any, value: any) => void): this;

    public on(event: 'expired', listener: (key: any, value: any) => void): this;

    public on(event: 'del', listener: (key: any, value: any) => void): this;

    public on(event: 'flush', listener: () => void): this;

    public on(event: 'flush_stats', listener: () => void): this;

    public on(event: 'error', listener: (error: Error) => void): this;

    public on (event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Returns in the instance is ready
     */
    public get isReady (): Readonly<boolean> {
        return this.ready;
    }

    public static get type (): string {
        return 'Memory';
    }

    /**
     * Connects to the memory storage
     */
    public async connect (): Promise<void> {
        return undefined;
    }

    /**
     * Closes the storage connection and halts the check interval
     */
    public async disconnect (): Promise<void> {
        this.ready = false;

        return this.client.close();
    }

    /**
     * Sets the value for the specified key
     *
     * @param key
     * @param value
     * @param ttl
     */
    public async set<ValueType = any, KeyType = any> (
        key: KeyType,
        value: ValueType,
        ttl = this.options.stdTTL ?? this.defaultTTL
    ): Promise<boolean> {
        const _key = this.stringify(key);

        return this.client.set(_key, this.stringify(value), ttl);
    }

    /**
     * Retrieves the value of the specified key if it exists
     *
     * @param key
     */
    public async get<ValueType = any, KeyType = any> (
        key: KeyType
    ): Promise<ValueType | undefined> {
        const _key = this.stringify(key);

        const response = this.client.get<string>(_key);

        if (response) {
            return this.unstringify(response);
        }
    }

    /**
     * Checks if the specified key exists in the cache
     *
     * @param key
     */
    public async includes<KeyType = any> (
        key: KeyType
    ): Promise<boolean> {
        const _key = this.stringify(key);

        return this.client.has(_key);
    }

    /**
     * Deletes the key (including the value) from the cache
     *
     * @param key
     */
    public async del<KeyType = any> (
        key: KeyType
    ): Promise<number> {
        const _key = this.stringify(key);

        return this.client.del(_key);
    }

    /**
     * Deletes all keys (and values) from the cache
     */
    public async clear (): Promise<boolean> {
        this.client.flushAll();

        return true;
    }

    /**
     * Retrieves a list of all keys
     */
    public async keys<KeyType = any> (): Promise<KeyType[]> {
        return this.client.keys()
            .map(key => this.unstringify(key));
    }

    /**
     * Mass retrieves values with the specified keys
     *
     * @param keys
     */
    public async mget<ValueType = any, KeyType = any> (
        keys: KeyType[]
    ): Promise<Map<KeyType, ValueType>> {
        const fetch_keys = keys.map(key => this.stringify(key));

        const data: { [key: string]: string; } = this.client.mget(fetch_keys);

        const values = new Map<KeyType, ValueType>();

        for (const key of Object.keys(data)) {
            if (data[key]) {
                values.set(this.unstringify(key), this.unstringify(data[key]));
            }
        }

        return values;
    }

    /**
     * Mass deletes values with the specified keys
     *
     * @param keys
     */
    public async mdel<KeyType = any> (
        keys: KeyType[]
    ): Promise<number> {
        const _keys = keys.map(key => this.stringify(key));

        return this.client.del(_keys);
    }

    /**
     * Mass sets values with the specified keys
     *
     * @param keys
     * @param values
     * @param ttl
     */
    public async mset<ValueType = any, KeyType = any> (
        keys: KeyType[],
        values: ValueType[],
        ttl = this.options.stdTTL ?? this.defaultTTL
    ): Promise<boolean> {
        if (keys.length !== values.length) {
            throw new Error('Keys and values array lengths must match!');
        }

        const _keys = keys.map(key => this.stringify(key));

        const _values = values.map(value => this.stringify(value));

        const set: { key: string, val: string, ttl: number }[] = [];

        for (let i = 0; i < _keys.length; i++) {
            set.push({
                key: _keys[i],
                val: _values[i],
                ttl
            });
        }

        return this.client.mset(set);
    }

    /**
     * Retrieves a map of all the keys and values in the cache
     */
    public async list<ValueType = any, KeyType = any> (): Promise<Map<KeyType, ValueType>> {
        const keys = await this.keys<KeyType>();

        return this.mget<ValueType, KeyType>(keys);
    }

    /**
     * Updates the TTL for the specified key
     *
     * @param key
     * @param ttl
     */
    public async ttl<KeyType = any> (
        key: KeyType,
        ttl = this.options.stdTTL ?? this.defaultTTL
    ): Promise<boolean> {
        return this.client.ttl(this.stringify(key), ttl);
    }

    /**
     * Retrieves the current TTL of the specified key
     *
     * @param key
     */
    public async getTtl<KeyType = any> (
        key: KeyType
    ): Promise<number | undefined> {
        return this.client.getTtl(this.stringify(key));
    }

    /**
     * Retrieves the value of the specified key and immediately deletes it from the cache
     *
     * @param key
     */
    public async take<ValueType = any, KeyType = any> (
        key: KeyType
    ): Promise<ValueType | undefined> {
        const value = this.client.take<string>(this.stringify(key));

        if (value) {
            return this.unstringify(value);
        }
    }
}

export { Memory };
