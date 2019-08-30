import { Readable } from 'stream';

import { OutputCommand } from './command';

export default class Stream extends Readable {
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
