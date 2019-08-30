import LoguxProcessor, {
  Stream,
  OutputCommand,
  Context,
  Action,
  Meta,
  Command,
  ResendCommand,
  AuthenticatedCommand,
  SubscribeAction
} from '../src';

QUnit.config.testTimeout = 1000;

QUnit.module('LoguxProcessor', function() {
  let processor: LoguxProcessor;
  let stream: Stream;
  let actionMeta: Meta;
  let subscribeMeta: Meta;

  const user = {
    id: 'userId',
    token: 'token'
  };

  function read(stream: Stream): Promise<OutputCommand[]> {
    return new Promise(resolve => {
      let result = '';
      stream.on('data', chunk => {
        result += chunk;
      });
      stream.on('end', () => {
        resolve(JSON.parse(result));
      });
    });
  }

  let i = 0;
  function createMeta(): Meta {
    return {
      id: `${i++} ${user.id}:2:3 123`,
      subprotocol: '2',
      time: 123,
      status: 'waiting',
      server: 'server'
    };
  }

  QUnit.module('base', function(hooks) {
    hooks.beforeEach(function() {
      processor = new LoguxProcessor({
        controlUrl: 'test',
        controlPassword: 'password'
      });
    });

    QUnit.test('it exists', function(assert) {
      assert.ok(processor);
      assert.ok(processor instanceof LoguxProcessor);
    });

    QUnit.test('check password', function(assert) {
      assert.throws(
        () => {
          stream = processor.streamForRequest({
            version: 2,
            password: 'yolo',
            commands: []
          });
          read(stream);
        },
        undefined,
        'Unauthorized'
      );
    });

    QUnit.test('check version', function(assert) {
      assert.throws(
        () => {
          stream = processor.streamForRequest({
            version: 1,
            password: 'password',
            commands: []
          });
          read(stream);
        },
        undefined,
        'Not Acceptable'
      );
    });

    QUnit.test('empty stream', async function(assert) {
      stream = processor.streamForRequest({
        version: 2,
        password: 'password',
        commands: []
      });
      const commands = await read(stream);
      assert.equal(commands.length, 0);
    });
  });

  QUnit.module('base', function(hooks) {
    let processed: string[] = [];
    class TestLoguxProcessor extends LoguxProcessor {
      async auth(userId: string, credentials: string) {
        return userId === user.id && credentials === user.token;
      }

      async access(context: Context, action: Action, meta: Meta) {
        if (context.userId !== user.id) {
          return false;
        }
        if (action.type === 'action/test') {
          return meta.id === actionMeta.id;
        } else {
          return meta.id === subscribeMeta.id;
        }
      }

      async isValidAction(context: Context, action: Action, meta: Meta) {
        return (
          context.userId === user.id &&
          action.type === 'action/test' &&
          meta.id === actionMeta.id
        );
      }

      async isValidChannel(context: Context, channel: string, meta: Meta) {
        return (
          context.userId === user.id &&
          channel === 'channel/test' &&
          meta.id === subscribeMeta.id
        );
      }

      async process(context: Context, action: Action, meta: Meta) {
        if (context.userId === user.id && action.type === 'action/test') {
          processed.push(meta.id);
        }
      }

      async resend(context: Context, action: Action, _meta: Meta) {
        if (context.userId === user.id && action.type === 'action/test') {
          return { channels: ['channel/test'] };
        }
        return {};
      }
    }

    hooks.beforeEach(async function() {
      processed = [];
      processor = new TestLoguxProcessor({
        controlUrl: 'test',
        controlPassword: 'password'
      });
    });

    QUnit.test('process', async function(assert) {
      actionMeta = createMeta();
      subscribeMeta = createMeta();
      let subscribeAction: SubscribeAction = {
        type: 'logux/subscribe',
        channel: 'channel/test'
      };

      stream = processor.streamForRequest({
        version: 2,
        password: 'password',
        commands: [
          [Command.Auth, user.id, user.token, 'authId'],
          [Command.Action, { type: 'action/test' }, actionMeta],
          [Command.Action, subscribeAction, subscribeMeta]
        ]
      });
      const commands = await read(stream);
      assert.equal(commands.length, 6);
      assert.deepEqual(commands.map(command => command[0]), [
        Command.Authenticated,
        Command.Resend,
        Command.Approved,
        Command.Processed,
        Command.Approved,
        Command.Processed
      ]);
      assert.equal(processed.length, 1);
      assert.equal(processed[0], actionMeta.id);

      const authCmd = commands[0] as AuthenticatedCommand;
      assert.equal(authCmd[1], 'authId');

      const resendCmd = commands[1] as ResendCommand;
      assert.deepEqual(resendCmd[2], { channels: ['channel/test'] });
    });
  });
});
