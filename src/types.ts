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

export interface ICache {
    isReady: Readonly<boolean>;

    connect: () => Promise<void>;

    disconnect: () => Promise<void>;

    set: <ValueType = any, KeyType = any>
    (key: KeyType, value: ValueType, ttl: number) => Promise<boolean>;

    get: <ValueType = any, KeyType = any>
    (key: KeyType) => Promise<ValueType | undefined>;

    includes: <KeyType = any>
    (key: KeyType) => Promise<boolean>;

    del: <KeyType = any>
    (key: KeyType) => Promise<number>;

    clear: () => Promise<boolean>;

    keys: <KeyType = any>
    () => Promise<KeyType[]>;

    mget: <ValueType = any, KeyType = any>
    (keys: KeyType[]) => Promise<Map<KeyType, ValueType>>;

    mdel: <KeyType = any>
    (keys: KeyType[]) => Promise<number>;

    mset: <ValueType = any, KeyType = any>
    (
        keys: KeyType[],
        values: ValueType[],
        ttl: number
    ) => Promise<boolean>;

    list: <ValueType = any, KeyType = any>
    () => Promise<Map<KeyType, ValueType>>;

    ttl: <KeyType = any>
    (key: KeyType, ttl: number) => Promise<boolean>;

    getTtl: <KeyType = any>
    (key: KeyType) => Promise<number | undefined>;

    take: <ValueType = any, KeyType = any>
    (key: KeyType) => Promise<ValueType | undefined>;
}
