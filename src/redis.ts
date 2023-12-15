// Copyright (c) 2018-2023, Brandon Lehmann <brandonlehmann@gmail.com>
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

import { createClient, RedisClientOptions, RedisFlushModes } from 'redis';
import Cache from './common';
import { config } from 'dotenv';

config();

export { RedisClientOptions };

export interface AdditionalRedisClientOptions {
    host: string;
    port: number;
    stdTTL: number;
}

export type OptionsType = RedisClientOptions & AdditionalRedisClientOptions;

export default class Redis extends Cache {
    public readonly client = createClient();
    private readonly options: Readonly<OptionsType>;

    /**
     * Constructs a new instance of a redis-based cache
     *
     * @param options
     */
    constructor (options: Partial<OptionsType> = {}) {
        super();

        options.host ??= process.env.REDIS_HOST ?? 'localhost';
        options.port ??= parseInt(process.env.REDIS_PORT || '6379') ?? 6379;
        options.username ??= process.env.REDIS_USERNAME;
        options.password ??= process.env.REDIS_PASSWORD;
        options.stdTTL ??= 300;

        options.url = 'redis://';

        if (options.username) {
            options.url += options.username;
        }

        if (options.password) {
            if (options.username) {
                options.url += ':';
            }

            options.url += options.password;
        }

        if (options.username || options.password) {
            options.url += '@';
        }

        delete options.username;
        delete options.password;

        options.url += `${options.host}:${options.port}`;

        this.options = options as OptionsType;

        this.client = createClient(options);

        this.client.on('connect', () => this.emit('connect'));
        this.client.on('ready', () => this.emit('ready'));
        this.client.on('end', () => this.emit('end'));
        this.client.on('error', error => this.emit('error', error));
        this.client.on('reconnecting', () => this.emit('reconnecting'));
    }

    public on(event: 'connect', listener: () => void): this;

    public on(event: 'ready', listener: () => void): this;

    public on(event: 'end', listener: () => void): this;

    public on(event: 'error', listener: (error: Error) => void): this;

    public on(event: 'reconnecting', listener: () => void): this;

    public on (event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Returns if the instance is ready
     */
    public get isReady (): Readonly<boolean> {
        return this.client.isReady;
    }

    public static get type (): string {
        return 'Redis';
    }

    /**
     * Connects to the redis server
     */
    public async connect (): Promise<void> {
        await this.client.connect();
    }

    /**
     * Disconnects from the redis server
     */
    public async disconnect (): Promise<void> {
        return this.client.disconnect();
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
        if (!this.client.isReady) {
            await this.connect();
        }

        const _key = this.stringify(key);

        const response = await this.client.set(_key, this.stringify(value), {
            EX: ttl
        });

        return response?.toLowerCase() === 'ok';
    }

    /**
     * Retrieves the value of the specified key if it exists
     *
     * @param key
     */
    public async get<ValueType = any, KeyType = any> (
        key: KeyType
    ): Promise<ValueType | undefined> {
        if (!this.client.isReady) {
            await this.connect();
        }

        const _key = this.stringify(key);

        const response = await this.client.get(_key);

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
        if (!this.client.isReady) {
            await this.connect();
        }

        const _key = this.stringify(key);

        return (await this.client.exists(_key)) === 1;
    }

    /**
     * Deletes the key (including the value) from the cache
     *
     * @param key
     */
    public async del<KeyType = any> (
        key: KeyType
    ): Promise<number> {
        if (!this.client.isReady) {
            await this.connect();
        }

        const _key = this.stringify(key);

        return this.client.del(_key);
    }

    /**
     * Deletes all keys (and values) from the cache
     */
    public async clear (): Promise<boolean> {
        if (!this.client.isReady) {
            await this.connect();
        }

        return (await this.client.flushAll(RedisFlushModes.SYNC)).toLowerCase() === 'ok';
    }

    /**
     * Retrieves a list of all keys
     */
    public async keys<KeyType = any> (): Promise<KeyType[]> {
        if (!this.client.isReady) {
            await this.connect();
        }

        return (await this.client.keys('*'))
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
        if (!this.client.isReady) {
            await this.connect();
        }

        const fetch_keys = keys.map(key => this.stringify(key));

        const data = await this.client.mGet(fetch_keys);

        const values = new Map<KeyType, ValueType>();

        for (let i = 0; i < keys.length; i++) {
            if (data[i]) {
                values.set(keys[i], this.unstringify(data[i] ?? ''));
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
        if (!this.client.isReady) {
            await this.connect();
        }

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
        if (!this.client.isReady) {
            await this.connect();
        }

        if (keys.length !== values.length) {
            throw new Error('Keys and values array lengths must match!');
        }

        const _keys = keys.map(key => this.stringify(key));

        const _values = values.map(value => this.stringify(value));

        const set: [string, string][] = [];

        for (let i = 0; i < _keys.length; i++) {
            set.push([_keys[i], _values[i]]);
        }

        if ((await this.client.mSet(set)).toLowerCase() !== 'ok') {
            return false;
        }

        const promises = [];

        for (const key of keys) {
            promises.push(this.ttl(key, ttl));
        }

        return (await Promise.all(promises))
            .filter(result => result)
            .length === keys.length;
    }

    /**
     * Retrieves a map of all the keys and values in the cache
     */
    public async list<ValueType = any, KeyType = any> (): Promise<Map<KeyType, ValueType>> {
        if (!this.client.isReady) {
            await this.connect();
        }

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
        if (!this.client.isReady) {
            await this.connect();
        }

        const _key = this.stringify(key);

        return this.client.expire(_key, ttl);
    }

    /**
     * Retrieves the current TTL of the specified key
     *
     * @param key
     */
    public async getTtl<KeyType = any> (
        key: KeyType
    ): Promise<number | undefined> {
        if (!this.client.isReady) {
            await this.connect();
        }

        const result = await this.client.ttl(this.stringify(key));

        if (result >= 0) {
            return result;
        }
    }

    /**
     * Retrieves the value of the specified key and immediately deletes it from the cache
     *
     * @param key
     */
    public async take<ValueType = any, KeyType = any> (
        key: KeyType
    ): Promise<ValueType | undefined> {
        if (!this.client.isReady) {
            await this.connect();
        }

        const value = await this.get<ValueType, KeyType>(key);

        if (value) {
            await this.del(key);

            return value;
        }
    }
}

export { Redis };
