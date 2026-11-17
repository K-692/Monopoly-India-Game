/**
 * Wire protocol between online clients and the browser host over Supabase Realtime broadcast.
 * Every message is a broadcast on the room channel; clients filter host messages by socket id.
 */

/** Client -> Host */
export type ClientToHostMessage =
  | {
      k: 'hello';
      sid: string;
      auth: { uid: string; token: string; displayName: string; avatarColor: string };
    }
  | { k: 'emit'; sid: string; ev: string; args: unknown[]; ack?: number }
  | { k: 'hb'; sid: string }
  | { k: 'bye'; sid: string };

/** Host -> Client(s) */
export type HostToClientMessage =
  | { k: 'welcome'; to: string[] }
  | { k: 'emit'; to: string[]; ev: string; args: unknown[] }
  | { k: 'ack'; to: string[]; ack: number; args: unknown[] }
  | { k: 'reset'; to: string[] }
  | { k: 'kick'; to: string[]; reason: string };

export const C2H_EVENT = 'c2h';
export const H2C_EVENT = 'h2c';

/** A remote socket with no traffic for this long is considered disconnected by the host. */
export const PEER_TIMEOUT_MS = 12000;
/** Client heartbeat interval. */
export const HEARTBEAT_MS = 3000;
