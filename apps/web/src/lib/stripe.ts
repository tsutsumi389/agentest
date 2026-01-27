import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Stripeインスタンスをシングルトンで初期化
export const stripePromise = publishableKey ? loadStripe(publishableKey) : null;
