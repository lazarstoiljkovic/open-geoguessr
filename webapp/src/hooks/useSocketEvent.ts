import { useEffect } from 'react';
import socket from '../modules/socket';

export default function useSocketEvent<T>(event: string, handler: (data: T) => void): void {
  useEffect(() => {
    return socket.on(event, handler as (data: unknown) => void);
  }, [event, handler]);
}
