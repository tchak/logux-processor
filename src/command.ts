import Action from './action';
import Meta from './meta';

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
