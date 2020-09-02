import { Observable } from 'apollo-client/util/Observable';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type retryInput = {
  func(): boolean;
  timeoutMs: number;
  tick: number;
};
export async function retry(input: retryInput): Promise<void> {
  const { func, timeoutMs, tick } = input;
  let waited: number = 0;
  while (!func()) {
    if (waited >= timeoutMs) {
      throw Error(`retry gave up after ${timeoutMs} ms.`);
    }
    await sleep(tick);
    waited += tick;
  }
}

export async function start<T>(
  observable: Observable<{ data?: { [key: string]: T } }>,
) {
  const itemBuffer: T[] = [];
  const subscription = observable.subscribe(
    (msg) => {
      itemBuffer.push(Object.values(msg.data)[0]);
    },
    // eslint-disable-next-line no-console
    (err) => console.error('changedMessage Subscription Error', err),
    () => {
      // eslint-disable-next-line no-console
      console.log('changedMessage Subscription Complete');
    },
  );

  await sleep(300); // Wait for the subscription to hook up before sending a message

  return {
    next: async (timeoutMs: number = 1000, tick: number = 200) => {
      let item: T | undefined;
      await retry({
        func: () => {
          item = itemBuffer.shift();
          return !!item; // returns true if message is defined
        },
        timeoutMs,
        tick,
      });
      return item!;
    },
    unsub: () => {
      subscription.unsubscribe();
    },
  };
}
