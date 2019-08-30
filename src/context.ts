import Meta from './meta';

export default class Context {
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
