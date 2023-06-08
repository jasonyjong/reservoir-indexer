/* eslint-disable @typescript-eslint/no-explicit-any */

import * as Boom from "@hapi/boom";
import { Request, RouteOptions } from "@hapi/hapi";
import Joi from "joi";

import { config } from "@/config/index";
import { redis } from "@/common/redis";
import { Channel } from "@/pubsub/channels";
import _ from "lodash";
import { getNetworkName } from "@/config/network";

export const postResumeRabbitQueueOptions: RouteOptions = {
  description: "Resume rabbit queue",
  tags: ["api", "x-admin"],
  validate: {
    headers: Joi.object({
      "x-admin-api-key": Joi.string().required(),
    }).options({ allowUnknown: true }),
    payload: Joi.object({
      queueName: Joi.string().description("The queue name to resume").required(),
    }),
  },
  handler: async (request: Request) => {
    if (request.headers["x-admin-api-key"] !== config.adminApiKey) {
      throw Boom.unauthorized("Wrong or missing admin API key");
    }

    const payload = request.payload as any;
    if (!_.startsWith(payload.queueName, `${getNetworkName()}.`)) {
      payload.queueName = `${getNetworkName()}.${payload.queueName}`;
    }

    await redis.publish(
      Channel.ResumeRabbitConsumerQueue,
      JSON.stringify({ queueName: payload.queueName })
    );

    return { message: `${payload.queueName} resumed` };
  },
};