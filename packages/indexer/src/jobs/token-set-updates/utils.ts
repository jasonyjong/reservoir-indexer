/* eslint-disable @typescript-eslint/no-explicit-any */

import { idb, ridb } from "@/common/db";
import _ from "lodash";
import {
  WebsocketEventKind,
  WebsocketEventRouter,
} from "@/jobs/websocket-events/websocket-event-router";
import { handleNewBuyOrderJob } from "@/jobs/update-attribute/handle-new-buy-order-job";
import { logger } from "@/common/logger";
import {
  topBidCollectionJob,
  TopBidCollectionJobPayload,
} from "@/jobs/collection-updates/top-bid-collection-job";

export type topBidPayload = {
  kind: string;
  tokenSetId: string;
  txHash: string | null;
  txTimestamp: number | null;
};

export async function processTopBid(payload: topBidPayload, queueName: string) {
  try {
    let tokenSetTopBid = await idb.manyOrNone(
      `
                          WITH x AS
              (SELECT token_sets.id AS token_set_id,
                      y.*,
                      z.*,
                      o.*
              FROM token_sets
              LEFT JOIN LATERAL
                (SELECT orders.id AS order_id,
                        orders.value,
                        orders.maker
                  FROM orders
                  WHERE orders.token_set_id = token_sets.id
                    AND orders.side = 'buy'
                    AND orders.fillability_status = 'fillable'
                    AND orders.approval_status = 'approved'
                    AND (orders.taker = '\\x0000000000000000000000000000000000000000'
                        OR orders.taker IS NULL)
                  ORDER BY orders.value DESC
                  LIMIT 1) y ON TRUE
              LEFT JOIN LATERAL
                (SELECT (CASE
                              WHEN $/tokenSetId/ LIKE 'token:%' THEN
                                    (SELECT collections.id
                                      FROM tokens
                                      JOIN collections ON tokens.collection_id = collections.id
                                      WHERE tokens.contract = decode(substring(split_part($/tokenSetId/, ':', 2)
                                                                              FROM 3), 'hex')
                                        AND tokens.token_id = (split_part($/tokenSetId/, ':', 3)::NUMERIC(78, 0)))
                              WHEN $/tokenSetId/ LIKE 'contract:%' THEN
                                    (SELECT collections.id
                                      FROM collections
                                      WHERE collections.id = substring($/tokenSetId/
                                                                      FROM 10))
                              WHEN $/tokenSetId/ LIKE 'range:%' THEN
                                    (SELECT collections.id
                                      FROM collections
                                      WHERE collections.id = substring($/tokenSetId/
                                                                      FROM 7))
                              WHEN $/tokenSetId/ LIKE 'list:%' THEN
                                    (SELECT CASE
                                                WHEN token_sets.collection_id IS NULL
                                                      AND token_sets.attribute_id IS NULL THEN
                                                        (SELECT NULL)
                                                WHEN token_sets.attribute_id IS NULL THEN
                                                        (SELECT collections.id
                                                        FROM collections
                                                        WHERE token_sets.collection_id = collections.id)
                                                ELSE
                                                        (SELECT collections.id
                                                        FROM attributes
                                                        JOIN attribute_keys ON attributes.attribute_key_id = attribute_keys.id
                                                        JOIN collections ON attribute_keys.collection_id = collections.id
                                                        WHERE token_sets.attribute_id = attributes.id)
                                            END
                                      FROM token_sets
                                      WHERE token_sets.id = $/tokenSetId/
                                      LIMIT 1)
                              WHEN $/tokenSetId/ LIKE 'dynamic:collection-non-flagged:%' THEN
                                    (SELECT collections.id
                                      FROM collections
                                      WHERE collections.id = substring($/tokenSetId/
                                                                      FROM 32))
                              ELSE NULL
                          END) AS "collectionId") o ON TRUE
              LEFT JOIN LATERAL
                (SELECT top_buy_value AS collection_top_buy_value
                  FROM collections
                  WHERE collections.id = o."collectionId" ) z ON TRUE
              WHERE token_sets.id = $/tokenSetId/ )
            UPDATE token_sets
            SET top_buy_id = x.order_id,
                top_buy_value = x.value,
                top_buy_maker = x.maker,
                attribute_id = token_sets.attribute_id,
                collection_id = token_sets.collection_id
            FROM x
            WHERE token_sets.id = x.token_set_id
              AND (token_sets.top_buy_id IS DISTINCT
                  FROM x.order_id
                  OR token_sets.top_buy_value IS DISTINCT
                  FROM x.value) RETURNING collection_id AS "collectionId",
                                          attribute_id AS "attributeId",
                                          top_buy_value AS "topBuyValue",
                                          top_buy_id AS "topBuyId",
                                          collection_top_buy_value AS "collectionTopBuyValue"
              `,
      { tokenSetId: payload.tokenSetId }
    );

    if (!tokenSetTopBid.length && payload.kind === "revalidation") {
      // When revalidating, force revalidation of the attribute / collection
      const tokenSetsResult = await ridb.manyOrNone(
        `
                  SELECT
                    token_sets.collection_id,
                    token_sets.attribute_id
                  FROM token_sets
                  WHERE token_sets.id = $/tokenSetId/
                `,
        {
          tokenSetId: payload.tokenSetId,
        }
      );

      if (tokenSetsResult.length) {
        tokenSetTopBid = tokenSetsResult.map(
          (result: { collection_id: any; attribute_id: any }) => ({
            kind: payload.kind,
            collectionId: result.collection_id,
            attributeId: result.attribute_id,
            txHash: payload.txHash || null,
            txTimestamp: payload.txTimestamp || null,
          })
        );
      }
    }

    if (tokenSetTopBid.length) {
      if (
        payload.kind === "new-order" &&
        tokenSetTopBid[0].topBuyId &&
        _.isNull(tokenSetTopBid[0].collectionId) &&
        tokenSetTopBid[0].topBuyValue > tokenSetTopBid[0].collectionTopBuyValue
      ) {
        //  Only trigger websocket event for non collection offers.
        await WebsocketEventRouter({
          eventKind: WebsocketEventKind.NewTopBid,
          eventInfo: {
            orderId: tokenSetTopBid[0].topBuyId,
          },
        });
      }

      for (const result of tokenSetTopBid) {
        if (!_.isNull(result.attributeId)) {
          await handleNewBuyOrderJob.addToQueue(result);
        }

        if (!_.isNull(result.collectionId)) {
          await topBidCollectionJob.addToQueue([
            {
              collectionId: result.collectionId,
              kind: payload.kind,
              txHash: payload.txHash || null,
              txTimestamp: payload.txTimestamp || null,
            } as TopBidCollectionJobPayload,
          ]);
        }
      }
    }
  } catch (error) {
    logger.error(
      queueName,
      `Failed to process token set top-bid info ${JSON.stringify(payload)}: ${error}`
    );
    throw error;
  }
}
