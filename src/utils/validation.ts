import Joi from 'joi';
import { OrderType } from '../types';

export const orderSubmissionSchema = Joi.object({
  type: Joi.string().valid(...Object.values(OrderType)).required(),
  tokenIn: Joi.string().required().min(1).max(100),
  tokenOut: Joi.string().required().min(1).max(100),
  amountIn: Joi.number().positive().required(),
  amountOut: Joi.number().positive().when('type', {
    is: OrderType.LIMIT,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  targetPrice: Joi.number().positive().when('type', {
    is: OrderType.LIMIT,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  launchTime: Joi.string().isoDate().when('type', {
    is: OrderType.SNIPER,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  slippage: Joi.number().min(0).max(1).default(0.01),
  userId: Joi.string().optional()
});

export const orderIdSchema = Joi.object({
  orderId: Joi.string().uuid().required()
});

export function validateOrderSubmission(data: any) {
  return orderSubmissionSchema.validate(data);
}

export function validateOrderId(data: any) {
  return orderIdSchema.validate(data);
}
