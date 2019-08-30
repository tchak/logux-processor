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
