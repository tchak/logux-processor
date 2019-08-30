import fetch from 'node-fetch';
import { Readable } from 'stream';

export enum Command {
  Auth = 'auth',
  Action = 'action',
  Error = 'error',
  Authenticated = 'authenticated',
  Denied = 'enied',
  Resend = 'resend',
  Approved = 'approved',
  Processed = 'processed',
  Forbidden = 'forbidden',
  UnknownAction = 'unknownAction',
  UnknownChannel = 'unknownChannel'
}

export type ActionCommand = [Command.Action, Action, Meta];
export type ApprovedCommand = [Command.Approved, string];
export type AuthCommand = [Command.Auth, string, string, string];
export type AuthenticatedCommand = [Command.Authenticated, string];
export type DeniedCommand = [Command.Denied, string];
export type ErrorCommand = [Command.Error, string];
export type ForbiddenCommand = [Command.Forbidden, string];
export type ProcessedCommand = [Command.Processed, string];
export type ResendCommand = [Command.Resend, string, Partial<Meta>];
export type UnknownActionCommand = [Command.UnknownAction, string];
export type UnknownChannelCommand = [Command.UnknownChannel, string];

export type OutputCommand =
  | ApprovedCommand
  | AuthenticatedCommand
  | DeniedCommand
  | ErrorCommand
  | ForbiddenCommand
  | ProcessedCommand
  | ResendCommand
  | UnknownActionCommand
  | UnknownChannelCommand;
export type InputCommand = AuthCommand | ActionCommand;

export function isAuthCommand(command: InputCommand): command is AuthCommand {
  return command[0] === Command.Auth;
}

export function isActionCommand(
  command: InputCommand
): command is ActionCommand {
  return command[0] === Command.Action;
}

export interface Meta {
  id: string;
  subprotocol: string;
  time: number;
  status: 'waiting' | 'processed' | 'error';
  server: string;

  channels?: string[];
  users?: string[];
  clients?: string[];
  nodes?: string[];
  reasons?: string[];
}

export interface Action {
  type: string;
}

export interface SubscribeAction extends Action {
  type: 'logux/subscribe';
  channel: string;
}

export function isActionOfType<A extends Action>(
  action: Action,
  type: string
): action is A {
  return action.type === type;
}

export function isSubscribeAction(action: Action): action is SubscribeAction {
  return isActionOfType<SubscribeAction>(action, 'logux/subscribe');
}

export class Context {
  nodeId: string;
  userId: string;
  clientId: string;
  data: unknown;

  constructor(meta: Meta) {
    const parts = meta.id.split(' ')[1].split(':');

    this.nodeId = parts.join(':');
    this.userId = parts[0];
    this.clientId = parts.slice(0, 2).join(':');
  }

  get isServer() {
    return this.userId === 'server';
  }
}

export class Stream extends Readable {
  private _started = false;

  constructor() {
    super();
    this.push('[');
  }

  _read() {}

  add(command: OutputCommand) {
    const chunk = JSON.stringify(command);
    if (this._started) {
      this.push(`,${chunk}`);
    } else {
      this.push(`${chunk}`);
      this._started = true;
    }
  }

  end() {
    this.push(']');
    this.push(null);
  }
}

export class Unauthorized extends Error {
  statusCode = 401;

  constructor() {
    super('Unauthorized');
  }
}

export class NotAcceptable extends Error {
  statusCode = 406;

  constructor() {
    super('Not Acceptable');
  }
}

export class NotImplemented extends Error {
  statusCode = 501;

  constructor() {
    super('Not Implemented');
  }
}

export interface LoguxRequest {
  version: number;
  password: string;
  commands: InputCommand[];
}

export interface LoguxProcessorSettings {
  controlUrl: string;
  controlPassword: string;
  version?: number;
}

export default class LoguxProcessor {
  controlUrl: string;
  controlPassword: string;
  version: number;

  constructor(settings: LoguxProcessorSettings) {
    this.controlUrl = settings.controlUrl;
    this.controlPassword = settings.controlPassword;
    this.version = settings.version || 2;
  }

  protected async auth(
    _userId: string,
    _credentials: string
  ): Promise<boolean> {
    throw new NotImplemented();
  }

  protected async access(
    _context: Context,
    _action: Action,
    _meta: Meta
  ): Promise<boolean> {
    throw new NotImplemented();
  }

  protected async isValidAction(
    _context: Context,
    _action: Action,
    _meta: Meta
  ): Promise<boolean> {
    throw new NotImplemented();
  }

  protected async resend(
    _context: Context,
    _action: Action,
    _meta: Meta
  ): Promise<Partial<Meta> | false> {
    return false;
  }

  protected async process(
    _context: Context,
    _action: Action,
    _meta: Meta
  ): Promise<void> {
    throw new NotImplemented();
  }

  protected async isValidChannel(
    _context: Context,
    _channel: string,
    _meta: Meta
  ): Promise<boolean> {
    throw new NotImplemented();
  }

  protected async subscribe(
    context: Context,
    channel: string,
    meta: Meta
  ): Promise<void> {
    const commands = await this.getInitialData(context, channel, meta);
    if (commands.length) {
      await this.send(commands);
    }
  }

  protected async getInitialData(
    _context: Context,
    _channel: string,
    _meta: Meta
  ): Promise<ActionCommand[]> {
    return [];
  }

  protected createContext(meta: Meta): Context {
    return new Context(meta);
  }

  streamForRequest(request: LoguxRequest): Stream {
    if (!request.version || this.version !== request.version) {
      throw new NotAcceptable();
    }
    if (this.controlPassword !== request.password) {
      throw new Unauthorized();
    }

    const stream = new Stream();

    if (request.commands.length) {
      this.processBatch(stream, request.commands).finally(() => stream.end());
    } else {
      stream.end();
    }

    return stream;
  }

  send(commands: ActionCommand[]): Promise<boolean> {
    const body = {
      version: this.version,
      password: this.controlPassword,
      commands
    };

    return fetch(this.controlUrl, {
      method: 'post',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(() => true);
  }

  protected async processBatch(
    stream: Stream,
    commands: InputCommand[]
  ): Promise<void> {
    for (let command of commands) {
      if (isAuthCommand(command)) {
        await this.processAuth(stream, command[1], command[2], command[3]);
      } else if (isActionCommand(command)) {
        await this.processAction(stream, command[1], command[2]);
      } else {
        stream.add([Command.Error, 'Unknown command']);
        break;
      }
    }
  }

  protected async processAuth(
    stream: Stream,
    userId: string,
    credentials: string,
    authId: string
  ): Promise<void> {
    if (await this.auth(userId, credentials)) {
      stream.add([Command.Authenticated, authId]);
    } else {
      stream.add([Command.Denied, authId]);
    }
  }

  protected async processAction(
    stream: Stream,
    action: Action,
    meta: Meta
  ): Promise<void> {
    const context = this.createContext(meta);

    if (isSubscribeAction(action)) {
      if (await this.isValidChannel(context, action.channel, meta)) {
        await this.subscribeOrProcess(stream, context, action, meta);
      } else {
        stream.add([Command.UnknownChannel, meta.id]);
      }
    } else if (await this.isValidAction(context, action, meta)) {
      const resendTo = await this.resend(context, action, meta);

      if (resendTo) {
        stream.add([Command.Resend, meta.id, resendTo]);
      }
      await this.subscribeOrProcess(stream, context, action, meta);
    } else {
      stream.add([Command.UnknownAction, meta.id]);
    }
  }

  protected async subscribeOrProcess(
    stream: Stream,
    context: Context,
    action: Action,
    meta: Meta
  ): Promise<void> {
    if (await this.access(context, action, meta)) {
      stream.add([Command.Approved, meta.id]);
      try {
        if (isSubscribeAction(action)) {
          await this.subscribe(context, action.channel, meta);
        } else {
          await this.process(context, action, meta);
        }
        stream.add([Command.Processed, meta.id]);
      } catch (error) {
        stream.add([Command.Error, error.message]);
      }
    } else {
      stream.add([Command.Forbidden, meta.id]);
    }
  }
}
