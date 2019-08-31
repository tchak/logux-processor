# logux-processor
[![build status](https://travis-ci.com/tchak/logux-processor.svg?branch=master)](https://travis-ci.com/tchak/logux-processor)
[![current npm version](https://img.shields.io/npm/v/logux-processor.svg)](https://www.npmjs.com/package/logux-processor)
![required node version](https://img.shields.io/node/v/logux-processor.svg)
![license](https://img.shields.io/npm/l/logux-processor.svg)

[Logux] processor for Node.js HTTP servers.

[Logux]: https://github.com/logux/logux

## Motivation

It is possible to write a `logux` server in node directly using `@logux/server` framework. But it means you are coupling your business logic application with a web socket server. They can have quite different scaling characteristics. By using this module, it is possible to write a backend server in node to be used with `@logux/server` in proxy mode. Processor is written in TypeScript and makes no assumptions about the web server used as long as it can send back a `ReadableStream`.

## Installation

Install with yarn:

```bash
yarn add logux-processor
```

## Usage

Example usage with [Fastify](https://www.fastify.io)

```javascript
import Fastify from 'fastify';
import LoguxProcessor from 'logux-processor';
import db from './db';

class TodoLoguxProcessor extends LoguxProcessor {
  async auth(userId, credentials) {
    const user = await db.find('User', userId);
    return user && user.token = credentials;
  }

  async access(context) {
    return true;
  }

  async isValidAction(context, action) {
    return action.type === 'ADD_TODO';
  }

  async isValidChannel(context, channel) {
    return channel.match(/\w*\/\w*/);
  }

  async process(context, action, meta) {
    switch (action.type) {
    case 'ADD_TODO':
      await db.create('Todo', action.todo);
    }
  }

  async resend(context, action) {
    switch (action.type) {
    case 'ADD_TODO':
      return {
        channels: [`Todo/${action.todo.id}`]
      };
    default:
      return false;
    }
  }

  async getInitialData(context, channel) {
    const [type, id] = channel.split('/');
    switch (type) {
    case 'Todo':
      return [
        {
          type: 'ADD_TODO',
          todo: await db.find('Todo', id)
        }
      ];
    default:
      return [];
    }
  }
}

const fastify = Fastify();
const processor = new TodoLoguxProcessor({
  controlUrl: 'https://example.logux.com',
  controlPassword: 'password'
});

fastify.post('/logux', ({ body }, reply) => {
  const stream = processor.streamForRequest(body);
  reply.send(stream);
});
```

## License

MIT License (see LICENSE for details).
