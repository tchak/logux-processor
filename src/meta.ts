export default interface Meta {
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
