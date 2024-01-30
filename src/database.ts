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

import { createConnection, Database, Query } from '@gibme/sql';
import Timer from '@gibme/timer';
import Cache from './common';

export {
    MySQL, MariaDB, Postgres, SQLite, LibSQL,
    MySQLConfig, MySQLPoolConfig, PostgresPoolConfig, SQLiteConfig, LibSQLConfig
} from '@gibme/sql';

export interface DatabaseCacheOptions {
    database: Database;
    stdTTL: number;
    checkperiod: number;
    tableName: string;
}

export default class DB extends Cache {
    private readonly tableName;
    private ready = false;
    public readonly client: Database;
    private readonly defaultTableName = 'cache';
    private readonly checkTimer: Timer;
    private readonly key_field: string;
    private readonly value_field: string;
    private readonly expiration_field: string;

    /**
     * Constructs a new instance of a database-based cache
     *
     * @param options
     */
    constructor (private readonly options: Partial<DatabaseCacheOptions> = {}) {
        super();

        this.options.database ??= createConnection();
        this.options.stdTTL ??= this.defaultTTL;
        this.options.checkperiod ??= this.defaultTTL / 10;
        this.options.tableName ??= this.defaultTableName;

        this.client = this.options.database;
        this.tableName = this.options.tableName;

        this.checkTimer = new Timer(this.options.checkperiod * 1_000, true);

        this.key_field = this.client.escapeId('key');
        this.value_field = this.client.escapeId('value');
        this.expiration_field = this.client.escapeId('expiration');

        // check for expired entries and delete them
        this.checkTimer.on('tick', async () => {
            try {
                await this.client.query(
                    `DELETE FROM ${this.client.escapeId(this.tableName)} WHERE ${this.expiration_field} < ?`,
                    this.now());
            } catch {}
        });

        this.client.on('connect', () => this.emit('connect'));
        this.client.on('connection', () => this.emit('connect'));
        this.client.on('error', error => this.emit('error', error));
    }

    public on(event: 'set', listener: (key: any, value: any) => void): this;

    public on(event: 'del', listener: (key: any, value: any) => void): this;

    public on(event: 'flush', listener: () => void): this;

    public on(event: 'flush_stats', listener: () => void): this;

    public on(event: 'error', listener: (error: Error) => void): this;

    public on (event: any, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    /**
     * Returns if the instance is ready
     */
    public get isReady (): Readonly<boolean> {
        return this.ready;
    }

    public static get type (): string {
        return 'Database';
    }

    /**
     * Connects to the database storage
     */
    public async connect (): Promise<void> {
        return undefined;
    }

    /**
     * Closes the database connection and halts the check interval
     */
    public async disconnect (): Promise<void> {
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
        await this.checkReady();

        const _key = this.stringify(key);

        if (_key.length > 255) {
            throw new Error('key exceeds maximum allowable size');
        }

        const expiration = this.now() + ttl;

        try {
            await this.client.multiUpdate(
                this.tableName,
                ['key'],
                ['key', 'value', 'expiration'],
                [[_key, this.stringify(value), expiration]]
            );

            this.emit('set', key, value);

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves the value of the specified key if it exists
     *
     * @param key
     */
    public async get<ValueType = any, KeyType = any> (
        key: KeyType
    ): Promise<ValueType | undefined> {
        await this.checkReady();

        const _key = this.stringify(key);

        if (_key.length > 255) {
            throw new Error('key exceeds maximum allowable size');
        }

        const [rows] = await this.client.query<{value: string}>(
            `SELECT ${this.value_field} FROM ${this.client.escapeId(this.tableName)} ` +
            `WHERE ${this.key_field} = ? AND ${this.expiration_field} >= ?`,
            _key,
            this.now());

        const row = rows.shift();

        if (row) {
            return this.unstringify(row.value);
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
        const value = await this.get(key);

        return typeof value !== 'undefined';
    }

    /**
     * Deletes the key (including the value) from the cache
     *
     * @param key
     */
    public async del<KeyType = any> (
        key: KeyType
    ): Promise<number> {
        const value = await this.get(key);

        const _key = this.stringify(key);

        if (_key.length > 255) {
            throw new Error('key exceeds maximum allowable size');
        }

        try {
            const [, meta] = await this.client.query(
                `DELETE FROM ${this.client.escapeId(this.tableName)} WHERE ${this.key_field} = ?`,
                _key);

            this.emit('del', key, value);

            return meta.affectedRows;
        } catch {
            return 0;
        }
    }

    /**
     * Deletes all keys (and values) from the cache
     */
    public async clear (): Promise<boolean> {
        await this.checkReady();

        const result = await this.client.truncate(this.tableName);

        if (result) {
            this.emit('flush');
        }

        return result;
    }

    /**
     * Retrieves a list of all keys
     */
    public async keys<KeyType = any> (): Promise<KeyType[]> {
        await this.checkReady();

        try {
            const [rows] = await this.client.query<{key: string}>(
                `SELECT ${this.key_field} FROM ${this.client.escapeId(this.tableName)} ` +
                `WHERE ${this.expiration_field} >= ? ORDER BY ${this.key_field}`,
                this.now());

            return rows.map(elem => this.unstringify(elem.key));
        } catch {
            return [];
        }
    }

    /**
     * Mass retrieves values with the specified keys
     *
     * @param keys
     */
    public async mget<ValueType = any, KeyType = any> (
        keys: KeyType[]
    ): Promise<Map<KeyType, ValueType>> {
        await this.checkReady();

        const fetch_keys = keys.map(key => this.stringify(key));

        fetch_keys.forEach(key => {
            if (key.length > 255) {
                throw new Error('key exceeds maximum allowable size');
            }
        });

        const values = new Map<KeyType, ValueType>();

        const queries: string[] = [];
        const _values: any[] = [];

        const now = this.now();

        fetch_keys.forEach(key => {
            queries.push(
                `SELECT ${this.key_field}, ${this.value_field} FROM ${this.client.escapeId(this.tableName)} ` +
            `WHERE ${this.key_field} = ? AND ${this.expiration_field} >= ?`);
            _values.push(key, now);
        });

        const [rows] = await this.client.query<{key: string, value: string}>(
            `${queries.join(' UNION ')}`,
            ..._values);

        for (const { key, value } of rows) {
            values.set(this.unstringify(key), this.unstringify(value));
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
        const values = await this.mget(keys);

        await this.checkReady();

        const _keys = keys.map(key => this.stringify(key));

        _keys.forEach(key => {
            if (key.length > 255) {
                throw new Error('key exceeds maximum allowable size');
            }
        });

        const queries: Query[] = [];

        for (const key of _keys) {
            queries.push({
                query: `DELETE FROM ${this.client.escapeId(this.tableName)} WHERE ${this.key_field} = ?`,
                values: [key]
            });
        }

        const results = await this.client.transaction(queries);

        let count = 0;

        results.forEach(([, meta]) => {
            count += meta.affectedRows;
        });

        for (const [key, value] of values) {
            this.emit('del', key, value);
        }

        return count;
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
        await this.checkReady();

        if (keys.length !== values.length) {
            throw new Error('Keys and values array lengths must match!');
        }

        const _keys = keys.map(key => this.stringify(key));

        _keys.forEach(key => {
            if (key.length > 255) {
                throw new Error('key exceeds maximum allowable size');
            }
        });

        const _values = values.map(value => this.stringify(value));

        const expiration = this.now() + ttl;

        const __values: any[][] = [];

        for (let i = 0; i < _keys.length; i++) {
            __values.push([_keys[i], _values[i], expiration]);
        }

        try {
            await this.client.multiUpdate(
                this.tableName,
                ['key'],
                ['key', 'value', 'expiration'],
                __values);

            for (let i = 0; i < keys.length; i++) {
                this.emit('set', keys[i], values[i]);
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves a map of all the keys and values in the cache
     */
    public async list<ValueType = any, KeyType = any> (): Promise<Map<KeyType, ValueType>> {
        await this.checkReady();

        const result = new Map<KeyType, ValueType>();

        const [rows] = await this.client.query<{key: string, value: string}>(
            `SELECT ${this.key_field}, ${this.value_field} FROM ${this.client.escapeId(this.tableName)} ` +
            `WHERE ${this.expiration_field} >= ?`,
            this.now());

        rows.forEach(row => result.set(this.unstringify(row.key), this.unstringify(row.value)));

        return result;
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
        await this.checkReady();

        const expiration = this.now() + ttl;

        const _key = this.stringify(key);

        if (_key.length > 255) {
            throw new Error('key exceeds maximum allowable size');
        }

        try {
            const [, meta] = await this.client.query(
                `UPDATE ${this.client.escapeId(this.tableName)} ` +
                `SET ${this.expiration_field} = ? WHERE ${this.key_field} = ?`,
                expiration,
                _key);

            return meta.affectedRows !== 0;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves the current TTL of the specified key
     *
     * @param key
     */
    public async getTtl<KeyType = any> (
        key: KeyType
    ): Promise<number | undefined> {
        await this.checkReady();

        const _key = this.stringify(key);

        if (_key.length > 255) {
            throw new Error('key exceeds maximum allowable size');
        }

        const [rows] = await this.client.query<{expiration: number}>(
            `SELECT ${this.expiration_field} FROM ${this.client.escapeId(this.tableName)} ` +
            `WHERE ${this.key_field} = ?`,
            _key);

        const row = rows.shift();

        if (row) {
            return row.expiration - this.now();
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
        const value = this.get<ValueType, KeyType>(key);

        if (value) {
            await this.del(key);

            return value;
        }
    }

    /**
     * Returns the current timestamp in seconds
     *
     * @private
     */
    private now (): number {
        return Math.floor((new Date()).getTime() / 1_000);
    }

    /**
     * Checks if the instance is ready, and if not, creates the necessary table
     * if it does not already exist
     *
     * @private
     */
    private async checkReady (): Promise<void> {
        if (!this.isReady) {
            await this.client.createTable(
                this.tableName,
                [{
                    name: 'key',
                    type: 'varchar(255)'
                },
                {
                    name: 'value',
                    type: 'text'
                },
                {
                    name: 'expiration',
                    type: 'integer'
                }],
                ['key']
            );

            this.ready = true;
        }
    }
}

export { DB as Database };
