# A Simple Caching Wrapper

## Features

* Provides a common interface between backend systems
* Backend systems supported:
  * [node-cache](https://npmjs.org/package/node-cache)
  * [redis](https://npmjs.org/package/redis)

## Documentation

[https://gibme-npm.github.io/cache](https://gibme-npm.github.io/cache)

## Sample Code

### Memory

```typescript
import Memory from '@gibme/cache/memory';

(async () => {
    const client = new Memory();
    
    await client.set('somekey', { some: 'value' });
    
    const value = await client.get('somekey');
    
    if (value) {
        console.log(value);
    }
    
    await client.disconnect();
})();
```

### Redis

```typescript
import Redis from '@gibme/cache/redis';

(async () => {
    const client = new Redis({
        host: 'localhost',
        username: 'someuser',
        password: 'somepassword'
    });
    
    await client.set('somekey', { some: 'value' });
    
    const value = await client.get('somekey');
    
    if (value) {
        console.log(value);
    }
    
    await client.disconnect();
})();
```
