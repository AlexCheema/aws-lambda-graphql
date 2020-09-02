import gql from 'graphql-tag';
import WebSocket from 'ws';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import { ApolloLink } from 'apollo-link';
import { createSubscriptionHandshakeLink } from 'aws-appsync-subscription-link';
import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { TestLambdaServer } from '../fixtures/server';
import { execute } from '../fixtures/helpers';
import { start, sleep } from './AppSyncClientUtil';

require('isomorphic-fetch');
// @ts-ignore
global.WebSocket = require('ws');

describe('apollo client integration test', () => {
  let server: TestLambdaServer;

  beforeEach(async () => {
    server = new TestLambdaServer({
      port: 3003,
      useAppSync: true,
    });

    await server.start();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('connect', () => {
    it('connects to server', (done) => {
      const link = ApolloLink.from([
        createSubscriptionHandshakeLink({
          url: 'http://localhost:3003',
          region: 'us-east-1',
          auth: {
            type: 'API_KEY',
            apiKey: '',
          },
        }),
      ]);

      const client = new ApolloClient({
        cache: new InMemoryCache(),
        link,
      });

      const sub = client.subscribe({
        query: gql`
          subscription Test($authorId: ID!) {
            textFeed(authorId: $authorId)
          }
        `,
        variables: {
          authorId: 'Michael Morpurgo',
        },
      });

      expect(sub).toBeDefined();
      done();
    });
  });

  describe('subscriptions', () => {
    it('streams results from a subscription', async () => {
      const mutationClient = new SubscriptionClient(
        'ws://localhost:3003',
        {},
        WebSocket as any,
      );

      const link1 = ApolloLink.from([
        createSubscriptionHandshakeLink({
          url: 'http://localhost:3003',
          region: 'us-east-1',
          auth: {
            type: 'API_KEY',
            apiKey: '',
          },
        }),
      ]);
      const client1 = new ApolloClient({
        cache: new InMemoryCache(),
        link: link1,
      });

      const link2 = ApolloLink.from([
        createSubscriptionHandshakeLink({
          url: 'http://localhost:3003',
          region: 'us-east-1',
          auth: {
            type: 'API_KEY',
            apiKey: '',
          },
        }),
      ]);
      const client2 = new ApolloClient({
        cache: new InMemoryCache(),
        link: link2,
      });

      const o1 = await start<{ authorId: string; text: string }>(
        client1.subscribe({
          query: gql`
            subscription Test($authorId: ID!) {
              textFeed(authorId: $authorId)
            }
          `,
          variables: {
            authorId: '1',
          },
        }),
      );
      const o2 = await start<{ authorId: string; text: string }>(
        client2.subscribe({
          query: gql`
            subscription Test($authorId: ID!) {
              textFeed(authorId: $authorId)
            }
          `,
          variables: {
            authorId: '2',
          },
        }),
      );

      // now publish all messages
      await Promise.all(
        [
          ['1', 'Test1'],
          ['2', 'Test2'],
          ['1', 'Test3'],
          ['2', 'Test4'],
        ].map(([authorId, text]) =>
          execute({
            client: mutationClient,
            query: gql`
              mutation publish($authorId: ID!, $text: String!) {
                testPublish(authorId: $authorId, text: $text)
              }
            `,
            variables: {
              authorId,
              text,
            },
          }),
        ),
      );

      // wait for event processor to process events
      await sleep(500);

      expect(await o1.next()).toEqual('Test1');
      expect(await o1.next()).toEqual('Test3');

      expect(await o2.next()).toEqual('Test2');
      expect(await o2.next()).toEqual('Test4');
    }, 30000);
  });
});
