import {
  GQLOperation,
  GQLConnectionACK,
  GQLErrorEvent,
  GQLData,
  GQLComplete,
  GQLStopOperation,
  GQLConnectionInit,
  AppSyncStartAck,
  AppSyncErrorEvent,
  SERVER_EVENT_TYPES,
} from './protocol';

type AllowedProtocolEvents =
  | GQLOperation
  | GQLConnectionACK
  | GQLErrorEvent
  | GQLData
  | GQLComplete
  | GQLConnectionInit
  | GQLStopOperation
  | AppSyncStartAck
  | AppSyncErrorEvent;

export function formatMessage(event: AllowedProtocolEvents): string {
  return JSON.stringify(event);
}

export function formatErrorMessage(err: Error, isAppSync?: boolean) {
  return formatMessage(
    isAppSync
      ? {
          type: SERVER_EVENT_TYPES.GQL_ERROR,
          payload: {
            errors: [
              { errorType: err.name ?? 'unknown', message: err.message },
            ],
          },
        }
      : {
          type: SERVER_EVENT_TYPES.GQL_ERROR,
          payload: { message: err.message },
        },
  );
}
