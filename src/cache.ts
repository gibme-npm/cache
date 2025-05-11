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

import { EventEmitter } from 'events';

/**
 * Base cache interface
 */
export default abstract class Cache extends EventEmitter {
    protected readonly defaultTTL = 300;

    abstract get isReady(): Readonly<boolean>;

    abstract clear(): Promise<boolean>;

    abstract connect(): Promise<void>;

    abstract del<KeyType>(key: KeyType): Promise<number>;

    abstract disconnect(): Promise<void>;

    abstract get<ValueType, KeyType>(key: KeyType): Promise<ValueType | undefined>;

    abstract getTtl<KeyType>(key: KeyType): Promise<number | undefined>;

    abstract includes<KeyType>(key: KeyType): Promise<boolean>;

    abstract keys<KeyType>(): Promise<KeyType[]>;

    abstract list<ValueType, KeyType>(): Promise<Map<KeyType, ValueType>>;

    abstract mdel<KeyType>(keys: KeyType[]): Promise<number>;

    abstract mget<ValueType, KeyType>(keys: KeyType[]): Promise<Map<KeyType, ValueType>>;

    abstract mset<ValueType, KeyType>(keys: KeyType[], values: ValueType[], ttl: number): Promise<boolean>;

    abstract set<ValueType, KeyType>(key: KeyType, value: ValueType, ttl: number): Promise<boolean>;

    abstract take<ValueType, KeyType>(key: KeyType): Promise<ValueType | undefined>;

    abstract ttl<KeyType>(key: KeyType, ttl: number): Promise<boolean>;

    /**
     * JSON encodes the data
     *
     * @param value
     * @private
     */
    protected stringify<Type = any> (value: Type): string {
        return JSON.stringify(value);
    }

    /**
     * Parses JSON into a value
     *
     * @param value
     * @private
     */
    protected unstringify<OutputType = any> (value: string): OutputType {
        return JSON.parse(value);
    }
}

export { Cache };
